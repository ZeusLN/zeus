import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

// The stores arrive as props and the screen's children are stubbed, so the
// test only looks at the filter icon in the header.
jest.mock('../../utils/BackendUtils', () => ({
    watchActivityUpdates: jest.fn()
}));
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Button: () => null, Icon: () => null }));
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Header', () => {
    const { View } = require('react-native');
    return ({ rightComponent }: any) => <View>{rightComponent}</View>;
});
jest.mock('../../components/LoadingIndicator', () => () => null);
jest.mock('./ActivityListItem', () => () => null);
jest.mock('./ActivityToCsv', () => () => null);
// prints the colour the icon is given
jest.mock('../../assets/images/SVG/Filter On.svg', () => {
    const { Text } = require('react-native');
    return ({ fill }: any) => <Text>{`filter:${fill}`}</Text>;
});
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => key)
}));
// ActivityStore is only needed for DEFAULT_FILTERS; its store imports pull in
// native modules
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/PaymentsStore', () => ({}));
jest.mock('../../stores/InvoicesStore', () => ({}));
jest.mock('../../stores/TransactionsStore', () => ({}));
jest.mock('../../stores/CashuStore', () => ({}));
jest.mock('../../stores/SwapStore', () => ({}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../stores/FiatStore', () => ({}));
jest.mock('../../stores/PosStore', () => ({}));
jest.mock('../../stores/LSPStore', () => ({ LSPS_ORDERS_KEY: 'lsps' }));
jest.mock('../../stores/Stores', () => ({}));
jest.mock('../../storage', () => ({}));

import { DEFAULT_FILTERS } from '../../stores/ActivityStore';
import Activity from './Activity';

const renderActivity = async ({
    filters,
    effectiveFilters
}: {
    filters: any;
    effectiveFilters: any;
}) => {
    const ActivityStore = {
        filters,
        filteredActivity: [],
        getFilters: jest.fn().mockResolvedValue(filters),
        getEffectiveFilters: jest.fn(() => effectiveFilters),
        getActivityAndFilter: jest.fn().mockResolvedValue(undefined)
    };
    await render(
        <Activity
            navigation={
                {
                    addListener: jest.fn(() => jest.fn()),
                    navigate: jest.fn()
                } as any
            }
            ActivityStore={ActivityStore as any}
            FiatStore={{} as any}
            PosStore={{ recordPayment: jest.fn() } as any}
            SettingsStore={
                {
                    implementation: 'ldk-node',
                    settings: { locale: 'en', fiat: 'USD' }
                } as any
            }
            SwapStore={{} as any}
            route={{ params: {} } as any}
        />
    );
    // the header shows the icon once the first load is done
    await waitFor(() => expect(screen.queryByText(/^filter:/)).not.toBeNull());
};

describe('Activity filter icon', () => {
    it('is not highlighted when only hidden toggles differ from the defaults', async () => {
        // saved under LND, then opened on a node without circular rebalancing:
        // the saved filters differ, the filters that are applied do not
        await renderActivity({
            filters: { ...DEFAULT_FILTERS, circularRebalance: false },
            effectiveFilters: { ...DEFAULT_FILTERS }
        });

        expect(screen.getByText('filter:text')).toBeTruthy();
    });

    it('is highlighted when a toggle the node shows is off', async () => {
        await renderActivity({
            filters: { ...DEFAULT_FILTERS, keysend: false },
            effectiveFilters: { ...DEFAULT_FILTERS, keysend: false }
        });

        expect(screen.getByText('filter:highlight')).toBeTruthy();
    });
});
