// Pins each SwapStore request not covered by the other SwapStore tests to
// the active node's Tor setting: with Tor on it goes through
// doTorRequestRaw, with Tor off through ReactNativeBlobUtil.
jest.mock('../stores/Stores', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (s: string) => s
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
const mockServesNetwork = jest.fn(() => true);
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: {
        getMempoolApiUrl: () => 'https://mempool.test/api',
        mempoolServesNetwork: () => mockServesNetwork()
    }
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
    doTorRequestRaw: jest.fn(),
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }
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
import { doTorRequestRaw } from '../utils/TorUtils';
import { SWAPS_KEY } from '../utils/SwapUtils';

const storageBacking = (Storage as any).__store as { [key: string]: string };
const fetchMock = ReactNativeBlobUtil.fetch as jest.Mock;
const torMock = doTorRequestRaw as jest.Mock;

const HOST = 'https://swaps.test/v2';
const MEMPOOL = 'https://mempool.test/api';
const LOCKUP_TXID = 'aa'.repeat(32);
const SPENDING_TXID = 'bb'.repeat(32);
// a stored claim spending output 0 of LOCKUP_TXID
const claim = new Transaction();
claim.addInput(Buffer.from(LOCKUP_TXID, 'hex').reverse(), 0);
const CLAIM_HEX = claim.toHex();
// BIP-39 zero-entropy test vector, never a real wallet
const RESCUE_MNEMONIC = `${'abandon '.repeat(11)}about`;
// An error body stops every flow right after its request
const BODY = JSON.stringify({ error: 'stop' });

// Answers the mempool tip height lookup over either path, and every other
// request with BODY
const TIP_URL = 'https://mempool.test/api/blocks/tip/height';
const answerTipHeight = () => {
    fetchMock.mockImplementation(async (_method: string, url: string) => {
        const body = url === TIP_URL ? '899900' : BODY;
        return {
            info: () => ({ status: 200 }),
            json: () => JSON.parse(body),
            text: () => body,
            data: body
        };
    });
    torMock.mockImplementation(async (url: string) => ({
        status: 200,
        body: url === TIP_URL ? '899900' : BODY
    }));
};

const newStore = (enableTor: boolean) => {
    const store = new SwapStore(
        { nodeInfo: { nodeId: 'node-pubkey', isTestNet: false } } as any,
        {
            settings: { swaps: { customHost: HOST, hostMainnet: 'Custom' } },
            implementation: 'lnd',
            enableTor
        } as any
    );
    // key derivation is covered in SwapStore.rescue.test.ts
    (store as any).generateNewKey = jest.fn(async () => ({
        keys: {
            privateKey: Buffer.alloc(32, 1),
            publicKey: Buffer.alloc(33, 2)
        },
        index: 0
    }));
    (store as any).derivePreimageFromRescueKey = jest.fn(async () =>
        Buffer.alloc(32, 3)
    );
    return store;
};

const cases: Array<[string, string, string, (store: SwapStore) => any]> = [
    [
        'getSwapFees (submarine)',
        'GET',
        `${HOST}/swap/submarine`,
        (store) => store.getSwapFees()
    ],
    [
        'getSwapFees (reverse)',
        'GET',
        `${HOST}/swap/reverse`,
        (store) => store.getSwapFees()
    ],
    [
        'getLockupTransaction',
        'GET',
        `${HOST}/swap/submarine/swap-1/transaction`,
        (store) => store.getLockupTransaction('swap-1')
    ],
    [
        'createSubmarineSwap',
        'POST',
        `${HOST}/swap/submarine`,
        (store) => {
            // a quote and a tip height, so the swap request is sent
            store.subInfo = {
                fees: { percentage: 0.5, minerFees: 300 }
            } as any;
            answerTipHeight();
            return store.createSubmarineSwap('lnbc1invoice', {});
        }
    ],
    [
        'createReverseSwap',
        'POST',
        `${HOST}/swap/reverse`,
        (store) => {
            // a claim fee quote and rate, so the swap can start
            store.reverseInfo = {
                fees: {
                    percentage: 0.5,
                    minerFees: { claim: 300, lockup: 400 }
                }
            } as any;
            return store.createReverseSwap('bc1qaddress', 50000, '2', {});
        }
    ],
    [
        'fetchAndUpdateSwaps',
        'GET',
        `${HOST}/swap/swap-1`,
        (store) => {
            storageBacking[SWAPS_KEY] = JSON.stringify([
                {
                    id: 'swap-1',
                    type: 'Submarine',
                    status: 'swap.created',
                    endpoint: HOST
                }
            ]);
            return store.fetchAndUpdateSwaps();
        }
    ],
    [
        'lockupSpentBy',
        'GET',
        `${MEMPOOL}/tx/${SPENDING_TXID}`,
        (store) => store.lockupSpentBy(SPENDING_TXID, LOCKUP_TXID, 0, '')
    ],
    [
        'checkStoredClaim',
        'GET',
        `${MEMPOOL}/tx/${LOCKUP_TXID}/outspend/0`,
        (store) => store.checkStoredClaim(CLAIM_HEX, '')
    ],
    [
        'getRescuableSwaps',
        'POST',
        `${HOST}/swap/restore`,
        (store) =>
            store.getRescuableSwaps({
                seedArray: RESCUE_MNEMONIC.split(' '),
                host: HOST
            })
    ]
];

beforeEach(() => {
    for (const key of Object.keys(storageBacking)) delete storageBacking[key];
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockServesNetwork.mockReturnValue(true);
    fetchMock.mockResolvedValue({
        info: () => ({ status: 200 }),
        json: () => JSON.parse(BODY),
        text: () => BODY,
        data: BODY
    });
    torMock.mockResolvedValue({ status: 200, body: BODY });
});

describe('SwapStore requests follow the Tor setting', () => {
    it.each(cases)(
        '%s goes over Tor when enabled',
        async (_, method, url, run) => {
            await run(newStore(true));

            expect(torMock.mock.calls.map((c) => [c[1], c[0]])).toContainEqual([
                method,
                url
            ]);
            expect(fetchMock.mock.calls.map((c) => c[1])).not.toContain(url);
        }
    );

    it.each(cases)(
        '%s goes direct when Tor is off',
        async (_, method, url, run) => {
            await run(newStore(false));

            expect(
                fetchMock.mock.calls.map((c) => [c[0], c[1]])
            ).toContainEqual([method, url]);
            expect(torMock).not.toHaveBeenCalled();
        }
    );
});
