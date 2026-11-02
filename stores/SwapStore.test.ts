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
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/BackendUtils', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => '#000' }));
// the real UrlUtils imports the whole store graph via Stores
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: { getMempoolApiUrl: () => 'https://mempool.test/api' }
}));
// models/Swap formats dates with DateTimeUtils, which reads display
// settings from the store graph
jest.mock('./Stores', () => ({}));
jest.mock('ecpair', () => ({ ECPairFactory: () => ({}) }));
jest.mock('@bitcoinerlab/secp256k1', () => ({ __esModule: true, default: {} }));
jest.mock('bitcoinjs-lib', () => ({
    crypto: { sha256: jest.fn() },
    initEccLib: jest.fn()
}));
jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class {},
    DEFAULT_SWAP_HOST_MAINNET: 'https://satsrouting.exchange/v2',
    DEFAULT_SWAP_HOST_TESTNET: 'https://api.testnet.boltz.exchange/v2',
    SWAP_HOST_KEYS_MAINNET: [
        {
            key: 'SATS Routing',
            value: 'https://satsrouting.exchange/v2',
            pro: false,
            supportsRescue: true
        },
        {
            key: 'Custom',
            value: 'Custom',
            pro: true,
            supportsRescue: true
        }
    ],
    SWAP_HOST_KEYS_TESTNET: [
        {
            key: 'Boltz',
            value: 'https://api.testnet.boltz.exchange/v2',
            pro: false,
            supportsRescue: true
        },
        {
            key: 'Custom',
            value: 'Custom',
            pro: true,
            supportsRescue: true
        }
    ]
}));

import { observable, runInAction } from 'mobx';
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

describe('SwapStore Pro referral gating', () => {
    beforeEach(() => jest.clearAllMocks());

    const store = (swaps: any, isTestNet = false) =>
        new SwapStore(
            { nodeInfo: { isTestNet } } as any,
            { settings: { swaps } } as any
        );

    it('sends the Referral header on a pro host', () => {
        const s = store({ hostMainnet: 'Custom', proEnabled: true });

        expect(s.isProHost).toBe(true);
        expect(s.getHeaders).toEqual({
            'Content-Type': 'application/json',
            Referral: 'pro'
        });
        expect(s.referralId).toBe('pro');
    });

    it('withholds the Referral header when the selected host has no pro tier', () => {
        // A migration can move a user onto a non-pro host without clearing
        // proEnabled, and the Pro switch only renders for pro hosts, so the
        // stale flag would otherwise be both live and unreachable.
        const s = store({
            hostMainnet: 'https://satsrouting.exchange/v2',
            proEnabled: true
        });

        expect(s.isProHost).toBe(false);
        expect(s.getHeaders).toBeUndefined();
        expect(s.referralId).toBeUndefined();
    });

    it('resolves an unset host to the default, which has no pro tier', () => {
        const s = store({ proEnabled: true });

        expect(s.isProHost).toBe(false);
        expect(s.getHeaders).toBeUndefined();
    });

    it('keeps Pro on a testnet custom host while mainnet sits on a non-pro one', () => {
        // proEnabled is one flag shared across networks, so the mainnet
        // selection must not decide the testnet header.
        const swaps = {
            hostMainnet: 'https://satsrouting.exchange/v2',
            hostTestnet: 'Custom',
            customHost: 'https://my-boltz.local/v2',
            proEnabled: true
        };

        expect(store(swaps, true).isProHost).toBe(true);
        expect(store(swaps, false).isProHost).toBe(false);
    });

    it('withholds the header when proEnabled is off, pro host or not', () => {
        const s = store({ hostMainnet: 'Custom', proEnabled: false });

        expect(s.isProHost).toBe(true);
        expect(s.getHeaders).toBeUndefined();
        expect(s.referralId).toBeUndefined();
    });
});

describe('SwapStore host selection', () => {
    const CUSTOM_HOST = 'https://my-boltz.local/v2';

    const store = (swaps: any, isTestNet = false) =>
        new SwapStore(
            { nodeInfo: { isTestNet } } as any,
            { settings: { swaps } } as any
        );

    it('uses the custom host only on the network that selected it', () => {
        // customHost is one value shared across networks, and the settings
        // screen only shows the active network's selection.
        const testnetCustom = {
            hostMainnet: 'https://satsrouting.exchange/v2',
            hostTestnet: 'Custom',
            customHost: CUSTOM_HOST
        };

        expect(store(testnetCustom, true).getHost).toBe(CUSTOM_HOST);
        expect(store(testnetCustom, false).getHost).toBe(
            'https://satsrouting.exchange/v2'
        );

        const mainnetCustom = {
            hostMainnet: 'Custom',
            hostTestnet: 'https://api.testnet.boltz.exchange/v2',
            customHost: CUSTOM_HOST
        };

        expect(store(mainnetCustom, false).getHost).toBe(CUSTOM_HOST);
        expect(store(mainnetCustom, true).getHost).toBe(
            'https://api.testnet.boltz.exchange/v2'
        );
    });
});

describe('SwapStore host-change rate refetch', () => {
    beforeEach(() => jest.clearAllMocks());

    const MAINNET_HOST = 'https://satsrouting.exchange/v2';

    // observable stores so the constructor's getHost reaction actually fires
    const buildReactiveStore = () => {
        const nodeInfoStore: any = observable({
            nodeInfo: { isTestNet: false }
        });
        const settingsStore: any = observable({
            settings: {
                swaps: {
                    hostMainnet: MAINNET_HOST,
                    hostTestnet: 'https://api.testnet.boltz.exchange/v2'
                }
            }
        });
        const store = new SwapStore(nodeInfoStore, settingsStore);
        runInAction(() => {
            // rates already loaded from mainnet this session
            store.fetchedRatesHost = MAINNET_HOST;
        });
        return { store, nodeInfoStore, settingsStore };
    };

    it('refetches when the mainnet host changes', () => {
        // control: proves the reaction fires in this harness, so the
        // testnet case below cannot pass vacuously
        const { settingsStore } = buildReactiveStore();

        runInAction(() => {
            settingsStore.settings.swaps.hostMainnet =
                'https://swap.coinos.io/v2';
        });

        expect(ReactNativeBlobUtil.fetch).toHaveBeenCalledWith(
            'GET',
            'https://swap.coinos.io/v2/swap/submarine',
            undefined
        );
    });

    it('does not fetch rates after switching to a testnet wallet', () => {
        const { nodeInfoStore } = buildReactiveStore();

        runInAction(() => {
            nodeInfoStore.nodeInfo.isTestNet = true;
        });

        expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
    });
});

describe('SwapStore.getSwapFees', () => {
    beforeEach(() => jest.clearAllMocks());
    // drop queued responses a superseded call never asked for
    afterEach(() => (ReactNativeBlobUtil.fetch as jest.Mock).mockReset());

    const ratesResponse = (claim: number) => ({
        info: () => ({ status: 200 }),
        json: () => ({
            BTC: {
                BTC: {
                    fees: { percentage: 0.5, minerFees: { claim, lockup: 400 } }
                }
            }
        })
    });

    it('ignores an earlier call that finishes after a later one', async () => {
        const store = buildStore();
        const fetchMock = ReactNativeBlobUtil.fetch as jest.Mock;

        // the first call's submarine request stays open
        let releaseFirst: (value: any) => void = () => {};
        fetchMock.mockImplementationOnce(
            () => new Promise((resolve) => (releaseFirst = resolve))
        );
        const first = store.getSwapFees();

        fetchMock
            .mockResolvedValueOnce(ratesResponse(300))
            .mockResolvedValueOnce(ratesResponse(300));
        await store.getSwapFees();
        expect(store.reverseInfo.fees?.minerFees?.claim).toBe(300);
        expect(store.loading).toBe(false);

        // the first call now completes with another quote
        fetchMock.mockResolvedValueOnce(ratesResponse(-97800));
        releaseFirst(ratesResponse(-97800));
        await first;

        expect(store.reverseInfo.fees?.minerFees?.claim).toBe(300);
        expect(store.loading).toBe(false);
        // it stopped before asking for the reverse rates again
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('ignores the error of an earlier call that fails after a later one', async () => {
        const store = buildStore();
        const fetchMock = ReactNativeBlobUtil.fetch as jest.Mock;

        let failFirst: (reason: any) => void = () => {};
        fetchMock.mockImplementationOnce(
            () => new Promise((_, reject) => (failFirst = reject))
        );
        const first = store.getSwapFees();

        fetchMock
            .mockResolvedValueOnce(ratesResponse(300))
            .mockResolvedValueOnce(ratesResponse(300));
        await store.getSwapFees();

        failFirst(new Error('timeout'));
        await first;

        expect(store.apiError).toBe('');
        expect(store.reverseInfo.fees?.minerFees?.claim).toBe(300);
    });
});
