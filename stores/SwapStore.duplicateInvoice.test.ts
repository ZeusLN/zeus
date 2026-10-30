// Submarine swap creation for an invoice that already backs a stored swap.
// Uses the real rescue-key derivation like SwapStore.reverseLockup.test.ts;
// the swap host is a mock that makes a swap for whatever invoice it is
// sent, also one it already has a swap for.
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
import ecc from '@bitcoinerlab/secp256k1';
import { payments } from 'bitcoinjs-lib';

import SwapStore from './SwapStore';
import Storage from '../storage';
import { SwapType } from '../models/Swap';
import Bolt11Utils from '../utils/Bolt11Utils';
import {
    SWAPS_KEY,
    SWAPS_RESCUE_KEY,
    buildSubmarineSwapLeaves,
    deriveReverseSwapOutputKey
} from '../utils/SwapUtils';

// BIP39 canonical test mnemonic, used as a swap rescue key
const RESCUE_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// BOLT11 spec vector: 2500 uBTC, payment hash 0001020304...
const INVOICE =
    'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpu9qrsgquk0rl77nj30yxdy8j9vdx85fkpmdla2087ne0xh8nhedh8w27kyke0lp53ut353s06fv3qfegext0eh0ymjpf39tuven09sam30g4vgpfna3rh';
// no amount, payment hash 0001020304... as well: one preimage opens both
const INVOICE_SAME_HASH =
    'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap2r09nt4ndd0unm3z9u5t48y6ucv4r5sg7lk98c77ctvjczkspk5qprc90gx';
// regtest invoice with another payment hash
const OTHER_INVOICE =
    'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';

const storageBacking = (Storage as any).__store as { [key: string]: string };
const fetchMock = ReactNativeBlobUtil.fetch as jest.Mock;

const SERVER_PUBKEY = Buffer.from(
    ecc.pointFromScalar(Buffer.alloc(32, 2), true)!
);
const TIP_URL = 'https://mempool.test/api/blocks/tip/height';
const TIP = 899900;
const TIMEOUT = 900000;

// the swap requests sent to the host, without the tip height lookups
let createRequests: any[][] = [];

// Answers the tip height lookup, and passes each swap request to `create`
const mockHost = (create: (body: any) => any) =>
    fetchMock.mockImplementation(async (method, url, headers, body) => {
        if (url === TIP_URL) {
            return { info: () => ({ status: 200 }), text: () => String(TIP) };
        }
        createRequests.push([method, url, headers, body]);
        return create(JSON.parse(body));
    });

// a host that makes a swap for whatever it is sent, with the swap tree a
// Boltz-style host builds for the invoice's payment hash and our refund
// key, so the swap passes the response checks
const hostWithoutTheCheck = () =>
    mockHost(({ invoice, refundPublicKey }) => {
        let preimageHash = Buffer.alloc(32);
        try {
            preimageHash = Buffer.from(
                Bolt11Utils.decode(invoice).payment_hash || '',
                'hex'
            );
        } catch (e) {
            // the store rejects the response for an undecodable invoice
        }
        const refundPubKey = Buffer.from(refundPublicKey, 'hex');
        const { claimLeaf, refundLeaf } = buildSubmarineSwapLeaves({
            claimPubKey: SERVER_PUBKEY,
            refundPubKey,
            preimageHash,
            timeoutBlockHeight: TIMEOUT
        });
        const pubkey = deriveReverseSwapOutputKey({
            ourPubKey: refundPubKey,
            serverPubKey: SERVER_PUBKEY,
            claimLeaf,
            refundLeaf
        });
        return {
            data: JSON.stringify({
                id: `swap-${createRequests.length}`,
                expectedAmount: 250400,
                address: payments.p2tr({ pubkey }).address,
                swapTree: {
                    claimLeaf: {
                        version: 192,
                        output: claimLeaf.toString('hex')
                    },
                    refundLeaf: {
                        version: 192,
                        output: refundLeaf.toString('hex')
                    }
                },
                claimPublicKey: SERVER_PUBKEY.toString('hex'),
                timeoutBlockHeight: TIMEOUT
            })
        };
    });

const newStore = () => {
    storageBacking[SWAPS_RESCUE_KEY] = RESCUE_MNEMONIC;
    const store = new SwapStore(
        { nodeInfo: { nodeId: 'node-pubkey', isTestNet: false } } as any,
        { settings: {}, implementation: 'lnd' } as any
    );
    // 0.5% and 300 sats: up to 251,550 sats to send for INVOICE
    store.subInfo = { fees: { percentage: 0.5, minerFees: 300 } };
    return store;
};
const newNavigation = () => ({ navigate: jest.fn() });
const storedIds = () =>
    JSON.parse(storageBacking[SWAPS_KEY]).map((swap: any) => swap.id);

beforeEach(() => {
    for (const key of Object.keys(storageBacking)) delete storageBacking[key];
    createRequests = [];
    jest.clearAllMocks();
});

describe('SwapStore.createSubmarineSwap for an invoice that already has a swap', () => {
    it.each([
        ['is waiting for funds', { status: 'invoice.set' }],
        [
            'is reported as failed by the host',
            { status: 'invoice.failedToPay' }
        ],
        [
            'is reported as refunded by the host',
            { status: 'transaction.refunded' }
        ],
        [
            'has a refund that may not have confirmed',
            { status: 'transaction.refunded', txid: '00'.repeat(32) }
        ],
        ['was made with another host', { endpoint: 'https://other.test/v2' }],
        ['has the invoice in upper case', { invoice: INVOICE.toUpperCase() }],
        [
            'pays another invoice with the same payment hash',
            { invoice: INVOICE_SAME_HASH }
        ]
    ])(
        'does not ask the host for a second swap when the first %s',
        async (_, first) => {
            storageBacking[SWAPS_KEY] = JSON.stringify([
                {
                    id: 'first',
                    type: SwapType.Submarine,
                    invoice: INVOICE,
                    ...first
                }
            ]);
            hostWithoutTheCheck();
            const store = newStore();
            const navigation = newNavigation();

            await store.createSubmarineSwap(INVOICE, navigation);

            expect(store.apiError).toBe('views.Swaps.invoiceInUse');
            expect(store.loading).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
            expect(storedIds()).toEqual(['first']);
            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );

    it.each([
        ['another invoice', OTHER_INVOICE],
        ['an invoice that cannot be decoded', 'lnbc-invoice'],
        ['no invoice', undefined]
    ])('is not held up by a stored swap with %s', async (_, invoice) => {
        storageBacking[SWAPS_KEY] = JSON.stringify([
            { id: 'first', type: SwapType.Submarine, invoice }
        ]);
        hostWithoutTheCheck();
        const store = newStore();
        const navigation = newNavigation();

        await store.createSubmarineSwap(INVOICE, navigation);

        expect(store.apiError).toBe('');
        expect(createRequests).toHaveLength(1);
        expect(storedIds()).toEqual(['swap-1', 'first']);
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
    });

    it('leaves an invoice it cannot decode to the host', async () => {
        storageBacking[SWAPS_KEY] = JSON.stringify([
            { id: 'first', type: SwapType.Submarine, invoice: 'lnbc-invoice' }
        ]);
        hostWithoutTheCheck();
        const store = newStore();

        await store.createSubmarineSwap('lnbc-other', newNavigation());

        // the response cannot be checked against an invoice that does not
        // decode, so the swap still fails, but after the host has seen it
        expect(store.apiError).not.toBe('views.Swaps.invoiceInUse');
        expect(createRequests).toHaveLength(1);
    });

    it('makes one swap when two requests for an invoice overlap', async () => {
        hostWithoutTheCheck();
        const store = newStore();
        const navigation = newNavigation();

        await Promise.all([
            store.createSubmarineSwap(INVOICE, navigation),
            store.createSubmarineSwap(INVOICE, navigation)
        ]);

        expect(createRequests).toHaveLength(1);
        expect(storedIds()).toEqual(['swap-1']);
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(store.apiError).toBe('');
        expect(store.loading).toBe(false);
    });

    it('makes one swap when overlapping requests use invoices with one payment hash', async () => {
        hostWithoutTheCheck();
        const store = newStore();
        const navigation = newNavigation();

        await Promise.all([
            store.createSubmarineSwap(INVOICE, navigation),
            store.createSubmarineSwap(INVOICE_SAME_HASH, navigation)
        ]);

        expect(createRequests).toHaveLength(1);
        expect(storedIds()).toEqual(['swap-1']);
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(store.apiError).toBe('');
    });

    it('takes a new request for an invoice once a request for it has failed', async () => {
        mockHost(() => {
            throw new Error('host unreachable');
        });
        const store = newStore();

        await store.createSubmarineSwap(INVOICE, newNavigation());
        expect(store.apiError).toBe('host unreachable');

        hostWithoutTheCheck();
        const navigation = newNavigation();
        await store.createSubmarineSwap(INVOICE, navigation);

        expect(createRequests).toHaveLength(2);
        expect(storedIds()).toEqual(['swap-2']);
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
    });

    it('makes the first swap for an invoice', async () => {
        hostWithoutTheCheck();
        const store = newStore();
        const navigation = newNavigation();

        await store.createSubmarineSwap(INVOICE, navigation);

        expect(store.apiError).toBe('');
        expect(JSON.parse(createRequests[0][3]).invoice).toBe(INVOICE);
        expect(storedIds()).toEqual(['swap-1']);
        expect(navigation.navigate).toHaveBeenCalledWith(
            'SwapDetails',
            expect.objectContaining({ invoice: INVOICE })
        );
    });
});
