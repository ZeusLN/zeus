jest.mock('../stores/Stores');

import Payment from './Payment';

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
