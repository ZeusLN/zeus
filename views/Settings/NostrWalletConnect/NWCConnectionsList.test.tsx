import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../../components/Header', () => () => null);
jest.mock('../../../components/Button', () => () => null);
jest.mock('../../../components/LoadingIndicator', () => () => null);
jest.mock('../../../components/SuccessErrorMessage', () => ({
    ErrorMessage: () => null
}));
jest.mock('../../../components/Amount', () => {
    const { Text: RNText } = require('react-native');
    return ({ sats }: any) => <RNText>{`amount:${sats}`}</RNText>;
});
jest.mock('../../../components/Channels/Tag', () => {
    const { Text: RNText } = require('react-native');
    return { Tag: ({ status }: any) => <RNText>{`tag:${status}`}</RNText> };
});
jest.mock('@rneui/themed', () => ({
    Divider: () => null,
    SearchBar: () => null,
    ButtonGroup: () => null
}));
jest.mock('../../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000'),
    placeholderColor: jest.fn(() => '#000')
}));
jest.mock('../../../utils/LocaleUtils');
jest.mock('../../../utils/DateTimeUtils', () => ({
    listFormattedDateShort: jest.fn(() => 'date')
}));
jest.mock('../../../utils/UrlUtils', () => ({ goToUrl: jest.fn() }));
jest.mock('../../../models/NWCConnection', () => ({
    __esModule: true,
    default: class {},
    ConnectionWarningType: { BudgetLimitReached: 'budget_limit_reached' }
}));
jest.mock('../../../models/Status', () => ({
    Status: {
        Active: 'Active',
        ReadOnly: 'ReadOnly',
        InvoiceOnly: 'InvoiceOnly',
        LimitExceed: 'LimitExceed'
    },
    ExpirationStatus: { Expired: 'Expired', LSPDiscretion: 'Warning' }
}));
jest.mock('../../../assets/images/SVG/Add.svg', () => () => null);
jest.mock('../../../assets/images/SVG/Gear.svg', () => () => null);
jest.mock('../../../assets/images/SVG/nwc-logo.svg', () => () => null);

import NWCConnectionsList from './NWCConnectionsList';

const RECENTLY_RECEIVED = 'views.Settings.NostrWalletConnect.recentlyReceived:';

const buildConnection = (overrides: Record<string, unknown> = {}) => ({
    id: 'conn-1',
    name: 'Tip jar',
    permissions: ['make_invoice', 'lookup_invoice'],
    maxAmountSats: undefined,
    isExpired: false,
    isActive: true,
    hasWarnings: false,
    lastUsed: undefined,
    lastReceivedActivitySats: 0,
    hasPaymentPermissions: () => false,
    hasPermission: (permission: string) => permission === 'make_invoice',
    isInvoiceOnly: () => true,
    ...overrides
});

const renderList = async (connection: any, refresh: () => Promise<void>) => {
    const NostrWalletConnectStore = {
        connections: [connection],
        loadMaxBudget: jest.fn(() => Promise.resolve()),
        loadConnections: jest.fn(() => Promise.resolve()),
        refreshPendingMakeInvoices: jest.fn(refresh)
    };
    await render(
        <NWCConnectionsList
            navigation={
                {
                    addListener: jest.fn(),
                    removeListener: jest.fn(),
                    navigate: jest.fn()
                } as any
            }
            SettingsStore={{ connecting: false } as any}
            NostrWalletConnectStore={NostrWalletConnectStore as any}
        />
    );
    return NostrWalletConnectStore;
};

describe('NWCConnectionsList', () => {
    it('re-renders a row when a refresh promotes an invoice in place', async () => {
        const connection = buildConnection();
        let finishRefresh: () => void = () => undefined;
        const refreshGate = new Promise<void>((resolve) => {
            finishRefresh = resolve;
        });
        const NostrWalletConnectStore = await renderList(
            connection,
            () => refreshGate
        );

        // list is on screen with the pre-refresh value while lookups run
        expect(
            NostrWalletConnectStore.refreshPendingMakeInvoices
        ).toHaveBeenCalledWith({ force: false });
        expect(screen.getByText('tag:InvoiceOnly')).toBeOnTheScreen();
        expect(screen.queryByText(RECENTLY_RECEIVED)).not.toBeOnTheScreen();

        await act(async () => {
            // same object, mutated in place, as the store does
            connection.lastReceivedActivitySats = 1000;
            finishRefresh();
            await refreshGate;
        });

        expect(screen.getByText(RECENTLY_RECEIVED)).toBeOnTheScreen();
        expect(screen.getByText('amount:1000')).toBeOnTheScreen();
    });

    it('shows the Invoice Only tag and hides the amount before anything is received', async () => {
        await renderList(buildConnection(), async () => undefined);

        expect(screen.getByText('tag:InvoiceOnly')).toBeOnTheScreen();
        expect(screen.queryByText(RECENTLY_RECEIVED)).not.toBeOnTheScreen();
    });

    it('does not tag a Custom connection that can create invoices as Read Only', async () => {
        await renderList(
            buildConnection({ isInvoiceOnly: () => false }),
            async () => undefined
        );

        expect(screen.queryByText('tag:ReadOnly')).not.toBeOnTheScreen();
        expect(screen.queryByText('tag:InvoiceOnly')).not.toBeOnTheScreen();
    });

    it('tags a connection without make_invoice as Read Only', async () => {
        await renderList(
            buildConnection({
                isInvoiceOnly: () => false,
                hasPermission: () => false
            }),
            async () => undefined
        );

        expect(screen.getByText('tag:ReadOnly')).toBeOnTheScreen();
    });
});
