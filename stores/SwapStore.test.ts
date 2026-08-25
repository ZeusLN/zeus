// First test file for SwapStore. The mocks below are import-time
// scaffolding: SwapStore pulls in native modules (blob-util, encrypted
// storage via SettingsStore) and ESM-only crypto packages that jest's
// transformIgnorePatterns does not cover (ecpair). getLockupTransaction
// uses only ReactNativeBlobUtil and Storage, both of which are driven
// directly by these tests.
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn(), config: jest.fn() }
}));
// SwapUtils' rescue-key export pulls these in at import time; neither is
// covered by transformIgnorePatterns. The tests below never reach them.
jest.mock('react-native-fs', () => ({
    __esModule: true,
    default: {
        DownloadDirectoryPath: '/public-downloads',
        DocumentDirectoryPath: '/docs',
        CachesDirectoryPath: '/cache',
        exists: jest.fn().mockResolvedValue(false),
        unlink: jest.fn(),
        writeFile: jest.fn()
    }
}));
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    isOnionHttpsUrl: jest.fn(),
    RequestMethod: {}
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }
}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (k: string) => k }));
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => '#000' }));
jest.mock('ecpair', () => ({ ECPairFactory: () => ({}) }));
jest.mock('@bitcoinerlab/secp256k1', () => ({ __esModule: true, default: {} }));
jest.mock('bitcoinjs-lib', () => ({
    crypto: { sha256: jest.fn() },
    initEccLib: jest.fn()
}));
jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class {},
    DEFAULT_SWAP_HOST_MAINNET: 'https://api.boltz.exchange/v2',
    DEFAULT_SWAP_HOST_TESTNET: 'https://api.testnet.boltz.exchange/v2',
    SWAP_HOST_KEYS_MAINNET: [],
    SWAP_HOST_KEYS_TESTNET: []
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import Storage from '../storage';
import SwapStore from './SwapStore';
import { SwapState, SwapType } from '../models/Swap';

const SWAP_ID = 'swap-abc';
const LOCKUP = {
    id: 'lockup-tx-id',
    hex: 'deadbeef',
    timeoutBlockHeight: 800000,
    timeoutEta: 1700000000
};

const buildStore = () =>
    new SwapStore(
        { nodeInfo: { isTestNet: false } } as any,
        { settings: { swaps: {} } } as any
    );

/** Returns the swap array handed to Storage.setItem by the call. */
const runGetLockupTransaction = async (
    storedSwaps: any[],
    httpStatus = 200
): Promise<any[]> => {
    (Storage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify(storedSwaps)
    );
    (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
        info: () => ({ status: httpStatus }),
        json: () => LOCKUP
    });

    await buildStore().getLockupTransaction(SWAP_ID, 'https://host.example/v2');

    const call = (Storage.setItem as jest.Mock).mock.calls.at(-1);
    return call ? JSON.parse(call[1]) : [];
};

describe('SwapStore.getLockupTransaction', () => {
    beforeEach(() => jest.clearAllMocks());

    it('leaves the swap state untouched while storing the lockup tx', async () => {
        // Regression: the HTTP status was spread onto the swap because the
        // local was named `status`, replacing the SwapState with 200.
        const swaps = await runGetLockupTransaction([
            {
                id: SWAP_ID,
                type: SwapType.Submarine,
                status: SwapState.TransactionClaimed
            }
        ]);

        expect(swaps[0].status).toBe(SwapState.TransactionClaimed);
        expect(swaps[0].status).not.toBe(200);
        expect(swaps[0].lockupTransaction).toEqual(LOCKUP);
    });

    it.each([
        SwapState.TransactionClaimed,
        SwapState.TransactionRefunded,
        SwapState.SwapExpired,
        SwapState.InvoiceFailedToPay
    ])(
        'preserves terminal state %s, which SwapDetails tests by membership',
        async (state) => {
            // SwapDetails decides a swap is settled with
            // finalStatus.includes(swapData?.status) against SwapState
            // strings, so a numeric status silently un-settles the swap
            // and makes it resubscribe.
            const swaps = await runGetLockupTransaction([
                { id: SWAP_ID, type: SwapType.Submarine, status: state }
            ]);

            expect(swaps[0].status).toBe(state);
        }
    );

    it('does not add a status to a swap that had none', async () => {
        const swaps = await runGetLockupTransaction([
            { id: SWAP_ID, type: SwapType.Submarine }
        ]);

        expect(swaps[0].status).toBeUndefined();
        expect(swaps[0].lockupTransaction).toEqual(LOCKUP);
    });

    it('only touches the matching swap', async () => {
        const swaps = await runGetLockupTransaction([
            {
                id: 'other-swap',
                type: SwapType.Submarine,
                status: SwapState.InvoiceSettled
            },
            {
                id: SWAP_ID,
                type: SwapType.Submarine,
                status: SwapState.TransactionMempool
            }
        ]);

        expect(swaps[0]).toEqual({
            id: 'other-swap',
            type: SwapType.Submarine,
            status: SwapState.InvoiceSettled
        });
        expect(swaps[1].status).toBe(SwapState.TransactionMempool);
        expect(swaps[1].lockupTransaction).toEqual(LOCKUP);
    });

    it('writes nothing on a non-200 response', async () => {
        await runGetLockupTransaction(
            [
                {
                    id: SWAP_ID,
                    type: SwapType.Submarine,
                    status: SwapState.TransactionMempool
                }
            ],
            404
        );

        expect(Storage.setItem as jest.Mock).not.toHaveBeenCalled();
    });

    it('returns the lockup transaction to the caller', async () => {
        (Storage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));
        (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
            info: () => ({ status: 200 }),
            json: () => LOCKUP
        });

        await expect(
            buildStore().getLockupTransaction(
                SWAP_ID,
                'https://host.example/v2'
            )
        ).resolves.toEqual(LOCKUP);
    });
});
