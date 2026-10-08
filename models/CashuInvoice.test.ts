jest.mock('../stores/Stores', () => ({}));

import CashuInvoice from './CashuInvoice';

const cdkReceive = {
    id: 'b'.repeat(64),
    amount: 5000,
    fee: 1,
    mint_url: 'https://mint.example.com',
    timestamp: 1756200000,
    memo: 'zap'
};

describe('CashuInvoice.fromCDKTransaction', () => {
    it('treats records without a lifecycle state as paid (pre-0.18 CDK)', () => {
        const invoice = CashuInvoice.fromCDKTransaction(cdkReceive);

        expect(invoice.state).toBe('PAID');
        expect(invoice.isPaid).toBe(true);
        expect(invoice.isFailed).toBe(false);
        expect(invoice.isExpired).toBe(false);
    });

    it('treats a Completed lifecycle state as paid', () => {
        const invoice = CashuInvoice.fromCDKTransaction({
            ...cdkReceive,
            state: 'Completed'
        });

        expect(invoice.state).toBe('PAID');
        expect(invoice.isPaid).toBe(true);
        expect(invoice.isFailed).toBe(false);
        expect(invoice.isExpired).toBe(false);
    });

    it('treats a Pending lifecycle state as unpaid', () => {
        const invoice = CashuInvoice.fromCDKTransaction({
            ...cdkReceive,
            state: 'Pending'
        });

        expect(invoice.state).toBe('UNPAID');
        expect(invoice.isPaid).toBe(false);
        expect(invoice.isFailed).toBe(false);
        expect(invoice.isExpired).toBe(false);
    });

    it('does not report a Failed lifecycle state as paid', () => {
        const invoice = CashuInvoice.fromCDKTransaction({
            ...cdkReceive,
            state: 'Failed'
        });

        expect(invoice.state).toBe('FAILED');
        expect(invoice.paid).toBe(false);
        expect(invoice.isPaid).toBe(false);
        expect(invoice.isFailed).toBe(true);
        // closed out, so views do not render it as a pending request
        expect(invoice.isExpired).toBe(true);
    });
});
