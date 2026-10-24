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
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable role="button" onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/CollapsedQR', () => {
    const { Text } = require('react-native');
    return ({ value }: any) => <Text testID="order-qr">{value}</Text>;
});
jest.mock('../../components/LoadingIndicator', () => () => null);
jest.mock('../../components/SuccessAnimation', () => () => null);
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>,
        WarningMessage: ({ message }: any) => <Text>{message}</Text>
    };
});
jest.mock('../../stores/LSPStore', () => ({ LSPS_ORDERS_KEY: 'orders' }));
jest.mock('../../stores/ChannelsStore', () => ({
    ChannelsType: { Pending: 'pending' }
}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null))
}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsLSPS1rest: () => true,
    supportsLSPScustomMessage: () => true,
    supportsLSPS7native: () => false
}));
jest.mock('../../utils/handleAnything', () => jest.fn());
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));
jest.mock('../../utils/LocaleUtils');

import Storage from '../../storage';
import { buildPaymentAwaitParams, LSPService } from '../../models/LSP';
import LSPPaymentAwait from './LSPPaymentAwait';

// 100 000 sat and amountless invoices from utils/LspUtils.test.ts
const INVOICE_100K =
    'lnbc1m1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqpj9qypqsq2vynt4pr072a6kxqxke74s3lhg83939xvm2u8wmsnqg34j7l6y5q92yy9ey8vyve6jupggy22y3dz00uy70q3dryra2dmwg0693lp9gpj93x0l';
const INVOICE_AMOUNTLESS =
    'lnbc1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqpj9qypqsqsvrmr2u4zak97jvzueml36t58qrsu36q4y6csslzt58sqndtghmhmwa9njvkynxas8ssqj9svk2wcmhewkexdyhtrdmrt0up9tmflfgqxjmhxa';

const MISMATCH = 'views.LSPS1.invoiceAmountMismatch';
const PAY_FROM_ZEUS = 'views.LSPS1.payFromZeus';

const navigation = { navigate: jest.fn(), popTo: jest.fn() } as any;

const ENDPOINT = 'https://lsp.example.com/api/v1';
const PEER = '02abc@lsp.example.com:9735';

// order history entry the screen reads its poll endpoint and peer from
const storedOrders = JSON.stringify([
    JSON.stringify({
        order: { result: { order_id: 'order-1' } },
        endpoint: ENDPOINT,
        peer: PEER
    })
]);

let lspStore: any;

// the first poll runs before the stored endpoint/peer reach state, so the
// first request goes out on the next poll, 5 seconds later
const advancePastFirstPoll = () =>
    act(async () => {
        jest.advanceTimersByTime(5000);
    });

const viewFor = (payment: any, service = LSPService.LSPS1) => (
    <LSPPaymentAwait
        navigation={navigation}
        route={
            {
                params: buildPaymentAwaitParams(payment, 'order-1', service)
            } as any
        }
        LSPStore={lspStore}
        ChannelsStore={{} as any}
        NodeInfoStore={{} as any}
    />
);

const renderView = (payment: any, service = LSPService.LSPS1) =>
    render(viewFor(payment, service));

describe('LSPPaymentAwait invoice check', () => {
    beforeEach(() => {
        (Storage.getItem as jest.Mock)
            .mockClear()
            .mockResolvedValue(storedOrders);
        lspStore = {
            lsps1GetOrderREST: jest.fn(() => Promise.resolve()),
            lsps7GetOrderCustomMessage: jest.fn(() => Promise.resolve())
        };
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('shows the QR and polls the LSPS1 order when the invoice matches the order total', async () => {
        jest.useFakeTimers();
        await renderView({
            bolt11: { invoice: INVOICE_100K, order_total_sat: '100000' }
        });

        expect(screen.getByTestId('order-qr')).toHaveTextContent(
            `lightning:${INVOICE_100K}`
        );
        expect(screen.getByText(PAY_FROM_ZEUS)).toBeTruthy();
        expect(screen.queryByText(MISMATCH)).toBeNull();
        await advancePastFirstPoll();
        expect(lspStore.lsps1GetOrderREST).toHaveBeenCalledWith(
            'order-1',
            ENDPOINT
        );
    });

    it('polls the LSPS7 order when the invoice matches the order total', async () => {
        jest.useFakeTimers();
        await renderView(
            { bolt11: { invoice: INVOICE_100K, order_total_sat: '100000' } },
            LSPService.LSPS7
        );

        expect(screen.getByTestId('order-qr')).toBeTruthy();
        await advancePastFirstPoll();
        expect(lspStore.lsps7GetOrderCustomMessage).toHaveBeenCalledWith(
            'order-1',
            PEER
        );
    });

    it('never polls a rejected order, including after the poll interval', async () => {
        jest.useFakeTimers();
        await renderView({
            bolt11: { invoice: INVOICE_100K, order_total_sat: '1000' }
        });

        await advancePastFirstPoll();
        await advancePastFirstPoll();

        expect(screen.getByText(MISMATCH)).toBeTruthy();
        expect(lspStore.lsps1GetOrderREST).not.toHaveBeenCalled();
        expect(lspStore.lsps7GetOrderCustomMessage).not.toHaveBeenCalled();
    });

    it.each([
        [
            'LSPS1 bolt11',
            { bolt11: { invoice: INVOICE_100K, order_total_sat: '1000' } },
            LSPService.LSPS1
        ],
        [
            'LSPS1 legacy',
            { lightning_invoice: INVOICE_100K, order_total_sat: 1000 },
            LSPService.LSPS1
        ],
        [
            'LSPS7 bolt11',
            { bolt11: { invoice: INVOICE_100K, order_total_sat: '1000' } },
            LSPService.LSPS7
        ],
        [
            'fee total fallback',
            { bolt11_invoice: INVOICE_100K, fee_total_sat: '1000' },
            LSPService.LSPS1
        ]
    ])(
        'hides the QR and the pay button when a %s invoice exceeds the order total',
        async (_label, payment, service) => {
            await renderView(payment, service);

            expect(screen.getByText(MISMATCH)).toBeTruthy();
            expect(screen.queryByTestId('order-qr')).toBeNull();
            expect(screen.queryByText(PAY_FROM_ZEUS)).toBeNull();
            expect(Storage.getItem).not.toHaveBeenCalled();
            expect(lspStore.lsps1GetOrderREST).not.toHaveBeenCalled();
            expect(lspStore.lsps7GetOrderCustomMessage).not.toHaveBeenCalled();
        }
    );

    it('rechecks the invoice when the route params change after mount', async () => {
        const { rerender } = await renderView({
            bolt11: { invoice: INVOICE_100K, order_total_sat: '100000' }
        });
        expect(screen.getByTestId('order-qr')).toBeTruthy();

        await rerender(
            viewFor({
                bolt11: { invoice: INVOICE_100K, order_total_sat: '1000' }
            })
        );

        expect(screen.getByText(MISMATCH)).toBeTruthy();
        expect(screen.queryByTestId('order-qr')).toBeNull();
        expect(screen.queryByText(PAY_FROM_ZEUS)).toBeNull();
    });

    it('rejects an amountless invoice', async () => {
        await renderView({
            bolt11: { invoice: INVOICE_AMOUNTLESS, order_total_sat: '100000' }
        });

        expect(screen.getByText(MISMATCH)).toBeTruthy();
        expect(screen.queryByTestId('order-qr')).toBeNull();
    });

    it('rejects an order without a total', async () => {
        await renderView({ bolt11: { invoice: INVOICE_100K } });

        expect(screen.getByText(MISMATCH)).toBeTruthy();
        expect(screen.queryByTestId('order-qr')).toBeNull();
    });
});
