import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { observable, runInAction } from 'mobx';

jest.mock(
    'react-dom',
    () => ({
        unstable_batchedUpdates: (fn: any) => fn(),
        findDOMNode: () => null
    }),
    { virtual: true }
);

const caps: Record<string, boolean> = {
    supportsOnchainSends: true,
    supportsKeysend: true,
    supportsCircularRebalancing: false
};
jest.mock('../../utils/BackendUtils', () => {
    const names = [
        'isLNDBased',
        'supportsOnchainSends',
        'supportsCashuWallet',
        'supportsLSPS1native',
        'supportsLSPScustomMessage',
        'supportsLSPS1rest',
        'supportsLSPS7native',
        'supportsAMP',
        'supportsLightningAddress',
        'supportsKeysend',
        'supportsCircularRebalancing'
    ];
    const m: any = { watchActivityUpdates: jest.fn() };
    names.forEach((n) => (m[n] = jest.fn(() => !!caps[n])));
    return m;
});
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
jest.mock('../../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(undefined)
    }
}));

import ActivityStore, { DEFAULT_FILTERS } from '../../stores/ActivityStore';
import Activity from './Activity';

// Activity.test.tsx mocks mobx-react for the whole file, so the observer
// dependencies of the filter icon are pinned here with the real observer
// and a real ActivityStore.
const setup = async () => {
    const settingsStore: any = observable({
        implementation: 'ldk-node',
        settings: {
            locale: 'en',
            fiat: 'USD',
            lightningAddress: { enabled: false },
            ecash: { enableCashu: false }
        }
    });
    const nodeInfoStore: any = observable({ testnet: false });
    const store: any = new ActivityStore(
        settingsStore,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        nodeInfoStore
    );
    store.getFilters = jest.fn(async () => store.filters);
    store.getActivityAndFilter = jest.fn(async () => undefined);
    // inject() needs every store it names, InvoicesStore included
    const props: any = {
        navigation: {
            addListener: jest.fn(() => jest.fn()),
            navigate: jest.fn()
        },
        route: { params: {} },
        ActivityStore: store,
        SettingsStore: settingsStore,
        InvoicesStore: {},
        PosStore: { recordPayment: jest.fn() },
        FiatStore: {},
        SwapStore: {}
    };
    await render(<Activity {...props} />);
    await waitFor(() => expect(screen.queryByText(/^filter:/)).not.toBeNull());
    return { store, nodeInfoStore, settingsStore };
};

describe('Activity filter icon with the real observer', () => {
    it('re-renders when only store.filters changes', async () => {
        const { store } = await setup();
        expect(screen.getByText('filter:text')).toBeTruthy();

        await act(async () =>
            runInAction(() => {
                store.filters = { ...DEFAULT_FILTERS, keysend: false };
            })
        );
        expect(screen.getByText('filter:highlight')).toBeTruthy();

        await act(async () =>
            runInAction(() => {
                store.filters = {
                    ...DEFAULT_FILTERS,
                    circularRebalance: false
                };
            })
        );
        expect(screen.getByText('filter:text')).toBeTruthy();
    });

    it('re-renders when the node turns out to be on testnet', async () => {
        const { store, nodeInfoStore } = await setup();
        await act(async () =>
            runInAction(() => {
                store.filters = { ...DEFAULT_FILTERS, swaps: false };
            })
        );
        expect(screen.getByText('filter:highlight')).toBeTruthy();

        await act(async () =>
            runInAction(() => {
                nodeInfoStore.testnet = true;
            })
        );
        expect(screen.getByText('filter:text')).toBeTruthy();
    });
});
