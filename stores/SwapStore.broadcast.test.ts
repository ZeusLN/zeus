// Swap transaction broadcast and the stored claim. Uses the real
// bitcoinjs-lib so txids are computed as the app computes them.
jest.mock('../stores/Stores', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (s: string) => s
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: { getMempoolApiUrl: () => 'https://mempool.test/api' }
}));
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: {
        fetch: jest.fn(),
        fs: { dirs: { LibraryDir: '/lib', DocumentDir: '/docs' } }
    }
}));
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
jest.mock('react-native-biometrics', () => ({ BiometryType: {} }));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/BackendUtils', () => ({ getPayments: jest.fn() }));
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
// the invoice check has its own tests in SwapUtils.test.ts; building a
// signed BOLT11 for the derived preimage hash here adds nothing
jest.mock('../utils/SwapUtils', () => ({
    ...jest.requireActual('../utils/SwapUtils'),
    verifyReverseSwapInvoice: jest.fn(() => ({ valid: true }))
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
import { Transaction } from 'bitcoinjs-lib';

import SwapStore from './SwapStore';
import Storage from '../storage';
import { SWAPS_KEY, REVERSE_SWAPS_KEY } from '../utils/SwapUtils';

const storageBacking = (Storage as any).__store as { [key: string]: string };
const fetchMock = ReactNativeBlobUtil.fetch as jest.Mock;

const newStore = () =>
    new SwapStore(
        { nodeInfo: { nodeId: 'node-pubkey', isTestNet: false } } as any,
        { settings: {}, implementation: 'lnd' } as any
    );

const claimTx = () => {
    const tx = new Transaction();
    tx.addInput(Buffer.alloc(32, 1), 0);
    tx.addOutput(Buffer.from('0014' + '22'.repeat(20), 'hex'), 99000);
    return tx;
};
const CLAIM = claimTx();
const CLAIM_HEX = CLAIM.toHex();
const CLAIM_TXID = CLAIM.getId();
const HOST = 'https://swaps.test/v2';
const MEMPOOL_TX = 'https://mempool.test/api/tx';
const HOST_TX = `${HOST}/chain/BTC/transaction`;

const respond = (status: number, text = '') => ({
    info: () => ({ status }),
    text: async () => text
});

const routes = (byUrl: { [url: string]: any }) =>
    fetchMock.mockImplementation(async (_method: string, url: string) => {
        const route = byUrl[url];
        if (route instanceof Error) throw route;
        return route ?? respond(404, 'not found');
    });

beforeEach(() => {
    for (const key of Object.keys(storageBacking)) delete storageBacking[key];
    jest.clearAllMocks();
});

describe('SwapStore.broadcastSwapTransaction', () => {
    it('broadcasts to the mempool instance and returns the txid', async () => {
        routes({ [MEMPOOL_TX]: respond(200, CLAIM_TXID) });

        await expect(
            newStore().broadcastSwapTransaction(CLAIM_HEX, HOST)
        ).resolves.toBe(CLAIM_TXID);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            'POST',
            MEMPOOL_TX,
            { 'Content-Type': 'text/plain' },
            CLAIM_HEX
        );
    });

    it.each([
        ['an error status', respond(503, 'unavailable')],
        ['a network error', new Error('network down')]
    ])(
        'falls back to the swap host when the mempool instance gives %s',
        async (_, mempool) => {
            routes({
                [MEMPOOL_TX]: mempool,
                [HOST_TX]: respond(201, JSON.stringify({ id: CLAIM_TXID }))
            });

            await expect(
                newStore().broadcastSwapTransaction(CLAIM_HEX, HOST)
            ).resolves.toBe(CLAIM_TXID);

            expect(fetchMock).toHaveBeenLastCalledWith(
                'POST',
                HOST_TX,
                { 'Content-Type': 'application/json' },
                JSON.stringify({ hex: CLAIM_HEX })
            );
        }
    );

    it('counts a transaction already in the mempool as broadcast', async () => {
        routes({
            [MEMPOOL_TX]: respond(
                400,
                'sendrawtransaction RPC error: {"code":-27,"message":"txn-already-in-mempool"}'
            )
        });

        await expect(
            newStore().broadcastSwapTransaction(CLAIM_HEX, HOST)
        ).resolves.toBe(CLAIM_TXID);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws with both errors when neither accepts it', async () => {
        routes({
            [MEMPOOL_TX]: respond(400, 'bad-txns-inputs-missingorspent'),
            [HOST_TX]: respond(400, 'bad-txns-inputs-missingorspent')
        });

        await expect(
            newStore().broadcastSwapTransaction(CLAIM_HEX, HOST)
        ).rejects.toThrow(
            /mempool\.test.*missingorspent.*swaps\.test.*missingorspent/
        );
    });

    it('does not try a host when none is given', async () => {
        routes({ [MEMPOOL_TX]: respond(500, 'error') });

        await expect(
            newStore().broadcastSwapTransaction(CLAIM_HEX)
        ).rejects.toThrow('mempool.test');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects a transaction it cannot decode without sending it', async () => {
        await expect(
            newStore().broadcastSwapTransaction('not hex', HOST)
        ).rejects.toThrow();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('SwapStore claim storage', () => {
    it.each([REVERSE_SWAPS_KEY, SWAPS_KEY])(
        'stores the signed claim and its txid on a swap under %s',
        async (key) => {
            storageBacking[key] = JSON.stringify([
                { id: 'other' },
                { id: 'swap', status: 'transaction.confirmed' }
            ]);
            const store = newStore();

            await store.saveClaimTransaction('swap', CLAIM_HEX);
            await store.saveClaimTxid('swap', CLAIM_TXID);

            expect(JSON.parse(storageBacking[key])).toEqual([
                { id: 'other' },
                {
                    id: 'swap',
                    status: 'transaction.confirmed',
                    claimTransactionHex: CLAIM_HEX,
                    claimTxid: CLAIM_TXID
                }
            ]);
        }
    );

    it('writes nothing when no swap matches', async () => {
        storageBacking[REVERSE_SWAPS_KEY] = JSON.stringify([{ id: 'other' }]);

        await expect(
            newStore().saveClaimTransaction('swap', CLAIM_HEX)
        ).resolves.toBe(false);
        expect(Storage.setItem).not.toHaveBeenCalled();
    });
});

describe('SwapStore.getReverseLockupTransactionHex', () => {
    const URL = `${HOST}/swap/reverse/swap/transaction`;

    it('returns the lockup hex from the host', async () => {
        fetchMock.mockResolvedValue({
            info: () => ({ status: 200 }),
            json: () => ({ id: 'lockup', hex: 'lockuphex' })
        });

        await expect(
            newStore().getReverseLockupTransactionHex('swap', HOST)
        ).resolves.toBe('lockuphex');
        expect(fetchMock).toHaveBeenCalledWith('GET', URL);
    });

    it.each([
        [
            'an error status',
            { info: () => ({ status: 404 }), json: () => ({}) }
        ],
        ['no hex', { info: () => ({ status: 200 }), json: () => ({ id: 'x' }) }]
    ])('returns nothing for %s', async (_, response) => {
        fetchMock.mockResolvedValue(response);
        await expect(
            newStore().getReverseLockupTransactionHex('swap', HOST)
        ).resolves.toBeUndefined();
    });

    it('returns nothing when the request fails', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));
        await expect(
            newStore().getReverseLockupTransactionHex('swap', HOST)
        ).resolves.toBeUndefined();
    });
});
