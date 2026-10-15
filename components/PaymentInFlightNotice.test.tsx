jest.mock('mobx-react', () => ({
    observer: (component: any) => component
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../stores/TransactionsStore', () => ({}));
jest.mock('./Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});

import * as React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import PaymentInFlightNotice from './PaymentInFlightNotice';

const renderNotice = async (state: {
    paymentInFlight: boolean;
    paymentInFlightConfirmed: boolean;
}) => {
    const store: any = {
        ...state,
        releasePaymentInFlight: jest.fn(() => true)
    };
    await render(<PaymentInFlightNotice TransactionsStore={store} />);
    return store;
};

describe('PaymentInFlightNotice', () => {
    beforeEach(() => {
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders nothing when no payment is in flight', async () => {
        await renderNotice({
            paymentInFlight: false,
            paymentInFlightConfirmed: false
        });
        expect(screen.toJSON()).toBeNull();
    });

    it('explains the wait without an override while the node is being checked', async () => {
        await renderNotice({
            paymentInFlight: true,
            paymentInFlightConfirmed: false
        });
        expect(
            screen.getByText('components.PaymentInFlightNotice.checking')
        ).toBeTruthy();
        expect(
            screen.queryByText('components.PaymentInFlightNotice.payAnyway')
        ).toBeNull();
    });

    it('releases the guard only after the user confirms Pay anyway', async () => {
        const store = await renderNotice({
            paymentInFlight: true,
            paymentInFlightConfirmed: true
        });
        expect(
            screen.getByText('components.PaymentInFlightNotice.pending')
        ).toBeTruthy();

        await fireEvent.press(
            screen.getByText('components.PaymentInFlightNotice.payAnyway')
        );
        expect(store.releasePaymentInFlight).not.toHaveBeenCalled();

        const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
        expect(Alert.alert).toHaveBeenCalledWith(
            'components.PaymentInFlightNotice.confirmTitle',
            'components.PaymentInFlightNotice.confirmText',
            expect.any(Array)
        );
        buttons.find((b: any) => b.style === 'cancel').onPress?.();
        expect(store.releasePaymentInFlight).not.toHaveBeenCalled();

        buttons.find((b: any) => b.style === 'destructive').onPress();
        expect(store.releasePaymentInFlight).toHaveBeenCalledTimes(1);
    });
});
