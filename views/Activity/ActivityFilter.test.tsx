import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ListItem's PadView adds a spacer after every child but the last, using
// React.Children.count, which also counts false. Record that count.
jest.mock('@rneui/themed', () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    const ListItem: any = ({ children, containerStyle }: any) => (
        <View
            testID="list-item"
            style={containerStyle}
            childCount={React.Children.count(children)}
        >
            {children}
        </View>
    );
    ListItem.Content = ({ children }: any) => <View>{children}</View>;
    ListItem.Title = ({ children }: any) => <Text>{children}</Text>;
    return { Button: () => null, Icon: () => null, ListItem };
});
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
jest.mock('../../components/Accordion', () => ({
    __esModule: true,
    default: () => null,
    AnimatedRotateWrapper: () => null
}));
jest.mock('../../components/Switch', () => () => null);
jest.mock('../../components/TextInput', () => () => null);
jest.mock('../../assets/images/SVG/Caret Down.svg', () => () => null);
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));
jest.mock('../../utils/BackendUtils', () => ({
    isLNDBased: () => true,
    supportsCashuWallet: () => true,
    supportsKeysend: () => true,
    supportsOnchainReceiving: () => true,
    supportsOnchainSends: () => true
}));
// ActivityStore is only needed for DEFAULT_FILTERS and SERVICES_CONFIG; its
// store imports pull in native modules
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/PaymentsStore', () => ({}));
jest.mock('../../stores/InvoicesStore', () => ({}));
jest.mock('../../stores/TransactionsStore', () => ({}));
jest.mock('../../stores/CashuStore', () => ({}));
jest.mock('../../stores/SwapStore', () => ({}));
jest.mock('../../stores/NodeInfoStore', () => ({}));
jest.mock('../../stores/LSPStore', () => ({ LSPS_ORDERS_KEY: 'lsps' }));
jest.mock('../../stores/Stores', () => ({}));
jest.mock('../../storage', () => ({}));

import { DEFAULT_FILTERS } from '../../stores/ActivityStore';
import ActivityFilter from './ActivityFilter';

const renderFilter = async () => {
    const ActivityStore = {
        filters: {
            ...DEFAULT_FILTERS,
            startDate: new Date(2026, 9, 2),
            endDate: new Date(2026, 9, 4)
        },
        getFilters: jest.fn(),
        resetFilters: jest.fn(),
        setFilters: jest.fn(),
        setAmountFilter: jest.fn(),
        setMaximumAmountFilter: jest.fn(),
        setStartDateFilter: jest.fn(),
        setEndDateFilter: jest.fn(),
        clearStartDateFilter: jest.fn(),
        clearEndDateFilter: jest.fn(),
        setMemoFilter: jest.fn()
    };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
        tree = renderer.create(
            <ActivityFilter
                navigation={{ goBack: jest.fn() } as any}
                ActivityStore={ActivityStore as any}
                SettingsStore={
                    {
                        settings: {
                            locale: 'en',
                            lightningAddress: { enabled: false }
                        }
                    } as any
                }
                SwapStore={{ formatStatus: (s: string) => s } as any}
            />
        );
    });
    return tree!;
};

const rowWithLabel = (tree: renderer.ReactTestRenderer, label: string) =>
    tree.root.find(
        (n) =>
            n.type === View &&
            n.props.testID === 'list-item' &&
            n
                .findAllByType(Text)
                .some(
                    (t: renderer.ReactTestInstance) =>
                        t.props.children === label
                )
    );

describe('ActivityFilter', () => {
    it.each([
        'views.ActivityFilter.startDate',
        'views.ActivityFilter.endDate',
        'views.ActivityFilter.memo',
        'views.ActivityFilter.minimumAmount',
        'general.sent'
    ])('renders the %s row as a label and one control group', async (label) => {
        const tree = await renderFilter();
        const row = rowWithLabel(tree, label);
        // With two children, PadView adds no trailing spacer, so every row
        // gets its right inset from paddingRight. #4878: the End Date
        // control was the last of six children and lost the inset.
        expect(row.props.childCount).toBe(2);
        expect(StyleSheet.flatten(row.props.style).paddingRight).toBe(16);
    });
});
