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
import Swap from '../models/Swap';
import { ReverseClaimTransaction } from '../models/ClaimTransaction';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';

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

    it('does not append a rescued reverse swap already filed under the reverse list again', async () => {
        // getRescuableSwaps writes rescued swaps to SWAPS_KEY, but the next
        // fetchAndUpdateSwaps re-files reverse ones under REVERSE_SWAPS_KEY,
        // so a second rescue has to check both lists or it duplicates it
        setStored(REVERSE_SWAPS_KEY, [
            {
                id: 'rescued-reverse',
                type: 'Reverse',
                status: 'transaction.mempool',
                preimage: { type: 'Buffer', data: [1, 2, 3] }
            }
        ]);
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
        expect(getStored(REVERSE_SWAPS_KEY)).toHaveLength(1);
        expect(
            (getStored(SWAPS_KEY) || []).filter(
                (s: any) => s.id === 'rescued-reverse'
            )
        ).toHaveLength(0);
    });

    it('repairs a stored reverse swap without a preimage under the reverse list', async () => {
        // swaps rescued before the preimage was re-derived have none
        // stored; a second rescue must pin it onto the stored entry, in
        // place, instead of appending a second copy that has one
        setStored(REVERSE_SWAPS_KEY, [
            {
                id: 'rescued-reverse',
                type: 'Reverse',
                status: 'transaction.mempool',
                destinationAddress: 'bc1qkeep'
            }
        ]);
        restoreResponse([
            {
                id: 'rescued-reverse',
                type: 'reverse',
                claimDetails: { keyIndex: 0, serverPublicKey: 'ab' }
            }
        ]);

        await newStore().getRescuableSwaps({
            seedArray: RESCUE_MNEMONIC.split(' '),
            host: 'https://swaps.example.com'
        });

        const stored = getStored(REVERSE_SWAPS_KEY);
        expect(stored).toHaveLength(1);
        expect(Buffer.from(stored[0].preimage.data).toString('hex')).toBe(
            '03c0b3323daab895d806870bd1f050bdca624a24882d3e317b151d537fa75bb7'
        );
        expect(stored[0].status).toBe('transaction.mempool');
        expect(stored[0].destinationAddress).toBe('bc1qkeep');
        expect(
            (getStored(SWAPS_KEY) || []).filter(
                (s: any) => s.id === 'rescued-reverse'
            )
        ).toHaveLength(0);
    });

    it('repairs a stored reverse swap without a preimage under the submarine list', async () => {
        setStored(SWAPS_KEY, [
            {
                id: 'rescued-reverse',
                type: 'Reverse',
                status: 'transaction.mempool',
                destinationAddress: 'bc1qkeep'
            }
        ]);
        restoreResponse([
            {
                id: 'rescued-reverse',
                type: 'reverse',
                claimDetails: { keyIndex: 0, serverPublicKey: 'ab' }
            }
        ]);

        await newStore().getRescuableSwaps({
            seedArray: RESCUE_MNEMONIC.split(' '),
            host: 'https://swaps.example.com'
        });

        const stored = getStored(SWAPS_KEY);
        expect(stored).toHaveLength(1);
        expect(Buffer.from(stored[0].preimage.data).toString('hex')).toBe(
            '03c0b3323daab895d806870bd1f050bdca624a24882d3e317b151d537fa75bb7'
        );
        expect(stored[0].status).toBe('transaction.mempool');
        expect(stored[0].destinationAddress).toBe('bc1qkeep');
    });

    it('leaves a stored reverse swap that already has a preimage unchanged', async () => {
        const existing = {
            id: 'rescued-reverse',
            type: 'Reverse',
            status: 'transaction.mempool',
            preimage: { type: 'Buffer', data: [9, 9, 9] }
        };
        setStored(REVERSE_SWAPS_KEY, [existing]);
        restoreResponse([
            {
                id: 'rescued-reverse',
                type: 'reverse',
                claimDetails: { keyIndex: 0, serverPublicKey: 'ab' }
            }
        ]);

        await newStore().getRescuableSwaps({
            seedArray: RESCUE_MNEMONIC.split(' '),
            host: 'https://swaps.example.com'
        });

        expect(getStored(REVERSE_SWAPS_KEY)).toEqual([existing]);
    });

    it('still skips a stored submarine swap and adds no preimage to it', async () => {
        const existing = { id: 'stored-submarine', type: 'Submarine' };
        setStored(SWAPS_KEY, [existing]);
        restoreResponse([
            {
                id: 'stored-submarine',
                type: 'submarine',
                refundDetails: { keyIndex: 3 }
            }
        ]);

        await newStore().getRescuableSwaps({
            seedArray: RESCUE_MNEMONIC.split(' '),
            host: 'https://swaps.example.com'
        });

        expect(getStored(SWAPS_KEY)).toEqual([existing]);
    });

    it('collapses duplicate stored entries for a rescued reverse swap to the one with a preimage', async () => {
        setStored(REVERSE_SWAPS_KEY, [
            { id: 'rescued-reverse', type: 'Reverse', status: 'swap.created' },
            {
                id: 'rescued-reverse',
                type: 'Reverse',
                status: 'transaction.mempool',
                preimage: { type: 'Buffer', data: [7, 7, 7] }
            }
        ]);
        restoreResponse([
            {
                id: 'rescued-reverse',
                type: 'reverse',
                claimDetails: { keyIndex: 0, serverPublicKey: 'ab' }
            }
        ]);

        await newStore().getRescuableSwaps({
            seedArray: RESCUE_MNEMONIC.split(' '),
            host: 'https://swaps.example.com'
        });

        const stored = getStored(REVERSE_SWAPS_KEY);
        expect(stored).toHaveLength(1);
        expect(stored[0].preimage).toEqual({ type: 'Buffer', data: [7, 7, 7] });
        expect(stored[0].status).toBe('transaction.mempool');
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

describe('SwapStore.resolveClaimAddress', () => {
    it('returns the address already on the swap without generating one', async () => {
        const getNewAddress = jest.fn();

        const address = await newStore().resolveClaimAddress({
            swapId: 'reverse-swap',
            destinationAddress: 'bc1qpicked',
            canReceiveOnchain: true,
            getNewAddress
        });

        expect(address).toBe('bc1qpicked');
        expect(getNewAddress).not.toHaveBeenCalled();
        expect(Storage.setItem).not.toHaveBeenCalled();
    });

    it('returns nothing on a wallet that cannot receive on-chain', async () => {
        setStored(REVERSE_SWAPS_KEY, [{ id: 'reverse-swap' }]);
        const getNewAddress = jest.fn();

        const address = await newStore().resolveClaimAddress({
            swapId: 'reverse-swap',
            canReceiveOnchain: false,
            getNewAddress
        });

        expect(address).toBe('');
        expect(getNewAddress).not.toHaveBeenCalled();
        expect(Storage.setItem).not.toHaveBeenCalled();
    });

    it('persists nothing when no address comes back', async () => {
        // InvoicesStore.getNewAddress catches backend errors and resolves
        // undefined rather than rejecting
        setStored(REVERSE_SWAPS_KEY, [{ id: 'reverse-swap' }]);

        const address = await newStore().resolveClaimAddress({
            swapId: 'reverse-swap',
            canReceiveOnchain: true,
            getNewAddress: jest.fn().mockResolvedValue(undefined)
        });

        expect(address).toBe('');
        expect(Storage.setItem).not.toHaveBeenCalled();
    });

    it('persists nothing when generating an address throws', async () => {
        setStored(REVERSE_SWAPS_KEY, [{ id: 'reverse-swap' }]);

        const address = await newStore().resolveClaimAddress({
            swapId: 'reverse-swap',
            canReceiveOnchain: true,
            getNewAddress: jest.fn().mockRejectedValue(new Error('offline'))
        });

        expect(address).toBe('');
        expect(Storage.setItem).not.toHaveBeenCalled();
    });

    it('persists a fresh address against the swap and returns it', async () => {
        setStored(REVERSE_SWAPS_KEY, [{ id: 'reverse-swap' }]);

        const address = await newStore().resolveClaimAddress({
            swapId: 'reverse-swap',
            canReceiveOnchain: true,
            getNewAddress: jest.fn().mockResolvedValue('bc1qfresh')
        });

        expect(address).toBe('bc1qfresh');
        expect(getStored(REVERSE_SWAPS_KEY)).toEqual([
            { id: 'reverse-swap', destinationAddress: 'bc1qfresh' }
        ]);
    });
});

describe('rescued reverse swap, from storage to claim', () => {
    it('builds a claim with the re-derived preimage and key', async () => {
        // Covers the whole path the bug broke: the rescued swap goes through
        // JSON in storage (preimage and key become { type: 'Buffer', data }
        // shapes), gets a claim address, and must still yield a buildable
        // claim carrying the preimage the host committed to.
        (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
            data: JSON.stringify([
                {
                    id: 'rescued-reverse',
                    type: 'reverse',
                    status: 'transaction.mempool',
                    claimDetails: {
                        keyIndex: 0,
                        serverPublicKey: 'ab',
                        lockupAddress: 'bc1plockup',
                        tree: {
                            claimLeaf: { output: 'c1' },
                            refundLeaf: { output: 'r1' }
                        }
                    }
                }
            ])
        });

        const store = newStore();
        await store.getRescuableSwaps({
            seedArray: RESCUE_MNEMONIC.split(' '),
            host: 'https://swaps.example.com'
        });

        const [stored] = getStored(SWAPS_KEY);
        const destinationAddress = await store.resolveClaimAddress({
            swapId: stored.id,
            destinationAddress: stored.destinationAddress,
            canReceiveOnchain: true,
            getNewAddress: jest.fn().mockResolvedValue('bc1qclaim')
        });

        const claim = ReverseClaimTransaction.build({
            swap: new Swap({ ...getStored(SWAPS_KEY)[0] }),
            endpoint: 'https://swaps.example.com',
            transactionHex: '00',
            feeRate: 2,
            minerFee: 200,
            isTestnet: false
        });

        const childPrivateKey = HDKey.fromMasterSeed(
            mnemonicToSeedSync(RESCUE_MNEMONIC)
        ).derive('m/44/0/0/0/0').privateKey!;

        expect(destinationAddress).toBe('bc1qclaim');
        expect(claim).not.toBeNull();
        expect(claim!.preimageHex).toBe(
            '03c0b3323daab895d806870bd1f050bdca624a24882d3e317b151d537fa75bb7'
        );
        expect(claim!.privateKey).toBe(
            Buffer.from(childPrivateKey).toString('hex')
        );
        expect(claim!.destinationAddress).toBe('bc1qclaim');
        expect(claim!.lockupAddress).toBe('bc1plockup');
        expect(claim!.servicePubKey).toBe('ab');
    });
});
