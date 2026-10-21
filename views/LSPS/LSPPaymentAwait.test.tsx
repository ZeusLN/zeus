import * as React from 'react';
import { render, screen } from '@testing-library/react-native';

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
    supportsLSPS1rest: () => false,
    supportsLSPScustomMessage: () => false,
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

const renderView = (payment: any, service = LSPService.LSPS1) =>
    render(
        <LSPPaymentAwait
            navigation={{ navigate: jest.fn(), popTo: jest.fn() } as any}
            route={
                {
                    params: buildPaymentAwaitParams(payment, 'order-1', service)
                } as any
            }
            LSPStore={{} as any}
            ChannelsStore={{} as any}
            NodeInfoStore={{} as any}
        />
    );

describe('LSPPaymentAwait invoice check', () => {
    beforeEach(() => {
        (Storage.getItem as jest.Mock).mockClear();
    });

    it('shows the QR and starts polling when the invoice matches the order total', async () => {
        await renderView({
            bolt11: { invoice: INVOICE_100K, order_total_sat: '100000' }
        });

        expect(screen.getByTestId('order-qr')).toHaveTextContent(
            `lightning:${INVOICE_100K}`
        );
        expect(screen.getByText(PAY_FROM_ZEUS)).toBeTruthy();
        expect(screen.queryByText(MISMATCH)).toBeNull();
        expect(Storage.getItem).toHaveBeenCalled();
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
        }
    );

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
