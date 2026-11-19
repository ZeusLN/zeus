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
import LSPS7OrderResponse from '../LSPS7/OrderResponse';

const MIN_ONCHAIN_CONFIRMATIONS = 'views.LSPS1.minOnchainPaymentConfirmations';

// payment.onchain from the lsps1.create_order response example in the
// LSPS1 spec (bLIP-51): an LSP that accepts the payment with 0 confirmations
const SPEC_ONCHAIN_PAYMENT = {
    state: 'EXPECT_PAYMENT',
    expires_at: '2015-01-25T19:29:44.612Z',
    fee_total_sat: '9999',
    order_total_sat: '2009999',
    address: 'bc1p5uvtaxzkjwvey2tfy49k5vtqfpjmrgm09cvs88ezyy8h2zv7jhas9tu4yr',
    min_fee_for_0conf: 253,
    min_onchain_payment_confirmations: 0,
    refund_onchain_address:
        'bc1qvmsy0f3yyes6z9jvddk8xqwznndmdwapvrc0xrmhd3vqj5rhdrrq6hz49h'
};

const orderWith = (payment: any) => ({
    order_id: 'bb4b5d0a-8334-49d8-9463-90a6d413af7c',
    order_state: 'CREATED',
    client_balance_sat: '2000000',
    lsp_balance_sat: '5000000',
    payment
});

const renderLSPS1 = (payment: any) =>
    render(
        <LSPS1OrderResponse
            navigation={{ navigate: jest.fn() }}
            orderResponse={orderWith(payment)}
            NodeInfoStore={{ testnet: false } as any}
            orderView
        />
    );

describe('LSPS order responses with zero on-chain confirmations', () => {
    it('LSPS1 shows min_onchain_payment_confirmations 0 under payment.onchain', async () => {
        await renderLSPS1({ onchain: SPEC_ONCHAIN_PAYMENT });

        expect(
            screen.getByText(`${MIN_ONCHAIN_CONFIRMATIONS}: 0`)
        ).toBeOnTheScreen();
    });

    it('LSPS1 shows min_onchain_payment_confirmations 0 in the flat payment format', async () => {
        await renderLSPS1({
            state: 'EXPECT_PAYMENT',
            fee_total_sat: '9999',
            order_total_sat: '2009999',
            onchain_address: SPEC_ONCHAIN_PAYMENT.address,
            min_fee_for_0conf: 253,
            min_onchain_payment_confirmations: 0
        });

        expect(
            screen.getByText(`${MIN_ONCHAIN_CONFIRMATIONS}: 0`)
        ).toBeOnTheScreen();
    });

    it('LSPS1 leaves the row out when min_onchain_payment_confirmations is missing', async () => {
        const { min_onchain_payment_confirmations: _omitted, ...onchain } =
            SPEC_ONCHAIN_PAYMENT;
        await renderLSPS1({ onchain });

        expect(
            screen.queryByText(new RegExp(MIN_ONCHAIN_CONFIRMATIONS))
        ).toBeNull();
    });

    it('LSPS7 shows min_onchain_payment_confirmations 0 under payment.onchain', async () => {
        await render(
            <LSPS7OrderResponse
                navigation={{ navigate: jest.fn() }}
                orderResponse={orderWith({ onchain: SPEC_ONCHAIN_PAYMENT })}
                orderView
            />
        );

        expect(
            screen.getByText(`${MIN_ONCHAIN_CONFIRMATIONS}: 0`)
        ).toBeOnTheScreen();
    });
});
