import * as React from 'react';
import {
    FlatList,
    NativeModules,
    NativeEventEmitter,
    Text,
    TouchableOpacity,
    View,
    StyleSheet,
    EmitterSubscription
} from 'react-native';
import { Button, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import isEqual from 'lodash/isEqual';

import Amount from '../../components/Amount';
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
import PrivacyUtils from '../../utils/PrivacyUtils';
import dateTimeUtils from '../../utils/DateTimeUtils';

import ActivityStore, { DEFAULT_FILTERS } from '../../stores/ActivityStore';
import FiatStore from '../../stores/FiatStore';
import PosStore from '../../stores/PosStore';
import SettingsStore from '../../stores/SettingsStore';
import NotesStore from '../../stores/NotesStore';

import Filter from '../../assets/images/SVG/Filter On.svg';

import Invoice from '../../models/Invoice';
import CashuInvoice from '../../models/CashuInvoice';
import CashuPayment from '../../models/CashuPayment';
import { SwapType } from '../../models/Swap';
import WithdrawalRequest from '../../models/WithdrawalRequest';
import CashuToken from '../../models/CashuToken';

import Storage from '../../storage';

interface ActivityProps {
    navigation: StackNavigationProp<any, any>;
    ActivityStore: ActivityStore;
    FiatStore: FiatStore;
    PosStore: PosStore;
    SettingsStore: SettingsStore;
    NotesStore: NotesStore;
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

interface ActivityListItemProps {
    item: any;
    selectedPaymentForOrder: any;
    onItemPress: (item: any) => void;
    getRightTitleTheme: (
        item: any
    ) =>
        | 'text'
        | 'highlight'
        | 'secondaryText'
        | 'success'
        | 'warning'
        | 'warningReserve';
    order?: Order;
}

const ActivityListItem = React.memo(
    ({
        item,
        selectedPaymentForOrder,
        onItemPress,
        getRightTitleTheme,
        order
    }: ActivityListItemProps) => {
        const [invreqTime, setInvreqTime] = React.useState('');

        React.useEffect(() => {
            async function getData() {
                if (item.invreq_id && item.bolt12) {
                    try {
                        const timestamp = await Storage.getItem(
                            `withdrawalRequest_${item.bolt12}`
                        );
                        if (timestamp) {
                            const invreqTime =
                                dateTimeUtils.listFormattedDateShort(
                                    Math.round(Number(timestamp) / 1000)
                                );
                            setInvreqTime(invreqTime);
                        }
                    } catch (err) {
                        console.error('Error fetching data:', err);
                    }
                }
            }

            getData();
        }, [item]);

        const note = item.getNote;
        let displayName = item.model;
        let subTitle = item.model;

        if (item instanceof WithdrawalRequest) {
            displayName = item.redeem
                ? item.isPaid
                    ? localeString('views.Activity.withdrew')
                    : item.isExpired
                    ? localeString('views.Activity.expiredRequested')
                    : localeString('views.Activity.pendingWithdrawal')
                : item.used
                ? localeString('views.Activity.outgoingWithdrawal')
                : localeString('views.Activity.pendingWithdrawal');
        } else if (item instanceof Invoice) {
            displayName = item.isPaid
                ? item.is_amp
                    ? localeString('views.Activity.youReceivedAmp')
                    : localeString('views.Activity.youReceived')
                : item.isExpired
                ? localeString('views.Activity.expiredRequested')
                : item.is_amp
                ? localeString('views.Activity.requestedPaymentAmp')
                : localeString('views.Activity.requestedPayment');
            const keysendMessageOrMemo = item.getKeysendMessageOrMemo;
            subTitle = (
                <Text>
                    {item.isPaid
                        ? localeString('general.lightning')
                        : localeString('views.PaymentRequest.title')}
                    {keysendMessageOrMemo ? ': ' : ''}
                    {keysendMessageOrMemo ? (
                        <Text style={{ fontStyle: 'italic' }}>
                            {PrivacyUtils.sensitiveValue(
                                keysendMessageOrMemo
                            )?.toString()}
                        </Text>
                    ) : (
                        ''
                    )}
                </Text>
            );
        } else if (item instanceof CashuToken) {
            displayName = item.received
                ? localeString('views.Activity.youReceived')
                : item.spent
                ? localeString('views.Activity.youSent')
                : localeString('general.unspent');
            const memo = item.getMemo;
            subTitle = (
                <Text>
                    {localeString('cashu.token')}
                    {memo ? ': ' : ''}
                    {memo ? (
                        <Text style={{ fontStyle: 'italic' }}>
                            {PrivacyUtils.sensitiveValue(memo)?.toString()}
                        </Text>
                    ) : (
                        ''
                    )}
                </Text>
            );
        } else if (item instanceof CashuInvoice) {
            displayName = item.isPaid
                ? localeString('views.Activity.youReceived')
                : item.isExpired
                ? localeString('views.Activity.expiredRequested')
                : localeString('views.Activity.requestedPayment');
            const memo = item.getMemo;
            subTitle = (
                <Text>
                    {item.isPaid
                        ? localeString('general.cashu')
                        : localeString('views.Cashu.CashuInvoice.title')}
                    {memo ? ': ' : ''}
                    {memo ? (
                        <Text style={{ fontStyle: 'italic' }}>
                            {PrivacyUtils.sensitiveValue(memo)?.toString()}
                        </Text>
                    ) : (
                        ''
                    )}
                </Text>
            );
        } else if (item instanceof CashuPayment) {
            displayName = item.isFailed
                ? localeString('views.Cashu.CashuPayment.failedPayment')
                : item.isInTransit
                ? localeString('views.Cashu.CashuPayment.inTransitPayment')
                : localeString('views.Activity.youSent');
            const keysendMessageOrMemo = item.getKeysendMessageOrMemo;
            subTitle = (
                <Text>
                    {localeString('general.cashu')}
                    {keysendMessageOrMemo ? ': ' : ''}
                    {keysendMessageOrMemo ? (
                        <Text style={{ fontStyle: 'italic' }}>
                            {PrivacyUtils.sensitiveValue(
                                keysendMessageOrMemo
                            )?.toString()}
                        </Text>
                    ) : (
                        ''
                    )}
                </Text>
            );
        } else if (item.model === localeString('views.Payment.title')) {
            displayName = item.isFailed
                ? localeString('views.Payment.failedPayment')
                : item.isInTransit
                ? localeString('views.Payment.inTransitPayment')
                : localeString('views.Activity.youSent');
            const keysendMessageOrMemo = item.getKeysendMessageOrMemo;
            subTitle = (
                <Text>
                    {localeString('general.lightning')}
                    {keysendMessageOrMemo ? ': ' : ''}
                    {keysendMessageOrMemo ? (
                        <Text style={{ fontStyle: 'italic' }}>
                            {PrivacyUtils.sensitiveValue(
                                keysendMessageOrMemo
                            )?.toString()}
                        </Text>
                    ) : (
                        ''
                    )}
                </Text>
            );
        } else if (item.model === localeString('general.transaction')) {
            displayName =
                item.getAmount == 0
                    ? localeString('views.Activity.channelOperation')
                    : !item.getAmount.toString().includes('-')
                    ? localeString('views.Activity.youReceived')
                    : localeString('views.Activity.youSent');
            subTitle =
                item.num_confirmations == 0
                    ? `${localeString('general.onchain')}: ${localeString(
                          'general.unconfirmed'
                      )}`
                    : localeString('general.onchain');
        } else if (item.model === localeString('views.Swaps.title')) {
            displayName =
                item.type === SwapType.Submarine
                    ? localeString('views.Swaps.submarine')
                    : localeString('views.Swaps.reverse');
            subTitle = (
                <Text>
                    {item?.imported
                        ? `${localeString('views.Swaps.SwapsPane.imported')}: `
                        : ''}
                    {item.type === SwapType.Submarine
                        ? `${localeString('general.onchain')} → ${localeString(
                              'general.lightning'
                          )}  🔗 → ⚡`
                        : `${localeString(
                              'general.lightning'
                          )} → ${localeString('general.onchain')}  ⚡ → 🔗`}
                </Text>
            );
        } else if (item.model === 'LSPS1Order') {
            displayName = localeString('views.LSPS1.type');
            subTitle = `${localeString('general.state')}: ${item.state}`;
        } else if (item.model === 'LSPS7Order') {
            displayName = localeString('views.LSPS7.type');
            subTitle = `${localeString('general.state')}: ${item.state}`;
        }

        return (
            <ListItem
                containerStyle={{
                    borderBottomWidth: 0,
                    backgroundColor: 'transparent'
                }}
                onPress={() => onItemPress(item)}
            >
                <ListItem.Content>
                    <View style={styles.row}>
                        <ListItem.Title
                            style={{
                                ...styles.leftCell,
                                fontWeight: '600',
                                color:
                                    item === selectedPaymentForOrder
                                        ? themeColor('highlight')
                                        : themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {displayName}
                        </ListItem.Title>

                        <View
                            style={{
                                ...styles.rightCell,
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                columnGap: 5,
                                rowGap: -5,
                                justifyContent: 'flex-end'
                            }}
                        >
                            <Amount
                                sats={item.getAmount}
                                sensitive
                                color={getRightTitleTheme(item)}
                            />
                            {!!item.getFee && item.getFee != 0 && (
                                <>
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontSize: 16
                                        }}
                                    >
                                        +
                                    </Text>
                                    <Amount
                                        sats={item.getFee}
                                        sensitive
                                        color={getRightTitleTheme(item)}
                                        fee
                                        roundAmount
                                    />
                                </>
                            )}
                        </View>
                    </View>

                    <View style={styles.row}>
                        <ListItem.Subtitle
                            right
                            style={{
                                ...styles.leftCell,
                                color:
                                    item === selectedPaymentForOrder
                                        ? themeColor('highlight')
                                        : themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {subTitle}
                        </ListItem.Subtitle>

                        {item.invreq_id ? (
                            <ListItem.Subtitle
                                style={{
                                    ...styles.rightCell,
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                <Text>{invreqTime}</Text>
                            </ListItem.Subtitle>
                        ) : (
                            <ListItem.Subtitle
                                style={{
                                    ...styles.rightCell,
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {order
                                    ? item.getDisplayTimeOrder
                                    : item.getDisplayTimeShort}
                            </ListItem.Subtitle>
                        )}
                    </View>

                    {!item.invreq_id &&
                        !item.isPaid &&
                        !item.isExpired &&
                        item.formattedTimeUntilExpiry && (
                            <View style={styles.row}>
                                <ListItem.Subtitle
                                    style={{
                                        ...styles.leftCell,
                                        color:
                                            item === selectedPaymentForOrder
                                                ? themeColor('highlight')
                                                : themeColor('secondaryText'),
                                        fontFamily: 'Lato-Regular'
                                    }}
                                >
                                    {localeString('views.Invoice.expiration')}
                                </ListItem.Subtitle>

                                <ListItem.Subtitle
                                    style={{
                                        ...styles.rightCell,
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'Lato-Regular'
                                    }}
                                >
                                    <Text textBreakStrategy="highQuality">
                                        {item.formattedTimeUntilExpiry}
                                    </Text>
                                </ListItem.Subtitle>
                            </View>
                        )}
                    {note && (
                        <View style={styles.row}>
                            <ListItem.Subtitle
                                style={{
                                    ...styles.leftCell,
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular',
                                    flexShrink: 0,
                                    flex: 0,
                                    width: 'auto',
                                    overflow: 'hidden'
                                }}
                                numberOfLines={1}
                            >
                                {localeString('general.note')}
                            </ListItem.Subtitle>

                            <ListItem.Subtitle
                                style={{
                                    ...styles.rightCell,
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'Lato-Regular',
                                    flexWrap: 'wrap',
                                    flexShrink: 1
                                }}
                                ellipsizeMode="tail"
                            >
                                {note.length > 150
                                    ? `${PrivacyUtils.sensitiveValue(
                                          note.substring(0, 150)
                                      )?.toString()}...`
                                    : PrivacyUtils.sensitiveValue(
                                          note
                                      )?.toString()}
                            </ListItem.Subtitle>
                        </View>
                    )}
                </ListItem.Content>
            </ListItem>
        );
    }
);

@inject(
    'ActivityStore',
    'FiatStore',
    'PosStore',
    'SettingsStore',
    'NotesStore',
    'InvoicesStore'
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

    UNSAFE_componentWillReceiveProps = (newProps: any) => {
        const { ActivityStore, SettingsStore } = newProps;
        const { getActivityAndFilter } = ActivityStore;
        getActivityAndFilter(SettingsStore.settings.locale);
    };

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
            () => ActivityStore.updateInvoices(locale),
            () => ActivityStore.updateWithdrawalRequest(locale)
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

        if (item.model === localeString('views.Cashu.CashuPayment.title'))
            return 'warning';

        if (item.model === localeString('views.Swaps.title')) {
            return 'text';
        }

        if (item.model === 'LSPS1Order' || item.model === 'LSPS7Order') {
            switch (item.state) {
                case 'CREATED':
                    return 'highlight';
                case 'COMPLETED':
                    return 'success';
                case 'FAILED':
                    return 'warning';
                default:
                    return 'text';
            }
        }

        if (item.model === localeString('cashu.token')) {
            return item.sent
                ? item.spent
                    ? 'warning'
                    : 'highlight'
                : 'success';
        }

        if (item.model === localeString('views.Invoice.title')) {
            if (item.isExpired && !item.isPaid) {
                return 'text';
            } else if (!item.isPaid) {
                return 'highlight';
            }
        }

        if (item.model === localeString('general.withdrawalRequest')) {
            if (item.isExpired && !item.isPaid) {
                return 'text';
            }

            if (item.active && !item.isPaid) {
                return 'highlight';
            }

            if (!item.redeem) {
                return 'warning';
            }

            if (item.redeem) {
                return 'success';
            }
        }

        if (item.model === localeString('views.Cashu.CashuInvoice.title')) {
            if (item.isExpired && !item.isPaid) {
                return 'text';
            } else if (!item.isPaid) {
                return 'highlight';
            }
        }

        if (item.isPaid) return 'success';

        return 'secondaryText';
    };

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
                item.state === 'FAILED' || item.state === 'COMPLETED';
            navigation.navigate('LSPS1Order', {
                orderId: item.id,
                orderShouldUpdate
            });
            return;
        }

        if (item.model === 'LSPS7Order') {
            const orderShouldUpdate =
                item.state === 'FAILED' || item.state === 'COMPLETED';
            navigation.navigate('LSPS7Order', {
                orderId: item.id,
                orderShouldUpdate
            });
            return;
        }

        if (item.model === localeString('general.withdrawalRequest')) {
            navigation.navigate('WithdrawalRequestView', {
                withdrawalRequest: item
            });
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
                            <ActivityListItem
                                item={item}
                                selectedPaymentForOrder={
                                    selectedPaymentForOrder
                                }
                                onItemPress={this.handleItemPress}
                                getRightTitleTheme={this.getRightTitleTheme}
                                order={route.params?.order}
                            />
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

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        columnGap: 10
    },
    leftCell: {
        flexGrow: 0,
        flexShrink: 1
    },
    rightCell: {
        flexGrow: 0,
        flexShrink: 1,
        textAlign: 'right'
    }
});
