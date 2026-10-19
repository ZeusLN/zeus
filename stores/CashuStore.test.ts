jest.mock('./Stores', () => ({
    activityStore: { getSortedActivity: jest.fn() },
    connectivityStore: {}
}));
jest.mock('./SettingsStore', () => ({
    DEFAULT_NOSTR_RELAYS: ['wss://relay.one', 'wss://relay.two']
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
jest.mock('../utils/LocaleUtils');
jest.mock('../NavigationService', () => ({}));
jest.mock('../cashu-cdk', () => ({
    isAvailable: jest.fn(() => true),
    initializeWallet: jest.fn().mockResolvedValue(undefined),
    melt: jest.fn(),
    isValidToken: jest.fn(),
    checkMeltQuote: jest.fn(),
    getMintBalance: jest.fn()
}));
jest.mock('../storage', () => ({
    setItem: jest.fn().mockResolvedValue(true),
    getItem: jest.fn(),
    getRawItem: jest.fn(),
    KEY_PREFIX: 'zeus:'
}));

import { Platform } from 'react-native';
import { validateMnemonic } from '@scure/bip39';
import NDK from '@nostr-dev-kit/ndk';
import CashuStore from './CashuStore';
import CashuPayment from '../models/CashuPayment';
import Storage, { getRawItem } from '../storage';
import CashuDevKit from '../cashu-cdk';
import { BIP39_WORD_LIST } from '../utils/Bip39Utils';
import Bolt11Utils from '../utils/Bolt11Utils';
import * as SchedulingUtils from '../utils/SchedulingUtils';

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

describe('CashuStore pending item checks before init', () => {
    // Activity and Activity Export call checkPendingItems before Cashu has
    // initialized, e.g. with no node running
    afterEach(() => jest.restoreAllMocks());

    it('starts with no mints', () => {
        expect(newStore().mintUrls).toEqual([]);
    });

    it('checkPendingItems runs its sweep on a fresh store', async () => {
        let task: (() => unknown) | undefined;
        jest.spyOn(SchedulingUtils, 'runWhenIdle').mockImplementation((t) => {
            task = t;
            return () => {};
        });
        const store = newStore();
        const checkInvoicePaid = jest.spyOn(store, 'checkInvoicePaid');
        const checkTokenSpent = jest.spyOn(store, 'checkTokenSpent');

        await store.checkPendingItems();
        await expect(task!()).resolves.toBeUndefined();

        expect(checkInvoicePaid).not.toHaveBeenCalled();
        expect(checkTokenSpent).not.toHaveBeenCalled();
    });

    it('checkSentTokensSpentStatus reports no updates on a fresh store', async () => {
        const store = newStore();
        store.sentTokens = [
            { spent: false, mint: 'https://mint.example.com' }
        ] as any;
        const checkTokenSpent = jest.spyOn(store, 'checkTokenSpent');

        await expect(store.checkSentTokensSpentStatus()).resolves.toBe(false);
        // No mints are configured yet, so the token's mint is not polled
        expect(checkTokenSpent).not.toHaveBeenCalled();
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

    beforeEach(() => {
        connect = jest.fn().mockResolvedValue(undefined);
        MockNDK.mockReset().mockImplementation(() => ({
            connect,
            // Emit EOSE right away so subscribeAndCollectEvents resolves
            // without waiting out its 10s timeout.
            subscribe: jest.fn(() => ({
                on: (event: string, cb: () => void) => {
                    if (event === 'eose') cb();
                },
                stop: jest.fn()
            })),
            fetchEvents: jest.fn().mockResolvedValue(new Set())
        }));
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
            explicitRelayUrls: ['wss://relay.one', 'wss://relay.two'],
            enableOutboxModel: false
        });
        expect(connect).toHaveBeenCalledWith(2000);
    });

    it('reuses one instance across repeated Discover Mints loads', async () => {
        const store = newStore();

        await store.fetchMints();
        await store.fetchMints();

        expect(MockNDK).toHaveBeenCalledTimes(1);
        expect(connect).toHaveBeenCalledTimes(1);
        expect(store.error).toBe(false);
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

describe('CashuStore melt quotes belong to the loaded invoice', () => {
    const mints = ['https://mint.one', 'https://mint.two'];
    const amounts: { [invoice: string]: number } = {
        lnbc1first: 90000,
        lnbc1second: 100
    };
    // Different fees, so a payer that reads the other invoice's fee
    // reaches a different balance decision
    const fees: { [invoice: string]: number } = {
        lnbc1first: 5000,
        lnbc1second: 10
    };

    // The mint answers a quote request when the test calls answer[invoice]()
    const storeWithMint = (multiMint = false) => {
        const store = new CashuStore(
            { settings: { ecash: { enableMultiMint: multiMint } } } as any,
            {} as any,
            {} as any,
            { checkAndTriggerRatingModal: jest.fn() } as any
        );
        store.mintUrls = mints;
        store.selectedMintUrl = mints[0];
        store.multiMintSelectedUrls = multiMint ? mints : [];
        store.cashuWallets = { [mints[0]]: {} as any };
        store.mintBalances = { [mints[0]]: 100000 };
        const answer: { [invoice: string]: () => void } = {};
        jest.spyOn(store, 'createMeltQuoteCDK').mockImplementation(
            (_, invoice) =>
                new Promise((resolve) => {
                    answer[invoice] = () =>
                        resolve({
                            id: `quote for ${invoice}`,
                            amount: amounts[invoice],
                            fee_reserve: fees[invoice]
                        } as any);
                })
        );
        jest.spyOn(store as any, 'ensureMintAdded').mockResolvedValue(
            undefined
        );
        jest.spyOn(store, 'syncCDKBalances').mockResolvedValue(undefined);
        return { store, answer };
    };
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    const load = async (
        { store, answer }: ReturnType<typeof storeWithMint>,
        invoice: string
    ) => {
        const loaded = store.getPayReq(invoice);
        await flush();
        answer[invoice]();
        await loaded;
    };

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(Bolt11Utils, 'decode').mockImplementation(
            (invoice) =>
                ({
                    num_satoshis: amounts[invoice],
                    payment_hash: `hash of ${invoice}`
                } as any)
        );
        Object.assign(CashuDevKit, {
            // only the first mint is funded: the multi-mint planner falls
            // back to one regular quote
            getBalances: jest.fn().mockResolvedValue({ [mints[0]]: 100000 }),
            getMintBalance: jest.fn().mockResolvedValue(100000),
            melt: jest
                .fn()
                .mockResolvedValue({ state: 'Paid', amount: 0, fee_paid: 0 }),
            restore: jest.fn().mockResolvedValue(0)
        });
    });

    afterEach(() => jest.restoreAllMocks());

    it.each([false, true])(
        'drops the quote of the previous invoice when another one is loaded (multi-mint: %p)',
        async (multiMint) => {
            const wallet = storeWithMint(multiMint);
            const { store } = wallet;
            await load(wallet, 'lnbc1first');
            expect(
                multiMint ? store.meltQuotes[0].meltQuote.id : store.meltQuote
            ).toBeTruthy();

            store.getPayReq('lnbc1second');

            expect(store.meltQuote).toBeUndefined();
            expect(store.meltQuotes).toEqual([]);
            await store.payLnInvoiceFromEcash({
                paymentRequest: 'lnbc1second'
            });
            expect(CashuDevKit.melt).not.toHaveBeenCalled();
        }
    );

    it.each([false, true])(
        'does not store the quote of a superseded invoice (multi-mint: %p)',
        async (multiMint) => {
            const wallet = storeWithMint(multiMint);
            const { store, answer } = wallet;
            const superseded = store.getPayReq('lnbc1first');
            await flush();
            await load(wallet, 'lnbc1second');

            answer.lnbc1first();
            await superseded;

            expect(store.paymentRequest).toBe('lnbc1second');
            await store.payLnInvoiceFromEcash({
                paymentRequest: 'lnbc1second'
            });
            expect(CashuDevKit.melt).toHaveBeenCalledTimes(1);
            expect(CashuDevKit.melt).toHaveBeenCalledWith(
                mints[0],
                'quote for lnbc1second'
            );
        }
    );

    it.each([false, true])(
        'pays nothing when the caller validated another invoice (multi-mint: %p)',
        async (multiMint) => {
            const wallet = storeWithMint(multiMint);
            const { store } = wallet;
            await load(wallet, 'lnbc1second');

            await expect(
                store.payLnInvoiceFromEcash({ paymentRequest: 'lnbc1first' })
            ).resolves.toBeUndefined();

            expect(CashuDevKit.melt).not.toHaveBeenCalled();
            expect(store.paymentError).toBe(true);
            expect(store.paymentErrorMsg).toBe(
                'views.PaymentRequest.payReqChanged'
            );
        }
    );

    it.each([false, true])(
        'pays nothing when the caller did not say which invoice (multi-mint: %p)',
        async (multiMint) => {
            const wallet = storeWithMint(multiMint);
            const { store } = wallet;
            await load(wallet, 'lnbc1second');

            await expect(
                store.payLnInvoiceFromEcash({ paymentRequest: undefined })
            ).resolves.toBeUndefined();

            expect(CashuDevKit.melt).not.toHaveBeenCalled();
            expect(store.paymentError).toBe(true);
            expect(store.paymentErrorMsg).toBe(
                'stores.CashuStore.noPaymentRequestAvailable'
            );
        }
    );

    it('melts and records the invoice it was started for when another one is loaded meanwhile', async () => {
        const wallet = storeWithMint();
        const { store } = wallet;
        await load(wallet, 'lnbc1second');
        // Enough for lnbc1second and its fee, not for lnbc1first's fee
        (CashuDevKit.getMintBalance as jest.Mock).mockImplementation(
            async () => {
                await load(wallet, 'lnbc1first');
                return 1000;
            }
        );

        const payment = await store.payLnInvoiceFromEcash({
            paymentRequest: 'lnbc1second'
        });

        expect(store.paymentRequest).toBe('lnbc1first');
        expect(CashuDevKit.melt).toHaveBeenCalledTimes(1);
        expect(CashuDevKit.melt).toHaveBeenCalledWith(
            mints[0],
            'quote for lnbc1second'
        );
        expect(payment?.getPaymentRequest).toBe('lnbc1second');
        expect(payment?.paymentHash).toBe('hash of lnbc1second');
        expect(payment?.meltResponse.quote?.quote).toBe(
            'quote for lnbc1second'
        );
    });

    it('records the invoice it was started for when another one is loaded during a multi-mint melt', async () => {
        const wallet = storeWithMint(true);
        const { store } = wallet;
        await load(wallet, 'lnbc1second');
        (CashuDevKit.melt as jest.Mock).mockImplementation(async () => {
            await load(wallet, 'lnbc1first');
            return { state: 'Paid', amount: 100, fee_paid: 0 };
        });

        const payment = await store.payLnInvoiceFromEcash({
            paymentRequest: 'lnbc1second'
        });

        expect(store.paymentRequest).toBe('lnbc1first');
        expect(CashuDevKit.melt).toHaveBeenCalledTimes(1);
        expect(CashuDevKit.melt).toHaveBeenCalledWith(
            mints[0],
            'quote for lnbc1second'
        );
        expect(payment?.getPaymentRequest).toBe('lnbc1second');
        expect(payment?.paymentHash).toBe('hash of lnbc1second');
        expect(payment?.meltResponse.quote?.quote).toBe(
            'quote for lnbc1second'
        );
    });
});

describe('CashuStore single-mint melt state', () => {
    const payingStore = () => {
        const store: any = new CashuStore(
            { implementation: 'lnd', settings: {}, lndDir: 'lnd' } as any,
            {} as any,
            {} as any,
            { checkAndTriggerRatingModal: jest.fn() } as any
        );
        // cdkInitialized stays false so syncCDKBalances early-returns
        store.selectedMintUrl = 'https://mint.example.com';
        store.meltQuote = {
            quote: 'quote-1',
            amount: 1000,
            fee_reserve: 10,
            state: 'Unpaid',
            expiry: 9999999999
        };
        store.payReq = {};
        store.paymentRequest = 'lnbc10n1ptestinvoice';
        store.payments = [];
        return store;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // the success path schedules the rating modal, which would otherwise
        // outlive the test and force the worker to exit
        jest.useFakeTimers();
        (CashuDevKit.getMintBalance as jest.Mock).mockResolvedValue(1_000_000);
        (Storage.setItem as jest.Mock).mockReset().mockResolvedValue(true);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    // CDK 0.18 waits out Pending and only resolves Paid, but the bridge
    // types allow any state. The single-mint path used to report any
    // resolved melt as a paid invoice, with an empty preimage.
    it('does not report a resolved Pending melt as a successful payment', async () => {
        const store = payingStore();
        (CashuDevKit.melt as jest.Mock).mockResolvedValue({
            state: 'Pending',
            amount: 1000,
            fee_paid: 0
        });

        await store.payLnInvoiceFromEcash({
            amount: '1000',
            paymentRequest: 'lnbc10n1ptestinvoice'
        });

        expect(store.paymentSuccess).toBe(false);
        expect(store.paymentError).toBe(true);
        expect(store.paymentErrorMsg).toBe('stores.CashuStore.paymentInFlight');
        expect(store.paymentPreimage).toBe('');
        // the payment is recorded as in flight, with no preimage, so a mint
        // that settles it later can still be reconciled against it
        expect(store.payments).toHaveLength(1);
        expect(store.payments[0].isInTransit).toBe(true);
        expect(store.payments[0].payment_preimage).toBe('');
        expect(store.pendingMelts).toEqual([
            expect.objectContaining({
                quote: 'quote-1',
                mintUrl: 'https://mint.example.com',
                source: 'payment',
                amount: 1000,
                feeReserve: 10
            })
        ]);
    });

    // A mint that has settled the quote without paying it is finished with
    // the melt: nothing is in flight, so nothing should be left behind
    it('leaves nothing behind when the mint settles the melt unpaid', async () => {
        const store = payingStore();
        (CashuDevKit.melt as jest.Mock).mockResolvedValue({
            state: 'Unpaid',
            amount: 1000,
            fee_paid: 0
        });

        await store.payLnInvoiceFromEcash({
            amount: '1000',
            paymentRequest: 'lnbc10n1ptestinvoice'
        });

        expect(store.paymentSuccess).toBe(false);
        expect(store.paymentError).toBe(true);
        expect(store.paymentErrorMsg).toBe(
            'stores.CashuStore.errorPayingInvoice'
        );
        expect(store.payments).toEqual([]);
        expect(store.pendingMelts).toEqual([]);
    });

    // The melt is tracked before it is executed, so a crash mid-melt is
    // recoverable. A melt that resolves Paid has to clear that tracking.
    it('records a Paid melt as a successful payment and stops tracking it', async () => {
        const store = payingStore();
        (CashuDevKit.melt as jest.Mock).mockResolvedValue({
            state: 'Paid',
            amount: 1000,
            fee_paid: 2,
            preimage: 'a'.repeat(64)
        });

        await store.payLnInvoiceFromEcash({
            amount: '1000',
            paymentRequest: 'lnbc10n1ptestinvoice'
        });

        expect(store.paymentError).toBe(false);
        expect(store.paymentSuccess).toBe(true);
        expect(store.paymentPreimage).toBe('a'.repeat(64));
        expect(store.paymentFee).toBe(2);
        expect(store.payments).toHaveLength(1);
        expect(store.payments[0].isInTransit).toBe(false);
        expect(store.pendingMelts).toEqual([]);
    });

    // CDK history keeps no outgoing record, so a kill after the untrack but
    // before the payment write would lose a paid invoice from activity
    it('stores a Paid payment before it stops tracking the melt', async () => {
        const store = payingStore();
        (CashuDevKit.melt as jest.Mock).mockResolvedValue({
            state: 'Paid',
            amount: 1000,
            fee_paid: 2,
            preimage: 'a'.repeat(64)
        });

        await store.payLnInvoiceFromEcash({
            amount: '1000',
            paymentRequest: 'lnbc10n1ptestinvoice'
        });

        const keys = (Storage.setItem as jest.Mock).mock.calls.map(
            ([key]) => key
        );
        const paymentsWrite = keys.indexOf('lnd-cashu-payments');
        const untrackWrite = keys.lastIndexOf('lnd-cashu-pending-melts');
        expect(paymentsWrite).toBeGreaterThan(-1);
        expect(untrackWrite).toBeGreaterThan(paymentsWrite);
    });

    it('keeps tracking a Paid melt whose payment could not be stored', async () => {
        const store = payingStore();
        (CashuDevKit.melt as jest.Mock).mockResolvedValue({
            state: 'Paid',
            amount: 1000,
            fee_paid: 2,
            preimage: 'a'.repeat(64)
        });
        (Storage.setItem as jest.Mock).mockImplementation(async (key) => {
            if (key === 'lnd-cashu-payments') throw new Error('disk full');
            return true;
        });

        await store.payLnInvoiceFromEcash({
            amount: '1000',
            paymentRequest: 'lnbc10n1ptestinvoice'
        });

        // reconcile settles it from the mint on the next pass
        expect(store.pendingMelts).toEqual([
            expect.objectContaining({ quote: 'quote-1' })
        ]);
    });

    // What CDK does with a melt the mint has not settled: it waits, and if
    // it stops waiting it throws while its saga still holds the quote. The
    // quote CDK then returns is its local copy, still Unpaid.
    it('reports a melt that threw while CDK still holds it as in flight', async () => {
        const store = payingStore();
        (CashuDevKit.melt as jest.Mock).mockRejectedValue(
            new Error('Subscription closed')
        );
        (CashuDevKit.checkMeltQuote as jest.Mock).mockResolvedValue({
            id: 'quote-1',
            state: 'Unpaid',
            used_by_operation: 'op-1'
        });

        await store.payLnInvoiceFromEcash({
            amount: '1000',
            paymentRequest: 'lnbc10n1ptestinvoice'
        });

        expect(CashuDevKit.checkMeltQuote).toHaveBeenCalledWith(
            'https://mint.example.com',
            'quote-1'
        );
        expect(store.paymentSuccess).toBe(false);
        expect(store.paymentErrorMsg).toBe('stores.CashuStore.paymentInFlight');
        expect(store.payments).toHaveLength(1);
        expect(store.payments[0].isInTransit).toBe(true);
        expect(store.payments[0].bolt11).toBe('lnbc10n1ptestinvoice');
        expect(store.pendingMelts).toHaveLength(1);
    });

    // CDK released the quote: the saga compensated and the proofs are back
    it('stops tracking a melt that threw once CDK has released the quote', async () => {
        const store = payingStore();
        (CashuDevKit.melt as jest.Mock).mockRejectedValue(
            new Error('Payment failed')
        );
        (CashuDevKit.checkMeltQuote as jest.Mock).mockResolvedValue({
            id: 'quote-1',
            state: 'Unpaid'
        });

        await store.payLnInvoiceFromEcash({
            amount: '1000',
            paymentRequest: 'lnbc10n1ptestinvoice'
        });

        expect(store.paymentSuccess).toBe(false);
        expect(store.paymentError).toBe(true);
        expect(store.paymentErrorMsg).not.toBe(
            'stores.CashuStore.paymentInFlight'
        );
        expect(store.payments).toEqual([]);
        expect(store.pendingMelts).toEqual([]);
    });

    it('keeps tracking a melt whose state cannot be checked', async () => {
        const store = payingStore();
        (CashuDevKit.melt as jest.Mock).mockRejectedValue(
            new Error('network request failed')
        );
        (CashuDevKit.checkMeltQuote as jest.Mock).mockRejectedValue(
            new Error('network request failed')
        );

        await store.payLnInvoiceFromEcash({
            amount: '1000',
            paymentRequest: 'lnbc10n1ptestinvoice'
        });

        expect(store.paymentSuccess).toBe(false);
        expect(store.payments).toEqual([]);
        // the mint may have taken the ecash and be paying: reconciliation
        // decides, not the failed round trip
        expect(store.pendingMelts).toHaveLength(1);
    });

    // CDK reserves the proofs a melt moved for as long as the mint may
    // settle it, so the balance from before the attempt is stale
    it.each(['Pending', 'Unpaid'])(
        'refreshes balances after a %s melt',
        async (state) => {
            const store = payingStore();
            store.syncCDKBalances = jest.fn().mockResolvedValue(undefined);
            (CashuDevKit.melt as jest.Mock).mockResolvedValue({
                state,
                amount: 1000,
                fee_paid: 0
            });

            await store.payLnInvoiceFromEcash({
                amount: '1000',
                paymentRequest: 'lnbc10n1ptestinvoice'
            });

            expect(store.paymentSuccess).toBe(false);
            expect(store.syncCDKBalances).toHaveBeenCalledWith(true);
        }
    );

    // The quote is tracked before the melt starts. A reconcile pass in
    // between would find an Unpaid quote no saga holds yet and untrack it,
    // losing the record a kill mid-melt depends on.
    it('keeps a quote from reconcile while it is being tracked', async () => {
        const store = payingStore();
        store.cdkInitialized = true;
        store.mintUrls = ['https://mint.example.com'];
        store.syncCDKBalances = jest.fn().mockResolvedValue(undefined);
        let persistTracked: (value: boolean) => void = () => {};
        (Storage.setItem as jest.Mock).mockImplementationOnce(
            () => new Promise((resolve) => (persistTracked = resolve))
        );
        (CashuDevKit.checkMeltQuote as jest.Mock).mockResolvedValue({
            id: 'quote-1',
            state: 'Unpaid'
        });
        let finishMelt: (value: any) => void = () => {};
        (CashuDevKit.melt as jest.Mock).mockImplementation(
            () => new Promise((resolve) => (finishMelt = resolve))
        );

        // fake timers are on, so drain microtasks rather than wait
        const settle = async () => {
            for (let i = 0; i < 20; i++) await Promise.resolve();
        };

        const paying = store.payLnInvoiceFromEcash({
            amount: '1000',
            paymentRequest: 'lnbc10n1ptestinvoice'
        });
        await settle();
        expect(store.pendingMelts).toHaveLength(1);

        await store.reconcilePendingMelts();

        expect(CashuDevKit.checkMeltQuote).not.toHaveBeenCalled();
        expect(store.pendingMelts).toHaveLength(1);

        persistTracked(true);
        await settle();
        expect(CashuDevKit.melt).toHaveBeenCalledWith(
            'https://mint.example.com',
            'quote-1'
        );
        finishMelt({
            state: 'Paid',
            amount: 1000,
            fee_paid: 1,
            preimage: 'a'.repeat(64)
        });
        await paying;

        expect(store.paymentSuccess).toBe(true);
        expect(store.pendingMelts).toEqual([]);
    });
});

describe('CashuStore self-custody claim', () => {
    const mintUrl = 'https://mint.example.com';

    const claimingStore = () => {
        const store: any = new CashuStore(
            { implementation: 'lnd', settings: {}, lndDir: 'lnd' } as any,
            {
                createInvoice: jest.fn().mockResolvedValue({
                    paymentRequest: 'lnbc10n1ptestinvoice'
                })
            } as any,
            {} as any,
            {} as any
        );
        store.cdkInitialized = true;
        store.mintUrls = [mintUrl];
        store.receiveTokenCDK = jest.fn().mockResolvedValue(undefined);
        store.createMeltQuoteCDK = jest.fn().mockResolvedValue({
            id: 'quote-1',
            amount: 1000,
            fee_reserve: 0,
            expiry: 9999999999
        });
        store.syncCDKBalances = jest.fn().mockResolvedValue(undefined);
        return store;
    };

    const token = { mint: mintUrl, getAmount: 1000, proofs: [] } as any;

    beforeEach(() => {
        jest.clearAllMocks();
        (CashuDevKit.isValidToken as jest.Mock).mockResolvedValue(true);
        (Storage.setItem as jest.Mock).mockReset().mockResolvedValue(true);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    // The token is received before the sweep runs, so a melt that does not
    // pay leaves the ecash claimed and unclaimable again: reporting a failed
    // claim would send the user looking for a token they already hold
    it('reports a claim whose sweep did not complete as a warning', async () => {
        const store = claimingStore();
        store.meltCDK = jest
            .fn()
            .mockRejectedValue(
                new Error('stores.CashuStore.errorPayingInvoice')
            );

        const result = await store.claimToken('cashuAtoken', token, true);

        expect(store.receiveTokenCDK).toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.errorMessage).toBe('');
        expect(result.warningMessage).toBe(
            'stores.CashuStore.claimedButNotSwept'
        );
    });

    it('reports a completed self-custody claim as a plain success', async () => {
        const store = claimingStore();
        store.meltCDK = jest.fn().mockResolvedValue({ state: 'Paid' });

        const result = await store.claimToken('cashuAtoken', token, true);

        expect(result.success).toBe(true);
        expect(result.warningMessage).toBeUndefined();
    });
});

describe('CashuStore reconcilePendingMelts', () => {
    const mintUrl = 'https://mint.example.com';

    const reconcilingStore = (pendingMelt: any, payments: any[] = []) => {
        const store: any = new CashuStore(
            { implementation: 'lnd', settings: {}, lndDir: 'lnd' } as any,
            {} as any,
            {} as any,
            {} as any
        );
        store.cdkInitialized = true;
        store.mintUrls = [mintUrl];
        store.pendingMelts = [pendingMelt];
        store.payments = payments;
        store.syncCDKBalances = jest.fn().mockResolvedValue(undefined);
        return store;
    };

    const pendingMelt = (source = 'payment') => ({
        quote: 'quote-1',
        mintUrl,
        source,
        amount: 1000,
        feeReserve: 10,
        request: 'lnbc10n1ptestinvoice',
        expiry: 9999999999,
        createdAt: 1_700_000_000_000
    });

    const inFlightPayment = () =>
        new CashuPayment({
            bolt11: 'lnbc10n1ptestinvoice',
            meltResponse: { quote: { quote: 'quote-1', amount: 1000 } },
            amount: 1000,
            fee: 0,
            status: 'IN_FLIGHT',
            payment_preimage: '',
            mintUrl
        });

    beforeEach(() => {
        jest.clearAllMocks();
        (Storage.setItem as jest.Mock).mockReset().mockResolvedValue(true);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('records the payment a melt turned out to be once the mint pays it', async () => {
        const store = reconcilingStore(pendingMelt(), [inFlightPayment()]);
        (CashuDevKit.checkMeltQuote as jest.Mock).mockResolvedValue({
            id: 'quote-1',
            state: 'Paid',
            payment_preimage: 'b'.repeat(64)
        });

        await store.reconcilePendingMelts();

        expect(store.payments).toHaveLength(1);
        expect(store.payments[0].isInTransit).toBe(false);
        expect(store.payments[0].payment_preimage).toBe('b'.repeat(64));
        // the quote does not say what the mint spent, so no fee is shown
        // rather than a free payment
        expect(store.payments[0].fee_unknown).toBe(true);
        expect(store.payments[0].getFee).toBe('');
        expect(store.pendingMelts).toEqual([]);
        expect(store.syncCDKBalances).toHaveBeenCalled();
    });

    // A kill after the pay path stored the payment but before it untracked
    // the melt leaves both behind
    it('settles a stored payment in place rather than adding a second', async () => {
        const stored = new CashuPayment({
            bolt11: 'lnbc10n1ptestinvoice',
            meltResponse: {
                quote: {
                    quote: 'quote-1',
                    amount: 1000,
                    fee_reserve: 10,
                    state: 'Unpaid',
                    expiry: 9999999999
                }
            },
            amount: 1000,
            fee: 2,
            payment_preimage: 'b'.repeat(64),
            mintUrl
        });
        const store = reconcilingStore(pendingMelt(), [stored]);
        (CashuDevKit.checkMeltQuote as jest.Mock).mockResolvedValue({
            id: 'quote-1',
            state: 'Paid',
            payment_preimage: 'b'.repeat(64)
        });

        await store.reconcilePendingMelts();

        expect(store.payments).toHaveLength(1);
        expect(store.payments[0].getFee).toBe('2');
        expect(store.payments[0].fee_unknown).toBe(false);
        expect(store.payments[0].payment_preimage).toBe('b'.repeat(64));
        expect(store.pendingMelts).toEqual([]);
    });

    // The pay path may never have recorded anything: a melt whose execution
    // threw is tracked with no payment entry to update
    it('creates the payment when the melt was never recorded', async () => {
        const store = reconcilingStore(pendingMelt());
        (CashuDevKit.checkMeltQuote as jest.Mock).mockResolvedValue({
            id: 'quote-1',
            state: 'Paid',
            payment_preimage: 'b'.repeat(64)
        });

        await store.reconcilePendingMelts();

        expect(store.payments).toHaveLength(1);
        expect(store.payments[0].getAmount).toBe(1000);
        expect(store.payments[0].payment_preimage).toBe('b'.repeat(64));
        // dated when the melt started, not 1970
        expect(store.payments[0].getTimestamp).toBe(1_700_000_000);
        expect(store.payments[0].getFee).toBe('');
        expect(store.pendingMelts).toEqual([]);
    });

    it('drops the in-flight payment when the mint settles the melt unpaid', async () => {
        const store = reconcilingStore(pendingMelt(), [inFlightPayment()]);
        (CashuDevKit.checkMeltQuote as jest.Mock).mockResolvedValue({
            id: 'quote-1',
            state: 'Unpaid'
        });

        await store.reconcilePendingMelts();

        expect(store.payments).toEqual([]);
        expect(store.pendingMelts).toEqual([]);
    });

    // CDK returns Pending when the mint says so for a quote no saga holds,
    // and its local Unpaid copy while a saga still holds the quote
    it.each([
        ['Pending', { state: 'Pending' }],
        [
            'Unpaid held by a saga',
            { state: 'Unpaid', used_by_operation: 'op-1' }
        ]
    ])('leaves a still-pending melt alone (%s)', async (_, quote) => {
        const store = reconcilingStore(pendingMelt(), [inFlightPayment()]);
        (CashuDevKit.checkMeltQuote as jest.Mock).mockResolvedValue({
            id: 'quote-1',
            ...quote
        });

        await store.reconcilePendingMelts();

        expect(store.payments).toHaveLength(1);
        expect(store.payments[0].isInTransit).toBe(true);
        expect(store.pendingMelts).toHaveLength(1);
        expect(store.syncCDKBalances).not.toHaveBeenCalled();
    });

    // A kill mid-melt leaves the melt tracked with no payment entry
    it('records an in-flight payment for a pending melt that has none', async () => {
        const store = reconcilingStore(pendingMelt());
        (CashuDevKit.checkMeltQuote as jest.Mock).mockResolvedValue({
            id: 'quote-1',
            state: 'Unpaid',
            used_by_operation: 'op-1'
        });

        await store.reconcilePendingMelts();
        await store.reconcilePendingMelts();

        expect(store.payments).toHaveLength(1);
        expect(store.payments[0].isInTransit).toBe(true);
        expect(store.payments[0].bolt11).toBe('lnbc10n1ptestinvoice');
        expect(store.payments[0].getAmount).toBe(1000);
        expect(store.payments[0].getTimestamp).toBe(1_700_000_000);
        expect(store.payments[0].getFee).toBe('');
        expect(store.pendingMelts).toHaveLength(1);
    });

    it('records no ecash payment for a pending sweep', async () => {
        const store = reconcilingStore(pendingMelt('sweep'));
        (CashuDevKit.checkMeltQuote as jest.Mock).mockResolvedValue({
            id: 'quote-1',
            state: 'Unpaid',
            used_by_operation: 'op-1'
        });

        await store.reconcilePendingMelts();

        expect(store.payments).toEqual([]);
        expect(store.pendingMelts).toHaveLength(1);
    });

    // The melt call is still waiting on the mint and settles the melt itself
    it('skips a melt whose melt call has not returned', async () => {
        const store = reconcilingStore(pendingMelt());
        store.meltsInProgress.add('quote-1');

        await store.reconcilePendingMelts();

        expect(CashuDevKit.checkMeltQuote).not.toHaveBeenCalled();
        expect(store.pendingMelts).toHaveLength(1);
    });

    // The quotes to check are copied up front; one whose caller settled it
    // while an earlier quote was being checked is no longer tracked
    it('skips a melt untracked while an earlier one was being checked', async () => {
        const store = reconcilingStore(pendingMelt());
        store.pendingMelts = [
            pendingMelt(),
            { ...pendingMelt(), quote: 'quote-2' }
        ];
        (CashuDevKit.checkMeltQuote as jest.Mock).mockImplementation(
            async () => {
                store.pendingMelts = store.pendingMelts.filter(
                    (melt: any) => melt.quote !== 'quote-2'
                );
                return { id: 'quote-1', state: 'Pending' };
            }
        );

        await store.reconcilePendingMelts();

        expect(CashuDevKit.checkMeltQuote).toHaveBeenCalledTimes(1);
        expect(CashuDevKit.checkMeltQuote).toHaveBeenCalledWith(
            mintUrl,
            'quote-1'
        );
    });

    // A mint being unreachable says nothing about the payment
    it('keeps tracking when the mint cannot be reached', async () => {
        const store = reconcilingStore(pendingMelt());
        (CashuDevKit.checkMeltQuote as jest.Mock).mockRejectedValue(
            new Error('mint unreachable')
        );

        await store.reconcilePendingMelts();

        expect(store.pendingMelts).toHaveLength(1);
    });

    // Past its expiry the quote can no longer settle, so an unanswerable one
    // is not retried forever
    it('stops tracking an expired melt the mint will not answer for', async () => {
        const store = reconcilingStore({ ...pendingMelt(), expiry: 1 }, [
            inFlightPayment()
        ]);
        (CashuDevKit.checkMeltQuote as jest.Mock).mockRejectedValue(
            new Error('unknown quote')
        );

        await store.reconcilePendingMelts();

        expect(store.pendingMelts).toEqual([]);
        // the in-flight entry goes with it rather than staying in flight
        // with nothing left to settle it
        expect(store.payments).toEqual([]);
    });

    // Sweeps and self-custody claims pay an invoice from the user's own node,
    // which records the incoming payment itself
    it('records no ecash payment for a settled sweep', async () => {
        const store = reconcilingStore(pendingMelt('sweep'));
        (CashuDevKit.checkMeltQuote as jest.Mock).mockResolvedValue({
            id: 'quote-1',
            state: 'Paid',
            payment_preimage: 'b'.repeat(64)
        });

        await store.reconcilePendingMelts();

        expect(store.payments).toEqual([]);
        expect(store.pendingMelts).toEqual([]);
        expect(store.syncCDKBalances).toHaveBeenCalled();
    });

    it('skips melts from mints the user has since removed', async () => {
        const store = reconcilingStore(pendingMelt());
        store.mintUrls = ['https://other.example.com'];

        await store.reconcilePendingMelts();

        expect(CashuDevKit.checkMeltQuote).not.toHaveBeenCalled();
        expect(store.pendingMelts).toHaveLength(1);
    });
});
