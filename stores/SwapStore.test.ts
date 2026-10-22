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
jest.mock('../utils/BackendUtils', () => ({ lookupInvoice: jest.fn() }));
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

import { createHash } from 'crypto';
import { observable, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { crypto } from 'bitcoinjs-lib';
import Storage from '../storage';
import BackendUtils from '../utils/BackendUtils';
import { SWAPS_KEY, REVERSE_SWAPS_KEY } from '../utils/SwapUtils';
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

// regtest invoice whose payment hash is SWAP_INVOICE_HASH
const SWAP_INVOICE =
    'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';
const SWAP_INVOICE_HASH =
    'f2cbe057ae04a29a28b098de1eea199d8f1802810fb4f0269dac84c6f8c8762d';
const HOST = 'https://host.example/v2';

const lookupInvoice = BackendUtils.lookupInvoice as jest.Mock;
const blobFetch = ReactNativeBlobUtil.fetch as jest.Mock;

const useRealSha256 = () =>
    (crypto.sha256 as jest.Mock).mockImplementation((data: Buffer) =>
        createHash('sha256').update(data).digest()
    );

// a preimage the host gives for the swap; none of these hash to the
// invoice's payment hash
const hostPreimage = (preimage?: string) =>
    blobFetch.mockResolvedValue({ json: () => ({ preimage }) });

describe('SwapStore.isSubmarineSwapInvoicePaid', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useRealSha256();
        lookupInvoice.mockRejectedValue(new Error('unable to locate invoice'));
        hostPreimage(undefined);
    });

    const isPaid = () =>
        buildStore().isSubmarineSwapInvoicePaid(SWAP_ID, SWAP_INVOICE, HOST);

    it('is true when the node reports the invoice paid', async () => {
        lookupInvoice.mockResolvedValue({ state: 'SETTLED', settled: true });

        await expect(isPaid()).resolves.toBe(true);
        expect(lookupInvoice).toHaveBeenCalledWith({
            r_hash: SWAP_INVOICE_HASH
        });
        expect(blobFetch).not.toHaveBeenCalled();
    });

    it("is true when the host's preimage hashes to the payment hash", async () => {
        // stand in for SHA256 so this preimage hashes to the invoice's
        // payment hash
        const preimage = '11'.repeat(32);
        (crypto.sha256 as jest.Mock).mockImplementation((data: Buffer) =>
            data.toString('hex') === preimage
                ? Buffer.from(SWAP_INVOICE_HASH, 'hex')
                : createHash('sha256').update(data).digest()
        );
        hostPreimage(preimage);

        await expect(isPaid()).resolves.toBe(true);
        expect(blobFetch.mock.calls[0].slice(0, 2)).toEqual([
            'GET',
            `${HOST}/swap/submarine/${SWAP_ID}/preimage`
        ]);
    });

    it('is false while the node holds the invoice unpaid and the host has no preimage', async () => {
        lookupInvoice.mockResolvedValue({ state: 'OPEN', settled: false });

        await expect(isPaid()).resolves.toBe(false);
    });

    it('is false for a preimage of another payment hash', async () => {
        hostPreimage('22'.repeat(32));

        await expect(isPaid()).resolves.toBe(false);
    });

    it('is false for a malformed preimage', async () => {
        hostPreimage('not hex');

        await expect(isPaid()).resolves.toBe(false);
    });

    it('is false when the host cannot be reached', async () => {
        blobFetch.mockRejectedValue(new Error('offline'));

        await expect(isPaid()).resolves.toBe(false);
    });

    it('is false for an invoice that does not decode', async () => {
        await expect(
            buildStore().isSubmarineSwapInvoicePaid(SWAP_ID, 'lnbc-bad', HOST)
        ).resolves.toBe(false);
        expect(lookupInvoice).not.toHaveBeenCalled();
    });
});

describe('SwapStore.fetchAndUpdateSwaps and transaction.claimed', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useRealSha256();
    });

    const submarineSwap = {
        id: SWAP_ID,
        type: SwapType.Submarine,
        status: SwapState.TransactionMempool,
        invoice: SWAP_INVOICE,
        endpoint: HOST
    };

    // Polls one stored swap; the host reports hostStatus and has no
    // preimage to give. Returns the swap as stored afterwards.
    const poll = async (swap: any, hostStatus: string) => {
        const key =
            swap.type === SwapType.Reverse ? REVERSE_SWAPS_KEY : SWAPS_KEY;
        (Storage.getItem as jest.Mock).mockImplementation(async (k) =>
            k === key ? JSON.stringify([swap]) : null
        );
        blobFetch.mockImplementation(async (_method: string, url: string) => ({
            json: () =>
                url.endsWith('/preimage') ? {} : { status: hostStatus }
        }));

        await buildStore().fetchAndUpdateSwaps();

        const call = (Storage.setItem as jest.Mock).mock.calls.find(
            ([k]) => k === key
        );
        return JSON.parse(call[1])[0];
    };

    it('records a claim once the node reports the invoice paid', async () => {
        lookupInvoice.mockResolvedValue({ state: 'SETTLED', settled: true });

        const swap = await poll(submarineSwap, SwapState.TransactionClaimed);

        expect(swap.status).toBe(SwapState.TransactionClaimed);
    });

    it('keeps the stored status of a claim nothing confirms', async () => {
        lookupInvoice.mockResolvedValue({ state: 'OPEN', settled: false });

        const swap = await poll(submarineSwap, SwapState.TransactionClaimed);

        expect(swap.status).toBe(SwapState.TransactionMempool);
    });

    it('keeps the stored status when the node did not issue the invoice', async () => {
        lookupInvoice.mockRejectedValue(new Error('unable to locate invoice'));

        const swap = await poll(submarineSwap, SwapState.TransactionClaimed);

        expect(swap.status).toBe(SwapState.TransactionMempool);
    });

    it('records the claim of a swap without an invoice, as before', async () => {
        const { invoice: _invoice, ...rescued } = submarineSwap;

        const swap = await poll(rescued, SwapState.TransactionClaimed);

        expect(swap.status).toBe(SwapState.TransactionClaimed);
        expect(lookupInvoice).not.toHaveBeenCalled();
    });

    it('records other statuses without checking the invoice', async () => {
        const swap = await poll(submarineSwap, SwapState.InvoiceFailedToPay);

        expect(swap.status).toBe(SwapState.InvoiceFailedToPay);
        expect(lookupInvoice).not.toHaveBeenCalled();
    });

    it('does not check the invoice of a reverse swap', async () => {
        const swap = await poll(
            { ...submarineSwap, type: SwapType.Reverse },
            SwapState.TransactionClaimed
        );

        expect(swap.status).toBe(SwapState.TransactionClaimed);
        expect(lookupInvoice).not.toHaveBeenCalled();
    });

    describe('when the node or host does not answer', () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        // Polls the stored submarine swap while the host reports it
        // claimed; requests matching `silent` never settle. Returns the
        // swap as stored afterwards.
        const pollWithSilent = async (silent: (url: string) => boolean) => {
            (Storage.getItem as jest.Mock).mockImplementation(async (k) =>
                k === SWAPS_KEY ? JSON.stringify([submarineSwap]) : null
            );
            const cancel = jest.fn();
            blobFetch.mockImplementation((_method: string, url: string) =>
                silent(url)
                    ? Object.assign(new Promise(() => undefined), { cancel })
                    : Promise.resolve({
                          json: () => ({
                              status: SwapState.TransactionClaimed
                          })
                      })
            );

            const done = buildStore().fetchAndUpdateSwaps();
            await jest.advanceTimersByTimeAsync(10000);
            await done;

            const call = (Storage.setItem as jest.Mock).mock.calls.find(
                ([k]) => k === SWAPS_KEY
            );
            return { swap: JSON.parse(call[1])[0], cancel };
        };

        it('does not wait for a preimage request the host holds', async () => {
            lookupInvoice.mockRejectedValue(
                new Error('unable to locate invoice')
            );

            const { swap, cancel } = await pollWithSilent((url) =>
                url.endsWith('/preimage')
            );

            expect(swap.status).toBe(SwapState.TransactionMempool);
            expect(cancel).toHaveBeenCalledTimes(1);
        });

        it('does not wait for an invoice lookup the node holds', async () => {
            lookupInvoice.mockReturnValue(new Promise(() => undefined));

            const { swap } = await pollWithSilent((url) =>
                url.endsWith('/preimage')
            );

            expect(swap.status).toBe(SwapState.TransactionMempool);
        });
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
