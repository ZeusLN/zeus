jest.mock('dateformat', () => ({}));
jest.mock('./LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../stores/Stores', () => ({
    notesStore: {
        notes: []
    }
}));

import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Transaction from '../models/Transaction';
import {
    getActivityAmountTheme,
    getActivityListItemPresentation
} from './ActivityListItemUtils';

describe('ActivityListItemUtils', () => {
    it('uses icons to carry sent Lightning direction instead of repeating the sent label as the row title', () => {
        const payment = new Payment({
            value: '2500',
            payment_preimage:
                '0000000000000000000000000000000000000000000000000000000000000001'
        });

        const presentation = getActivityListItemPresentation(payment);

        expect(presentation.title).toBe('views.Payment.title');
        expect(presentation.directionLabel).toBe('views.Activity.youSent');
        expect(presentation.directionIcon).toBe('call-made');
        expect(presentation.directionColor).toBe('warning');
        expect(presentation.layer).toBe('lightning');
        expect(presentation.layerLabel).toBe('general.lightning');
    });

    it('uses icons to carry received Lightning direction instead of repeating the received label as the row title', () => {
        const invoice = new Invoice({
            settled: true,
            value: '2500'
        });

        const presentation = getActivityListItemPresentation(invoice);

        expect(presentation.title).toBe('views.Invoice.title');
        expect(presentation.directionLabel).toBe('views.Activity.youReceived');
        expect(presentation.directionIcon).toBe('call-received');
        expect(presentation.directionColor).toBe('success');
        expect(presentation.layer).toBe('lightning');
        expect(presentation.layerLabel).toBe('general.lightning');
    });

    it('marks on-chain transaction direction with icons while keeping the row title generic', () => {
        const transaction = new Transaction({
            amount: -10000,
            total_fees: 200,
            num_confirmations: 4
        });

        const presentation = getActivityListItemPresentation(transaction);

        expect(presentation.title).toBe('general.transaction');
        expect(presentation.directionLabel).toBe('views.Activity.youSent');
        expect(presentation.directionIcon).toBe('call-made');
        expect(presentation.layer).toBe('onchain');
        expect(presentation.layerLabel).toBe('general.onchain');
    });

    it('renders failed payment amounts neutrally because no funds were sent', () => {
        const failedPayment = new Payment({
            value: '1000',
            failure_reason: 'FAILURE_REASON_TIMEOUT',
            payment_preimage:
                '0000000000000000000000000000000000000000000000000000000000000000'
        });

        const presentation = getActivityListItemPresentation(failedPayment);

        expect(presentation.title).toBe('views.Payment.failedPayment');
        expect(presentation.directionIcon).toBe('error-outline');
        expect(presentation.directionColor).toBe('secondaryText');
        expect(getActivityAmountTheme(failedPayment)).toBe('secondaryText');
    });
});
