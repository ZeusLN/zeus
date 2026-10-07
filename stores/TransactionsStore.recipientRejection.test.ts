// module mocks keep the import graph out of native modules; only
// handlePayment/handlePaymentError are exercised
jest.mock('./Stores', () => ({}));
jest.mock('../utils/GraphSyncUtils', () => ({}));
jest.mock('../utils/UrlUtils', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('react-native-randombytes', () => ({ randomBytes: jest.fn() }));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {}
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('../utils/Bolt11Utils', () => ({
    __esModule: true,
    default: { decode: () => ({ cltv_expiry: 40 }) }
}));

import TransactionsStore from './TransactionsStore';

const newStore = (implementation = 'lnd') =>
    new TransactionsStore(
        { implementation } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any
    );

// lnd REST shape: final hop (index 2 on a two-hop route) held the HTLC
// for 134 seconds, then failed it back
const heldHtlc = {
    status: 'FAILED',
    route: { hops: [{}, {}] },
    attempt_time_ns: '1790000000000000000',
    resolve_time_ns: '1790000134000000000',
    failure: {
        code: 'INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS',
        failure_source_index: 2
    }
};

describe('TransactionsStore recipient rejection', () => {
    it('flags an LND REST incorrect-payment-details failure', () => {
        const store = newStore();
        store.handlePayment({
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS'
        });

        expect(store.error).toBe(true);
        expect(store.paymentRejectedByRecipient).toBe(true);
        expect(store.payment_error).toBe(
            'error.failureReasonIncorrectPaymentDetails'
        );
    });

    it('flags an embedded LND failure reported as an enum value', () => {
        const store = newStore('embedded-lnd');
        // lnrpc.Payment.PaymentStatus.FAILED = 3,
        // lnrpc.PaymentFailureReason.FAILURE_REASON_INCORRECT_PAYMENT_DETAILS = 4
        store.handlePayment({ status: 3, failure_reason: 4 });

        expect(store.paymentRejectedByRecipient).toBe(true);
    });

    it('does not flag other failure reasons', () => {
        const store = newStore();
        store.handlePayment({
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_NO_ROUTE'
        });

        expect(store.error).toBe(true);
        expect(store.paymentRejectedByRecipient).toBe(false);
    });

    it('flags an LDK Node recipient rejection', () => {
        const store = newStore('ldk-node');
        store.handlePaymentError(new Error('recipientRejected'));

        expect(store.paymentRejectedByRecipient).toBe(true);
        expect(store.error_msg).toBe('error.ldk.recipientRejected');
    });

    it('reports how long the recipient held a canceled HTLC', () => {
        const store = newStore();
        store.handlePayment({
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS',
            htlcs: [heldHtlc]
        });

        expect(store.paymentRejectedByRecipient).toBe(true);
        expect(store.payment_error).toBe(
            'views.SendingLightning.recipientCanceledHeldPayment'
        );
    });

    it('uses the HTLC failure when lnd reports a timeout for a canceled hold', () => {
        const store = newStore();
        store.handlePayment({
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_TIMEOUT',
            htlcs: [heldHtlc]
        });

        expect(store.paymentRejectedByRecipient).toBe(true);
        expect(store.payment_error).toBe(
            'views.SendingLightning.recipientCanceledHeldPayment'
        );
    });

    it('uses the generic rejection copy for a prompt HTLC rejection under a timeout reason', () => {
        const store = newStore();
        store.handlePayment({
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_TIMEOUT',
            htlcs: [{ ...heldHtlc, resolve_time_ns: '1790000001000000000' }]
        });

        expect(store.paymentRejectedByRecipient).toBe(true);
        expect(store.payment_error).toBe(
            'error.failureReasonIncorrectPaymentDetails'
        );
    });

    it('keeps the lnd failure copy for a prompt HTLC rejection', () => {
        const store = newStore();
        store.handlePayment({
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS',
            htlcs: [{ ...heldHtlc, resolve_time_ns: '1790000001000000000' }]
        });

        expect(store.paymentRejectedByRecipient).toBe(true);
        expect(store.payment_error).toBe(
            'error.failureReasonIncorrectPaymentDetails'
        );
    });

    it('does not flag a rejection caused by the sender being behind the chain', () => {
        const store = newStore();
        store.handlePayment({
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS',
            payment_request: 'lnbc1',
            htlcs: [
                {
                    ...heldHtlc,
                    route: { hops: [{ expiry: 1073 }, { expiry: 1033 }] },
                    resolve_time_ns: '1790000001000000000',
                    failure: {
                        ...heldHtlc.failure,
                        // 10 blocks ahead of the sender: 990 + 40 + 3 < 1000 + 40
                        height: 1000
                    }
                }
            ]
        });

        expect(store.error).toBe(true);
        expect(store.paymentRejectedByRecipient).toBe(false);
        expect(store.payment_error).toBe(
            'views.SendingLightning.senderBehindChain'
        );
    });

    it('flags a CLN xpay rejection', () => {
        const store = newStore('cln-rest');
        store.handlePaymentError(
            new Error(
                "Destination said it doesn't know invoice: WIRE_INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS"
            )
        );

        expect(store.paymentRejectedByRecipient).toBe(true);
        expect(store.error_msg).toBe(
            'error.failureReasonIncorrectPaymentDetails'
        );
    });

    // lnd puts the keysend preimage record on the final hop only
    const keysendHtlc = {
        ...heldHtlc,
        route: {
            hops: [{}, { custom_records: { '5482373484': 'preimage' } }]
        },
        resolve_time_ns: '1790000001000000000'
    };

    it('adds the keysend hint for a multi-hop keysend rejection', () => {
        const store = newStore();
        store.handlePayment({
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS',
            htlcs: [keysendHtlc]
        });

        expect(store.paymentRejectedByRecipient).toBe(true);
        expect(store.payment_error).toBe(
            'error.failureReasonIncorrectPaymentDetails error.failureReasonIncorrectPaymentDetailsKeysend'
        );
    });

    it('adds the keysend hint on embedded LND', () => {
        const store = newStore('embedded-lnd');
        store.handlePayment({
            status: 3,
            failure_reason: 4,
            htlcs: [keysendHtlc]
        });

        expect(store.payment_error).toBe(
            'error.failureReasonIncorrectPaymentDetails error.failureReasonIncorrectPaymentDetailsKeysend'
        );
    });

    it('clears the flag on reset', () => {
        const store = newStore();
        store.handlePaymentError(new Error('recipientRejected'));
        store.reset();

        expect(store.paymentRejectedByRecipient).toBe(false);
    });
});
