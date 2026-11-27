import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/LoadingIndicator', () => () => null);
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        WarningMessage: ({ message }: any) => (
            <Text testID="warning">{message}</Text>
        )
    };
});
jest.mock('./OrderResponse', () => {
    const { Text } = require('react-native');
    return ({ orderResponse }: any) => (
        <Text testID="order">
            {`${orderResponse.order_id}:${orderResponse.order_state}`}
        </Text>
    );
});
jest.mock('../../stores/LSPStore', () => ({ LSPS_ORDERS_KEY: 'orders' }));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/InvoicesStore', () => ({}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../storage', () => ({ getItem: jest.fn() }));
jest.mock('../../utils/BackendUtils', () => ({
    supportsLSPS1rest: jest.fn(() => true),
    supportsLSPScustomMessage: jest.fn(() => true)
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../utils/LocaleUtils');

import Storage from '../../storage';
import BackendUtils from '../../utils/BackendUtils';
import LSPS1Order from './Order';

const ENDPOINT = 'https://lsp.example.com';
const PEER = '02abc';

// how long the screen waits before it reads the get_order reply
const READ_DELAY_MS = 3000;

const storedOrder = (orderId: string, extra: any = {}) =>
    JSON.stringify({
        order: { order_id: orderId, order_state: 'CREATED' },
        endpoint: ENDPOINT,
        peer: PEER,
        ...extra
    });

let lspStore: any;

const renderOrder = async (orderId: string) => {
    await render(
        <LSPS1Order
            navigation={{} as any}
            route={{ params: { orderId, orderShouldUpdate: false } } as any}
            LSPStore={lspStore}
            SettingsStore={{} as any}
            InvoicesStore={{} as any}
            NodeInfoStore={{} as any}
        />
    );
    // let the stored order load and the get_order request go out
    await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
    });
};

const waitForRead = () =>
    act(async () => {
        await jest.advanceTimersByTimeAsync(READ_DELAY_MS);
    });

describe('LSPS1Order', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.mocked(Storage.getItem).mockResolvedValue(
            JSON.stringify([storedOrder('order-x'), storedOrder('order-y')])
        );
        jest.mocked(BackendUtils.supportsLSPS1rest).mockReturnValue(true);
        lspStore = {
            getOrderResponse: {},
            error: false,
            error_msg: '',
            loadingLSPS1: false,
            updateOrderInStorage: jest.fn(),
            lsps1GetOrderREST: jest.fn(),
            lsps1GetOrderNative: jest.fn(),
            lsps1GetOrderCustomMessage: jest.fn()
        };
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('shows the stored order, then the reply for this order', async () => {
        const reply = { order_id: 'order-y', order_state: 'COMPLETED' };
        lspStore.lsps1GetOrderREST.mockImplementation(() => {
            lspStore.getOrderResponse = reply;
        });

        await renderOrder('order-y');
        expect(screen.getByTestId('order')).toHaveTextContent(
            'order-y:CREATED'
        );
        expect(lspStore.lsps1GetOrderREST).toHaveBeenCalledWith(
            'order-y',
            ENDPOINT
        );

        await waitForRead();

        expect(screen.getByTestId('order')).toHaveTextContent(
            'order-y:COMPLETED'
        );
        expect(lspStore.updateOrderInStorage).toHaveBeenCalledWith(reply);
        expect(screen.queryByTestId('warning')).toBeNull();
    });

    it('keeps the stored order when the slot still holds the reply for the order opened before', async () => {
        // order-x's screen was left with hardware back, which skips onBack,
        // and order-y's own request is not answered in time
        lspStore.getOrderResponse = {
            order_id: 'order-x',
            order_state: 'COMPLETED'
        };

        await renderOrder('order-y');
        await waitForRead();

        expect(screen.getByTestId('order')).toHaveTextContent(
            'order-y:CREATED'
        );
        expect(lspStore.updateOrderInStorage).not.toHaveBeenCalled();
    });

    it('keeps the stored order when a reply for another order arrives while it waits', async () => {
        await renderOrder('order-y');
        // for example the free-order poll, over custom messages
        lspStore.getOrderResponse = {
            result: { order_id: 'order-x', order_state: 'FAILED' }
        };
        await waitForRead();

        expect(screen.getByTestId('order')).toHaveTextContent(
            'order-y:CREATED'
        );
        expect(lspStore.updateOrderInStorage).not.toHaveBeenCalled();
    });

    it('does not show an error left by an earlier request', async () => {
        lspStore.error = true;
        lspStore.error_msg = 'lsp unreachable';
        lspStore.lsps1GetOrderREST.mockImplementation(() => {
            lspStore.getOrderResponse = {
                order_id: 'order-y',
                order_state: 'COMPLETED'
            };
        });

        await renderOrder('order-y');
        expect(lspStore.error).toBe(false);
        expect(lspStore.error_msg).toBe('');

        await waitForRead();

        expect(screen.queryByTestId('warning')).toBeNull();
        expect(screen.getByTestId('order')).toHaveTextContent(
            'order-y:COMPLETED'
        );
    });

    it("shows the stored order with a warning when this order's request fails", async () => {
        lspStore.lsps1GetOrderREST.mockImplementation(() => {
            lspStore.error = true;
            lspStore.error_msg = 'lsp unreachable';
        });

        await renderOrder('order-y');
        await waitForRead();

        expect(screen.getByTestId('warning')).toHaveTextContent(
            'lsp unreachable: views.LSPS1.showingPreviousState'
        );
        expect(screen.getByTestId('order')).toHaveTextContent(
            'order-y:CREATED'
        );
    });

    it('asks LDK Node for an order that was created natively', async () => {
        jest.mocked(Storage.getItem).mockResolvedValue(
            JSON.stringify([storedOrder('order-y', { native: true })])
        );

        await renderOrder('order-y');

        expect(lspStore.lsps1GetOrderNative).toHaveBeenCalledWith('order-y');
        expect(lspStore.lsps1GetOrderREST).not.toHaveBeenCalled();
    });

    it('asks the stored peer when the backend has no LSPS1 REST', async () => {
        jest.mocked(BackendUtils.supportsLSPS1rest).mockReturnValue(false);

        await renderOrder('order-y');

        expect(lspStore.lsps1GetOrderCustomMessage).toHaveBeenCalledWith(
            'order-y',
            PEER
        );
        expect(lspStore.lsps1GetOrderREST).not.toHaveBeenCalled();
    });
});
