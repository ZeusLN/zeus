jest.mock('../stores/Stores');

import CashuPayment from './CashuPayment';

describe('CashuPayment.getFee', () => {
    it('returns the fee of a settled payment', () => {
        const payment = new CashuPayment({ fee: 3, status: 'SUCCEEDED' });

        expect(payment.getFee).toBe('3');
    });

    // The mint has not settled the melt, so no fee exists yet and the
    // payment view should not show one
    it('returns no fee for a payment still in flight', () => {
        const payment = new CashuPayment({ fee: 0, status: 'IN_FLIGHT' });

        expect(payment.getFee).toBe('');
        expect(payment.getFeePercentage).toBe('');
    });

    // Settled from its melt quote, which does not carry the fee
    it('returns no fee for a paid payment whose fee is unknown', () => {
        const payment = new CashuPayment({
            fee: 0,
            fee_unknown: true,
            status: 'SUCCEEDED'
        });

        expect(payment.getFee).toBe('');
        expect(payment.getFeePercentage).toBe('');
    });
});

describe('CashuPayment.getTimestamp', () => {
    it('prefers creation_date over the invoice timestamp', () => {
        const payment = new CashuPayment({
            creation_date: 1_700_000_100,
            timestamp: 1_700_000_000
        });

        expect(payment.getTimestamp).toBe(1_700_000_100);
    });

    it('falls back to the invoice timestamp', () => {
        const payment = new CashuPayment({ timestamp: 1_700_000_000 });

        expect(payment.getTimestamp).toBe(1_700_000_000);
    });
});
