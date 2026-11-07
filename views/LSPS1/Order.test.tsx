import * as React from 'react';
import { act, render } from '@testing-library/react-native';

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
jest.mock('../../components/SuccessErrorMessage', () => ({
    WarningMessage: () => null
}));
jest.mock('./OrderResponse', () => () => null);
jest.mock('../LSPS7/OrderResponse', () => () => null);
jest.mock('../../stores/LSPStore', () => ({ LSPS_ORDERS_KEY: 'orders' }));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/InvoicesStore', () => ({}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../storage', () => ({
    getItem: jest.fn()
}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsLSPS1rest: () => true,
    supportsLSPScustomMessage: () => true
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));
jest.mock('../../utils/LocaleUtils');

import Storage from '../../storage';
import LSPS1Order from './Order';
import LSPS7Order from '../LSPS7/Order';

const INVOICE = 'lnbc1000n1examplesecretinvoice';
const ADDRESS = 'bc1qexampleorderaddress';
const PUBKEY =
    '02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const orderResult = (orderState: string) => ({
    order_id: 'order-1',
    order_state: orderState,
    public_key: PUBKEY,
    payment: {
        bolt11: { invoice: INVOICE, order_total_sat: '5000' },
        onchain: { address: ADDRESS, order_total_sat: '5000' }
    }
});

const storedOrders = JSON.stringify([
    JSON.stringify({
        order: { result: orderResult('CREATED') },
        endpoint: 'https://lsp.example.com/api/v1',
        peer: `${PUBKEY}@lsp.example.com:9735`
    })
]);

const loggedText = (spy: jest.SpyInstance) =>
    spy.mock.calls.map((args) => JSON.stringify(args)).join('\n');

describe('LSPS order views logging', () => {
    let logSpy: jest.SpyInstance;
    let lspStore: any;

    beforeEach(() => {
        jest.useFakeTimers();
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        (Storage.getItem as jest.Mock).mockResolvedValue(storedOrders);
        lspStore = {
            error: false,
            error_msg: '',
            getOrderResponse: { result: orderResult('CREATED') },
            getExtensionOrderResponse: { result: orderResult('CREATED') },
            lsps1GetOrderREST: jest.fn(),
            lsps7GetOrderCustomMessage: jest.fn(),
            updateOrderInStorage: jest.fn()
        };
    });

    afterEach(() => {
        logSpy.mockRestore();
        jest.useRealTimers();
    });

    it.each([
        ['LSPS1', LSPS1Order],
        ['LSPS7', LSPS7Order]
    ])(
        '%s does not log the order invoice, address or node pubkey',
        async (_label, View: any) => {
            await render(
                <View
                    navigation={{} as any}
                    route={
                        {
                            params: {
                                orderId: 'order-1',
                                orderShouldUpdate: false
                            }
                        } as any
                    }
                    LSPStore={lspStore}
                    SettingsStore={{} as any}
                    InvoicesStore={{} as any}
                    NodeInfoStore={{} as any}
                />
            );
            await act(async () => {
                jest.advanceTimersByTime(3000);
            });

            const logged = loggedText(logSpy);
            expect(logged).toContain('Order found in storage');
            expect(logged).toContain('Latest Order state fetched!');
            expect(logged).not.toContain(INVOICE);
            expect(logged).not.toContain(ADDRESS);
            expect(logged).not.toContain(PUBKEY);
        }
    );
});
