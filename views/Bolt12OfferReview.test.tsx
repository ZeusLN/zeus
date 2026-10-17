jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../components/Amount', () => 'Amount');
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/Conversion', () => 'Conversion');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/KeyValue', () => 'KeyValue');
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/SwipeButton', () => 'SwipeButton');
jest.mock('../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../stores/FiatStore', () => ({}));
jest.mock('../stores/Stores', () => ({}));
jest.mock('../stores/TransactionsStore', () => ({}));
jest.mock('../stores/SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {},
    DEFAULT_SLIDE_TO_PAY_THRESHOLD: 10000
}));
jest.mock('../utils/DateTimeUtils', () => ({
    listFormattedDate: () => 'date'
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../utils/UnitsUtils', () => ({
    numberWithCommas: (value: any) => String(value)
}));

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
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

const renderView = async ({
    decodedOffer = payableOffer,
    satAmount = '2500',
    feeLimitSat = '25',
    timeoutSeconds = '45',
    paymentInFlight = false
}: {
    decodedOffer?: DecodedOffer;
    satAmount?: string;
    feeLimitSat?: string;
    timeoutSeconds?: string;
    paymentInFlight?: boolean;
} = {}) => {
    // sendPayment takes the in-flight guard like the real store does, so a
    // second tap sees paymentInFlight
    const TransactionsStore: any = {
        paymentInFlight,
        sendPayment: jest.fn(() => {
            TransactionsStore.paymentInFlight = true;
        })
    };
    const navigation = { navigate: jest.fn(), addListener: jest.fn() };
    await render(
        <Bolt12OfferReview
            {...({
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
            } as any)}
        />
    );
    return { TransactionsStore, navigation };
};

const hostOfType = (type: string) =>
    screen.container.queryAll((n) => n.type === type)[0];

const expiredMessageShown = () =>
    screen.container
        .queryAll((n) => n.type === 'ErrorMessage')
        .some((n) => n.props.message === 'views.Bolt12OfferReview.expired');

// The control the user confirms with: Button below the slide-to-pay
// threshold, SwipeButton at or above it. Both are mocked as plain hosts, so
// a confirm reaches the handler even when the control renders disabled,
// which exercises the screen's own guards.
const payControl = () => {
    const swipe = hostOfType('SwipeButton');
    if (swipe)
        return {
            disabled: swipe.props.disabled,
            confirm: () => fireEvent(swipe, 'swipeSuccess')
        };
    const button = hostOfType('Button');
    return {
        disabled: button.props.disabled,
        confirm: () => fireEvent.press(button)
    };
};

describe('Bolt12OfferReview confirmation', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(NOW_SECONDS * 1000);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('dispatches the offer payment once with the reviewed amount, fee limit and timeout', async () => {
        const { TransactionsStore, navigation } = await renderView();

        const control = payControl();
        expect(control.disabled).toBe(false);
        await control.confirm();
        // a rapid second tap on the control the user already saw
        await control.confirm();

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

    it('falls back to the default routing fee when no fee limit was set', async () => {
        const { TransactionsStore } = await renderView({
            satAmount: '100000',
            feeLimitSat: ''
        });

        await payControl().confirm();

        expect(TransactionsStore.sendPayment).toHaveBeenCalledWith(
            expect.objectContaining({ amount: '100000', fee_limit_sat: '5000' })
        );
    });

    it('requires a swipe at or above the slide-to-pay threshold and dispatches once', async () => {
        const { TransactionsStore } = await renderView({ satAmount: '10000' });

        expect(hostOfType('SwipeButton')).toBeDefined();
        expect(hostOfType('Button')).toBeUndefined();

        const control = payControl();
        await control.confirm();
        await control.confirm();

        expect(TransactionsStore.sendPayment).toHaveBeenCalledTimes(1);
        expect(TransactionsStore.sendPayment).toHaveBeenCalledWith(
            expect.objectContaining({ offer, amount: '10000' })
        );
    });

    it('disables the pay control while another payment is in flight', async () => {
        const { TransactionsStore } = await renderView({
            paymentInFlight: true
        });

        const control = payControl();
        expect(control.disabled).toBe(true);
        await control.confirm();

        expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
    });

    it.each(['1,000', '0,5', '-1', '.'])(
        'cannot dispatch with the unusable fee limit %s',
        async (feeLimitSat) => {
            const { TransactionsStore, navigation } = await renderView({
                feeLimitSat
            });

            expect(
                screen.container
                    .queryAll((n) => n.type === 'ErrorMessage')
                    .map((n) => n.props.message)
            ).toContain('views.PaymentRequest.invalidFeeLimit');

            const control = payControl();
            expect(control.disabled).toBe(true);
            await control.confirm();

            expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );

    it('dispatches with a fee limit of 0', async () => {
        const { TransactionsStore } = await renderView({ feeLimitSat: '0' });

        const control = payControl();
        expect(control.disabled).toBe(false);
        await control.confirm();

        expect(TransactionsStore.sendPayment).toHaveBeenCalledWith(
            expect.objectContaining({ fee_limit_sat: '0' })
        );
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
        async (_label, overrides, satAmount) => {
            const { TransactionsStore, navigation } = await renderView({
                decodedOffer: { ...payableOffer, ...overrides } as DecodedOffer,
                satAmount
            });

            const control = payControl();
            expect(control.disabled).toBe(true);
            await control.confirm();

            expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
            expect(navigation.navigate).not.toHaveBeenCalled();
        }
    );

    it('says an offer that expired before the screen opened has expired', async () => {
        await renderView({
            decodedOffer: { ...payableOffer, isExpired: true }
        });

        expect(expiredMessageShown()).toBe(true);
    });

    it('refuses to dispatch when the offer expires after the screen rendered', async () => {
        const { TransactionsStore, navigation } = await renderView({
            decodedOffer: {
                ...payableOffer,
                absoluteExpirySeconds: NOW_SECONDS + 30
            }
        });

        const control = payControl();
        expect(control.disabled).toBe(false);

        // the user leaves the screen open past the offer's expiry, then taps
        // the control that was rendered enabled
        jest.setSystemTime((NOW_SECONDS + 31) * 1000);
        await control.confirm();

        expect(TransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('currently leaves the control enabled and silent when the offer expires on screen', async () => {
        await renderView({
            decodedOffer: {
                ...payableOffer,
                absoluteExpirySeconds: NOW_SECONDS + 30
            }
        });

        jest.setSystemTime((NOW_SECONDS + 31) * 1000);
        await payControl().confirm();

        // payOffer returns without a state change, so nothing re-renders:
        // the tap does nothing and the expired message does not appear (#5063)
        expect(payControl().disabled).toBe(false);
        expect(expiredMessageShown()).toBe(false);
    });
});
