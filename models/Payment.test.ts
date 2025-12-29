jest.mock('../stores/Stores', () => ({}));

import Payment from './Payment';

describe('Payment.getAmount with partial HTLC success', () => {
    it('sums only succeeded HTLC parts and ignores failed ones', () => {
        const payment = new Payment({
            value_sat: 130206,
            htlcs: [
                { status: 'SUCCEEDED', route: { total_amt: 65103 } },
                { status: 'FAILED', route: { total_amt: 4242 } },
                { status: 'FAILED', route: { total_amt: 999999 } }
            ]
        });

        expect(payment.getAmount).toBe(65103);
    });
});
