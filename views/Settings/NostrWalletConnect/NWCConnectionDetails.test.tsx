import React from 'react';
import { render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
// The header actions arrive as its right component
jest.mock('../../../components/Header', () => {
    const { View } = require('react-native');
    return ({ rightComponent }: any) => <View>{rightComponent}</View>;
});
jest.mock('../../../components/Button', () => () => null);
jest.mock('../../../components/LoadingIndicator', () => () => null);
jest.mock('../../../components/SuccessErrorMessage', () => ({
    ErrorMessage: () => null
}));
jest.mock('../../../components/KeyValue', () => {
    const { View, Text: RNText } = require('react-native');
    return ({ keyValue, value }: any) => (
        <View>
            <RNText>{keyValue}</RNText>
            {typeof value === 'string' ? <RNText>{value}</RNText> : value}
        </View>
    );
});
jest.mock('../../../components/Amount', () => {
    const { Text: RNText } = require('react-native');
    return ({ sats }: any) => <RNText>{`amount:${sats}`}</RNText>;
});
jest.mock('../../../components/text/Body', () => ({ Body: () => null }));
jest.mock('../../../stores/ModalStore', () => ({}));
jest.mock('../../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));
jest.mock('../../../utils/LocaleUtils');
jest.mock('../../../utils/DateTimeUtils', () => ({
    listFormattedDateShort: jest.fn(() => 'date'),
    formatDate: jest.fn(() => 'date')
}));
jest.mock('../../../utils/ActionUtils', () => ({ confirmAction: jest.fn() }));
jest.mock('../../../utils/NavigationUtils', () => ({
    reAuthNavigation: jest.fn()
}));
jest.mock('../../../utils/NostrConnectUtils', () => ({
    __esModule: true,
    default: {
        getAvailablePermissions: jest.fn(() => []),
        getPermissionShortDescription: jest.fn(() => '')
    }
}));
jest.mock('../../../models/NWCConnection', () => ({
    __esModule: true,
    default: class {}
}));
jest.mock('../../../assets/images/SVG/Edit.svg', () => {
    const { Text: RNText } = require('react-native');
    return () => <RNText>edit-icon</RNText>;
});
jest.mock('../../../assets/images/SVG/Checkmark.svg', () => () => null);
jest.mock('../../../assets/images/SVG/Clock.svg', () => {
    const { Text: RNText } = require('react-native');
    return () => <RNText>activity-icon</RNText>;
});

import NWCConnectionDetails from './NWCConnectionDetails';

const TOTAL_RECEIVED = 'views.Settings.NostrWalletConnect.totalReceived';
const ACTIVITY_BUTTON = 'activity-icon';

const buildConnection = (
    permissions: string[],
    overrides: Record<string, unknown> = {}
) => ({
    id: 'conn-1',
    name: 'Tip jar',
    pubkey: 'pubkey',
    relayUrl: 'wss://relay.example',
    description: undefined,
    createdAt: new Date(1_700_000_000_000),
    lastUsed: undefined,
    expiresAt: undefined,
    isExpired: false,
    hasWarnings: false,
    permissions,
    maxAmountSats: undefined,
    budgetRenewal: 'never',
    totalSpendSats: 0,
    totalReceivedActivitySats: 2100,
    remainingBudget: 0,
    hasPaymentPermissions: () =>
        ['pay_invoice', 'multi_pay_invoice'].some((p) =>
            permissions.includes(p)
        ),
    hasPermission: (permission: string) => permissions.includes(permission),
    ...overrides
});

const renderDetails = async (connection: any) => {
    const NostrWalletConnectStore = {
        loading: false,
        waitingForInFlightHandlers: false,
        getConnection: jest.fn(() => ({ connection })),
        getActivities: jest.fn(() => Promise.resolve())
    };
    await render(
        <NWCConnectionDetails
            navigation={
                {
                    // the initial focus event loads the connection
                    addListener: jest.fn(
                        (event: string, callback: () => void) => {
                            if (event === 'focus') callback();
                            return jest.fn();
                        }
                    ),
                    navigate: jest.fn()
                } as any
            }
            route={{ params: { connectionId: connection.id } } as any}
            NostrWalletConnectStore={NostrWalletConnectStore as any}
            ModalStore={{} as any}
        />
    );
    // the connection is read from the store after the focus event
    await screen.findByText('general.status');
};

describe('NWCConnectionDetails', () => {
    it('shows Total Received and the activity button for an invoice-only connection without a budget', async () => {
        await renderDetails(buildConnection(['make_invoice']));

        expect(screen.getAllByText(TOTAL_RECEIVED)).toHaveLength(1);
        expect(screen.getByText('amount:2100')).toBeTruthy();
        expect(screen.getByText(ACTIVITY_BUTTON)).toBeTruthy();
    });

    it('shows neither Total Received nor the activity button for a read-only connection', async () => {
        await renderDetails(buildConnection(['get_info', 'get_balance']));

        expect(screen.queryByText(TOTAL_RECEIVED)).toBeNull();
        expect(screen.queryByText(ACTIVITY_BUTTON)).toBeNull();
    });

    it('shows exactly one Total Received row for a budgeted connection that can make invoices', async () => {
        await renderDetails(
            buildConnection(['pay_invoice', 'make_invoice'], {
                maxAmountSats: 10_000,
                totalSpendSats: 500,
                remainingBudget: 9_500
            })
        );

        expect(screen.getAllByText(TOTAL_RECEIVED)).toHaveLength(1);
        expect(screen.getByText(ACTIVITY_BUTTON)).toBeTruthy();
    });

    it('keeps the activity button for a connection that can pay but not make invoices', async () => {
        await renderDetails(buildConnection(['pay_invoice']));

        expect(screen.getByText(ACTIVITY_BUTTON)).toBeTruthy();
        expect(screen.queryByText(TOTAL_RECEIVED)).toBeNull();
    });
});
