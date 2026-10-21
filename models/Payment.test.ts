jest.mock('../stores/Stores');

import Payment from './Payment';
import { lnrpc } from '../proto/lightning';

describe('Payment.getAmount with partial HTLC success', () => {
    it('sums only succeeded HTLC parts and ignores failed ones', () => {
        const payment = new Payment({
            value_sat: 130206,
            htlcs: [
                {
                    status: 'SUCCEEDED',
                    route: {
                        total_amt: 65103,
                        hops: [{ amt_to_forward: 65103 }]
                    }
                },
                { status: 'FAILED', route: { total_amt: 4242 } },
                { status: 'FAILED', route: { total_amt: 999999 } }
            ]
        });

        expect(payment.getAmount).toBe(65103);
    });

    it('excludes routing fees from the payment amount', () => {
        const payment = new Payment({
            htlcs: [
                {
                    status: 'SUCCEEDED',
                    route: {
                        total_amt_msat: 105000, // 100 sats + 5 sats fee
                        total_fees_msat: 5000,
                        hops: [
                            { amt_to_forward_msat: 100000, fee_msat: 5000 },
                            { amt_to_forward_msat: 100000 } // last hop
                        ]
                    }
                }
            ]
        });

        // Should return 100 sats (the actual payment), not 105 sats
        expect(payment.getAmount).toBe(100);
    });

    it('uses last hop amount when multiple hops exist', () => {
        const payment = new Payment({
            htlcs: [
                {
                    status: 'SUCCEEDED',
                    route: {
                        total_amt_msat: 1010000, // includes fees
                        total_fees_msat: 10000,
                        hops: [
                            { amt_to_forward_msat: 1005000, fee_msat: 5000 },
                            { amt_to_forward_msat: 1002000, fee_msat: 3000 },
                            { amt_to_forward_msat: 1000000 } // final destination
                        ]
                    }
                }
            ]
        });

        // Should return 1000 sats from the last hop
        expect(payment.getAmount).toBe(1000);
    });

    it('falls back to route total minus fees when no hops available', () => {
        const payment = new Payment({
            htlcs: [
                {
                    status: 'SUCCEEDED',
                    route: {
                        total_amt_msat: 50500,
                        total_fees_msat: 500
                    }
                }
            ]
        });

        // Should return 50 sats (50500 - 500) / 1000
        expect(payment.getAmount).toBe(50);
    });

    it('uses amountFromFields for in-transit payments', () => {
        const payment = new Payment({
            value_sat: 50000,
            payment_preimage:
                '0000000000000000000000000000000000000000000000000000000000000000',
            htlcs: [
                {
                    status: 'IN_FLIGHT',
                    route: {
                        total_amt_msat: 50000000,
                        hops: [{ amt_to_forward_msat: 50000000 }]
                    }
                }
            ]
        });

        // Should return 50000 sats from value_sat, not 0 from failed HTLC sum
        expect(payment.isInTransit).toBe(true);
        expect(payment.getAmount).toBe(50000);
    });
});

describe('Payment.getFee', () => {
    it('reads the fee of an LndHub /gettxs row', () => {
        const payment = new Payment({
            type: 'paid_invoice',
            fee: 2,
            value: 3,
            timestamp: 1700000000
        });
        expect(payment.getFee).toBe('2');
    });

    it('reads the route fee of an LndHub /payinvoice response', () => {
        const payment = new Payment({
            payment_error: '',
            payment_route: { total_amt: '252501', total_fees: '2501' }
        });
        expect(payment.getFee).toBe('2501');
    });

    it('is 0 for an LndHub payment that paid no fee', () => {
        expect(new Payment({ fee: 0, value: 1 }).getFee).toBe('0');
        expect(new Payment({ value: 1 }).getFee).toBe('0');
        expect(new Payment({ payment_route: {} }).getFee).toBe('0');
    });

    it('prefers the lnd fee fields', () => {
        const payment = new Payment({
            fee: '1',
            fee_sat: '1',
            fee_msat: '1500'
        });
        expect(payment.getFee).toBe('1.5');
    });
});

describe('Payment.isFailed / isInTransit with retried HTLC attempts', () => {
    const zeroPreimage =
        '0000000000000000000000000000000000000000000000000000000000000000';

    it.each([
        ['string', 'IN_FLIGHT', 'FAILED', 'IN_FLIGHT'],
        ['embedded LND enum', 1, 2, 0]
    ])(
        'is in transit, not failed, while a retry is out (%s statuses)',
        (_label, status, failed, inFlight) => {
            const payment = new Payment({
                status,
                failure_reason: 'FAILURE_REASON_NONE',
                payment_preimage: zeroPreimage,
                htlcs: [{ status: failed }, { status: inFlight }]
            });

            expect(payment.isInTransit).toBe(true);
            expect(payment.isFailed).toBe(false);
        }
    );

    it('is in transit, not failed, between two attempts', () => {
        const payment = new Payment({
            status: 'IN_FLIGHT',
            failure_reason: 'FAILURE_REASON_NONE',
            value_sat: 50000,
            payment_preimage: zeroPreimage,
            htlcs: [{ status: 'FAILED', route: { total_amt: 50000 } }]
        });

        expect(payment.isInTransit).toBe(true);
        expect(payment.isFailed).toBe(false);
        // shown at the amount being paid, like any payment in transit
        expect(payment.getAmount).toBe(50000);
    });

    it('is in transit, not failed, between two attempts (embedded LND enum statuses)', () => {
        const payment = new Payment({
            status: lnrpc.Payment.PaymentStatus.IN_FLIGHT,
            failure_reason: lnrpc.PaymentFailureReason.FAILURE_REASON_NONE,
            value_sat: 50000,
            payment_preimage: zeroPreimage,
            htlcs: [
                {
                    status: lnrpc.HTLCAttempt.HTLCStatus.FAILED,
                    route: { total_amt: 50000 }
                }
            ]
        });

        expect(payment.isInTransit).toBe(true);
        expect(payment.isFailed).toBe(false);
        expect(payment.getAmount).toBe(50000);
    });

    it('is in transit while a part is out after a failure reason is set', () => {
        const payment = new Payment({
            status: 'IN_FLIGHT',
            failure_reason: 'FAILURE_REASON_TIMEOUT',
            payment_preimage: zeroPreimage,
            htlcs: [{ status: 'FAILED' }, { status: 'IN_FLIGHT' }]
        });

        expect(payment.isInTransit).toBe(true);
        expect(payment.isFailed).toBe(false);
    });

    it.each([
        ['string', 'FAILED', 'FAILURE_REASON_NO_ROUTE', 'FAILED'],
        ['embedded LND enum', 3, 2, 2]
    ])(
        'is failed once lnd reports the payment failed (%s statuses)',
        (_label, status, failureReason, failed) => {
            const payment = new Payment({
                status,
                failure_reason: failureReason,
                payment_preimage: zeroPreimage,
                htlcs: [{ status: failed }, { status: failed }]
            });

            expect(payment.isInTransit).toBe(false);
            expect(payment.isFailed).toBe(true);
        }
    );

    it('is neither once settled', () => {
        const payment = new Payment({
            status: 'SUCCEEDED',
            failure_reason: 'FAILURE_REASON_NONE',
            payment_preimage: 'ab'.repeat(32),
            htlcs: [{ status: 'FAILED' }, { status: 'SUCCEEDED' }]
        });

        expect(payment.isInTransit).toBe(false);
        expect(payment.isFailed).toBe(false);
    });
});

describe('Payment.resolvedPaymentHash', () => {
    // BOLT11 spec reference vector; its payment_hash is
    // 0001020304050607080900010203040506070809000102030405060708090102
    const specInvoice =
        'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr';
    const specHash =
        '0001020304050607080900010203040506070809000102030405060708090102';

    it('passes through a string payment_hash', () => {
        const payment = new Payment({ payment_hash: specHash });
        expect(payment.resolvedPaymentHash).toBe(specHash);
    });

    it('converts a Buffer-style payment_hash (LndHub)', () => {
        const payment = new Payment({
            payment_hash: { type: 'Buffer', data: [171, 205] }
        });
        expect(payment.resolvedPaymentHash).toBe('abcd');
    });

    it('derives the hash from the payment request when absent', () => {
        const payment = new Payment({ payment_request: specInvoice });
        expect(payment.resolvedPaymentHash).toBe(specHash);
    });

    it('derives the hash from the preimage when nothing else is available', () => {
        const payment = new Payment({
            payment_preimage: '01'.repeat(32)
        });
        expect(payment.resolvedPaymentHash).toBe(
            '72cd6e8422c407fb6d098690f1130b7ded7ec2f7f5e1d30bd9d521f015363793'
        );
    });

    it('ignores an all-zero preimage', () => {
        const payment = new Payment({
            payment_preimage: '00'.repeat(32)
        });
        expect(payment.resolvedPaymentHash).toBeUndefined();
    });

    it('returns undefined when the hash cannot be derived', () => {
        const payment = new Payment({ value_sat: 1000 });
        expect(payment.resolvedPaymentHash).toBeUndefined();
    });
});

describe('Payment.isFailed', () => {
    it('flags Core Lightning failed payments via sendpays status', () => {
        // shaped like a canceled hold-invoice payment from the CLNRest
        // sql getPayments query: no htlcs, no failure_reason
        const payment = new Payment({
            payment_hash: 'abc123',
            status: 'failed',
            destination: '03abcdef',
            created_at: 1724688000,
            amount_sent_msat: null,
            amount_msat: 0,
            preimage: null
        });

        expect(payment.isFailed).toBe(true);
    });

    it('does not flag completed Core Lightning payments', () => {
        const payment = new Payment({
            payment_hash: 'abc123',
            status: 'complete',
            amount_sent_msat: 100500,
            amount_msat: 100000,
            preimage:
                'a44ef01c2a2c11c9209232f6cc8e2bd25733fbc99b1b1e0d90b465c1b2c95a92'
        });

        expect(payment.isFailed).toBe(false);
    });

    it('does not flag pending Core Lightning payments', () => {
        const payment = new Payment({
            payment_hash: 'abc123',
            status: 'pending',
            amount_msat: 0,
            preimage: null
        });

        expect(payment.isFailed).toBe(false);
    });

    it('still flags LND payments via failure_reason', () => {
        const payment = new Payment({
            payment_hash: 'abc123',
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_INCORRECT_PAYMENT_DETAILS',
            value_sat: 50000,
            htlcs: [{ status: 'FAILED', route: { total_amt: 50000 } }]
        });

        expect(payment.isFailed).toBe(true);
    });
});

describe('Payment status from backends without htlcs', () => {
    const preimage =
        'a44ef01c2a2c11c9209232f6cc8e2bd25733fbc99b1b1e0d90b465c1b2c95a92';

    // shapes below match what each backend's getPayments mapping returns

    it('flags a pending Core Lightning payment as in transit', () => {
        const payment = new Payment({
            payment_hash: 'abc123',
            status: 'pending',
            amount_sent_msat: null,
            amount_msat: 1000000,
            preimage: null
        });

        expect(payment.isInTransit).toBe(true);
        expect(payment.isFailed).toBe(false);
        expect(payment.getAmount).toBe(1000);
        expect(payment.getFee).toBe('0');
    });

    it('flags a pending LDK Node payment as in transit', () => {
        const payment = new Payment({
            payment_hash: 'abc123',
            value_sat: '1000',
            payment_preimage: '',
            status: 'IN_FLIGHT',
            failure_reason: ''
        });

        expect(payment.isInTransit).toBe(true);
        expect(payment.isFailed).toBe(false);
    });

    it('flags a failed LDK Node payment as failed', () => {
        const payment = new Payment({
            payment_hash: 'abc123',
            value_sat: '1000',
            payment_preimage: '',
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_ERROR'
        });

        expect(payment.isFailed).toBe(true);
        expect(payment.isInTransit).toBe(false);
    });

    it('does not flag a succeeded LDK Node payment', () => {
        const payment = new Payment({
            payment_hash: 'abc123',
            value_sat: '1000',
            payment_preimage: preimage,
            status: 'SUCCEEDED',
            failure_reason: ''
        });

        expect(payment.isFailed).toBe(false);
        expect(payment.isInTransit).toBe(false);
    });

    it('flags a pending NWC payment as in transit', () => {
        const payment = new Payment({
            type: 'outgoing',
            state: 'pending',
            payment_hash: 'abc123',
            amount: 1000,
            preimage: ''
        });

        expect(payment.isInTransit).toBe(true);
        expect(payment.isFailed).toBe(false);
    });

    it('flags a failed NWC payment as failed', () => {
        const payment = new Payment({
            type: 'outgoing',
            state: 'failed',
            payment_hash: 'abc123',
            amount: 1000,
            preimage: ''
        });

        expect(payment.isFailed).toBe(true);
        expect(payment.isInTransit).toBe(false);
    });

    it('does not flag a settled NWC payment', () => {
        const payment = new Payment({
            type: 'outgoing',
            state: 'settled',
            payment_hash: 'abc123',
            amount: 1000,
            preimage
        });

        expect(payment.isFailed).toBe(false);
        expect(payment.isInTransit).toBe(false);
    });

    it('ignores a pending status once a preimage is known', () => {
        const payment = new Payment({
            payment_hash: 'abc123',
            status: 'pending',
            preimage
        });

        expect(payment.isInTransit).toBe(false);
    });

    it('still flags LND in-flight payments via htlcs', () => {
        const payment = new Payment({
            payment_hash: 'abc123',
            status: 'IN_FLIGHT',
            value_sat: 50000,
            htlcs: [{ status: 'IN_FLIGHT', route: { total_amt: 50000 } }]
        });

        expect(payment.isInTransit).toBe(true);
        expect(payment.isFailed).toBe(false);
    });

    it('flags an LND payment with no htlcs yet as in transit', () => {
        const payment = new Payment({
            payment_hash: 'abc123',
            status: 'INITIATED',
            value_sat: 50000,
            failure_reason: 'FAILURE_REASON_NONE',
            htlcs: []
        });

        expect(payment.isInTransit).toBe(true);
        expect(payment.isFailed).toBe(false);
        expect(payment.getAmount).toBe(50000);
    });

    it('flags an embedded LND payment with no htlcs yet as in transit', () => {
        // raw protobuf decode: numeric enums, empty repeated fields
        const payment = new Payment({
            payment_hash: 'abc123',
            status: lnrpc.Payment.PaymentStatus.INITIATED,
            value_sat: 50000,
            payment_preimage: '',
            failure_reason: lnrpc.PaymentFailureReason.FAILURE_REASON_NONE,
            htlcs: []
        });

        expect(payment.isInTransit).toBe(true);
        expect(payment.isFailed).toBe(false);
        expect(payment.getAmount).toBe(50000);
    });

    it('keeps an LND payment between retries in transit', () => {
        // status stays IN_FLIGHT while lnd retries after every attempt failed
        const payment = new Payment({
            payment_hash: 'abc123',
            status: 'IN_FLIGHT',
            value_sat: 50000,
            failure_reason: 'FAILURE_REASON_NONE',
            htlcs: [{ status: 'FAILED', route: { total_amt: 50000 } }]
        });

        expect(payment.isInTransit).toBe(true);
        expect(payment.isFailed).toBe(false);
        expect(payment.getAmount).toBe(50000);
    });

    it('does not flag a settled LND payment', () => {
        const payment = new Payment({
            payment_hash: 'abc123',
            status: 'SUCCEEDED',
            value_sat: 50000,
            payment_preimage: preimage,
            failure_reason: 'FAILURE_REASON_NONE',
            htlcs: [{ status: 'SUCCEEDED', route: { total_amt: 50000 } }]
        });

        expect(payment.isInTransit).toBe(false);
        expect(payment.isFailed).toBe(false);
    });
});
