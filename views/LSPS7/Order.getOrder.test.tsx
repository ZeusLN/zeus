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
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../utils/LocaleUtils');

import Storage from '../../storage';
import LSPS7Order from './Order';

const PEER = '02abc';

// how long the screen waits before it reads the get_order reply
const READ_DELAY_MS = 3000;

const storedOrder = (orderId: string) =>
    JSON.stringify({
        order: { result: { order_id: orderId, order_state: 'CREATED' } },
        peer: PEER
    });

let lspStore: any;

const renderOrder = async (orderId: string) => {
    await render(
        <LSPS7Order
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

describe('LSPS7Order', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.mocked(Storage.getItem).mockResolvedValue(
            JSON.stringify([storedOrder('ext-x'), storedOrder('ext-y')])
        );
        lspStore = {
            getExtensionOrderResponse: {},
            error: false,
            error_msg: '',
            loadingLSPS7: false,
            updateOrderInStorage: jest.fn(),
            lsps7GetOrderCustomMessage: jest.fn()
        };
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('shows the stored order, then the reply for this order', async () => {
        const reply = {
            result: { order_id: 'ext-y', order_state: 'COMPLETED' }
        };
        lspStore.lsps7GetOrderCustomMessage.mockImplementation(() => {
            lspStore.getExtensionOrderResponse = reply;
        });

        await renderOrder('ext-y');
        expect(screen.getByTestId('order')).toHaveTextContent('ext-y:CREATED');
        expect(lspStore.lsps7GetOrderCustomMessage).toHaveBeenCalledWith(
            'ext-y',
            PEER
        );

        await waitForRead();

        expect(screen.getByTestId('order')).toHaveTextContent(
            'ext-y:COMPLETED'
        );
        expect(lspStore.updateOrderInStorage).toHaveBeenCalledWith(reply);
        expect(screen.queryByTestId('warning')).toBeNull();
    });

    it('keeps the stored order when the slot still holds the reply for the order opened before', async () => {
        // ext-x's screen was left with hardware back, which skips onBack,
        // and ext-y's own request is not answered in time
        lspStore.getExtensionOrderResponse = {
            result: { order_id: 'ext-x', order_state: 'COMPLETED' }
        };

        await renderOrder('ext-y');
        await waitForRead();

        expect(screen.getByTestId('order')).toHaveTextContent('ext-y:CREATED');
        expect(lspStore.updateOrderInStorage).not.toHaveBeenCalled();
    });

    it('keeps the stored order when a reply for another order arrives while it waits', async () => {
        await renderOrder('ext-y');
        // for example the free-order poll
        lspStore.getExtensionOrderResponse = {
            result: { order_id: 'ext-x', order_state: 'FAILED' }
        };
        await waitForRead();

        expect(screen.getByTestId('order')).toHaveTextContent('ext-y:CREATED');
        expect(lspStore.updateOrderInStorage).not.toHaveBeenCalled();
    });

    it('does not show an error left by an earlier request', async () => {
        lspStore.error = true;
        lspStore.error_msg = 'lsp unreachable';
        // the LDK Node get_order does not clear the error when it starts
        lspStore.lsps7GetOrderCustomMessage.mockImplementation(() => {
            lspStore.getExtensionOrderResponse = {
                result: { order_id: 'ext-y', order_state: 'COMPLETED' }
            };
        });

        await renderOrder('ext-y');
        expect(lspStore.error).toBe(false);
        expect(lspStore.error_msg).toBe('');

        await waitForRead();

        expect(screen.queryByTestId('warning')).toBeNull();
        expect(screen.getByTestId('order')).toHaveTextContent(
            'ext-y:COMPLETED'
        );
    });

    it("shows the stored order with a warning when this order's request fails", async () => {
        lspStore.lsps7GetOrderCustomMessage.mockImplementation(() => {
            lspStore.error = true;
            lspStore.error_msg = 'lsp unreachable';
        });

        await renderOrder('ext-y');
        await waitForRead();

        expect(screen.getByTestId('warning')).toHaveTextContent(
            'lsp unreachable: views.LSPS1.showingPreviousState'
        );
        expect(screen.getByTestId('order')).toHaveTextContent('ext-y:CREATED');
    });
});
