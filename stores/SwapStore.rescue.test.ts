// Separate from SwapStore.test.ts because the mocks are incompatible:
// these tests pin a preimage derivation against known vectors, so they
// need the real ecpair, bitcoinjs-lib and @scure key material that the
// other file stubs out, and a real in-memory Storage rather than a bare
// jest.fn. Same split as UnitsUtils.alt.test.ts and
// AddressUtils-testnet.test.ts.
jest.mock('../stores/Stores', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (s: string) => s
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: {
        fetch: jest.fn(),
        fs: { dirs: { LibraryDir: '/lib', DocumentDir: '/docs' } }
    }
}));
// SwapUtils touches the filesystem and save dialog for the rescue key
// export; neither is exercised here
jest.mock('react-native-fs', () => ({
    DownloadDirectoryPath: '/public-downloads',
    DocumentDirectoryPath: '/docs',
    CachesDirectoryPath: '/cache',
    exists: jest.fn().mockResolvedValue(false),
    unlink: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));

// SwapStore pulls in SettingsStore, which reaches for the keychain,
// biometrics and Tor at import time
jest.mock('react-native-biometrics', () => ({ BiometryType: {} }));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/BackendUtils', () => ({}));
jest.mock('../utils/BiometricUtils', () => ({
    getSupportedBiometryType: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/MigrationUtils', () => ({
    keychainCloudSyncMigration: jest.fn().mockResolvedValue(undefined),
    migrateRgsDefaultToZeus: jest.fn().mockResolvedValue(undefined),
    migrateInvoiceExpiryDisplay: jest.fn().mockResolvedValue(undefined),
    legacySettingsMigrations: jest.fn().mockResolvedValue({}),
    storageMigrationV2: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    RequestMethod: {}
}));
jest.mock('../utils/LdkNodeUtils', () => ({
    DEFAULT_SCORER_URL: '',
    DEFAULT_VSS_SERVER: '',
    getDefaultEsploraServer: jest.fn().mockReturnValue(''),
    getDefaultRgsServer: jest.fn().mockReturnValue('')
}));
jest.mock('../storage', () => {
    const store: { [key: string]: string } = {};
    return {
        __esModule: true,
        default: {
            getItem: jest.fn(async (key: string) => store[key] ?? null),
            setItem: jest.fn(async (key: string, value: string) => {
                store[key] = value;
                return true;
            }),
            __store: store
        }
    };
});

import ReactNativeBlobUtil from 'react-native-blob-util';
import SwapStore from './SwapStore';
import Storage from '../storage';
import { SWAPS_KEY, REVERSE_SWAPS_KEY } from '../utils/SwapUtils';

// BIP39 canonical test mnemonic, used as a swap rescue key
const RESCUE_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const storageBacking = (Storage as any).__store as { [key: string]: string };

const newStore = () =>
    new SwapStore(
        { nodeInfo: { nodeId: 'node-pubkey', isTestNet: false } } as any,
        { settings: {}, implementation: 'lnd' } as any
    );

const setStored = (key: string, swaps: any[]) => {
    storageBacking[key] = JSON.stringify(swaps);
};

const getStored = (key: string) =>
    storageBacking[key] ? JSON.parse(storageBacking[key]) : null;

beforeEach(() => {
    for (const key of Object.keys(storageBacking)) delete storageBacking[key];
    jest.clearAllMocks();
});

describe('SwapStore.getRescuableSwaps', () => {
    const restoreResponse = (swaps: any[]) => {
        (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
            data: JSON.stringify(swaps)
        });
    };

    it('re-derives the preimage of a rescued reverse swap', async () => {
        // A reverse swap's preimage is chosen by ZEUS and never leaves the
        // device - the host only ever sees sha256(preimage), as the hold
        // invoice's payment hash - so it cannot come back from
        // /swap/restore and has to be derived again from the rescue key.
        restoreResponse([
            {
                id: 'rescued-reverse',
                type: 'reverse',
                claimDetails: { keyIndex: 0, serverPublicKey: 'ab' }
            }
        ]);

        const result = await newStore().getRescuableSwaps({
            seedArray: RESCUE_MNEMONIC.split(' '),
            host: 'https://swaps.example.com'
        });

        expect(result?.success).toBe(true);

        const [rescued] = getStored(SWAPS_KEY);
        expect(rescued.type).toBe('Reverse');
        // sha256 of m/44/0/0/0/0 under the canonical mnemonic, pinned in
        // SwapUtils.test.ts alongside the payment hash the host committed to
        expect(Buffer.from(rescued.preimage.data).toString('hex')).toBe(
            '03c0b3323daab895d806870bd1f050bdca624a24882d3e317b151d537fa75bb7'
        );
    });

    it('does not put a preimage on a rescued submarine swap', async () => {
        // the host picks a submarine swap's preimage and reveals it on
        // settlement, so there is nothing of ours to re-derive
        restoreResponse([
            {
                id: 'rescued-submarine',
                type: 'submarine',
                refundDetails: { keyIndex: 3 }
            }
        ]);

        await newStore().getRescuableSwaps({
            seedArray: RESCUE_MNEMONIC.split(' '),
            host: 'https://swaps.example.com'
        });

        const [rescued] = getStored(SWAPS_KEY);
        expect(rescued.type).toBe('Submarine');
        expect(rescued.preimage).toBeUndefined();
    });

    it('rejects an invalid rescue key without calling the host', async () => {
        const result = await newStore().getRescuableSwaps({
            seedArray: 'not a valid bip39 mnemonic at all whatsoever'.split(
                ' '
            ),
            host: 'https://swaps.example.com'
        });

        expect(result?.success).toBe(false);
        expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
    });
});

describe('SwapStore.updateSwapDestinationAddress', () => {
    it('records the address on a reverse swap', async () => {
        setStored(REVERSE_SWAPS_KEY, [{ id: 'other' }, { id: 'reverse-swap' }]);

        const updated = await newStore().updateSwapDestinationAddress(
            'reverse-swap',
            'bc1qclaim'
        );

        expect(updated).toBe(true);
        expect(getStored(REVERSE_SWAPS_KEY)).toEqual([
            { id: 'other' },
            { id: 'reverse-swap', destinationAddress: 'bc1qclaim' }
        ]);
    });

    it('finds a rescued swap still filed under the submarine list', async () => {
        // getRescuableSwaps writes every rescued swap to SWAPS_KEY whatever
        // its type; only the next fetchAndUpdateSwaps re-files it
        setStored(REVERSE_SWAPS_KEY, [{ id: 'unrelated' }]);
        setStored(SWAPS_KEY, [{ id: 'rescued-reverse', imported: true }]);

        const updated = await newStore().updateSwapDestinationAddress(
            'rescued-reverse',
            'bc1qclaim'
        );

        expect(updated).toBe(true);
        expect(getStored(SWAPS_KEY)).toEqual([
            {
                id: 'rescued-reverse',
                imported: true,
                destinationAddress: 'bc1qclaim'
            }
        ]);
        expect(getStored(REVERSE_SWAPS_KEY)).toEqual([{ id: 'unrelated' }]);
    });

    it('overwrites an address already on the swap', async () => {
        setStored(REVERSE_SWAPS_KEY, [
            { id: 'reverse-swap', destinationAddress: 'bc1qold' }
        ]);

        await newStore().updateSwapDestinationAddress(
            'reverse-swap',
            'bc1qnew'
        );

        expect(getStored(REVERSE_SWAPS_KEY)[0].destinationAddress).toBe(
            'bc1qnew'
        );
    });

    it('writes nothing when no stored swap matches', async () => {
        setStored(REVERSE_SWAPS_KEY, [{ id: 'reverse-swap' }]);
        setStored(SWAPS_KEY, [{ id: 'submarine-swap' }]);

        const updated = await newStore().updateSwapDestinationAddress(
            'unknown-swap',
            'bc1qclaim'
        );

        expect(updated).toBe(false);
        expect(Storage.setItem).not.toHaveBeenCalled();
    });
});
