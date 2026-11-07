import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../components/KeyValue', () => () => null);
jest.mock('../../components/Amount', () => () => null);
jest.mock('../../components/Channels/ChannelItem', () => ({
    ChannelItem: () => null
}));
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable role="button" onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/SuccessErrorMessage', () => ({
    SuccessMessage: () => null,
    ErrorMessage: () => null
}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../utils/DateTimeUtils', () => ({
    formatDateTime: (value: any) => String(value)
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));
jest.mock('../../utils/UrlUtils', () => ({}));
jest.mock('../../utils/UnitsUtils', () => ({
    numberWithCommas: (value: any) => String(value)
}));
jest.mock('../../utils/LocaleUtils');

import LSPS1OrderResponse from './OrderResponse';
import LSPS7OrderResponse from '../LSPS7/OrderResponse';

const ADDRESS = 'bc1qexampleaddress';
const PAY_ONCHAIN = 'views.LSPS1.makePayment';

const orderWith = (onchain: any) => ({
    order_id: 'order-1',
    order_state: 'CREATED',
    client_balance_sat: '50000',
    lsp_balance_sat: '1000000',
    payment: { onchain: { address: ADDRESS, ...onchain } }
});

describe('LSPS on-chain payment button', () => {
    let navigation: any;

    beforeEach(() => {
        navigation = { navigate: jest.fn() };
    });

    it('LSPS1 sends the order total, which includes the client balance', async () => {
        await render(
            <LSPS1OrderResponse
                navigation={navigation}
                orderResponse={orderWith({
                    fee_total_sat: '5000',
                    order_total_sat: '55000'
                })}
                NodeInfoStore={{ testnet: false } as any}
                orderView
            />
        );

        await fireEvent.press(screen.getByText(PAY_ONCHAIN));

        expect(navigation.navigate).toHaveBeenCalledWith('Send', {
            destination: ADDRESS,
            satAmount: '55000',
            transactionType: 'On-chain'
        });
    });

    it('LSPS1 falls back to the fee total when the order total is missing', async () => {
        await render(
            <LSPS1OrderResponse
                navigation={navigation}
                orderResponse={orderWith({ fee_total_sat: '5000' })}
                NodeInfoStore={{ testnet: false } as any}
                orderView
            />
        );

        await fireEvent.press(screen.getByText(PAY_ONCHAIN));

        expect(navigation.navigate).toHaveBeenCalledWith('Send', {
            destination: ADDRESS,
            satAmount: '5000',
            transactionType: 'On-chain'
        });
    });

    it('LSPS1 shows the button when only the order total is present', async () => {
        await render(
            <LSPS1OrderResponse
                navigation={navigation}
                orderResponse={orderWith({ order_total_sat: '55000' })}
                NodeInfoStore={{ testnet: false } as any}
                orderView
            />
        );

        await fireEvent.press(screen.getByText(PAY_ONCHAIN));

        expect(navigation.navigate).toHaveBeenCalledWith(
            'Send',
            expect.objectContaining({ satAmount: '55000' })
        );
    });

    it('LSPS1 hides the button when neither total is present', async () => {
        await render(
            <LSPS1OrderResponse
                navigation={navigation}
                orderResponse={orderWith({})}
                NodeInfoStore={{ testnet: false } as any}
                orderView
            />
        );

        expect(screen.queryByText(PAY_ONCHAIN)).toBeNull();
    });

    it('LSPS7 sends the order total', async () => {
        await render(
            <LSPS7OrderResponse
                navigation={navigation}
                orderResponse={orderWith({
                    fee_total_sat: '5000',
                    order_total_sat: '6000'
                })}
                orderView
            />
        );

        await fireEvent.press(screen.getByText(PAY_ONCHAIN));

        expect(navigation.navigate).toHaveBeenCalledWith('Send', {
            destination: ADDRESS,
            satAmount: '6000',
            transactionType: 'On-chain'
        });
    });
});
