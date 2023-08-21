import * as React from 'react';
import {
    FlatList,
    NativeModules,
    NativeEventEmitter,
    TouchableOpacity,
    View
} from 'react-native';
import { Button, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';

import Amount from '../../components/Amount';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import BackendUtils from '../../utils/BackendUtils';
import { themeColor } from '../../utils/ThemeUtils';

import ActivityStore from '../../stores/ActivityStore';
import FiatStore from '../../stores/FiatStore';
import PosStore from '../../stores/PosStore';
import SettingsStore from '../../stores/SettingsStore';
import SyncStore from '../../stores/SyncStore';
import { SATS_PER_BTC } from '../../stores/UnitsStore';

import Filter from '../../assets/images/SVG/Filter On.svg';

interface ActivityProps {
    navigation: any;
    ActivityStore: ActivityStore;
    FiatStore: FiatStore;
    PosStore: PosStore;
    SettingsStore: SettingsStore;
    SyncStore: SyncStore;
}

interface ActivityState {
    selectedPaymentForOrder: any;
}

@inject('ActivityStore', 'FiatStore', 'PosStore', 'SettingsStore', 'SyncStore')
@observer
export default class Activity extends React.PureComponent<
    ActivityProps,
    ActivityState
> {
    transactionListener: any;
    invoicesListener: any;

    state = {
        selectedPaymentForOrder: null
    };

    async UNSAFE_componentWillMount() {
        const { ActivityStore, SettingsStore, SyncStore } = this.props;
        const { getActivityAndFilter, getFilters } = ActivityStore;
        const filters = await getFilters();
        await getActivityAndFilter(filters);
        if (SettingsStore.implementation === 'lightning-node-connect') {
            this.subscribeEvents();
        }

        // pause syncing updates if necessary
        const { isSyncing, syncStatusUpdatesPaused, pauseSyncingUpates } =
            SyncStore;
        if (isSyncing && !syncStatusUpdatesPaused) {
            pauseSyncingUpates();
        }
    }

    UNSAFE_componentWillReceiveProps = (newProps: any) => {
        const { ActivityStore } = newProps;
        const { getActivityAndFilter } = ActivityStore;
        getActivityAndFilter();
    };

    componentWillUnmount() {
        if (this.transactionListener && this.transactionListener.stop)
            this.transactionListener.stop();
        if (this.invoicesListener && this.invoicesListener.stop)
            this.invoicesListener.stop();
    }

    subscribeEvents = () => {
        const { ActivityStore } = this.props;
        const { LncModule } = NativeModules;
        const eventEmitter = new NativeEventEmitter(LncModule);
        this.transactionListener = eventEmitter.addListener(
            BackendUtils.subscribeTransactions(),
            () => {
                ActivityStore.updateTransactions();
            }
        );

        this.invoicesListener = eventEmitter.addListener(
            BackendUtils.subscribeInvoices(),
            () => {
                ActivityStore.updateInvoices();
            }
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

    // TODO this feels like an odd place to do all this deciding
    // TODO on-chain has "-" sign but lightning doesn't?
    getRightTitleTheme = (item: any) => {
        if (item.getAmount == 0) return 'secondaryText';

        if (item.model === localeString('general.transaction')) {
            if (item.getAmount.toString().includes('-')) return 'warning';
            return 'success';
        }

        if (item.model === localeString('views.Payment.title'))
            return 'warning';

        if (item.model === localeString('views.Invoice.title')) {
            if (item.isExpired && !item.isPaid) {
                return 'text';
            } else if (!item.isPaid) {
                return 'highlight';
            }
        }

        if (item.isPaid) return 'success';

        return 'secondaryText';
    };

    render() {
        const {
            navigation,
            ActivityStore,
            FiatStore,
            PosStore,
            SettingsStore
        } = this.props;
        const { selectedPaymentForOrder } = this.state;
        const { loading, filteredActivity, getActivityAndFilter } =
            ActivityStore;
        const { recordPayment } = PosStore;
        const { settings } = SettingsStore;
        const { fiat } = settings;

        const order = navigation.getParam('order', null);

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

                    const fiatEntry = FiatStore.fiatRates.filter(
                        (entry: any) => entry.code === fiat
                    )[0];

                    const { symbol, space, rtl, separatorSwap } =
                        FiatStore.symbolLookup(fiatEntry && fiatEntry.code);

                    const formattedRate = separatorSwap
                        ? FiatStore.numberWithDecimals(rate)
                        : FiatStore.numberWithCommas(rate);

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
                onPress={() => navigation.navigate('ActivityFilter')}
            >
                <Filter fill={themeColor('text')} />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Close"
                    centerComponent={{
                        text: localeString('general.activity'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    rightComponent={
                        order ? (
                            selectedPaymentForOrder ? (
                                <MarkPaymentButton />
                            ) : null
                        ) : (
                            <FilterButton />
                        )
                    }
                    navigation={navigation}
                />
                {loading ? (
                    <View style={{ padding: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : !!filteredActivity && filteredActivity.length > 0 ? (
                    <FlatList
                        data={filteredActivity}
                        renderItem={({ item }: { item: any }) => {
                            let displayName = item.model;
                            let subTitle = item.model;
                            if (
                                item.model ===
                                localeString('views.Invoice.title')
                            ) {
                                displayName = item.isPaid
                                    ? localeString('views.Activity.youReceived')
                                    : localeString(
                                          'views.Activity.requestedPayment'
                                      );
                                subTitle = `${
                                    item.isPaid
                                        ? localeString('general.lightning')
                                        : `${localeString(
                                              'views.PaymentRequest.title'
                                          )}: ${
                                              item.isExpired
                                                  ? localeString(
                                                        'views.Activity.expired'
                                                    )
                                                  : item.expirationDate
                                          }`
                                }${item.memo ? `: ${item.memo}` : ''}`;
                            }

                            if (
                                item.model ===
                                localeString('views.Payment.title')
                            ) {
                                displayName = localeString(
                                    'views.Activity.youSent'
                                );
                                subTitle = item.memo
                                    ? `${localeString('general.lightning')}: ${
                                          item.memo
                                      }`
                                    : localeString('general.lightning');
                            }

                            if (
                                item.model ===
                                localeString('general.transaction')
                            ) {
                                displayName =
                                    item.getAmount == 0
                                        ? localeString(
                                              'views.Activity.channelOperation'
                                          )
                                        : !item.getAmount
                                              .toString()
                                              .includes('-')
                                        ? localeString(
                                              'views.Activity.youReceived'
                                          )
                                        : localeString(
                                              'views.Activity.youSent'
                                          );
                                subTitle =
                                    item.num_confirmations == 0
                                        ? `${localeString(
                                              'general.onchain'
                                          )}: ${localeString(
                                              'general.unconfirmed'
                                          )}`
                                        : localeString('general.onchain');
                            }

                            return (
                                <React.Fragment>
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent'
                                        }}
                                        onPress={() => {
                                            if (order) {
                                                if (
                                                    selectedPaymentForOrder ===
                                                    item
                                                ) {
                                                    this.setState({
                                                        selectedPaymentForOrder:
                                                            null
                                                    });
                                                } else {
                                                    this.setState({
                                                        selectedPaymentForOrder:
                                                            item
                                                    });
                                                }
                                                return;
                                            }
                                            if (
                                                item.model ===
                                                localeString(
                                                    'views.Invoice.title'
                                                )
                                            ) {
                                                navigation.navigate('Invoice', {
                                                    invoice: item
                                                });
                                            }

                                            if (
                                                item.model ===
                                                localeString(
                                                    'general.transaction'
                                                )
                                            ) {
                                                navigation.navigate(
                                                    'Transaction',
                                                    {
                                                        transaction: item
                                                    }
                                                );
                                            }

                                            if (
                                                item.model ===
                                                localeString(
                                                    'views.Payment.title'
                                                )
                                            ) {
                                                navigation.navigate('Payment', {
                                                    payment: item
                                                });
                                            }
                                        }}
                                    >
                                        <ListItem.Content>
                                            <ListItem.Title
                                                right
                                                style={{
                                                    fontWeight: '600',
                                                    color:
                                                        item ===
                                                        selectedPaymentForOrder
                                                            ? themeColor(
                                                                  'highlight'
                                                              )
                                                            : themeColor(
                                                                  'text'
                                                              ),
                                                    fontFamily: 'Lato-Regular'
                                                }}
                                            >
                                                {displayName}
                                            </ListItem.Title>
                                            <ListItem.Subtitle
                                                right
                                                style={{
                                                    color:
                                                        item ===
                                                        selectedPaymentForOrder
                                                            ? themeColor(
                                                                  'highlight'
                                                              )
                                                            : themeColor(
                                                                  'secondaryText'
                                                              ),
                                                    fontFamily: 'Lato-Regular'
                                                }}
                                            >
                                                {subTitle}
                                            </ListItem.Subtitle>
                                        </ListItem.Content>
                                        <ListItem.Content right>
                                            <Amount
                                                sats={item.getAmount}
                                                sensitive
                                                color={this.getRightTitleTheme(
                                                    item
                                                )}
                                            />
                                            <ListItem.Subtitle
                                                right
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontFamily: 'Lato-Regular'
                                                }}
                                            >
                                                {order
                                                    ? item.getDisplayTimeOrder
                                                    : item.getDisplayTimeShort}
                                            </ListItem.Subtitle>
                                        </ListItem.Content>
                                    </ListItem>
                                </React.Fragment>
                            );
                        }}
                        keyExtractor={(item, index) => `${item.model}-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                        refreshing={loading}
                        onRefresh={() => getActivityAndFilter()}
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
                        onPress={() => getActivityAndFilter()}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }}
                    />
                )}
            </Screen>
        );
    }
}
