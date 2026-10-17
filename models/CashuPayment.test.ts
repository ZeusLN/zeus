jest.mock('../stores/Stores', () => ({}));

import CashuPayment from './CashuPayment';
import type { CDKTransaction } from '../cashu-cdk';

const cdkMelt: CDKTransaction = {
    id: 'a'.repeat(64),
    direction: 'outgoing',
    amount: 21000,
    fee: 4,
    mint_url: 'https://mint.example.com',
    timestamp: 1756200000,
    unit: 'sat',
    quote_id: 'quote-1',
    payment_request: 'lnbc210u1invoice',
    payment_proof: 'deadbeef',
    payment_method: 'bolt11'
};

describe('CashuPayment.fromCDKTransaction', () => {
    it('maps CDK melt fields onto payment getters', () => {
        const payment = CashuPayment.fromCDKTransaction(cdkMelt);

        expect(payment.getAmount).toBe(21000);
        expect(payment.getFee).toBe('4');
        expect(payment.getTimestamp).toBe(1756200000);
        expect(payment.getPreimage).toBe('deadbeef');
        expect(payment.getPaymentRequest).toBe('lnbc210u1invoice');
        expect(payment.getMintUrl).toBe('https://mint.example.com');
        expect(payment.fromCDK).toBe(true);
        expect(payment.cdkTransactionId).toBe('a'.repeat(64));
        expect(payment.cdkQuoteId).toBe('quote-1');
    });

    it('treats a completed melt as neither failed nor in transit', () => {
        const payment = CashuPayment.fromCDKTransaction({
            ...cdkMelt,
            state: 'Completed'
        });

        expect(payment.isFailed).toBe(false);
        expect(payment.isInTransit).toBe(false);
    });

    it('treats a melt without a lifecycle state as settled', () => {
        const payment = CashuPayment.fromCDKTransaction(cdkMelt);

        expect(payment.isFailed).toBe(false);
        expect(payment.isInTransit).toBe(false);
    });

    it('treats a pending melt as in transit', () => {
        const payment = CashuPayment.fromCDKTransaction({
            ...cdkMelt,
            state: 'Pending',
            payment_proof: undefined
        });

        expect(payment.isInTransit).toBe(true);
        expect(payment.isFailed).toBe(false);
    });

    it('treats a failed melt as failed', () => {
        const payment = CashuPayment.fromCDKTransaction({
            ...cdkMelt,
            state: 'Failed'
        });

        expect(payment.isFailed).toBe(true);
        expect(payment.isInTransit).toBe(false);
    });

    it('defaults fee to 0 when absent', () => {
        const payment = CashuPayment.fromCDKTransaction({
            ...cdkMelt,
            fee: undefined
        });

        expect(payment.getFee).toBe('0');
    });
});
