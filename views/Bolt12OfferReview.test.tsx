jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../components/Amount', () => 'Amount');
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/Conversion', () => 'Conversion');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/KeyValue', () => 'KeyValue');
jest.mock('../components/Screen', () => 'Screen');
jest.mock('../components/SwipeButton', () => 'SwipeButton');
jest.mock('../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../stores/FiatStore', () => ({}));
jest.mock('../stores/TransactionsStore', () => ({}));
jest.mock('../stores/SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {},
    DEFAULT_SLIDE_TO_PAY_THRESHOLD: 10000
}));
jest.mock('../utils/DateTimeUtils', () => ({
    listFormattedDate: () => 'date'
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../utils/UnitsUtils', () => ({
    numberWithCommas: (value: any) => String(value)
}));

import * as React from 'react';
import Bolt12OfferReview from './Bolt12OfferReview';

import type { DecodedOffer } from '../ldknode/LdkNodeInjection';

const offer = 'lno1qgsyxjtl6luzd9t3pr62xr7eemp6awnejusgf6gw45q75vcfqqqqqqq';
const NOW_SECONDS = 1_800_000_000;

const payableOffer: DecodedOffer = {
    offerId: 'id',
    description: 'coffee',
    isExpired: false,
    expectsQuantity: false
};

const childrenOf = (element: any): any[] =>
    React.Children.toArray(element?.props?.children);

const findByType = (node: any, type: string): any => {
    if (!React.isValidElement(node)) return undefined;
    if ((node as any).type === type) return node;
    for (const child of childrenOf(node)) {
        const found = findByType(child, type);
        if (found) return found;
    }
    return undefined;
};

const makeView = ({
    decodedOffer = payableOffer,
    satAmount = '2500',
    feeLimitSat = '25',
    timeoutSeconds = '45'
}: {
    decodedOffer?: DecodedOffer;
    satAmount?: string;
    feeLimitSat?: string;
    timeoutSeconds?: string;
} = {}) => {
    // sendPayment takes the in-flight guard like the real store does, so a
    // second tap sees paymentInFlight
    const TransactionsStore: any = {
        paymentInFlight: false,
        sendPayment: jest.fn(() => {
            TransactionsStore.paymentInFlight = true;
        })
    };
    const navigation = { navigate: jest.fn(), addListener: jest.fn() };
    const view = new Bolt12OfferReview({
        navigation,
        route: {
            key: 'Bolt12OfferReview',
            name: 'Bolt12OfferReview',
            params: {
                offer,
                decodedOffer,
                satAmount,
                timeoutSeconds,
                feeLimitSat
            }
        },
        FiatStore: { symbolLookup: () => ({ decimalPlaces: 2 }) },
        SettingsStore: { settings: { payments: {} } },
        TransactionsStore
    } as unknown as React.ComponentProps<typeof Bolt12OfferReview>);
    return { view, TransactionsStore, navigation };
};

// the control the user confirms with: Button below the slide-to-pay
// threshold, SwipeButton at or above it
const payControl = (view: Bolt12OfferReview) => {
    const tree = view.render();
    const swipe = findByType(tree, 'SwipeButton');
    if (swipe)
        return {
            disabled: swipe.props.disabled,
            confirm: swipe.props.onSwipeSuccess
        };
    const button = findByType(tree, 'Button');
    return { disabled: button.props.disabled, confirm: button.props.onPress };
};

describe('Bolt12OfferReview confirmation', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(NOW_SECONDS * 1000);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('dispatches the offer payment once with the reviewed amount, fee limit and timeout', () => {
        const { view, TransactionsStore, navigation } = makeView();

        const control = payControl(view);
        expect(control.disabled).toBe(false);
        control.confirm();
        // a rapid second tap before the screen re-renders
        control.confirm();

        expect(TransactionsStore.sendPayment).toHaveBeenCalledTimes(1);
        expect(TransactionsStore.sendPayment).toHaveBeenCalledWith({
            offer,
            amount: '2500',
            fee_limit_sat: '25',
            timeout_seconds: '45'
        });
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledWith('SendingLightning');
    });

    it('falls back to the default routing fee when no fee limit was set', () => {
        const { view, TransactionsStore } = makeView({
            satAmount: '100000',
            feeLimitSat: ''
        });

        payControl(view).confirm();

        expect(TransactionsStore.sendPayment).toHaveBeenCalledWith(
            expect.objectContaining({ amount: '100000', fee_limit_sat: '5000' })
        );
    });

    it('requires a swipe at or above the slide-to-pay threshold and dispatches once', () => {
        const { view, TransactionsStore } = makeView({ satAmount: '10000' });

        expect(findByType(view.render(), 'SwipeButton')).toBeDefined();
        expect(findByType(view.render(), 'Button')).toBeUndefined();

        const control = payControl(view);
        control.confirm();
        control.confirm();

        expect(TransactionsStore.sendPayment).toHaveBeenCalledTimes(1);
        expect(TransactionsStore.sendPayment).toHaveBeenCalledWith(
            expect.objectContaining({ offer, amount: '10000' })
        );
    });

    it('disables the pay control while another payment is in flight', () => {
        const { view, TransactionsStore } = makeView();
        TransactionsStore.paymentInFlight = true;

        const control = payControl(view);
        expect(control.disabled).toBe(true);
        control.confirm();

        expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
    });

    it.each([
        ['expired at decode time', { isExpired: true }, '2500'],
        [
            'past its absolute expiry',
            { absoluteExpirySeconds: NOW_SECONDS - 1 },
            '2500'
        ],
        ['expecting a quantity', { expectsQuantity: true }, '2500'],
        [
            'denominated in a currency',
            {
                amountType: 'currency',
                iso4217Code: 'USD',
                currencyAmount: 250
            },
            '2500'
        ],
        ['underpaid', { amountType: 'bitcoin', amountMsats: 5_000_000 }, '4999']
    ] as const)(
        'cannot dispatch an offer %s',
        (_label, overrides, satAmount) => {
            const { view, TransactionsStore, navigation } = makeView({
                decodedOffer: { ...payableOffer, ...overrides } as DecodedOffer,
                satAmount
            });

            const control = payControl(view);
            expect(control.disabled).toBe(true);
            control.confirm();

            expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );

    it('refuses to dispatch when the offer expires after the screen rendered', () => {
        const { view, TransactionsStore, navigation } = makeView({
            decodedOffer: {
                ...payableOffer,
                absoluteExpirySeconds: NOW_SECONDS + 30
            }
        });

        const control = payControl(view);
        expect(control.disabled).toBe(false);

        // the user leaves the screen open past the offer's expiry, then taps
        // the control that was rendered enabled
        jest.setSystemTime((NOW_SECONDS + 31) * 1000);
        control.confirm();

        expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
        expect(payControl(view).disabled).toBe(true);
    });
});
