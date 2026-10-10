jest.mock('../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('bitcoinjs-lib', () => ({}));
jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => require('crypto').randomBytes(n)
}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./ChannelsStore', () => ({}));
jest.mock('./BalanceStore', () => ({}));
jest.mock('./ModalStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        payOffer: jest.fn(),
        payLightningInvoice: jest.fn(),
        sendKeysend: jest.fn(),
        lookupPayment: jest.fn(),
        supportsPaymentLookup: jest.fn(() => true),
        supportsOffersDirectPay: jest.fn(() => true),
        isLNDBased: jest.fn(() => false)
    }
}));
jest.mock('../utils/Bolt11Utils', () => ({
    __esModule: true,
    default: {
        decode: jest.fn(() => ({ payment_hash: 'ab'.repeat(32) }))
    }
}));
jest.mock('../utils/GraphSyncUtils', () => ({
    checkGraphSyncBeforePayment: jest.fn(() => true)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (error: any) =>
        typeof error === 'string' ? error : error?.message
}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: {}
}));
jest.mock('../utils/RatingUtils', () => ({
    RATING_MODAL_TRIGGER_DELAY: 1000
}));

import TransactionsStore, {
    PAYMENT_TRACK_POLL_MS,
    PAYMENT_TRACK_MAX_FAILURES,
    PAYMENT_TRACK_MAX_NOT_FOUND,
    PAYMENT_TRACK_MAX_MS
} from './TransactionsStore';
import BackendUtils from '../utils/BackendUtils';
import { paymentLookupInconclusiveError } from '../utils/PaymentLookupUtils';

const payOffer = BackendUtils.payOffer as jest.Mock;
const payLightningInvoice = BackendUtils.payLightningInvoice as jest.Mock;
const sendKeysend = BackendUtils.sendKeysend as jest.Mock;
const supportsOffersDirectPay =
    BackendUtils.supportsOffersDirectPay as jest.Mock;

const offer = 'lno1qgsyxjtl6luzd9t3pr62xr7eemp6awnejusgf6gw45q75vcfqqqqqqq';

// 64-char hex: normalizePaymentHash rejects anything that isn't a real hash
const HASH = 'ab'.repeat(32);

const newStore = (implementation = 'ldk-node') =>
    new TransactionsStore(
        { implementation, enableTor: false, settings: {} } as any,
        {} as any,
        {} as any,
        {} as any,
        { checkAndTriggerRatingModal: jest.fn() } as any
    );

const deferred = () => {
    let resolve!: (value: any) => void;
    let reject!: (err: Error) => void;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

// let the payFunc .then/.catch chain run
const flushPromises = () =>
    new Promise(jest.requireActual('timers').setImmediate);

describe('TransactionsStore.sendPayment with an offer', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        payOffer.mockReset();
        payLightningInvoice.mockReset();
        sendKeysend.mockReset();
        supportsOffersDirectPay.mockReset();
        supportsOffersDirectPay.mockReturnValue(true);
        (BackendUtils.isLNDBased as jest.Mock).mockReturnValue(false);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('dispatches to payOffer with the offer, amount, fee limit and timeout', () => {
        payOffer.mockReturnValue(deferred().promise);

        const store = newStore();
        store.sendPayment({
            offer,
            amount: '1000',
            fee_limit_sat: '50',
            timeout_seconds: '30'
        });

        expect(payOffer).toHaveBeenCalledTimes(1);
        expect(payOffer).toHaveBeenCalledWith(
            expect.objectContaining({
                offer,
                amt: 1000,
                fee_limit_sat: 50,
                timeout_seconds: 30
            })
        );
        expect(payLightningInvoice).not.toHaveBeenCalled();
        expect(sendKeysend).not.toHaveBeenCalled();
    });

    it('enters the loading state SendingLightning animates on until the backend settles', async () => {
        const pending = deferred();
        payOffer.mockReturnValue(pending.promise);

        const store = newStore();
        // leftovers from a previous failed payment
        store.error = true;
        store.error_msg = 'old error';
        store.payment_error = 'old payment error';
        store.payment_preimage = 'old preimage';
        store.status = 'FAILED';

        store.sendPayment({ offer, amount: '1000' });

        expect(store.loading).toBe(true);
        expect(store.paymentInFlight).toBe(true);
        expect(store.error).toBe(false);
        expect(store.error_msg).toBeNull();
        expect(store.payment_error).toBeNull();
        expect(store.payment_preimage).toBeNull();
        expect(store.status).toBeNull();

        pending.resolve({
            payment_hash: 'ab'.repeat(32),
            payment_preimage: 'cd'.repeat(32),
            status: 'SUCCEEDED'
        });
        await flushPromises();

        expect(store.loading).toBe(false);
        expect(store.paymentInFlight).toBe(false);
        expect(store.error).toBe(false);
        expect(store.status).toBe('SUCCEEDED');
        expect(store.payment_preimage).toBe('cd'.repeat(32));
        expect(store.paymentDuration).not.toBeNull();
    });

    it('surfaces a failed payment as an error and releases the in-flight guard', async () => {
        payOffer.mockRejectedValue(new Error('RouteNotFound'));

        const store = newStore();
        store.sendPayment({ offer, amount: '1000' });
        await flushPromises();

        expect(store.loading).toBe(false);
        expect(store.paymentInFlight).toBe(false);
        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('RouteNotFound');
        expect(store.status).toBeNull();
    });

    // LdkNode reports an offer payment still pending at its timeout as
    // IN_FLIGHT; SendingLightning then shows it as in transit with no retry
    it('records an offer payment still pending at timeout as in transit, not an error', async () => {
        payOffer.mockResolvedValue({
            payment_hash: '',
            payment_preimage: '',
            fee_msat: '0',
            status: 'IN_FLIGHT'
        });

        const store = newStore();
        store.sendPayment({ offer, amount: '1000' });
        await flushPromises();

        expect(store.loading).toBe(false);
        expect(store.error).toBe(false);
        expect(store.error_msg).toBeNull();
        expect(store.payment_error).toBeNull();
        expect(store.status).toBe('IN_FLIGHT');
    });

    it('ignores a second send while a payment is in flight', () => {
        payOffer.mockReturnValue(deferred().promise);

        const store = newStore();
        store.sendPayment({ offer, amount: '1000' });
        store.sendPayment({ offer, amount: '1000' });

        expect(payOffer).toHaveBeenCalledTimes(1);
    });

    it('clears the in-flight guard after the timeout plus grace if the backend never settles', () => {
        payOffer.mockReturnValue(deferred().promise);

        const store = newStore();
        store.sendPayment({ offer, amount: '1000', timeout_seconds: '30' });

        jest.advanceTimersByTime(89_000);
        expect(store.paymentInFlight).toBe(true);
        jest.advanceTimersByTime(1_000);
        expect(store.paymentInFlight).toBe(false);
    });

    it('defaults the backstop to a 60 second payment timeout', () => {
        payOffer.mockReturnValue(deferred().promise);

        const store = newStore();
        store.sendPayment({ offer, amount: '1000' });

        jest.advanceTimersByTime(119_000);
        expect(store.paymentInFlight).toBe(true);
        jest.advanceTimersByTime(1_000);
        expect(store.paymentInFlight).toBe(false);
    });

    it('fails fast and releases the guard on a backend without direct offer pay', () => {
        supportsOffersDirectPay.mockReturnValue(false);

        const store = newStore('cln-rest');
        store.sendPayment({ offer, amount: '1000' });

        expect(payOffer).not.toHaveBeenCalled();
        expect(payLightningInvoice).not.toHaveBeenCalled();
        expect(store.loading).toBe(false);
        expect(store.paymentInFlight).toBe(false);
        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('views.Send.payBolt12.offersNotSupported');

        // the guard is free, so the next payment goes through
        payLightningInvoice.mockReturnValue(deferred().promise);
        store.sendPayment({ payment_request: 'lnbcrt1...' });
        expect(payLightningInvoice).toHaveBeenCalledTimes(1);
    });
});

const flush = () => jest.advanceTimersByTimeAsync(0);
const advancePoll = () => jest.advanceTimersByTimeAsync(PAYMENT_TRACK_POLL_MS);

describe('TransactionsStore payment tracking (issue #4317)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        (BackendUtils.supportsPaymentLookup as jest.Mock).mockReturnValue(true);
        (BackendUtils.isLNDBased as jest.Mock).mockReturnValue(true);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('holds the guard on an IN_FLIGHT result and tracks to SUCCEEDED', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });
        // the first lookup fires immediately when tracking starts; the
        // terminal result lands on the second poll
        (BackendUtils.lookupPayment as jest.Mock)
            .mockResolvedValueOnce({ status: 'IN_FLIGHT', payment_hash: HASH })
            .mockResolvedValueOnce({ status: 'IN_FLIGHT', payment_hash: HASH })
            .mockResolvedValueOnce({
                status: 'SUCCEEDED',
                payment_hash: HASH,
                payment_preimage: 'deadbeef'
            });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        // stream ended non-terminal: guard must stay armed
        expect(store.paymentInFlight).toBe(true);
        expect(store.status).toBe('IN_FLIGHT');

        await advancePoll();
        expect(store.paymentInFlight).toBe(true);

        await advancePoll();
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('SUCCEEDED');
        expect(store.error).toBe(false);
    });

    it('treats a client-side timeout as unknown and surfaces the tracked FAILED outcome', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            payment_error: 'views.SendingLightning.paymentTimedOut',
            payment_timed_out: true
        });
        // hold the first lookup open so the ambiguous state is observable
        let resolveLookup: (value: any) => void = () => {};
        (BackendUtils.lookupPayment as jest.Mock).mockReturnValue(
            new Promise((resolve) => {
                resolveLookup = resolve;
            })
        );

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        // outcome unknown: no error yet, guard held, in-transit UI
        expect(store.paymentInFlight).toBe(true);
        expect(store.error).toBe(false);
        expect(store.status).toBe('IN_FLIGHT');

        resolveLookup({
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_TIMEOUT',
            payment_hash: HASH
        });
        await flush();
        expect(store.paymentInFlight).toBe(false);
        expect(store.error).toBe(true);
        expect(store.status).toBe('FAILED');
    });

    it('replaces a transport error with success when the payment settled anyway', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            new Error('connection closed')
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'SUCCEEDED',
            payment_hash: HASH,
            payment_preimage: 'deadbeef'
        });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('SUCCEEDED');
        expect(store.error).toBe(false);
    });

    it('releases the guard after repeated no-record answers from the node', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            new Error('invoice is invalid')
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue(null);

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        // the error surfaces immediately, but one no-record answer isn't
        // proof the dispatch never reached the node (the request may still
        // be in transit), so the guard stays held
        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('invoice is invalid');
        expect(store.paymentInFlight).toBe(true);

        for (let i = 0; i < PAYMENT_TRACK_MAX_NOT_FOUND - 1; i++) {
            await advancePoll();
        }
        expect(store.paymentInFlight).toBe(false);
        expect(store.error).toBe(true);
        // the dispatch error is more specific than the generic not-sent copy
        expect(store.error_msg).toBe('invoice is invalid');
        expect(BackendUtils.lookupPayment).toHaveBeenCalledTimes(
            PAYMENT_TRACK_MAX_NOT_FOUND
        );
        // lookups are bounded to payments created around dispatch, so a
        // busy node's newer payments can't evict ours from the page
        expect(BackendUtils.lookupPayment).toHaveBeenCalledWith({
            payment_hash: HASH,
            creation_date_start: expect.any(Number)
        });
    });

    it('keeps tracking when a no-record answer precedes the payment appearing', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            new Error('connection closed')
        );
        // the dispatch request was still in transit when the first lookup
        // answered; the payment then appears and settles
        (BackendUtils.lookupPayment as jest.Mock)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ status: 'IN_FLIGHT', payment_hash: HASH })
            .mockResolvedValueOnce({
                status: 'SUCCEEDED',
                payment_hash: HASH,
                payment_preimage: 'deadbeef'
            });

        const store = newStore();
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.paymentInFlight).toBe(true);

        await advancePoll();
        expect(store.paymentInFlight).toBe(true);
        expect(store.status).toBe('IN_FLIGHT');

        await advancePoll();
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('SUCCEEDED');
        expect(store.error).toBe(false);
    });

    it('gives up after consecutive failed lookups and releases the guard', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });
        (BackendUtils.lookupPayment as jest.Mock).mockRejectedValue(
            new Error('node unreachable')
        );

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.paymentInFlight).toBe(true);

        for (let i = 0; i < PAYMENT_TRACK_MAX_FAILURES; i++) {
            await advancePoll();
        }
        expect(store.paymentInFlight).toBe(false);
        expect(BackendUtils.lookupPayment).toHaveBeenCalledTimes(
            PAYMENT_TRACK_MAX_FAILURES
        );
        // outcome unknown: stays in transit rather than failed (a failed
        // screen offers a retry that could double-pay), flagged unverified
        expect(store.status).toBe('IN_FLIGHT');
        expect(store.error).toBe(false);
        expect(store.paymentOutcomeUnverified).toBe(true);
    });

    it('shows a timed-out payment the node never recorded as not sent', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockImplementation(() =>
            Promise.resolve({
                payment_error: 'views.SendingLightning.paymentTimedOut',
                payment_timed_out: true,
                dispatch_deadline_ms: Date.now()
            })
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue(null);

        const store = newStore();
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.status).toBe('IN_FLIGHT');
        expect(store.error).toBe(false);

        for (let i = 1; i < PAYMENT_TRACK_MAX_NOT_FOUND; i++) {
            await advancePoll();
        }
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe(null);
        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('views.SendingLightning.paymentNotSent');
        expect(store.paymentOutcomeUnverified).toBe(false);
    });

    it('ignores no-record answers until the send request can no longer arrive', async () => {
        // the request is torn down just after the third lookup
        (BackendUtils.payLightningInvoice as jest.Mock).mockImplementation(() =>
            Promise.resolve({
                payment_error: 'views.SendingLightning.paymentTimedOut',
                payment_timed_out: true,
                dispatch_deadline_ms: Date.now() + 2 * PAYMENT_TRACK_POLL_MS + 1
            })
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue(null);

        const store = newStore();
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        // enough no-record answers to conclude, but all before the deadline
        for (let i = 1; i < PAYMENT_TRACK_MAX_NOT_FOUND; i++) {
            await advancePoll();
        }
        expect(store.paymentInFlight).toBe(true);
        expect(store.status).toBe('IN_FLIGHT');
        expect(store.error).toBe(false);

        // answers from the deadline on count
        for (let i = 1; i < PAYMENT_TRACK_MAX_NOT_FOUND; i++) {
            await advancePoll();
        }
        expect(store.paymentInFlight).toBe(true);
        await advancePoll();
        expect(store.paymentInFlight).toBe(false);
        expect(store.error_msg).toBe('views.SendingLightning.paymentNotSent');
    });

    it('does not show a timed-out send without a dispatch deadline as not sent', async () => {
        // LNC shape: the stream is never cancelled, so the request could
        // still reach the node after any number of no-record answers
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            payment_error: 'views.SendingLightning.paymentTimedOut',
            payment_timed_out: true
        });
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue(null);

        const store = newStore();
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        for (let i = 1; i < PAYMENT_TRACK_MAX_NOT_FOUND; i++) {
            await advancePoll();
        }
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('IN_FLIGHT');
        expect(store.error).toBe(false);
        expect(store.paymentOutcomeUnverified).toBe(true);
    });

    it('keeps tracking through inconclusive lookups until the ceiling', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            payment_error: 'views.SendingLightning.paymentTimedOut',
            payment_timed_out: true
        });
        (BackendUtils.lookupPayment as jest.Mock).mockImplementation(() =>
            Promise.reject(paymentLookupInconclusiveError())
        );

        const store = newStore();
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        // a truncated scan is neither a no-record answer nor a failure
        const limit = Math.max(
            PAYMENT_TRACK_MAX_NOT_FOUND,
            PAYMENT_TRACK_MAX_FAILURES
        );
        for (let i = 0; i < limit; i++) {
            await advancePoll();
        }
        expect(store.paymentInFlight).toBe(true);

        await jest.advanceTimersByTimeAsync(PAYMENT_TRACK_MAX_MS);
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('IN_FLIGHT');
        expect(store.error).toBe(false);
        expect(store.paymentOutcomeUnverified).toBe(true);

        // the next send starts with a clean slate
        (BackendUtils.payLightningInvoice as jest.Mock).mockReturnValue(
            new Promise(() => {})
        );
        store.sendPayment({ payment_request: 'lnbc1fake' });
        expect(store.paymentOutcomeUnverified).toBe(false);
    });

    it('keeps the pre-tracking behavior on backends without payment lookup', async () => {
        (BackendUtils.supportsPaymentLookup as jest.Mock).mockReturnValue(
            false
        );
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('IN_FLIGHT');
        expect(BackendUtils.lookupPayment).not.toHaveBeenCalled();
    });

    it('ignores a second send while a tracked payment is unresolved', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.paymentInFlight).toBe(true);

        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(BackendUtils.payLightningInvoice).toHaveBeenCalledTimes(1);
    });

    it('lets an unscoped handlePayment (Rebalance view path) stop tracking and clear the guard', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.paymentInFlight).toBe(true);

        store.handlePayment({
            status: 'SUCCEEDED',
            payment_hash: HASH,
            payment_preimage: 'deadbeef'
        });
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('SUCCEEDED');

        // the orphaned tracking loop must exit without resurrecting state
        const calls = (BackendUtils.lookupPayment as jest.Mock).mock.calls
            .length;
        await advancePoll();
        await advancePoll();
        expect(
            (BackendUtils.lookupPayment as jest.Mock).mock.calls.length
        ).toBeLessThanOrEqual(calls + 1);
        expect(store.paymentInFlight).toBe(false);
    });
});
