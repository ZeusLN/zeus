import * as React from 'react';
import {
    Animated,
    FlatList,
    View,
    Text,
    TouchableHighlight,
    TouchableOpacity
} from 'react-native';
import { SearchBar } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import LoadingIndicator from '../../components/LoadingIndicator';
import WalletHeader from '../../components/WalletHeader';

import { Spacer } from '../../components/layout/Spacer';
import OrderItem from './OrderItem';

import FiatStore from '../../stores/FiatStore';
import PosStore from '../../stores/PosStore';
import UnitsStore from '../../stores/UnitsStore';
import SettingsStore from '../../stores/SettingsStore';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import Order from '../../models/Order';

interface PosPaneProps {
    navigation: any;
    FiatStore: FiatStore;
    PosStore: PosStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

interface PosPaneState {
    search: string;
    filteredOrders: Array<Order>;
    fadeAnimation: any;
}

@inject('FiatStore', 'PosStore', 'UnitsStore', 'SettingsStore')
@observer
export default class PosPane extends React.PureComponent<
    PosPaneProps,
    PosPaneState
> {
    constructor(props: any) {
        super(props);

        const { orders } = this.props.PosStore;

        this.state = {
            search: '',
            filteredOrders: orders,
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

    updateSearch = (value: string) => {
        const { orders } = this.props.PosStore;
        const result = orders.filter(
            (item: any) =>
                item.getItemsList.includes(value) ||
                item.getItemsList.toLowerCase().includes(value)
        );
        this.setState({
            search: value,
            filteredOrders: result
        });
    };

    renderItem = (order) => {
        const { navigation, FiatStore } = this.props;
        const { getRate, loading } = FiatStore;
        const { item } = order;
        return (
            <TouchableHighlight
                onPress={() => {
                    if (loading || getRate() === '$N/A') return;
                    navigation.navigate('Order', {
                        order: item
                    });
                }}
            >
                <OrderItem
                    title={item.getItemsList}
                    money={item.getTotalMoneyDisplay}
                    date={item.getDisplayTime}
                />
            </TouchableHighlight>
        );
    };

    render() {
        const { SettingsStore, PosStore, FiatStore, navigation } = this.props;
        const { search, filteredOrders } = this.state;
        const { loading, getOrders } = PosStore;
        const orders = filteredOrders;
        const { getRate, getFiatRates } = FiatStore;
        const fiatLoading = FiatStore.loading;

        const headerString = `${localeString('general.orders')} (${
            orders.length
        })`;

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader
                    title={headerString}
                    navigation={navigation}
                    SettingsStore={SettingsStore}
                />

                {fiatLoading ? (
                    <Animated.View
                        style={{
                            alignSelf: 'center',
                            opacity: this.state.fadeAnimation
                        }}
                    >
                        <Text
                            style={{
                                color: themeColor('text'),
                                marginBottom: 10
                            }}
                        >
                            {localeString(
                                'pos.views.Wallet.PosPane.fetchingRates'
                            )}
                        </Text>
                    </Animated.View>
                ) : (
                    <TouchableOpacity onPress={() => getFiatRates()}>
                        <Text
                            style={{
                                color:
                                    getRate() === '$N/A'
                                        ? themeColor('error')
                                        : themeColor('text'),
                                alignSelf: 'center',
                                marginBottom: 10
                            }}
                        >
                            {getRate() === '$N/A'
                                ? localeString('general.fiatFetchError')
                                : getRate()}
                        </Text>
                    </TouchableOpacity>
                )}

                {loading && <LoadingIndicator />}

                {!loading && (
                    <SearchBar
                        placeholder={localeString('general.search')}
                        onChangeText={this.updateSearch}
                        value={search}
                        inputStyle={{
                            color: themeColor('text')
                        }}
                        placeholderTextColor={themeColor('secondaryText')}
                        containerStyle={{
                            backgroundColor: themeColor('background'),
                            borderTopWidth: 0,
                            borderBottomWidth: 0
                        }}
                        inputContainerStyle={{
                            borderRadius: 15,
                            backgroundColor: themeColor('secondary')
                        }}
                    />
                )}

                {!loading && orders && orders.length > 0 && (
                    <FlatList
                        data={orders}
                        renderItem={this.renderItem}
                        ListFooterComponent={<Spacer height={100} />}
                        onRefresh={() => getOrders()}
                        refreshing={loading}
                        keyExtractor={(item, index) => `${item.id}-${index}`}
                    />
                )}

                {!loading && orders && orders.length === 0 && (
                    <TouchableOpacity onPress={() => getOrders()}>
                        <Text
                            style={{
                                color: themeColor('text'),
                                margin: 10,
                                textAlign: 'center'
                            }}
                        >
                            {localeString('pos.views.Wallet.PosPane.noOrders')}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }
}
