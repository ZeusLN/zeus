import * as React from 'react';
import { render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../components/KeyValue', () => {
    const { Text } = require('react-native');
    return ({ keyValue, value }: any) => <Text>{`${keyValue}: ${value}`}</Text>;
});
jest.mock('../../components/Amount', () => () => null);
jest.mock('../../components/Channels/ChannelItem', () => ({
    ChannelItem: () => null
}));
jest.mock('../../components/Button', () => () => null);
jest.mock('../../components/SuccessErrorMessage', () => ({
    SuccessMessage: () => null,
    ErrorMessage: () => null
}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../utils/DateTimeUtils', () => ({
    formatDateTime: (value: any) => String(value)
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../utils/UrlUtils', () => ({}));
jest.mock('../../utils/UnitsUtils', () => ({
    numberWithCommas: (value: any) => String(value)
}));
jest.mock('../../utils/LocaleUtils');

import LSPS1OrderResponse from './OrderResponse';

const ONCHAIN_PAYMENT = 'views.LSPS1.onchainPayment';
const ONCHAIN_ADDRESS = 'views.Settings.AddContact.onchainAddress';
const ADDRESS = 'bc1qexampleaddress';

const renderWithPayment = (payment: any) =>
    render(
        <LSPS1OrderResponse
            navigation={{ navigate: jest.fn() }}
            orderResponse={{
                order_id: 'order-1',
                order_state: 'CREATED',
                client_balance_sat: '0',
                lsp_balance_sat: '1000000',
                payment
            }}
            NodeInfoStore={{ testnet: false } as any}
            orderView
        />
    );

describe('LSPS1 order response onchain_payment row', () => {
    it('leaves the row out when onchain_payment is an object, as the LDK Node backend builds it', async () => {
        await renderWithPayment({
            state: 'EXPECT_PAYMENT',
            onchain_address: ADDRESS,
            onchain_payment: { address: ADDRESS, order_total_sat: '2000' }
        });

        expect(screen.queryByText(new RegExp(ONCHAIN_PAYMENT))).toBeNull();
        expect(
            screen.getByText(`${ONCHAIN_ADDRESS}: ${ADDRESS}`)
        ).toBeOnTheScreen();
    });

    it('shows the row when onchain_payment is text', async () => {
        await renderWithPayment({
            state: 'EXPECT_PAYMENT',
            onchain_payment: 'ab12:1'
        });

        expect(
            screen.getByText(`${ONCHAIN_PAYMENT}: ab12:1`)
        ).toBeOnTheScreen();
    });

    it('leaves the row out when there is no onchain_payment', async () => {
        await renderWithPayment({
            state: 'EXPECT_PAYMENT',
            onchain_address: ADDRESS
        });

        expect(screen.queryByText(new RegExp(ONCHAIN_PAYMENT))).toBeNull();
    });
});
