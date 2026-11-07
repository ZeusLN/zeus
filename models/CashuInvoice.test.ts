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
    memo: 'zap'
};

describe('CashuInvoice.fromCDKTransaction', () => {
    it('maps CDK transaction fields onto invoice getters', () => {
        const invoice = CashuInvoice.fromCDKTransaction({
            ...cdkReceive,
            unit: 'sat',
            quote_id: 'quote-2',
            payment_request: 'lnbc50u1invoice'
        });

        expect(invoice.getAmount).toBe(5000);
        expect(invoice.getFee).toBe(1);
        expect(invoice.getTimestamp).toBe(1756200000);
        expect(invoice.getMemo).toBe('zap');
        expect(invoice.getPaymentRequest).toBe('lnbc50u1invoice');
        expect(invoice.mintUrl).toBe('https://mint.example.com');
        expect(invoice.key).toBe('b'.repeat(64));
        expect(invoice.cdkQuoteId).toBe('quote-2');
    });

    it('defaults fee to 0 when absent', () => {
        const invoice = CashuInvoice.fromCDKTransaction({
            ...cdkReceive,
            fee: undefined
        });

        expect(invoice.getFee).toBe(0);
    });

    it('treats records without a lifecycle state as paid (pre-0.18 CDK)', () => {
        const invoice = CashuInvoice.fromCDKTransaction(cdkReceive);

        expect(invoice.state).toBe('PAID');
        expect(invoice.isPaid).toBe(true);
        expect(invoice.isFailed).toBe(false);
        expect(invoice.isExpired).toBe(false);
        expect(invoice.shouldPollMint).toBe(false);
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
        // a transaction id is not a mint quote id
        expect(invoice.shouldPollMint).toBe(false);
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
        expect(invoice.shouldPollMint).toBe(false);
    });

    it('does not report an unrecognised lifecycle state as paid', () => {
        const invoice = CashuInvoice.fromCDKTransaction({
            ...cdkReceive,
            state: 'Unknown'
        });

        expect(invoice.state).toBe('UNPAID');
        expect(invoice.paid).toBe(false);
        expect(invoice.isPaid).toBe(false);
        expect(invoice.isFailed).toBe(false);
        expect(invoice.shouldPollMint).toBe(false);
    });
});

describe('CashuInvoice.shouldPollMint', () => {
    it('polls an unpaid mint quote', () => {
        const invoice = new CashuInvoice({
            quote: 'quote-id',
            request: '',
            state: 'UNPAID',
            paid: false,
            mintUrl: 'https://mint.example.com'
        });

        expect(invoice.shouldPollMint).toBe(true);
    });

    it('does not poll a paid mint quote', () => {
        const invoice = new CashuInvoice({
            quote: 'quote-id',
            request: '',
            state: 'PAID',
            paid: true,
            mintUrl: 'https://mint.example.com'
        });

        expect(invoice.shouldPollMint).toBe(false);
    });
});
