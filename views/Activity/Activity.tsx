import * as React from 'react';
import {
    FlatList,
    NativeModules,
    NativeEventEmitter,
    Text,
    TouchableOpacity,
    View,
    EmitterSubscription
} from 'react-native';
import { Button, Icon } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import isEqual from 'lodash/isEqual';

import ActivityItem, {
    getActivityItemTheme
} from '../../components/ActivityItem';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import { Row } from '../../components/layout/Row';
import ActivityToCsv from './ActivityToCsv';

import { localeString } from '../../utils/LocaleUtils';
import BackendUtils from '../../utils/BackendUtils';
import { themeColor } from '../../utils/ThemeUtils';
import {
    SATS_PER_BTC,
    numberWithCommas,
    numberWithDecimals
} from '../../utils/UnitsUtils';

import ActivityStore, { DEFAULT_FILTERS } from '../../stores/ActivityStore';
import FiatStore from '../../stores/FiatStore';
import PosStore from '../../stores/PosStore';
import SettingsStore from '../../stores/SettingsStore';
import SwapStore from '../../stores/SwapStore';

import Filter from '../../assets/images/SVG/Filter On.svg';

import { LSPOrderState } from '../../models/LSP';

interface ActivityProps {
    navigation: NativeStackNavigationProp<any, any>;
    ActivityStore: ActivityStore;
    FiatStore: FiatStore;
    PosStore: PosStore;
    SettingsStore: SettingsStore;
    SwapStore: SwapStore;
    route: Route<'Activity', { order: any }>;
}

interface ActivityState {
    loading: boolean;
    selectedPaymentForOrder: any;
    isCsvModalVisible: boolean;
}

interface OrderItem {
    id: string;
    total_money: {
        amount: number;
    };
}

interface Order {
    item: OrderItem;
}


@inject(
    'ActivityStore',
    'FiatStore',
    'PosStore',
    'SettingsStore',
    'InvoicesStore',
    'SwapStore'
)
@observer
export default class Activity extends React.PureComponent<
    ActivityProps,
    ActivityState
> {
    private transactionListener: EmitterSubscription;
    private invoicesListener: EmitterSubscription;
    private focusListener?: () => void;

    state = {
        loading: false,
        selectedPaymentForOrder: null,
        isCsvModalVisible: false
    };

    async componentDidMount() {
        const {
            ActivityStore: { getActivityAndFilter, getFilters },
            SettingsStore,
            navigation
        } = this.props;
        this.setState({ loading: true });

        const filters = await getFilters();
        await getActivityAndFilter(SettingsStore.settings.locale, filters);

        if (SettingsStore.implementation === 'lightning-node-connect') {
            this.subscribeEvents();
        }

        this.focusListener = navigation.addListener('focus', async () => {
            const refilters = await getFilters();
            await getActivityAndFilter(
                SettingsStore.settings.locale,
                refilters
            );
        });

        this.setState({ loading: false });
    }

    async componentDidUpdate(prevProps: any) {
        const { ActivityStore, SettingsStore } = this.props;
        const { getActivityAndFilter } = ActivityStore;

        if (
            SettingsStore.settings.locale !==
            prevProps.SettingsStore.settings.locale
        ) {
            const filters = await ActivityStore.getFilters();
            await getActivityAndFilter(SettingsStore.settings.locale, filters);
        }
    }

    componentWillUnmount() {
        if (this.transactionListener) this.transactionListener.remove();
        if (this.invoicesListener) this.invoicesListener.remove();
        if (this.focusListener) this.focusListener();
    }

    subscribeEvents = () => {
        const { ActivityStore, SettingsStore } = this.props;
        const { LncModule } = NativeModules;
        const locale = SettingsStore.settings.locale;
        const eventEmitter = new NativeEventEmitter(LncModule);
        this.transactionListener = eventEmitter.addListener(
            BackendUtils.subscribeTransactions(),
            () => ActivityStore.updateTransactions(locale)
        );

        this.invoicesListener = eventEmitter.addListener(
            BackendUtils.subscribeInvoices(),
            () => ActivityStore.updateInvoices(locale)
        );
    };

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    getRightTitleTheme = (item: any) => getActivityItemTheme(item);

    handleItemPress = (item: any) => {
        const { navigation, route } = this.props;
        const order = route.params?.order;

        if (order) {
            if (this.state.selectedPaymentForOrder === item) {
                this.setState({ selectedPaymentForOrder: null });
            } else {
                this.setState({ selectedPaymentForOrder: item });
            }
            return;
        }
        if (item.model === localeString('views.Swaps.title')) {
            navigation.navigate('SwapDetails', {
                swapData: item,
                keys: item.keys,
                endpoint: item.endpoint,
                invoice: item.invoice
            });
        }

        if (item.model === 'LSPS1Order') {
            const orderShouldUpdate =
                item.state === LSPOrderState.FAILED ||
                item.state === LSPOrderState.COMPLETED;
            navigation.navigate('LSPS1Order', {
                orderId: item.id,
                orderShouldUpdate
            });
            return;
        }

        if (item.model === 'LSPS7Order') {
            const orderShouldUpdate =
                item.state === LSPOrderState.FAILED ||
                item.state === LSPOrderState.COMPLETED;
            navigation.navigate('LSPS7Order', {
                orderId: item.id,
                orderShouldUpdate
            });
            return;
        }

        if (item.model === localeString('views.Invoice.title')) {
            navigation.navigate('Invoice', { invoice: item });
        }
        if (item.model === localeString('views.Cashu.CashuInvoice.title')) {
            navigation.navigate('CashuInvoice', { invoice: item });
        }
        if (item.model === localeString('views.Cashu.CashuPayment.title')) {
            navigation.navigate('CashuPayment', { payment: item });
        }
        if (item.model === localeString('cashu.token')) {
            navigation.navigate('CashuToken', { decoded: item });
        }
        if (item.model === localeString('general.transaction')) {
            navigation.navigate('Transaction', { transaction: item });
        }
        if (item.model === localeString('views.Payment.title')) {
            navigation.navigate('Payment', { payment: item });
        }
    };

    render() {
        const {
            navigation,
            ActivityStore,
            FiatStore,
            PosStore,
            SettingsStore,
            SwapStore,
            route
        } = this.props;
        const { loading, selectedPaymentForOrder, isCsvModalVisible } =
            this.state;

        const { filteredActivity, getActivityAndFilter, filters } =
            ActivityStore;
        const { recordPayment } = PosStore;
        const { settings } = SettingsStore;
        const { fiat } = settings;

        const order = route.params?.order;

        const MarkPaymentButton = () => (
            <Icon
                name="payments"
                onPress={() => {
                    if (!order || !selectedPaymentForOrder) return;
                    const payment: any = selectedPaymentForOrder;
                    /*
                    missing fields for recovered payment
                        orderTip,
                    */

                    const orderTotal = payment.payment_request
                        ? payment.amt_paid_sat.toString()
                        : payment.amount;

                    const orderItem = order.item;
                    const fiatAmount = new BigNumber(
                        orderItem.total_money.amount
                    ).div(100);

                    const rate = fiatAmount
                        .div(orderTotal)
                        .multipliedBy(SATS_PER_BTC)
                        .toFixed(3);

                    const { fiatRates } = FiatStore;

                    const fiatEntry =
                        fiatRates &&
                        fiatRates.filter(
                            (entry: any) => entry.code === fiat
                        )[0];

                    const { symbol, space, rtl, separatorSwap } = fiatEntry
                        ? FiatStore.symbolLookup(fiatEntry.code)
                        : {
                              symbol: 'N/A',
                              space: true,
                              rtl: false,
                              separatorSwap: false
                          };

                    const formattedRate = separatorSwap
                        ? numberWithDecimals(rate)
                        : numberWithCommas(rate);

                    const exchangeRate = rtl
                        ? `${formattedRate}${
                              space ? ' ' : ''
                          }${symbol} BTC/${fiat}`
                        : `${symbol}${
                              space ? ' ' : ''
                          }${formattedRate} BTC/${fiat}`;

                    recordPayment({
                        orderId: order.item.id,
                        type: payment.payment_request ? 'ln' : 'onchain',
                        tx: payment.tx_hash || payment.payment_request,
                        orderTotal,
                        orderTip: '0',
                        exchangeRate,
                        rate: Number(rate)
                    }).then(() => {
                        navigation.goBack();
                    });
                }}
                color={themeColor('highlight')}
                underlayColor="transparent"
            />
        );

        const FilterButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('ActivityFilter', {
                        animation: 'slide_from_right'
                    })
                }
                accessibilityLabel={localeString('views.ActivityFilter.title')}
            >
                <Filter
                    fill={
                        isEqual(filters, DEFAULT_FILTERS)
                            ? themeColor('text')
                            : themeColor('highlight')
                    }
                    size={35}
                />
            </TouchableOpacity>
        );

        const DownloadButton = () => (
            <View style={{ marginRight: 15 }}>
                <TouchableOpacity
                    onPress={() =>
                        this.setState({
                            isCsvModalVisible: true
                        })
                    }
                    accessibilityLabel={localeString(
                        'views.ActivityToCsv.title'
                    )}
                >
                    <Icon
                        name="upload"
                        type="feather"
                        color={themeColor('text')}
                        underlayColor="transparent"
                        size={35}
                    />
                </TouchableOpacity>
            </View>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Close"
                    centerComponent={{
                        text: localeString('general.activity'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        !loading ? (
                            <Row>
                                {filteredActivity?.length > 0 && (
                                    <DownloadButton />
                                )}
                                {order ? (
                                    selectedPaymentForOrder ? (
                                        <MarkPaymentButton />
                                    ) : undefined
                                ) : (
                                    <FilterButton />
                                )}
                            </Row>
                        ) : undefined
                    }
                    navigation={navigation}
                />

                <ActivityToCsv
                    filteredActivity={filteredActivity}
                    closeModal={() =>
                        this.setState({ isCsvModalVisible: false })
                    }
                    isVisible={isCsvModalVisible}
                />

                {loading ? (
                    <View style={{ padding: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : filteredActivity?.length > 0 ? (
                    <FlatList
                        data={filteredActivity}
                        renderItem={({ item }: { item: any }) => (
                            <TouchableOpacity
                                onPress={() => this.handleItemPress(item)}
                            >
                                <ActivityItem
                                    item={item}
                                    selectedPaymentForOrder={
                                        selectedPaymentForOrder
                                    }
                                    order={!!route.params?.order}
                                    swapStore={SwapStore}
                                />
                            </TouchableOpacity>
                        )}
                        keyExtractor={(item, index) => `${item.model}-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                        refreshing={loading}
                        onRefresh={() =>
                            getActivityAndFilter(SettingsStore.settings.locale)
                        }
                        initialNumToRender={10}
                        maxToRenderPerBatch={5}
                        windowSize={10}
                    />
                ) : (
                    <Button
                        title={localeString('views.Activity.noActivity')}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: themeColor('text')
                        }}
                        onPress={() =>
                            getActivityAndFilter(SettingsStore.settings.locale)
                        }
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    />
                )}
            </Screen>
        );
    }
}

