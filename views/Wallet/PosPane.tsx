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

<<<<<<< HEAD
=======
import Button from '../../components/Button';
>>>>>>> 59886a969b3bac7eaa5bbbd65e1cc7621934ffa7
import LoadingIndicator from '../../components/LoadingIndicator';
import WalletHeader from '../../components/WalletHeader';

import { Spacer } from '../../components/layout/Spacer';
import OrderItem from './OrderItem';

import FiatStore from '../../stores/FiatStore';
<<<<<<< HEAD
=======
import NodeInfoStore from '../../stores/NodeInfoStore';
>>>>>>> 59886a969b3bac7eaa5bbbd65e1cc7621934ffa7
import PosStore from '../../stores/PosStore';
import UnitsStore from '../../stores/UnitsStore';
import SettingsStore from '../../stores/SettingsStore';

<<<<<<< HEAD
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import Order from '../../models/Order';
=======
import Order from '../../models/Order';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import { version } from './../../package.json';
>>>>>>> 59886a969b3bac7eaa5bbbd65e1cc7621934ffa7

interface PosPaneProps {
    navigation: any;
    FiatStore: FiatStore;
<<<<<<< HEAD
=======
    NodeInfoStore: NodeInfoStore;
>>>>>>> 59886a969b3bac7eaa5bbbd65e1cc7621934ffa7
    PosStore: PosStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

interface PosPaneState {
    search: string;
    filteredOrders: Array<Order>;
    fadeAnimation: any;
}

<<<<<<< HEAD
@inject('FiatStore', 'PosStore', 'UnitsStore', 'SettingsStore')
=======
@inject('FiatStore', 'NodeInfoStore', 'PosStore', 'UnitsStore', 'SettingsStore')
>>>>>>> 59886a969b3bac7eaa5bbbd65e1cc7621934ffa7
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

<<<<<<< HEAD
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
=======
    renderItem = (order) => {
        const { navigation, FiatStore } = this.props;
        const { getRate } = FiatStore;
>>>>>>> 59886a969b3bac7eaa5bbbd65e1cc7621934ffa7
        const { item } = order;
        return (
            <TouchableHighlight
                onPress={() => {
<<<<<<< HEAD
                    if (loading || getRate() === '$N/A') return;
=======
                    if (getRate() === '$N/A') return;
>>>>>>> 59886a969b3bac7eaa5bbbd65e1cc7621934ffa7
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
<<<<<<< HEAD
        const { SettingsStore, PosStore, FiatStore, navigation } = this.props;
        const { search, filteredOrders } = this.state;
        const { loading, getOrders } = PosStore;
        const orders = filteredOrders;
        const { getRate, getFiatRates } = FiatStore;
        const fiatLoading = FiatStore.loading;

        const headerString = `${localeString('general.orders')} (${
            orders.length
        })`;

=======
        const {
            SettingsStore,
            PosStore,
            FiatStore,
            NodeInfoStore,
            navigation
        } = this.props;
        const { search } = this.state;
        const { loading, getOrders, filteredOrders, updateSearch } = PosStore;
        const { getRate, getFiatRates } = FiatStore;
        const orders = filteredOrders;

        const headerString = `${localeString('general.orders')} (${
            orders.length || 0
        })`;

        const error = NodeInfoStore.error || SettingsStore.error;

        if (error) {
            return (
                <View
                    style={{
                        backgroundColor: themeColor('error'),
                        paddingTop: 20,
                        paddingLeft: 10,
                        flex: 1
                    }}
                >
                    <Text
                        style={{
                            fontFamily: 'Lato-Regular',
                            color: '#fff',
                            fontSize: 20,
                            marginTop: 20,
                            marginBottom: 25
                        }}
                    >
                        {SettingsStore.errorMsg
                            ? SettingsStore.errorMsg
                            : NodeInfoStore.errorMsg
                            ? NodeInfoStore.errorMsg
                            : localeString('views.Wallet.MainPane.error')}
                    </Text>
                    <Button
                        icon={{
                            name: 'settings',
                            size: 25,
                            color: '#fff'
                        }}
                        title={localeString(
                            'views.Wallet.MainPane.goToSettings'
                        )}
                        buttonStyle={{
                            backgroundColor: 'gray',
                            borderRadius: 30
                        }}
                        containerStyle={{
                            alignItems: 'center'
                        }}
                        onPress={() => {
                            const { posStatus, settings } =
                                this.props.SettingsStore;
                            const loginRequired =
                                settings &&
                                (settings.passphrase || settings.pin);
                            const posEnabled = posStatus === 'active';

                            if (posEnabled && loginRequired) {
                                navigation.navigate('Lockscreen', {
                                    attemptAdminLogin: true
                                });
                            } else {
                                navigation.navigate('Settings');
                            }
                        }}
                        adaptiveWidth
                    />
                    <Text
                        style={{
                            fontFamily: 'Lato-Regular',
                            color: '#fff',
                            fontSize: 12,
                            marginTop: 20,
                            marginBottom: -40
                        }}
                    >
                        {`v${version}`}
                    </Text>
                </View>
            );
        }

>>>>>>> 59886a969b3bac7eaa5bbbd65e1cc7621934ffa7
        return (
            <View style={{ flex: 1 }}>
                <WalletHeader
                    title={headerString}
                    navigation={navigation}
                    SettingsStore={SettingsStore}
                />

<<<<<<< HEAD
                {fiatLoading ? (
=======
                {getRate() === '$N/A' ? (
>>>>>>> 59886a969b3bac7eaa5bbbd65e1cc7621934ffa7
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
<<<<<<< HEAD
                        onChangeText={this.updateSearch}
=======
                        onChangeText={(value: string) => {
                            updateSearch(value);
                            this.setState({
                                search: value
                            });
                        }}
>>>>>>> 59886a969b3bac7eaa5bbbd65e1cc7621934ffa7
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
<<<<<<< HEAD
                        keyExtractor={(item, index) => `${item.id}-${index}`}
=======
                        keyExtractor={(item, index) => `${index}`}
>>>>>>> 59886a969b3bac7eaa5bbbd65e1cc7621934ffa7
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
