jest.mock('react-native', () => {
    const actual = jest.requireActual('react-native');
    return {
        Alert: actual.Alert,
        DeviceEventEmitter: actual.DeviceEventEmitter,
        NativeEventEmitter: actual.NativeEventEmitter,
        NativeModules: actual.NativeModules,
        Platform: { ...actual.Platform, OS: 'android' }
    };
});
jest.mock('react-native-device-info', () => ({
    getTotalMemory: jest.fn().mockResolvedValue(8000000000)
}));

// Both randomness APIs use the same fixture so these behavior tests survive
// replacing react-native-securerandom with crypto.getRandomValues (#4099).
// Keep the old module virtual so the tests also run after it is uninstalled.
jest.mock(
    'react-native-securerandom',
    () => ({
        generateSecureRandom: async (length: number) => mockRandomBytes(length)
    }),
    { virtual: true }
);
jest.mock('../lndmobile/log', () => () => ({
    d: jest.fn(),
    i: jest.fn(),
    w: jest.fn(),
    e: jest.fn()
}));
jest.mock('../lndmobile/index', () => ({}));
jest.mock('../lndmobile/LndMobileInjection', () => ({
    index: {
        writeConfig: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        startLnd: jest.fn().mockResolvedValue(undefined),
        subscribeState: jest.fn(),
        decodeState: jest.fn()
    },
    wallet: {
        genSeed: jest.fn(),
        initWallet: jest.fn(async () => mockWallet),
        unlockWallet: jest.fn()
    }
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: {
        settings: { neutrinoPeersMainnet: [] },
        embeddedLndStarted: false,
        walletJustCreated: false
    },
    syncStore: {}
}));
jest.mock('../stores/SettingsStore', () => ({
    DEFAULT_NEUTRINO_PEERS_MAINNET: [],
    SECONDARY_NEUTRINO_PEERS_MAINNET: [],
    DEFAULT_NEUTRINO_PEERS_TESTNET: [],
    DEFAULT_FEE_ESTIMATOR: 'https://example.com/fees',
    DEFAULT_SPEEDLOADER: 'https://example.com/graph'
}));
jest.mock('./LocaleUtils', () => ({ localeString: (key: string) => key }));
jest.mock('./ChannelMigrationUtils', () => ({ importChannelDb: jest.fn() }));
jest.mock('./SleepUtils', () => ({
    ...jest.requireActual('./SleepUtils'),
    sleep: jest.fn().mockResolvedValue(undefined)
}));

import lndMobile from '../lndmobile/LndMobileInjection';
import { lnrpc } from '../proto/lightning';
import { settingsStore } from '../stores/Stores';
import { createLndWallet, LndMobileEventEmitter } from './LndMobileUtils';

const mockRandomBytes = jest.fn<Uint8Array, [number]>();
const entropy = Uint8Array.from(
    Buffer.from(
        '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d80ff',
        'hex'
    )
);
const password = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdgP8=';
const seed = new lnrpc.GenSeedResponse({
    cipher_seed_mnemonic: Array(24).fill('abandon')
});
const mockWallet = new lnrpc.InitWalletResponse({
    admin_macaroon: Uint8Array.of(1, 2, 3)
});

describe('createLndWallet password generation', () => {
    const originalCrypto = Object.getOwnPropertyDescriptor(
        globalThis,
        'crypto'
    );

    beforeEach(() => {
        jest.clearAllMocks();
        mockRandomBytes.mockReset().mockReturnValue(entropy.slice());
        settingsStore.embeddedLndStarted = false;
        settingsStore.walletJustCreated = false;

        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: {
                getRandomValues: (array: Uint8Array) => {
                    expect(array).toBeInstanceOf(Uint8Array);
                    array.set(mockRandomBytes(array.byteLength));
                    return array;
                }
            }
        });
        jest.mocked(lndMobile.wallet.genSeed).mockResolvedValue(seed);
        jest.mocked(lndMobile.index.decodeState).mockReturnValue(
            new lnrpc.SubscribeStateResponse({
                state: lnrpc.WalletState.NON_EXISTING
            })
        );
        jest.mocked(lndMobile.index.subscribeState).mockImplementation(
            async () => {
                LndMobileEventEmitter.emit('SubscribeState', { data: '' });
                return '';
            }
        );
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        LndMobileEventEmitter.removeAllListeners('SubscribeState');
        jest.restoreAllMocks();
        if (originalCrypto) {
            Object.defineProperty(globalThis, 'crypto', originalCrypto);
        } else {
            Reflect.deleteProperty(globalThis, 'crypto');
        }
    });

    it('passes all 32 random bytes as a Base64 password and returns that password', async () => {
        const result = await createLndWallet({ lndDir: 'new-wallet' });

        expect(mockRandomBytes).toHaveBeenCalledTimes(1);
        expect(mockRandomBytes).toHaveBeenCalledWith(32);
        expect(lndMobile.wallet.initWallet).toHaveBeenCalledTimes(1);
        expect(lndMobile.wallet.initWallet).toHaveBeenCalledWith(
            seed.cipher_seed_mnemonic,
            password,
            undefined,
            undefined,
            undefined
        );
        expect(result).toEqual({
            wallet: mockWallet,
            seed,
            randomBase64: password
        });
    });

    it('requests fresh entropy for each wallet instead of reusing a password', async () => {
        mockRandomBytes
            .mockReturnValueOnce(entropy.slice())
            .mockReturnValueOnce(entropy.slice().reverse());

        const first = await createLndWallet({ lndDir: 'first-wallet' });
        const second = await createLndWallet({ lndDir: 'second-wallet' });

        expect(mockRandomBytes.mock.calls).toEqual([[32], [32]]);
        expect(first.randomBase64).toBe(password);
        expect(second.randomBase64).toBe(
            '/4AdHBsaGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQA='
        );
        expect(lndMobile.wallet.initWallet).toHaveBeenNthCalledWith(
            2,
            seed.cipher_seed_mnemonic,
            second.randomBase64,
            undefined,
            undefined,
            undefined
        );
    });

    it.each([undefined, 'aezeed-passphrase'])(
        'generates a new encryption password during recovery (seed passphrase: %s)',
        async (walletPassphrase) => {
            const seedMnemonic = Array(24).fill('ability').join(' ');
            const channelBackupsBase64 = 'AQID';
            const result = await createLndWallet({
                lndDir: 'restored-wallet',
                seedMnemonic,
                walletPassphrase,
                channelBackupsBase64
            });

            expect(lndMobile.wallet.genSeed).not.toHaveBeenCalled();
            expect(mockRandomBytes).toHaveBeenCalledTimes(1);
            expect(mockRandomBytes).toHaveBeenCalledWith(32);
            expect(lndMobile.wallet.initWallet).toHaveBeenCalledWith(
                seedMnemonic.split(' '),
                password,
                500,
                channelBackupsBase64,
                walletPassphrase
            );
            expect(result.randomBase64).toBe(password);
        }
    );

    it.each([
        { flow: 'creation', seedMnemonic: undefined },
        { flow: 'recovery', seedMnemonic: Array(24).fill('ability').join(' ') }
    ])(
        'does not initialize a wallet when randomness fails during $flow',
        async ({ seedMnemonic }) => {
            const error = new Error('Secure randomness unavailable');
            mockRandomBytes.mockImplementation(() => {
                throw error;
            });

            await expect(
                createLndWallet({ lndDir: 'failed-wallet', seedMnemonic })
            ).rejects.toBe(error);

            expect(mockRandomBytes).toHaveBeenCalledTimes(1);
            expect(lndMobile.wallet.initWallet).not.toHaveBeenCalled();
            expect(settingsStore.embeddedLndStarted).toBe(false);
            expect(settingsStore.walletJustCreated).toBe(false);
        }
    );
});
