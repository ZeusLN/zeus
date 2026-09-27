import * as React from 'react';

import { Animated, Text } from 'react-native';
import { SearchBar } from '@rneui/themed';

import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Layout from '../../views/POS/Layout';

import OrderList from '../POS/OrderList';

import ActivityStore from '../../stores/ActivityStore';
import FiatStore from '../../stores/FiatStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import PosStore from '../../stores/PosStore';
import UnitsStore from '../../stores/UnitsStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { placeholderColor, themeColor } from '../../utils/ThemeUtils';

// Clover POS pane — part 1 (orders list only).
// Scope: component + order list from PosStore via getOrders +
// search-filter + empty-state message (R13) + hidden/out-of-stock
// SHOW (R11: show, do not hide) + Wallet render-gate (separate hunk).
// Explicitly OUT of scope for part 1: payment/mark-paid (part 2),
// product catalog + categories SectionList (R14 tail), tax/tips UI.
// Mirrors views/Wallet/SquarePosPane.tsx (Layout + SearchBar +
// OrderList, open/paid tabs via filteredOpenOrders/filteredPaidOrders)
// so future Clover read-path (zeus_fix_v4 getCloverOrders) reuses the
// same store contract without a second list implementation.
interface CloverPosPaneProps {
    navigation: NativeStackNavigationProp<any, any>;
    ActivityStore?: ActivityStore;
    FiatStore?: FiatStore;
    NodeInfoStore?: NodeInfoStore;
    PosStore?: PosStore;
    UnitsStore?: UnitsStore;
    SettingsStore?: SettingsStore;
}

interface CloverPosPaneState {
    selectedIndex: number;
    search: string;
    fadeAnimation: any;
}

@inject(
    'ActivityStore',
    'FiatStore',
    'NodeInfoStore',
    'PosStore',
    'UnitsStore',
    'SettingsStore'
)
@observer
export default class CloverPosPane extends React.PureComponent<
    CloverPosPaneProps,
    CloverPosPaneState
> {
    constructor(props: any) {
        super(props);
        this.state = {
            selectedIndex: 0,
            search: '',
            fadeAnimation: new Animated.Value(1)
        };

        Animated.loop(
            Animated.sequence([
                Animated.timing(this.state.fadeAnimation, {
                    toValue: 0,
                    duration: 500,
                    delay: 1000,
                    useNativeDriver: true
                }),
                Animated.timing(this.state.fadeAnimation, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true
                })
            ])
        ).start();
    }

    componentDidMount() {
        // Part 1 entry point: pull Clover open/paid orders through the
        // shared PosStore.getOrders() contract (v4 routes to
        // getCloverOrders when Clover is enabled). Guarded so mount
        // never throws when the store is not injected (tests).
        const { PosStore } = this.props;
        try {
            if (PosStore && !PosStore.loading) {
                PosStore.getOrders();
            }
        } catch {}
    }

    render() {
        const { ActivityStore, PosStore, FiatStore, navigation } = this.props;
        const { search, selectedIndex, fadeAnimation } = this.state;
        const { setFiltersPos } = ActivityStore!;
        const {
            loading,
            getOrders,
            openOrders,
            paidOrders,
            filteredOpenOrders,
            filteredPaidOrders,
            updateSearch,
            hideOrder
        } = PosStore!;
        const orders =
            selectedIndex === 0 ? filteredOpenOrders : filteredPaidOrders;
        // R13 base: unfiltered source for the active tab. When search is
        // non-empty but the filtered slice is empty while the base is
        // non-empty, the list is empty BECAUSE of the search — show a
        // dedicated empty-search message instead of the generic noOrders.
        const baseOrders =
            selectedIndex === 0 ? openOrders : paidOrders;
        const trimmedSearch = (search || '').trim();
        const isEmptySearchResult =
            trimmedSearch !== '' &&
            (baseOrders || []).length > 0 &&
            (orders || []).length === 0;
        let emptyText: string;
        if (isEmptySearchResult) {
            // R13: separate message for empty search (no new locale key
            // in part 1; base noOrders strings stay on existing keys).
            emptyText = `No results for "${trimmedSearch}"`;
        } else {
            emptyText =
                selectedIndex === 0
                    ? localeString('pos.views.Wallet.PosPane.noOrders')
                    : localeString(
                          'pos.views.Wallet.PosPane.noOrdersPaid'
                      );
        }
        const headerString = `${localeString('general.orders')} (${
            orders.length || 0
        })`;

        // R11: SHOW hidden / out-of-stock, do NOT hide in the pane.
        // PosStore marks orders with `hidden = true` (POS_HIDDEN_KEY) and
        // Clover products carry `available`; part 1 deliberately applies
        // NO extra `available`/`hidden` filter here — whatever the store
        // returns is rendered via OrderList (paid-hidden stays visible;
        // open-hidden exclusion, if any, lives in the shared store, not
        // in a second pane-side filter). No categories SectionList here
        // (R14 tail stays in part 2+).

        const openOrdersButton = ({ isSelected }: { isSelected: boolean }) => (
            <Text
                style={{
                    fontSize: 16,
                    fontFamily: isSelected
                        ? 'PPNeueMontreal-Medium'
                        : 'PPNeueMontreal-Book',
                    color: isSelected
                        ? themeColor('background')
                        : themeColor('text')
                }}
            >
                {localeString('general.open')}
            </Text>
        );

        const paidOrdersButton = ({ isSelected }: { isSelected: boolean }) => (
            <Text
                style={{
                    fontSize: 16,
                    fontFamily: isSelected
                        ? 'PPNeueMontreal-Medium'
                        : 'PPNeueMontreal-Book',
                    color: isSelected
                        ? themeColor('background')
                        : themeColor('text')
                }}
            >
                {localeString('views.Wallet.Invoices.paid')}
            </Text>
        );

        const buttonElements = [
            { element: openOrdersButton },
            { element: paidOrdersButton }
        ];

        return (
            <Layout
                title={headerString}
                navigation={navigation}
                loading={loading}
                selectedIndex={selectedIndex}
                buttons={buttonElements}
                onIndexChange={(selectedIndex: number) =>
                    this.setState({ selectedIndex })
                }
                fadeAnimation={fadeAnimation}
            >
                {!loading && (
                    <SearchBar
                        placeholder={localeString('general.search')}
                        // @ts-ignore:next-line
                        onChangeText={(value: string) => {
                            updateSearch(value);
                            this.setState({ search: value });
                        }}
                        value={search}
                        inputStyle={{ color: themeColor('text') }}
                        placeholderTextColor={placeholderColor()}
                        containerStyle={{
                            backgroundColor: 'transparent',
                            borderTopWidth: 0,
                            borderBottomWidth: 0
                        }}
                        inputContainerStyle={{
                            borderRadius: 15,
                            backgroundColor: themeColor('secondary')
                        }}
                    />
                )}

                {!loading && (
                    <OrderList
                        orders={orders}
                        loading={loading}
                        onRefresh={() => getOrders()}
                        navigation={navigation}
                        fiatStore={FiatStore!}
                        emptyText={emptyText}
                        onHideOrder={(id) =>
                            hideOrder(id).then(() => getOrders())
                        }
                        onOrderClick={(item) => {
                            setFiltersPos().then(() => {
                                navigation.navigate('Activity', {
                                    order: item
                                });
                            });
                        }}
                    />
                )}
            </Layout>
        );
    }
}
