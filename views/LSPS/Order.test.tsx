import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { observable, runInAction } from 'mobx';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock(
    '../../components/Screen',
    () =>
        ({ children }: any) =>
            children
);
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/LoadingIndicator', () => () => null);
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        WarningMessage: ({ message }: any) => <Text>{message}</Text>
    };
});
jest.mock('../LSPS1/OrderResponse', () => {
    const { Text } = require('react-native');
    return ({ orderResponse }: any) => <Text>{orderResponse.order_state}</Text>;
});
jest.mock('../LSPS7/OrderResponse', () => {
    const { Text } = require('react-native');
    return ({ orderResponse }: any) => <Text>{orderResponse.order_state}</Text>;
});
jest.mock('../../stores/LSPStore', () => ({ LSPS_ORDERS_KEY: 'orders' }));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/InvoicesStore', () => ({}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../storage', () => ({ getItem: jest.fn() }));
jest.mock('../../utils/BackendUtils', () => ({
    supportsLSPS1rest: jest.fn(),
    supportsLSPScustomMessage: () => true
}));
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#fff' }));
jest.mock('../../utils/LocaleUtils');

import Storage from '../../storage';
import BackendUtils from '../../utils/BackendUtils';
import LSPS1Order from '../LSPS1/Order';
import LSPS7Order from '../LSPS7/Order';

const WARNING = 'timed out: views.LSPS1.showingPreviousState';

const orderIn = (order_state: string, order_id = 'order-1') => ({
    result: { order_id, order_state }
});

describe.each([
    {
        name: 'LSPS1 native',
        View: LSPS1Order as any,
        slot: 'getOrderResponse',
        loading: 'loadingLSPS1',
        request: 'lsps1GetOrderNative',
        rest: false,
        native: true
    },
    {
        name: 'LSPS1 REST',
        View: LSPS1Order as any,
        slot: 'getOrderResponse',
        loading: 'loadingLSPS1',
        request: 'lsps1GetOrderREST',
        rest: true,
        native: false
    },
    {
        name: 'LSPS1 custom message',
        View: LSPS1Order as any,
        slot: 'getOrderResponse',
        loading: 'loadingLSPS1',
        request: 'lsps1GetOrderCustomMessage',
        rest: false,
        native: false
    },
    {
        name: 'LSPS7',
        View: LSPS7Order as any,
        slot: 'getExtensionOrderResponse',
        loading: 'loadingLSPS7',
        request: 'lsps7GetOrderCustomMessage',
        rest: false,
        native: false
    }
])('$name order screen', ({ View, slot, loading, request, rest, native }) => {
    let store: any;
    let settle: () => void;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        (BackendUtils.supportsLSPS1rest as jest.Mock).mockReturnValue(rest);
        (Storage.getItem as jest.Mock).mockResolvedValue(
            JSON.stringify([
                JSON.stringify({ order: orderIn('CREATED'), native })
            ])
        );
        store = observable({
            [slot]: {},
            [loading]: true,
            error: false,
            error_msg: ''
        });
        store.updateOrderInStorage = jest.fn();
        store[request] = jest.fn(
            () => new Promise<void>((resolve) => (settle = resolve))
        );
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    const renderView = (orderShouldUpdate = false) =>
        render(
            <View
                navigation={{}}
                route={{ params: { orderId: 'order-1', orderShouldUpdate } }}
                LSPStore={store}
            />
        );

    const wait = (ms: number) =>
        act(async () => {
            await jest.advanceTimersByTimeAsync(ms);
        });

    const reply = (order: any) =>
        act(async () => {
            runInAction(() => (store[slot] = order));
            settle();
        });

    const fail = () =>
        act(async () => {
            runInAction(() => {
                store.error = true;
                store.error_msg = 'timed out';
            });
            settle();
        });

    it.each(['COMPLETED', 'FAILED'])(
        'shows and stores a %s reply after 6 s',
        async (state) => {
            await renderView();
            await wait(6000);
            expect(screen.getByText('CREATED')).toBeTruthy();

            await reply(orderIn(state));

            expect(screen.getByText(state)).toBeTruthy();
            expect(store.updateOrderInStorage).toHaveBeenCalledTimes(1);
            expect(store.updateOrderInStorage).toHaveBeenCalledWith(
                orderIn(state)
            );
        }
    );

    it('does not store the reply when orderShouldUpdate is set', async () => {
        await renderView(true);
        await reply(orderIn('COMPLETED'));

        expect(screen.getByText('COMPLETED')).toBeTruthy();
        expect(store.updateOrderInStorage).not.toHaveBeenCalled();
    });

    it('ignores a reply for another order', async () => {
        await renderView();
        await reply(orderIn('COMPLETED', 'order-2'));

        expect(screen.getByText('CREATED')).toBeTruthy();
        expect(store.updateOrderInStorage).not.toHaveBeenCalled();
    });

    it('keeps the stored order on error until a late reply', async () => {
        await renderView();
        await wait(7000);
        await fail();
        expect(screen.getByText('CREATED')).toBeTruthy();
        expect(screen.getByText(WARNING)).toBeTruthy();

        await reply(orderIn('COMPLETED'));

        expect(screen.getByText('COMPLETED')).toBeTruthy();
        expect(screen.queryByText(WARNING)).toBeNull();
    });

    it('shows no warning over a reply when an older error is left', async () => {
        store.error = true;
        store.error_msg = 'timed out';
        await renderView();
        await reply(orderIn('COMPLETED'));

        expect(screen.getByText('COMPLETED')).toBeTruthy();
        expect(screen.queryByText(WARNING)).toBeNull();
    });

    it.each([
        ['reply', () => reply(orderIn('COMPLETED'))],
        ['error', () => fail()]
    ])('does nothing on a %s after unmount', async (_name, answer) => {
        const setState = jest.spyOn(View.prototype, 'setState');
        const view = await renderView();
        await view.unmount();
        setState.mockClear();

        await answer();
        await wait(10000);

        expect(setState).not.toHaveBeenCalled();
        expect(store[loading]).toBe(true);
        expect(store.updateOrderInStorage).not.toHaveBeenCalled();
    });

    it('sends no request when unmounted before storage is read', async () => {
        let loadStorage: (value: string) => void = () => {};
        const stored = await Storage.getItem('orders');
        (Storage.getItem as jest.Mock).mockReturnValue(
            new Promise((resolve) => (loadStorage = resolve))
        );
        const view = await renderView();
        await view.unmount();
        await act(async () => loadStorage(stored as string));

        expect(store[request]).not.toHaveBeenCalled();
    });
});
