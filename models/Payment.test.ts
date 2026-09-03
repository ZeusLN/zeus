jest.mock('../stores/Stores', () => ({}));

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
