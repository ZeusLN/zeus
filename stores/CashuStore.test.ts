jest.mock('./Stores', () => ({}));
jest.mock('./SettingsStore', () => ({
    DEFAULT_NOSTR_RELAYS: [
        'wss://relay.one',
        'wss://relay.two',
        'wss://relay.three',
        'wss://relay.four'
    ]
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@nostr-dev-kit/ndk', () => ({
    __esModule: true,
    default: jest.fn()
}));
jest.mock('../utils/NostrUtils', () => ({}));
jest.mock('../utils/NostrMintBackup', () => ({}));
jest.mock('../utils/MigrationUtils', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
jest.mock('../NavigationService', () => ({}));
jest.mock('../cashu-cdk', () => ({
    isAvailable: jest.fn(() => true),
    initializeWallet: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../storage', () => ({
    setItem: jest.fn().mockResolvedValue(true),
    getRawItem: jest.fn(),
    KEY_PREFIX: 'zeus:'
}));

import { Platform } from 'react-native';
import { validateMnemonic } from '@scure/bip39';
import NDK from '@nostr-dev-kit/ndk';
import CashuStore from './CashuStore';
import Storage, { getRawItem } from '../storage';
import CashuDevKit from '../cashu-cdk';
import { BIP39_WORD_LIST } from '../utils/Bip39Utils';

// BIP-39 zero-entropy test vector, never a real wallet.
const mnemonic = `${'abandon '.repeat(11)}about`;
const words = mnemonic.split(' ');
const newStore = () =>
    new CashuStore(
        { implementation: 'lnd' } as any,
        {} as any,
        {} as any,
        {} as any
    );

describe('CashuStore synchronizable seed recovery', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Platform.OS = 'ios';
        (getRawItem as jest.Mock).mockReset();
        (Storage.setItem as jest.Mock).mockReset().mockResolvedValue(true);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('aborts on a read failure and recovers the original seed on retry', async () => {
        const store = newStore();
        (getRawItem as jest.Mock)
            .mockRejectedValueOnce(new Error('keychain unavailable'))
            .mockResolvedValueOnce(JSON.stringify(words));

        expect(await store.initializeCDK()).toBe(false);
        expect(store.seedPhrase).toBeUndefined();
        expect(store.cdkInitialized).toBe(false);
        expect(Storage.setItem).not.toHaveBeenCalled();
        expect(CashuDevKit.initializeWallet).not.toHaveBeenCalled();

        expect(await store.initializeCDK()).toBe(true);
        expect(getRawItem).toHaveBeenCalledWith(
            'zeus:lnd-cashu-seed-phrase',
            true
        );
        expect(store.seedPhrase).toEqual(words);
        expect(Storage.setItem).toHaveBeenCalledWith(
            'lnd-cashu-seed-phrase',
            words
        );
        expect(Storage.setItem).toHaveBeenCalledWith(
            'lnd-cashu-seed-version',
            'v2-bip39'
        );
        expect(CashuDevKit.initializeWallet).toHaveBeenCalledTimes(1);
        expect(CashuDevKit.initializeWallet).toHaveBeenCalledWith(
            mnemonic,
            'sat'
        );
    });

    it.each([
        '',
        'invalid json',
        'null',
        '{}',
        '[]',
        JSON.stringify(mnemonic),
        JSON.stringify([...words.slice(0, 11), 'abandon']),
        JSON.stringify(words.map((word) => [word]))
    ])('does not replace malformed stored seed %p', async (stored) => {
        (getRawItem as jest.Mock).mockResolvedValue(stored);
        const store = newStore();

        expect(await store.initializeCDK()).toBe(false);
        expect(store.seedPhrase).toBeUndefined();
        expect(Storage.setItem).not.toHaveBeenCalled();
        expect(CashuDevKit.initializeWallet).not.toHaveBeenCalled();
    });

    it('generates a new seed only after a confirmed miss', async () => {
        (getRawItem as jest.Mock).mockResolvedValue(null);
        const store = newStore();

        expect(await store.initializeCDK()).toBe(true);
        const generated = store.seedPhrase!.join(' ');
        expect(validateMnemonic(generated, BIP39_WORD_LIST)).toBe(true);
        expect(Storage.setItem).toHaveBeenCalledWith(
            'lnd-cashu-seed-phrase',
            store.seedPhrase
        );
        expect(Storage.setItem).toHaveBeenCalledWith(
            'lnd-cashu-seed-version',
            'v2-bip39'
        );
        expect(CashuDevKit.initializeWallet).toHaveBeenCalledWith(
            generated,
            'sat'
        );
    });

    it('keeps using the recovered seed if local persistence fails', async () => {
        (getRawItem as jest.Mock).mockResolvedValue(JSON.stringify(words));
        (Storage.setItem as jest.Mock).mockRejectedValue(
            new Error('write unavailable')
        );
        const store = newStore();

        expect(await store.initializeCDK()).toBe(true);
        expect(store.seedPhrase).toEqual(words);
        expect(CashuDevKit.initializeWallet).toHaveBeenCalledWith(
            mnemonic,
            'sat'
        );
    });

    it('does not consult the sync partition when a local seed is loaded', async () => {
        const store = newStore();
        store.seedPhrase = words;
        store.seedVersion = 'v2-bip39';

        expect(await store.initializeCDK()).toBe(true);
        expect(getRawItem).not.toHaveBeenCalled();
        expect(Storage.setItem).not.toHaveBeenCalled();
        expect(CashuDevKit.initializeWallet).toHaveBeenCalledWith(
            mnemonic,
            'sat'
        );
    });

    it('does not read the sync partition on Android', async () => {
        Platform.OS = 'android';

        expect(await newStore().initializeCDK()).toBe(true);
        expect(getRawItem).not.toHaveBeenCalled();
        expect(CashuDevKit.initializeWallet).toHaveBeenCalledTimes(1);
    });
});

describe('CashuStore checkAndSweepMints', () => {
    const storeWith = (settings: any) => {
        const store = new CashuStore(
            { settings } as any,
            {} as any,
            { channels: [{}] } as any,
            {} as any
        );
        store.mintUrls = ['https://mint.example.com'];
        store.mintBalances = { 'https://mint.example.com': 50000 };
        const sweepMint = jest
            .spyOn(store, 'sweepMint')
            .mockResolvedValue(undefined as any);
        return { store, sweepMint };
    };

    afterEach(() => jest.restoreAllMocks());

    it('does nothing when settings have no ecash key', async () => {
        const { store, sweepMint } = storeWith({});
        await expect(store.checkAndSweepMints()).resolves.toBeUndefined();
        expect(sweepMint).not.toHaveBeenCalled();
    });

    it('does nothing when automatic sweep is off', async () => {
        const { store, sweepMint } = storeWith({
            ecash: { automaticallySweep: false, sweepThresholdSats: 10000 }
        });
        await store.checkAndSweepMints();
        expect(sweepMint).not.toHaveBeenCalled();
    });

    it('sweeps a mint whose balance exceeds the threshold', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        const { store, sweepMint } = storeWith({
            ecash: { automaticallySweep: true, sweepThresholdSats: 10000 }
        });
        await store.checkAndSweepMints();
        expect(sweepMint).toHaveBeenCalledWith('https://mint.example.com');
    });
});

describe('CashuStore NDK instance', () => {
    const MockNDK = NDK as unknown as jest.Mock;
    let connect: jest.Mock;
    let connectedRelays: jest.Mock;
    let instances: any[];

    beforeEach(() => {
        connect = jest.fn().mockResolvedValue(undefined);
        connectedRelays = jest.fn(() => [{}]);
        instances = [];
        MockNDK.mockReset().mockImplementation(() => {
            const relays = new Set([
                'wss://relay.one',
                'wss://relay.two',
                'wss://relay.three',
                'wss://relay.four'
            ]);
            const instance = {
                connect,
                pool: {
                    connectedRelays,
                    urls: jest.fn(() => Array.from(relays)),
                    removeRelay: jest.fn((url: string) => relays.delete(url))
                },
                // Emit a single EOSE right away, as NDKSubscription does
                // once per subscription.
                subscribe: jest.fn(() => ({
                    on: (event: string, cb: () => void) => {
                        if (event === 'eose') cb();
                    },
                    stop: jest.fn()
                })),
                fetchEvents: jest.fn().mockResolvedValue(new Set())
            };
            instances.push(instance);
            return instance;
        });
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('opts out of the outbox model and connects with a timeout', async () => {
        await newStore().fetchMints();

        expect(MockNDK).toHaveBeenCalledWith({
            explicitRelayUrls: [
                'wss://relay.one',
                'wss://relay.two',
                'wss://relay.three',
                'wss://relay.four'
            ],
            enableOutboxModel: false
        });
        expect(connect).toHaveBeenCalledWith(2000);
    });

    it('disconnects the instance when discovery finishes', async () => {
        const store = newStore() as any;

        await store.fetchMints();

        expect(instances).toHaveLength(1);
        expect(instances[0].pool.removeRelay).toHaveBeenCalledTimes(4);
        expect(instances[0].pool.urls()).toEqual([]);
        expect(store.ndk).toBeUndefined();
        expect(store.error).toBe(false);

        // The next discovery starts with a fresh instance.
        await store.fetchMints();
        expect(MockNDK).toHaveBeenCalledTimes(2);
        expect(connect).toHaveBeenCalledTimes(2);
    });

    it('keeps the instance while another discovery still uses it', async () => {
        let finishFetch!: (events: Set<any>) => void;
        const store = newStore() as any;
        store.validateNpub = () => 'ab'.repeat(32);
        const ndk = await store.getNdk();
        ndk.fetchEvents.mockReturnValueOnce(
            new Promise((resolve) => (finishFetch = resolve))
        );

        const trusted = store.fetchMintsFromFollows();
        await store.fetchMints();

        expect(ndk.pool.removeRelay).not.toHaveBeenCalled();
        expect(store.ndk).toBe(ndk);

        finishFetch(new Set());
        await trusted;

        expect(ndk.pool.removeRelay).toHaveBeenCalledTimes(4);
        expect(store.ndk).toBeUndefined();
        expect(MockNDK).toHaveBeenCalledTimes(1);
    });

    it('disconnects the instance on reset', async () => {
        const store = newStore() as any;
        store.stopConnectivityMonitoring = jest.fn();
        const ndk = await store.getNdk();

        store.reset();

        expect(ndk.pool.removeRelay).toHaveBeenCalledTimes(4);
        expect(store.ndk).toBeUndefined();
        await expect(store.getNdk()).resolves.not.toBe(ndk);
        expect(MockNDK).toHaveBeenCalledTimes(2);
    });

    it('does not fetch when no relay connected', async () => {
        connectedRelays.mockReturnValue([]);
        const store = newStore() as any;
        store.validateNpub = () => 'ab'.repeat(32);

        await store.fetchMintsFromFollows();

        expect(instances[0].fetchEvents).not.toHaveBeenCalled();
        expect(instances[0].pool.removeRelay).toHaveBeenCalledTimes(4);
        expect(store.loadingTrustedMints).toBe(false);
        expect(store.error).toBe(true);
        expect(store.ndk).toBeUndefined();
    });

    it('resolves the collector on the single subscription EOSE', async () => {
        const store = newStore();

        // Fake timers are installed and never advanced: waiting for the 10s
        // timeout would leave this promise pending.
        await store.fetchMints();

        expect(store.loading).toBe(false);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('makes concurrent callers wait on a single connect', async () => {
        let finishConnect!: () => void;
        connect.mockReturnValue(
            new Promise<void>((resolve) => (finishConnect = resolve))
        );
        const store = newStore() as any;

        let settled = 0;
        const calls = [store.getNdk(), store.getNdk()].map((p) =>
            p.then((ndk: any) => {
                settled++;
                return ndk;
            })
        );
        await Promise.resolve();
        expect(settled).toBe(0);

        finishConnect();
        const [first, second] = await Promise.all(calls);

        expect(first).toBe(second);
        expect(MockNDK).toHaveBeenCalledTimes(1);
        expect(connect).toHaveBeenCalledTimes(1);
    });

    it('starts over after a failed connect', async () => {
        connect.mockRejectedValueOnce(new Error('connect failed'));
        const store = newStore() as any;

        await expect(store.getNdk()).rejects.toThrow('connect failed');
        await expect(store.getNdk()).resolves.toBeDefined();

        expect(MockNDK).toHaveBeenCalledTimes(2);
        expect(connect).toHaveBeenCalledTimes(2);
    });
});
