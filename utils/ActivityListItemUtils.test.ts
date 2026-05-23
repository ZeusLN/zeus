jest.mock('dateformat', () => ({}));
jest.mock('./LocaleUtils', () => ({
    localeString: (
        s: string,
        substitutions?: { [key: string]: string | number }
    ) => {
        if (!substitutions) return s;
        return `${s}:${Object.entries(substitutions)
            .map(([key, value]) => `${key}=${value}`)
            .join(',')}`;
    }
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
    formatActivityLabelValue,
    getActivityAmountTheme,
    getActivityListItemPresentation,
    getActivityStateLabel,
    getActivityTitleAccessibilityLabel,
    getLayerSubtitleAccessibilityLabel
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

    it('falls back to an unknown neutral presentation for missing activity rows', () => {
        const presentation = getActivityListItemPresentation(undefined);

        expect(presentation.title).toBe('general.unknown');
        expect(presentation.directionLabel).toBe('general.unknown');
        expect(presentation.directionIcon).toBe('receipt');
        expect(presentation.directionColor).toBe('secondaryText');
        expect(getActivityAmountTheme(undefined)).toBe('text');
    });

    it('formats title, subtitle, and state accessibility labels through localized templates', () => {
        const payment = new Payment({
            value: '2500',
            payment_preimage:
                '0000000000000000000000000000000000000000000000000000000000000001'
        });
        const presentation = getActivityListItemPresentation(payment);

        expect(getActivityTitleAccessibilityLabel(presentation)).toBe(
            'views.Activity.accessibility.titleWithDirection:direction=views.Activity.youSent,title=views.Payment.title'
        );
        expect(
            getLayerSubtitleAccessibilityLabel({
                layerLabel: presentation.layerLabel,
                status: 'general.unconfirmed',
                detail: 'memo'
            })
        ).toBe(
            'views.Activity.accessibility.subtitleWithLayer:layer=general.lightning,status=general.unconfirmed,detail=memo'
        );
        expect(formatActivityLabelValue('general.status', 'Pending')).toBe(
            'views.Activity.labelValue:label=general.status,value=Pending'
        );
        expect(getActivityStateLabel('IN_PROGRESS')).toBe(
            'views.Activity.labelValue:label=general.state,value=In progress'
        );
    });
});
