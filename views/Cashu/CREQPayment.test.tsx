jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../utils/NFCUtils', () => ({ payViaNfcTap: jest.fn() }));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/KeyValue', () => 'KeyValue');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable role="button" onPress={onPress} disabled={disabled}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>,
        SuccessMessage: ({ message }: any) => <Text>{message}</Text>
    };
});

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import CREQPayment from './CREQPayment';
import { payViaNfcTap } from '../../utils/NFCUtils';

const creqParams = {
    id: 'b7a90176',
    amount: 21,
    unit: 'sat',
    mints: ['https://mint.example.com']
};

const CashuStore = {
    mintUrls: ['https://mint.example.com'],
    mintBalances: { 'https://mint.example.com': 1000 },
    selectedMintUrl: 'https://mint.example.com',
    sendTokenForRequest: jest.fn()
};
const ModalStore = {};

const renderView = (params: any = creqParams) =>
    render(
        <CREQPayment
            {...({
                navigation: { navigate: jest.fn() },
                route: {
                    params: { creqParams: params, creqString: 'creqAoWFhZA' }
                },
                CashuStore,
                ModalStore
            } as any)}
        />
    );

const payButton = () =>
    screen.getByRole('button', { name: 'views.Cashu.CREQPayment.payViaNfc' });

describe('CREQPayment', () => {
    beforeEach(() => {
        (payViaNfcTap as jest.Mock).mockReset();
    });

    it('pays in one NFC session that checks the tag holds this request', async () => {
        (payViaNfcTap as jest.Mock).mockResolvedValue({
            status: 'paid',
            amount: 21
        });
        await renderView();

        await fireEvent.press(payButton());

        expect(payViaNfcTap).toHaveBeenCalledWith(ModalStore, CashuStore, {
            expected: creqParams
        });
        // no token is created before the tap
        expect(CashuStore.sendTokenForRequest).not.toHaveBeenCalled();
        expect(screen.getByText('general.success')).toBeOnTheScreen();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows why the payment failed and lets the user try again', async () => {
        (payViaNfcTap as jest.Mock).mockResolvedValue({
            status: 'failed',
            error: 'utils.NFCUtils.requestChanged'
        });
        await renderView();

        await fireEvent.press(payButton());

        expect(
            screen.getByText('utils.NFCUtils.requestChanged')
        ).toBeOnTheScreen();
        expect(payButton()).toBeOnTheScreen();
    });

    it('returns to the request after a cancelled tap', async () => {
        (payViaNfcTap as jest.Mock).mockResolvedValue({ status: 'cancelled' });
        await renderView();

        await fireEvent.press(payButton());

        expect(screen.queryByText('general.success')).toBeNull();
        expect(payButton()).toBeOnTheScreen();
    });

    it('disables paying without a mint that can cover the request', async () => {
        await renderView({ ...creqParams, amount: 5000 });

        expect(payButton()).toBeDisabled();
    });
});
