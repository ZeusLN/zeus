import * as React from 'react';

import { Animated, Text } from 'react-native';
import { SearchBar } from '@rneui/themed';

import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Layout from '../../views/POS/Layout';

import OrderList from '../POS/OrderList';

import ActivityStore from '../../stores/ActivityStore';
import FiatStore from '../../stores/FiatStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import PosStore from '../../stores/PosStore';
import UnitsStore from '../../stores/UnitsStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
interface SquarePosPaneProps {
    navigation: StackNavigationProp<any, any>;
    ActivityStore?: ActivityStore;
    FiatStore?: FiatStore;
    NodeInfoStore?: NodeInfoStore;
    PosStore?: PosStore;
    UnitsStore?: UnitsStore;
    SettingsStore?: SettingsStore;
}

interface SquarePosPaneState {
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
export default class SquarePosPane extends React.PureComponent<
    SquarePosPaneProps,
    SquarePosPaneState
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

    render() {
        const { ActivityStore, PosStore, FiatStore, navigation } = this.props;
        const { search, selectedIndex, fadeAnimation } = this.state;
        const { setFiltersPos } = ActivityStore!;
        const {
            loading,
            getOrders,
            filteredOpenOrders,
            filteredPaidOrders,
            updateSearch,
            hideOrder
        } = PosStore!;
        const orders =
            selectedIndex === 0 ? filteredOpenOrders : filteredPaidOrders;
        const headerString = `${localeString('general.orders')} (${
            orders.length || 0
        })`;

        const openOrdersButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        selectedIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('general.open')}
            </Text>
        );

        const paidOrdersButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        selectedIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('views.Wallet.Invoices.paid')}
            </Text>
        );

        const buttons = [
            { element: openOrdersButton },
            { element: paidOrdersButton }
        ];

        const buttonElements = buttons.map((btn) => btn.element());

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
                        placeholderTextColor={themeColor('secondaryText')}
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
                        fiatStore={FiatStore}
                        emptyText={
                            selectedIndex === 0
                                ? localeString(
                                      'pos.views.Wallet.PosPane.noOrders'
                                  )
                                : localeString(
                                      'pos.views.Wallet.PosPane.noOrdersPaid'
                                  )
                        }
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
