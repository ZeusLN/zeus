jest.mock('../stores/Stores');

import CashuPayment from './CashuPayment';
import type { CDKTransaction } from '../cashu-cdk';

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
