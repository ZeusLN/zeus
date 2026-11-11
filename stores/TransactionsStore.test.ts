jest.mock('../stores/Stores');
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
        sendCoins: jest.fn(),
        fundPsbt: jest.fn(),
        lookupPayment: jest.fn(),
        supportsPaymentLookup: jest.fn(() => true),
        supportsOffersDirectPay: jest.fn(() => true),
        supportsOnchainSendMax: jest.fn(() => true),
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
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: {}
}));
jest.mock('../utils/RatingUtils', () => ({
    RATING_MODAL_TRIGGER_DELAY: 1000
}));

import { createHash } from 'node:crypto';
import TransactionsStore, {
    PAYMENT_TRACK_POLL_MS,
    PAYMENT_TRACK_MAX_FAILURES,
    PAYMENT_TRACK_MAX_NOT_FOUND,
    PAYMENT_TRACK_MAX_MS,
    PAYMENT_STALE_ATTEMPT_SLACK_MS
} from './TransactionsStore';
import BackendUtils from '../utils/BackendUtils';
import { checkGraphSyncBeforePayment } from '../utils/GraphSyncUtils';
import {
    markNodeResponded,
    paymentLookupInconclusiveError
} from '../utils/PaymentLookupUtils';
import { lnrpc } from '../proto/lightning';

const payOffer = BackendUtils.payOffer as jest.Mock;
const payLightningInvoice = BackendUtils.payLightningInvoice as jest.Mock;
const sendKeysend = BackendUtils.sendKeysend as jest.Mock;
const sendCoins = BackendUtils.sendCoins as jest.Mock;
const fundPsbt = BackendUtils.fundPsbt as jest.Mock;
const isLNDBased = BackendUtils.isLNDBased as jest.Mock;
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
        // errorToUserFriendly splits PascalCase error codes into words
        expect(store.error_msg).toBe('Route not found');
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

describe('TransactionsStore.sendCoins with selected UTXOs on LND', () => {
    const utxo = `${'cd'.repeat(32)}:0`;
    const request = {
        addr: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
        amount: '100000',
        sat_per_vbyte: '5',
        spend_unconfirmed: true,
        account: 'default',
        utxos: [utxo]
    };

    beforeEach(() => {
        sendCoins.mockReset();
        sendCoins.mockReturnValue(deferred().promise);
        fundPsbt.mockReset();
        fundPsbt.mockReturnValue(deferred().promise);
        isLNDBased.mockReturnValue(true);
    });

    afterEach(() => {
        isLNDBased.mockReturnValue(false);
    });

    it('passes the UTXOs to sendCoins as outpoints for a single output', () => {
        newStore('lnd').sendCoins({ ...request, additional_outputs: [] });

        expect(fundPsbt).not.toHaveBeenCalled();
        expect(sendCoins).toHaveBeenCalledTimes(1);
        expect(sendCoins).toHaveBeenCalledWith(
            expect.objectContaining({
                addr: request.addr,
                amount: '100000',
                outpoints: [{ txid_str: 'cd'.repeat(32), output_index: 0 }]
            })
        );
    });

    it('funds a PSBT paying every output when there are additional outputs', () => {
        const address = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
        newStore('lnd').sendCoins({
            ...request,
            additional_outputs: [
                { address, amount: '250000', satAmount: '250000' }
            ]
        });

        expect(sendCoins).not.toHaveBeenCalled();
        expect(fundPsbt).toHaveBeenCalledTimes(1);
        expect(fundPsbt).toHaveBeenCalledWith(
            expect.objectContaining({
                raw: {
                    outputs: { [request.addr]: 100000, [address]: 250000 },
                    inputs: [{ txid_str: 'cd'.repeat(32), output_index: 0 }]
                },
                account: 'default'
            })
        );
    });

    it('pays an address entered more than once the sum of its amounts', () => {
        newStore('lnd').sendCoins({
            ...request,
            additional_outputs: [
                { address: request.addr, amount: '20000', satAmount: '20000' },
                { address: request.addr, amount: '3000', satAmount: '3000' }
            ]
        });

        expect(fundPsbt).toHaveBeenCalledWith(
            expect.objectContaining({
                raw: {
                    outputs: { [request.addr]: 123000 },
                    inputs: [{ txid_str: 'cd'.repeat(32), output_index: 0 }]
                }
            })
        );
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

    it('releases the guard after one no-record answer when the node rejected the send', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            markNodeResponded(
                new Error(
                    'amount must be specified when paying a zero amount invoice'
                )
            )
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue(null);

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        // the node processed the request and records a payment before
        // dispatching it, so its no-record answer is conclusive
        expect(store.paymentInFlight).toBe(false);
        expect(store.error).toBe(true);
        expect(store.error_msg).toBe(
            'amount must be specified when paying a zero amount invoice'
        );
        expect(BackendUtils.lookupPayment).toHaveBeenCalledTimes(1);
    });

    it('keeps tracking a node-rejected send the node has recorded', async () => {
        // with no_inflight_updates, LND reports an error after dispatch
        // (e.g. shutting down) as an error status from the node itself
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            markNodeResponded(new Error('routerrpc server shutting down'))
        );
        (BackendUtils.lookupPayment as jest.Mock)
            .mockResolvedValueOnce({ status: 'IN_FLIGHT', payment_hash: HASH })
            .mockResolvedValueOnce({
                status: 'SUCCEEDED',
                payment_hash: HASH,
                payment_preimage: 'deadbeef'
            });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.paymentInFlight).toBe(true);
        expect(store.status).toBe('IN_FLIGHT');

        await advancePoll();
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('SUCCEEDED');
        expect(store.error).toBe(false);
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

    it('keeps tracking through lookup failures once the node has reported the payment', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            payment_error: 'views.SendingLightning.paymentTimedOut',
            payment_timed_out: true
        });
        // the node reports the payment pending, then becomes unreachable
        // for longer than the failure limit, then reports it settled
        const lookup = BackendUtils.lookupPayment as jest.Mock;
        lookup.mockResolvedValueOnce({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });
        for (let i = 0; i < PAYMENT_TRACK_MAX_FAILURES + 2; i++) {
            lookup.mockRejectedValueOnce(new Error('node unreachable'));
        }
        lookup.mockResolvedValueOnce({
            status: 'SUCCEEDED',
            payment_hash: HASH,
            payment_preimage: 'deadbeef'
        });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.status).toBe('IN_FLIGHT');

        for (let i = 0; i < PAYMENT_TRACK_MAX_FAILURES + 2; i++) {
            await advancePoll();
        }
        // the HTLC is known to be pending: an outage must not release the
        // guard and reopen the keysend double-pay window
        expect(store.paymentInFlight).toBe(true);
        expect(store.paymentOutcomeUnverified).toBe(false);

        await advancePoll();
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('SUCCEEDED');
    });

    it('releases at the ceiling when lookups keep failing after the node answered', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            payment_error: 'views.SendingLightning.paymentTimedOut',
            payment_timed_out: true
        });
        (BackendUtils.lookupPayment as jest.Mock)
            .mockResolvedValueOnce({ status: 'IN_FLIGHT', payment_hash: HASH })
            .mockRejectedValue(new Error('node unreachable'));

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        await jest.advanceTimersByTimeAsync(PAYMENT_TRACK_MAX_MS - 1000);
        expect(store.paymentInFlight).toBe(true);

        await jest.advanceTimersByTimeAsync(PAYMENT_TRACK_POLL_MS + 1000);
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('IN_FLIGHT');
        expect(store.error).toBe(false);
        expect(store.paymentOutcomeUnverified).toBe(true);
    });

    it("doesn't surface an earlier attempt's failed record as this attempt's outcome", async () => {
        // a retry of an invoice whose earlier attempt failed: the old record
        // is still on the node because the retry hasn't reached it yet
        const staleFailure = {
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_NO_ROUTE',
            payment_hash: HASH,
            creation_date: String(
                Math.floor(
                    (Date.now() - PAYMENT_STALE_ATTEMPT_SLACK_MS - 60_000) /
                        1000
                )
            )
        };
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            new Error('connection closed')
        );
        (BackendUtils.lookupPayment as jest.Mock)
            .mockResolvedValueOnce(staleFailure)
            .mockResolvedValueOnce({ status: 'IN_FLIGHT', payment_hash: HASH })
            .mockResolvedValueOnce({
                status: 'SUCCEEDED',
                payment_hash: HASH,
                payment_preimage: 'deadbeef'
            });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.paymentInFlight).toBe(true);
        expect(store.status).not.toBe('FAILED');

        await advancePoll();
        expect(store.status).toBe('IN_FLIGHT');

        await advancePoll();
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('SUCCEEDED');
        expect(store.error).toBe(false);
    });

    it("treats an earlier attempt's failed record as no record of this attempt", async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            new Error('connection closed')
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'FAILED',
            payment_hash: HASH,
            // embedded LND returns int64 fields as Long
            creation_time_ns: {
                toString: () =>
                    String(
                        (Date.now() - PAYMENT_STALE_ATTEMPT_SLACK_MS - 60_000) *
                            1e6
                    )
            }
        });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        for (let i = 1; i < PAYMENT_TRACK_MAX_NOT_FOUND; i++) {
            await advancePoll();
        }
        // the retry never reached the node: released with the dispatch
        // error, not the earlier attempt's failure
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).not.toBe('FAILED');
        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('connection closed');
    });

    it('surfaces a failed record created around dispatch', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            new Error('connection closed')
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_NO_ROUTE',
            payment_hash: HASH,
            // node clock slightly behind the device's, inside the slack
            creation_date: String(Math.floor((Date.now() - 30_000) / 1000))
        });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('FAILED');
        expect(store.error).toBe(true);
    });

    // an earlier attempt's success for the same invoice, created before
    // this attempt's dispatch minus the stale-attempt slack
    const staleSuccess = () => ({
        status: 'SUCCEEDED',
        payment_hash: HASH,
        payment_preimage: 'deadbeef',
        creation_date: String(
            Math.floor(
                (Date.now() - PAYMENT_STALE_ATTEMPT_SLACK_MS - 60_000) / 1000
            )
        )
    });

    it('releases the guard without tracking when the node refuses a duplicate payment', async () => {
        // re-paying an invoice that already settled: LND refuses the send
        // with AlreadyExists before dispatching anything
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            markNodeResponded(new Error('invoice is already paid'), 6)
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'SUCCEEDED',
            payment_hash: HASH,
            payment_preimage: 'deadbeef',
            // the earlier attempt settled seconds ago, inside the slack
            creation_date: String(Math.floor((Date.now() - 10_000) / 1000))
        });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        // the earlier attempt's success must not show as this attempt's
        expect(BackendUtils.lookupPayment).not.toHaveBeenCalled();
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).not.toBe('SUCCEEDED');
        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('invoice is already paid');
    });

    it('treats a duplicate refusal from embedded LND the same way', async () => {
        const refusal = new Error('payment is in transition');
        (refusal as any).grpcCode = 'AlreadyExists';
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            markNodeResponded(refusal, 'AlreadyExists')
        );

        const store = newStore('embedded-lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        expect(BackendUtils.lookupPayment).not.toHaveBeenCalled();
        expect(store.paymentInFlight).toBe(false);
        expect(store.error_msg).toBe('payment is in transition');
    });

    it("treats an earlier attempt's succeeded record as no record of this attempt", async () => {
        // the refusal was lost in transit, so only the lookup sees the
        // earlier success
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            new Error('connection closed')
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue(
            staleSuccess()
        );

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.status).not.toBe('SUCCEEDED');

        for (let i = 1; i < PAYMENT_TRACK_MAX_NOT_FOUND; i++) {
            await advancePoll();
        }
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).not.toBe('SUCCEEDED');
        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('connection closed');
    });

    it('trusts a keysend success regardless of its creation time', async () => {
        // a keysend hash is new to this attempt, so an old-looking creation
        // time can only be clock skew; showing it as not sent would invite
        // a retry that pays again under a fresh hash
        // LND REST sends keysend through payLightningInvoice
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            new Error('connection closed')
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue(
            staleSuccess()
        );

        const store = newStore('lnd');
        store.sendPayment({ pubkey: '02' + 'ab'.repeat(32), amount: '1000' });
        await flush();

        expect(BackendUtils.lookupPayment).toHaveBeenCalledTimes(1);
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('SUCCEEDED');
        expect(store.error).toBe(false);
    });

    it('sends sha256 of the keysend preimage as the payment hash', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockReturnValue(
            new Promise(() => {})
        );

        const store = newStore('lnd');
        store.sendPayment({ pubkey: '02' + 'ab'.repeat(32), amount: '1000' });
        await flush();

        const data = (BackendUtils.payLightningInvoice as jest.Mock).mock
            .calls[0][0];
        const [secret] = Object.values(data.dest_custom_records) as string[];
        const preimage = Buffer.from(secret, 'base64');
        expect(preimage).toHaveLength(32);
        // Node's crypto, independent of the app's hashing library
        expect(Buffer.from(data.payment_hash, 'base64').toString('hex')).toBe(
            createHash('sha256').update(preimage).digest('hex')
        );
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

describe('TransactionsStore releasePaymentInFlight', () => {
    const HASH2 = 'cd'.repeat(32);

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        (BackendUtils.supportsPaymentLookup as jest.Mock).mockReturnValue(true);
        (BackendUtils.isLNDBased as jest.Mock).mockReturnValue(true);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('refuses to release the guard before the node reports the payment in flight', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            payment_error: 'views.SendingLightning.paymentTimedOut',
            payment_timed_out: true
        });
        // the first lookup hasn't answered yet
        (BackendUtils.lookupPayment as jest.Mock).mockReturnValue(
            new Promise(() => {})
        );

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        expect(store.paymentInFlight).toBe(true);
        expect(store.paymentInFlightConfirmed).toBe(false);
        expect(store.releasePaymentInFlight()).toBe(false);
        expect(store.paymentInFlight).toBe(true);
    });

    it('confirms a payment the node reports in flight after a timeout', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            payment_error: 'views.SendingLightning.paymentTimedOut',
            payment_timed_out: true
        });
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        expect(store.paymentInFlightConfirmed).toBe(true);
    });

    it("lets a second payment go out once released and ignores the first one's late outcome", async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValueOnce({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });
        // the tracker's first lookup is still open when the user releases
        const firstLookup = deferred();
        (BackendUtils.lookupPayment as jest.Mock).mockReturnValueOnce(
            firstLookup.promise
        );

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.paymentInFlightConfirmed).toBe(true);

        expect(store.releasePaymentInFlight()).toBe(true);
        expect(store.paymentInFlight).toBe(false);
        expect(store.paymentInFlightConfirmed).toBe(false);

        // a second, unrelated invoice
        const Bolt11Utils = require('../utils/Bolt11Utils').default;
        (Bolt11Utils.decode as jest.Mock).mockReturnValueOnce({
            payment_hash: HASH2
        });
        const second = deferred();
        (BackendUtils.payLightningInvoice as jest.Mock).mockReturnValueOnce(
            second.promise
        );
        store.sendPayment({ payment_request: 'lnbc1other' });
        await flush();
        expect(BackendUtils.payLightningInvoice).toHaveBeenCalledTimes(2);
        expect(store.paymentInFlight).toBe(true);
        expect(store.paymentInFlightConfirmed).toBe(false);

        // the first payment settles: its tracker must not report it as
        // the second payment's outcome
        firstLookup.resolve({
            status: 'SUCCEEDED',
            payment_hash: HASH,
            payment_preimage: 'deadbeef'
        });
        await flush();
        expect(store.status).toBeNull();
        expect(store.payment_preimage).toBeNull();
        expect(store.paymentInFlight).toBe(true);

        const lookups = (BackendUtils.lookupPayment as jest.Mock).mock.calls
            .length;
        await advancePoll();
        expect(BackendUtils.lookupPayment).toHaveBeenCalledTimes(lookups);

        second.resolve({
            status: 'SUCCEEDED',
            payment_hash: HASH2,
            payment_preimage: 'beefdead'
        });
        await flush();
        expect(store.status).toBe('SUCCEEDED');
        expect(store.paymentInFlight).toBe(false);
    });

    it("ignores the released payment's send request resolving late", async () => {
        // the send request never answers (e.g. a dropped LNC stream), so
        // the backstop starts tracking and the node reports it in flight
        const first = deferred();
        (BackendUtils.payLightningInvoice as jest.Mock).mockReturnValueOnce(
            first.promise
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await jest.advanceTimersByTimeAsync((60 + 60) * 1000);
        expect(store.paymentInFlightConfirmed).toBe(true);
        expect(store.releasePaymentInFlight()).toBe(true);

        const Bolt11Utils = require('../utils/Bolt11Utils').default;
        (Bolt11Utils.decode as jest.Mock).mockReturnValueOnce({
            payment_hash: HASH2
        });
        (BackendUtils.payLightningInvoice as jest.Mock).mockReturnValueOnce(
            new Promise(() => {})
        );
        store.sendPayment({ payment_request: 'lnbc1other' });
        await flush();

        first.resolve({
            status: 'SUCCEEDED',
            payment_hash: HASH,
            payment_preimage: 'deadbeef'
        });
        await flush();
        expect(store.status).toBeNull();
        expect(store.payment_preimage).toBeNull();
        expect(store.loading).toBe(true);
        expect(store.paymentInFlight).toBe(true);
    });

    // the send request never answers, so the backstop starts tracking and
    // the node reports the payment in flight
    const startHungPayment = async (store: TransactionsStore) => {
        const first = deferred();
        (BackendUtils.payLightningInvoice as jest.Mock).mockReturnValueOnce(
            first.promise
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await jest.advanceTimersByTimeAsync((60 + 60) * 1000);
        expect(store.paymentInFlightConfirmed).toBe(true);
        return first;
    };

    it("ignores the released payment's send request rejecting late", async () => {
        const store = newStore('lnd');
        const first = await startHungPayment(store);
        expect(store.releasePaymentInFlight()).toBe(true);

        const Bolt11Utils = require('../utils/Bolt11Utils').default;
        (Bolt11Utils.decode as jest.Mock).mockReturnValueOnce({
            payment_hash: HASH2
        });
        (BackendUtils.payLightningInvoice as jest.Mock).mockReturnValueOnce(
            new Promise(() => {})
        );
        store.sendPayment({ payment_request: 'lnbc1other' });
        await flush();

        first.reject(new Error('stream closed'));
        await flush();
        expect(store.error).toBe(false);
        expect(store.error_msg).toBeNull();
        expect(store.loading).toBe(true);
        expect(store.paymentInFlight).toBe(true);
    });

    it("clears loading when the released payment's send request is still open", async () => {
        const store = newStore('lnd');
        await startHungPayment(store);
        expect(store.loading).toBe(true);

        expect(store.releasePaymentInFlight()).toBe(true);
        expect(store.loading).toBe(false);
    });

    it("keeps one tracker for the next payment when the released payment's tracker exits", async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValueOnce({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });
        // the released payment's tracker is mid-lookup
        const firstLookup = deferred();
        (BackendUtils.lookupPayment as jest.Mock).mockReturnValueOnce(
            firstLookup.promise
        );

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.releasePaymentInFlight()).toBe(true);

        // a second payment that stays in flight and is tracked
        const Bolt11Utils = require('../utils/Bolt11Utils').default;
        (Bolt11Utils.decode as jest.Mock).mockReturnValueOnce({
            payment_hash: HASH2
        });
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValueOnce({
            status: 'IN_FLIGHT',
            payment_hash: HASH2
        });
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH2
        });
        store.sendPayment({ payment_request: 'lnbc1other' });
        await flush();

        // the released tracker's lookup answers and it exits
        firstLookup.resolve({ status: 'IN_FLIGHT', payment_hash: HASH });
        await flush();

        // the second payment's backstop must see its tracker still running
        await jest.advanceTimersByTimeAsync((60 + 60) * 1000);
        const lookups = (BackendUtils.lookupPayment as jest.Mock).mock.calls
            .length;
        await advancePoll();
        expect(
            (BackendUtils.lookupPayment as jest.Mock).mock.calls.length -
                lookups
        ).toBe(1);
        expect(store.paymentInFlight).toBe(true);
    });
});

describe('TransactionsStore.getPaymentOutcome', () => {
    it('derives a successful outcome without writing to the store', () => {
        const store = newStore('lnd');

        const outcome = store.getPaymentOutcome({
            payment_hash: 'ab'.repeat(32),
            payment_preimage: 'cd'.repeat(32),
            fee_sat: '3',
            status: 'SUCCEEDED'
        });

        expect(outcome).toEqual(
            expect.objectContaining({
                payment_hash: 'ab'.repeat(32),
                payment_preimage: 'cd'.repeat(32),
                payment_fee: '3',
                isIncomplete: false,
                status: 'SUCCEEDED'
            })
        );
        expect(outcome.error).toBeUndefined();
        expect(store.payment_hash).toBeUndefined();
        expect(store.payment_preimage).toBeUndefined();
        expect(store.status).toBeUndefined();
    });

    it('marks a failed payment as an error', () => {
        const store = newStore('lnd');

        const outcome = store.getPaymentOutcome({
            payment_hash: 'ab'.repeat(32),
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_NO_ROUTE'
        });

        expect(outcome.error).toBe(true);
        expect(outcome.payment_error).toBeTruthy();
        expect(outcome.status).toBe('FAILED');
        expect(store.error).toBe(false);
    });

    it('reports an LndHub error message', () => {
        const store = newStore('lndhub');

        const outcome = store.getPaymentOutcome({
            error: true,
            message: 'not enough balance'
        });

        expect(outcome.error).toBe(true);
        expect(outcome.error_msg).toBe('not enough balance');
        expect(outcome.status).toBeUndefined();
    });

    it('does not mark a CLN timed-out payment as complete', () => {
        const store = newStore('cln-rest');

        // CLNRest.payWithTimeout's timed-out shape
        const outcome = store.getPaymentOutcome({
            payment_error: 'views.SendingLightning.paymentTimedOut'
        });

        expect(outcome.error).toBe(true);
        expect(outcome.payment_error).toBeTruthy();
        expect(outcome.status).not.toBe('complete');
    });

    it('does not mark an LndHub timed-out payment as complete', () => {
        const store = newStore('lndhub');

        // LndHub.payLightningInvoice's timed-out shape
        const outcome = store.getPaymentOutcome({
            payment_error: 'views.SendingLightning.paymentTimedOut'
        });

        expect(outcome.error).toBe(true);
        expect(outcome.status).not.toBe('complete');
    });

    it("keeps the backend's status on an errored payment", () => {
        const store = newStore('cln-rest');

        const outcome = store.getPaymentOutcome({
            payment_error: 'route not found',
            status: 'failed'
        });

        expect(outcome.error).toBe(true);
        expect(outcome.status).toBe('failed');
    });

    it("keeps embedded LND's numeric status on a failed payment", () => {
        const store = newStore('embedded-lnd');

        const outcome = store.getPaymentOutcome({
            payment_hash: 'ab'.repeat(32),
            status: lnrpc.Payment.PaymentStatus.FAILED,
            failure_reason: lnrpc.PaymentFailureReason.FAILURE_REASON_NO_ROUTE
        });

        expect(outcome.error).toBe(true);
        expect(outcome.payment_error).toBeTruthy();
        expect(outcome.status).toBe(lnrpc.Payment.PaymentStatus.FAILED);
    });

    it('does not mark an embedded LND payment error without a status as complete', () => {
        const store = newStore('embedded-lnd');

        const outcome = store.getPaymentOutcome({
            payment_error: 'views.SendingLightning.paymentTimedOut'
        });

        expect(outcome.error).toBe(true);
        expect(outcome.payment_error).toBeTruthy();
        expect(outcome.status).toBeUndefined();
    });

    it('marks a successful payment without a status as complete', () => {
        const store = newStore('lndhub');

        const outcome = store.getPaymentOutcome({
            payment_hash: 'ab'.repeat(32),
            payment_preimage: 'cd'.repeat(32)
        });

        expect(outcome.error).toBeUndefined();
        expect(outcome.status).toBe('complete');
    });

    it('does not show a timed-out CLN keysend as both failed and complete', async () => {
        jest.useFakeTimers();
        try {
            (BackendUtils.supportsPaymentLookup as jest.Mock).mockReturnValue(
                false
            );
            sendKeysend.mockResolvedValueOnce({
                payment_error: 'views.SendingLightning.paymentTimedOut'
            });

            const store = newStore('cln-rest');
            store.sendPayment({ pubkey: '02'.repeat(33), amount: '1000' });
            await jest.advanceTimersByTimeAsync(0);

            expect(store.loading).toBe(false);
            expect(store.error).toBe(true);
            expect(store.status).not.toBe('complete');
        } finally {
            (BackendUtils.supportsPaymentLookup as jest.Mock).mockReturnValue(
                true
            );
            jest.useRealTimers();
        }
    });
});

describe('TransactionsStore.sendPaymentSilently', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        payLightningInvoice.mockReset();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("leaves the state of the user's own payment alone", async () => {
        const userPayment = deferred();
        payLightningInvoice.mockReturnValueOnce(userPayment.promise);
        payLightningInvoice.mockResolvedValueOnce({
            payment_hash: 'ab'.repeat(32),
            payment_preimage: 'cd'.repeat(32),
            fee_sat: '3',
            status: 'SUCCEEDED'
        });

        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbcrt1user' });

        const result = await store.sendPaymentSilently({
            payment_request: 'lnbcrt1service',
            amount: '7000'
        });

        expect(payLightningInvoice).toHaveBeenLastCalledWith(
            expect.objectContaining({
                payment_request: 'lnbcrt1service',
                amt: 7000
            })
        );
        expect(store.getPaymentOutcome(result).payment_preimage).toBe(
            'cd'.repeat(32)
        );
        expect(store.loading).toBe(true);
        expect(store.paymentInFlight).toBe(true);
        expect(store.payment_hash).toBeNull();
        expect(store.payment_preimage).toBeNull();
        expect(store.status).toBeNull();
    });

    it.each([
        [0, 0],
        [400, 400],
        [undefined, 100]
    ])('sends fee_limit_sat %p as %p', async (feeLimitSat, expected) => {
        isLNDBased.mockReturnValue(true);
        payLightningInvoice.mockResolvedValueOnce({ status: 'SUCCEEDED' });
        const store = newStore('lnd');

        await store.sendPaymentSilently({
            payment_request: 'lnbcrt1service',
            fee_limit_sat: feeLimitSat
        });

        expect(payLightningInvoice).toHaveBeenLastCalledWith(
            expect.objectContaining({ fee_limit_sat: expected })
        );
    });
});

describe('TransactionsStore late results for an earlier payment', () => {
    const HASH2 = 'cd'.repeat(32);
    const route2 = { total_amt: 2000, hops: [] };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        (BackendUtils.supportsPaymentLookup as jest.Mock).mockReturnValue(true);
        (BackendUtils.isLNDBased as jest.Mock).mockReturnValue(true);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // the first payment's send request never answers (e.g. embedded LND
    // paying a hold invoice), and something clears the guard without
    // the user releasing it
    const clearPaths: Array<
        [string, (store: TransactionsStore) => Promise<void>]
    > = [
        [
            'the backstop clears the guard',
            async () => {
                (
                    BackendUtils.supportsPaymentLookup as jest.Mock
                ).mockReturnValue(false);
                await jest.advanceTimersByTimeAsync((60 + 60) * 1000);
            }
        ],
        [
            'tracking stops at the ceiling',
            async () => {
                (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
                    status: 'IN_FLIGHT',
                    payment_hash: HASH
                });
                await jest.advanceTimersByTimeAsync(
                    (60 + 60) * 1000 +
                        PAYMENT_TRACK_MAX_MS +
                        PAYMENT_TRACK_POLL_MS
                );
            }
        ],
        [
            'reset() runs',
            async (store) => {
                store.reset();
            }
        ]
    ];

    const lateOutcomes: Array<[string, any]> = [
        [
            'SUCCEEDED',
            {
                status: 'SUCCEEDED',
                payment_hash: HASH,
                payment_preimage: 'deadbeef',
                payment_route: { total_amt: 1000, hops: [] }
            }
        ],
        [
            'FAILED',
            {
                status: 'FAILED',
                payment_hash: HASH,
                failure_reason: 'FAILURE_REASON_TIMEOUT'
            }
        ]
    ];

    const startFirst = async (
        store: TransactionsStore,
        clear: (store: TransactionsStore) => Promise<void>
    ) => {
        const first = deferred();
        (BackendUtils.payLightningInvoice as jest.Mock).mockReturnValueOnce(
            first.promise
        );
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.paymentInFlight).toBe(true);
        await clear(store);
        expect(store.paymentInFlight).toBe(false);
        return first;
    };

    const startSecond = (store: TransactionsStore) => {
        const Bolt11Utils = require('../utils/Bolt11Utils').default;
        (Bolt11Utils.decode as jest.Mock).mockReturnValueOnce({
            payment_hash: HASH2
        });
        const second = deferred();
        (BackendUtils.payLightningInvoice as jest.Mock).mockReturnValueOnce(
            second.promise
        );
        store.sendPayment({ payment_request: 'lnbc1other' });
        expect(BackendUtils.payLightningInvoice).toHaveBeenCalledTimes(2);
        return second;
    };

    describe.each(clearPaths)('after %s', (_, clear) => {
        it.each(lateOutcomes)(
            "doesn't let a late %s overwrite the next payment's success",
            async (_status, late) => {
                const store = newStore('lnd');
                const first = await startFirst(store, clear);

                const second = startSecond(store);
                second.resolve({
                    status: 'SUCCEEDED',
                    payment_hash: HASH2,
                    payment_preimage: 'beefdead',
                    payment_route: route2
                });
                await flush();
                expect(store.status).toBe('SUCCEEDED');

                first.resolve(late);
                await flush();
                expect(store.status).toBe('SUCCEEDED');
                expect(store.payment_route).toEqual(route2);
                expect(store.payment_preimage).toBe('beefdead');
                expect(store.payment_hash).toBe(HASH2);
                expect(store.error).toBe(false);
                expect(store.payment_error).toBeNull();
                expect(store.loading).toBe(false);
            }
        );

        it.each(lateOutcomes)(
            "doesn't let a late %s settle the next payment while it is pending",
            async (_status, late) => {
                const store = newStore('lnd');
                const first = await startFirst(store, clear);

                startSecond(store);
                await flush();
                expect(store.loading).toBe(true);

                first.resolve(late);
                await flush();
                expect(store.status).toBeNull();
                expect(store.payment_route).toBeNull();
                expect(store.payment_preimage).toBeNull();
                expect(store.error).toBe(false);
                expect(store.loading).toBe(true);
                expect(store.paymentInFlight).toBe(true);
            }
        );

        it("doesn't let a late rejection overwrite the next payment's success", async () => {
            const store = newStore('lnd');
            const first = await startFirst(store, clear);

            const second = startSecond(store);
            second.resolve({
                status: 'SUCCEEDED',
                payment_hash: HASH2,
                payment_preimage: 'beefdead',
                payment_route: route2
            });
            await flush();

            first.reject(new Error('stream closed'));
            await flush();
            expect(store.status).toBe('SUCCEEDED');
            expect(store.error).toBe(false);
            expect(store.error_msg).toBeNull();
            expect(store.loading).toBe(false);
        });
    });

    it('clears loading when the next payment is released while one from before reset() is still open', async () => {
        const store = newStore('lnd');
        const first = await startFirst(store, clearPaths[2][1]);

        // the next payment's send request never answers either, and the
        // node reports it in flight, so the user can release it
        const Bolt11Utils = require('../utils/Bolt11Utils').default;
        (Bolt11Utils.decode as jest.Mock).mockReturnValueOnce({
            payment_hash: HASH2
        });
        (BackendUtils.payLightningInvoice as jest.Mock).mockReturnValueOnce(
            new Promise(() => {})
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH2
        });
        store.sendPayment({ payment_request: 'lnbc1other' });
        await jest.advanceTimersByTimeAsync((60 + 60) * 1000);
        expect(store.paymentInFlightConfirmed).toBe(true);

        expect(store.releasePaymentInFlight()).toBe(true);
        expect(store.loading).toBe(false);
        const status = store.status;

        first.resolve(lateOutcomes[0][1]);
        await flush();
        expect(store.loading).toBe(false);
        expect(store.status).toBe(status);
        expect(store.payment_preimage).toBeNull();
    });

    it('still applies a late result when no newer payment was sent', async () => {
        const store = newStore('lnd');
        const first = await startFirst(store, clearPaths[0][1]);

        first.resolve(lateOutcomes[0][1]);
        await flush();
        expect(store.status).toBe('SUCCEEDED');
        expect(store.payment_preimage).toBe('deadbeef');
    });

    // reset() replaces the latest payment with none, so its result is
    // dropped even if no newer payment was sent
    it.each(lateOutcomes)(
        'drops a late %s for a payment sent before reset() when no payment followed',
        async (_status, late) => {
            const store = newStore('lnd');
            const first = await startFirst(store, clearPaths[2][1]);

            first.resolve(late);
            await flush();
            expect(store.status).toBeNull();
            expect(store.payment_route).toBeNull();
            expect(store.payment_preimage).toBeNull();
            expect(store.payment_hash).toBeNull();
            expect(store.error).toBe(false);
            expect(store.payment_error).toBeNull();
            expect(store.loading).toBe(false);
        }
    );

    it('drops a late rejection for a payment sent before reset() when no payment followed', async () => {
        const store = newStore('lnd');
        const first = await startFirst(store, clearPaths[2][1]);

        first.reject(new Error('stream closed'));
        await flush();
        expect(store.error).toBe(false);
        expect(store.error_msg).toBeNull();
        expect(store.loading).toBe(false);
    });

    it("doesn't show the previous payment's note while a payment is in transit", async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValueOnce({
            status: 'SUCCEEDED',
            payment_hash: HASH,
            payment_preimage: 'deadbeef'
        });
        const store = newStore('lnd');
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.noteKey).toBeTruthy();

        startSecond(store);
        await flush();
        expect(store.noteKey).toBeFalsy();
    });
});

describe('TransactionsStore.sendPayment held back by the graph sync prompt', () => {
    const checkGraphSync = checkGraphSyncBeforePayment as jest.Mock;

    // a store whose last payment succeeded and whose next one is held back
    const storeWithHeldPayment = async () => {
        payLightningInvoice.mockResolvedValueOnce({
            payment_hash: HASH,
            payment_preimage: 'cd'.repeat(32),
            status: 'SUCCEEDED'
        });
        const store = newStore('embedded-lnd');
        store.sendPayment({ payment_request: 'lnbc1first' });
        await flushPromises();
        expect(store.status).toBe('SUCCEEDED');
        expect(store.paymentInFlight).toBe(false);

        checkGraphSync.mockImplementationOnce(
            (_settings, _implementation, paymentData, transactionsStore) => {
                transactionsStore.pendingPaymentData = paymentData;
                transactionsStore.showGraphSyncPrompt = true;
                return false;
            }
        );
        store.sendPayment({ payment_request: 'lnbc1second' });
        return store;
    };

    beforeEach(() => {
        jest.useFakeTimers();
        payLightningInvoice.mockReset();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("clears the previous payment's outcome while the prompt is open", async () => {
        const store = await storeWithHeldPayment();

        expect(payLightningInvoice).toHaveBeenCalledTimes(1);
        expect(store.showGraphSyncPrompt).toBe(true);
        expect(store.loading).toBe(true);
        expect(store.error).toBe(false);
        expect(store.status).toBeNull();
        expect(store.payment_hash).toBeNull();
        expect(store.payment_preimage).toBeNull();
    });

    it('drops the payment and reports it as not sent when the prompt is dismissed', async () => {
        const store = await storeWithHeldPayment();
        store.hideGraphSyncPrompt();

        expect(payLightningInvoice).toHaveBeenCalledTimes(1);
        expect(store.showGraphSyncPrompt).toBe(false);
        expect(store.pendingPaymentData).toBeNull();
        expect(store.loading).toBe(false);
        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('views.GraphSyncPrompt.paymentNotSent');
        expect(store.status).toBeNull();

        // nothing is left to dispatch
        store.proceedWithPayment();
        expect(payLightningInvoice).toHaveBeenCalledTimes(1);
    });

    it("doesn't show the previous payment's tracking-stopped warning when the prompt is dismissed", async () => {
        const store = await storeWithHeldPayment();
        store.hideGraphSyncPrompt();
        // the warning belongs to the previous payment; set it the way
        // markTrackingStopped leaves it, then hold back the next payment
        store.paymentOutcomeUnverified = true;
        checkGraphSync.mockImplementationOnce(
            (_settings, _implementation, paymentData, transactionsStore) => {
                transactionsStore.pendingPaymentData = paymentData;
                transactionsStore.showGraphSyncPrompt = true;
                return false;
            }
        );
        store.sendPayment({ payment_request: 'lnbc1third' });
        expect(store.paymentOutcomeUnverified).toBe(false);

        store.hideGraphSyncPrompt();
        expect(payLightningInvoice).toHaveBeenCalledTimes(1);
        expect(store.error_msg).toBe('views.GraphSyncPrompt.paymentNotSent');
        expect(store.paymentOutcomeUnverified).toBe(false);
    });

    it('dispatches the payment when the prompt is answered', async () => {
        const store = await storeWithHeldPayment();
        payLightningInvoice.mockReturnValue(deferred().promise);
        store.proceedWithPayment();

        expect(payLightningInvoice).toHaveBeenCalledTimes(2);
        expect(payLightningInvoice).toHaveBeenLastCalledWith(
            expect.objectContaining({ payment_request: 'lnbc1second' })
        );
        expect(store.showGraphSyncPrompt).toBe(false);
        expect(store.pendingPaymentData).toBeNull();

        // the modal's onClosed fires once it has animated out
        store.hideGraphSyncPrompt();
        expect(store.loading).toBe(true);
        expect(store.error).toBe(false);
    });
});

describe('TransactionsStore payment sequence', () => {
    const { checkGraphSyncBeforePayment } = jest.requireMock(
        '../utils/GraphSyncUtils'
    );

    // what checkGraphSyncBeforePayment does when the graph sync prompt
    // holds the payment back
    const deferToGraphSyncPrompt = () =>
        checkGraphSyncBeforePayment.mockImplementationOnce(
            (_settings: any, _impl: any, paymentData: any, store: any) => {
                store.pendingPaymentData = paymentData;
                store.showGraphSyncPrompt = true;
                return false;
            }
        );

    beforeEach(() => {
        jest.useFakeTimers();
        payLightningInvoice.mockReset();
        payLightningInvoice.mockReturnValue(deferred().promise);
        checkGraphSyncBeforePayment.mockReset();
        checkGraphSyncBeforePayment.mockReturnValue(true);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns the sequence of a dispatched payment', () => {
        const store = newStore();

        const seq = store.sendPayment({ payment_request: 'lnbc1' });

        expect(typeof seq).toBe('number');
        expect(store.lastPaymentSequence).toBe(seq);
    });

    it('returns null for a payment dropped while another is in flight', () => {
        const store = newStore();
        const first = store.sendPayment({ payment_request: 'lnbc1' });

        const second = store.sendPayment({ payment_request: 'lnbc2' });

        expect(second).toBeNull();
        expect(store.lastPaymentSequence).toBe(first);
        expect(payLightningInvoice).toHaveBeenCalledTimes(1);
    });

    it('dispatches a payment held by the graph sync prompt under the sequence it reserved', () => {
        const store = newStore();
        deferToGraphSyncPrompt();

        const seq = store.sendPayment({ payment_request: 'lnbc1' });
        expect(typeof seq).toBe('number');
        expect(payLightningInvoice).not.toHaveBeenCalled();

        store.proceedWithPayment();

        expect(payLightningInvoice).toHaveBeenCalledTimes(1);
        expect(store.lastPaymentSequence).toBe(seq);
        expect(store.pendingPaymentData).toBeNull();
    });

    it('releases a held payment before hiding the prompt, so the prompt does not treat it as abandoned', () => {
        const store = newStore();
        deferToGraphSyncPrompt();
        const seq = store.sendPayment({ payment_request: 'lnbc1' });

        // a hideGraphSyncPrompt that reports a still-held payment as not
        // sent when the prompt closes
        let heldWhenHidden: any = 'not called';
        jest.spyOn(store, 'hideGraphSyncPrompt').mockImplementation(() => {
            heldWhenHidden = store.pendingPaymentData;
            store.showGraphSyncPrompt = false;
            if (store.pendingPaymentData) {
                store.pendingPaymentData = null;
                store.error = true;
                store.error_msg = 'views.GraphSyncPrompt.paymentNotSent';
            }
        });

        store.proceedWithPayment();

        expect(heldWhenHidden).toBeNull();
        expect(payLightningInvoice).toHaveBeenCalledTimes(1);
        expect(payLightningInvoice).toHaveBeenCalledWith(
            expect.objectContaining({ payment_request: 'lnbc1' })
        );
        expect(store.lastPaymentSequence).toBe(seq);
        expect(store.error).toBe(false);
        expect(store.error_msg).toBeNull();
        expect(store.loading).toBe(true);
    });

    it('does not give an abandoned held payment sequence to the next payment', () => {
        const store = newStore();
        deferToGraphSyncPrompt();
        const abandoned = store.sendPayment({ payment_request: 'lnbc1' });

        // the prompt is dismissed without sending
        store.hideGraphSyncPrompt();
        expect(store.pendingPaymentData).toBeNull();
        store.proceedWithPayment();
        expect(payLightningInvoice).not.toHaveBeenCalled();

        const next = store.sendPayment({ payment_request: 'lnbc2' });

        expect(typeof abandoned).toBe('number');
        expect(next).not.toBe(abandoned);
        expect(store.lastPaymentSequence).toBe(next);
    });

    it('does not dispatch a held payment that a later held payment replaced', () => {
        const store = newStore();
        deferToGraphSyncPrompt();
        const replaced = store.sendPayment({ payment_request: 'lnbc1' });
        deferToGraphSyncPrompt();
        const held = store.sendPayment({ payment_request: 'lnbc2' });

        store.proceedWithPayment();

        expect(held).not.toBe(replaced);
        expect(store.lastPaymentSequence).toBe(held);
        expect(payLightningInvoice).toHaveBeenCalledTimes(1);
        expect(payLightningInvoice).toHaveBeenCalledWith(
            expect.objectContaining({ payment_request: 'lnbc2' })
        );
    });
});

describe('TransactionsStore result of an earlier payment', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        payLightningInvoice.mockReset();
        // CLN has no lookupPayment, so the backstop frees the guard
        // without tracking the payment
        (BackendUtils.supportsPaymentLookup as jest.Mock).mockReturnValue(
            false
        );
    });

    afterEach(() => {
        (BackendUtils.supportsPaymentLookup as jest.Mock).mockReturnValue(true);
        jest.useRealTimers();
    });

    // sends a payment whose request stays open past its backstop (e.g. a
    // hold invoice), then the next payment once the backstop frees the guard
    const sendNextPastBackstop = (store: TransactionsStore) => {
        const first = deferred();
        const second = deferred();
        payLightningInvoice
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);

        const firstSeq = store.sendPayment({ payment_request: 'lnbc1' });
        // the 60 second payment timeout plus the grace period
        jest.advanceTimersByTime(120_000);
        expect(store.paymentInFlight).toBe(false);

        const secondSeq = store.sendPayment({ payment_request: 'lnbc2' });
        expect(secondSeq).not.toBe(firstSeq);
        expect(store.lastPaymentSequence).toBe(secondSeq);
        return { first, second, secondSeq };
    };

    it("ignores the earlier payment's success when it lands after the next one is sent", async () => {
        const store = newStore('cln-rest');
        const { first, second, secondSeq } = sendNextPastBackstop(store);

        first.resolve({ status: 'complete' });
        await flushPromises();

        // the screen for the second payment must not see a success
        expect(store.status).toBeNull();
        expect(store.error).toBe(false);
        expect(store.loading).toBe(true);
        expect(store.paymentInFlight).toBe(true);
        expect(store.lastPaymentSequence).toBe(secondSeq);

        second.resolve({ status: 'complete' });
        await flushPromises();

        expect(store.status).toBe('complete');
        expect(store.loading).toBe(false);
        expect(store.paymentInFlight).toBe(false);
    });

    it("ignores the earlier payment's error when it lands after the next one is sent", async () => {
        const store = newStore('cln-rest');
        const { first, second } = sendNextPastBackstop(store);

        first.reject(new Error('payment timed out'));
        await flushPromises();

        expect(store.error).toBe(false);
        expect(store.error_msg).toBeNull();
        expect(store.loading).toBe(true);
        expect(store.paymentInFlight).toBe(true);

        second.reject(new Error('no route'));
        await flushPromises();

        expect(store.error).toBe(true);
        expect(store.loading).toBe(false);
        expect(store.paymentInFlight).toBe(false);
    });
});
