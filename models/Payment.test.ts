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
