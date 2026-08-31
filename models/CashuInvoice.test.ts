jest.mock('../stores/Stores', () => ({}));

import CashuInvoice from './CashuInvoice';
import type { CDKTransaction } from '../cashu-cdk';

const cdkReceive: CDKTransaction = {
    id: 'b'.repeat(64),
    direction: 'incoming',
    amount: 5000,
    fee: 1,
    mint_url: 'https://mint.example.com',
    timestamp: 1756200000,
    unit: 'sat',
    memo: 'zap',
    quote_id: 'quote-2',
    payment_request: 'lnbc50u1invoice'
};

describe('CashuInvoice.fromCDKTransaction', () => {
    it('maps CDK transaction fields onto invoice getters', () => {
        const invoice = CashuInvoice.fromCDKTransaction(cdkReceive);

        expect(invoice.getAmount).toBe(5000);
        expect(invoice.getFee).toBe(1);
        expect(invoice.getTimestamp).toBe(1756200000);
        expect(invoice.getMemo).toBe('zap');
        expect(invoice.getPaymentRequest).toBe('lnbc50u1invoice');
        expect(invoice.mintUrl).toBe('https://mint.example.com');
        expect(invoice.key).toBe('b'.repeat(64));
        expect(invoice.cdkQuoteId).toBe('quote-2');
    });

    it('treats records without a lifecycle state as paid (pre-0.18 CDK)', () => {
        const invoice = CashuInvoice.fromCDKTransaction(cdkReceive);

        expect(invoice.isPaid).toBe(true);
        expect(invoice.isExpired).toBe(false);
    });

    it('treats a Pending lifecycle state as unpaid', () => {
        const invoice = CashuInvoice.fromCDKTransaction({
            ...cdkReceive,
            state: 'Pending'
        });

        expect(invoice.isPaid).toBe(false);
    });

    it('defaults fee to 0 when absent', () => {
        const invoice = CashuInvoice.fromCDKTransaction({
            ...cdkReceive,
            fee: undefined
        });

        expect(invoice.getFee).toBe(0);
    });
});
