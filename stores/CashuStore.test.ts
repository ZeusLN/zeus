jest.mock('./Stores', () => ({
    activityStore: { getSortedActivity: jest.fn() },
    connectivityStore: {}
}));
jest.mock('./SettingsStore', () => ({ DEFAULT_NOSTR_RELAYS: [] }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@nostr-dev-kit/ndk', () => ({}));
jest.mock('../utils/NostrUtils', () => ({}));
jest.mock('../utils/NostrMintBackup', () => ({}));
jest.mock('../utils/MigrationUtils', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
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
import CashuStore from './CashuStore';
import CashuPayment from '../models/CashuPayment';
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

    // CDK resolves an unsettled melt with a non-Paid state instead of
    // throwing, and the single-mint path used to report that as a paid
    // invoice: payment success with an empty preimage for an invoice the
    // mint had not paid
    it('reports a Pending melt as in flight, not as a successful payment', async () => {
        const store = payingStore();
        (CashuDevKit.melt as jest.Mock).mockResolvedValue({
            state: 'Pending',
            amount: 1000,
            fee_paid: 0
        });

        await store.payLnInvoiceFromEcash({ amount: '1000' });

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

        await store.payLnInvoiceFromEcash({ amount: '1000' });

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

        await store.payLnInvoiceFromEcash({ amount: '1000' });

        expect(store.paymentError).toBe(false);
        expect(store.paymentSuccess).toBe(true);
        expect(store.paymentPreimage).toBe('a'.repeat(64));
        expect(store.paymentFee).toBe(2);
        expect(store.payments).toHaveLength(1);
        expect(store.payments[0].isInTransit).toBe(false);
        expect(store.pendingMelts).toEqual([]);
    });

    it('keeps tracking a melt whose execution never returned', async () => {
        const store = payingStore();
        (CashuDevKit.melt as jest.Mock).mockRejectedValue(
            new Error('network request failed')
        );

        await store.payLnInvoiceFromEcash({ amount: '1000' });

        expect(store.paymentSuccess).toBe(false);
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

            await store.payLnInvoiceFromEcash({ amount: '1000' });

            expect(store.paymentSuccess).toBe(false);
            expect(store.syncCDKBalances).toHaveBeenCalledWith(true);
        }
    );
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
        expect(store.pendingMelts).toEqual([]);
        expect(store.syncCDKBalances).toHaveBeenCalled();
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

    it('leaves a still-pending melt alone', async () => {
        const store = reconcilingStore(pendingMelt(), [inFlightPayment()]);
        (CashuDevKit.checkMeltQuote as jest.Mock).mockResolvedValue({
            id: 'quote-1',
            state: 'Pending'
        });

        await store.reconcilePendingMelts();

        expect(store.payments).toHaveLength(1);
        expect(store.payments[0].isInTransit).toBe(true);
        expect(store.pendingMelts).toHaveLength(1);
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
        const store = reconcilingStore({ ...pendingMelt(), expiry: 1 });
        (CashuDevKit.checkMeltQuote as jest.Mock).mockRejectedValue(
            new Error('unknown quote')
        );

        await store.reconcilePendingMelts();

        expect(store.pendingMelts).toEqual([]);
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
