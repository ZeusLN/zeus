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
import { Button, Icon, ListItem } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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

import ActivityStore, { DEFAULT_FILTERS } from '../../stores/ActivityStore';
import FiatStore from '../../stores/FiatStore';
import PosStore from '../../stores/PosStore';
import SettingsStore from '../../stores/SettingsStore';
import SwapStore from '../../stores/SwapStore';

import Filter from '../../assets/images/SVG/Filter On.svg';
import EcashSvg from '../../components/SVG/EcashSvg';
import LightningSvg from '../../components/SVG/LightningSvg';
import OnChainSvg from '../../components/SVG/OnChainSvg';

import Invoice from '../../models/Invoice';
import CashuInvoice from '../../models/CashuInvoice';
import CashuPayment from '../../models/CashuPayment';
import CashuToken from '../../models/CashuToken';

import { SwapType } from '../../models/Swap';

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
    swapStore: SwapStore;
}

const activityIconSize = 21;
const layerIconSize = 18;

const ActivityIcon = ({ name, color }: { name: string; color: string }) => (
    <Icon
        name={name}
        size={activityIconSize}
        color={color}
        underlayColor="transparent"
        accessible={false}
        importantForAccessibility="no"
    />
);

const LayerIcon = ({ layer }: { layer: 'lightning' | 'onchain' | 'cashu' }) => {
    if (layer === 'lightning') {
        return (
            <LightningSvg
                width={layerIconSize}
                height={layerIconSize}
                circle={false}
            />
        );
    }

    if (layer === 'onchain') {
        return (
            <OnChainSvg
                width={layerIconSize}
                height={layerIconSize}
                circle={false}
            />
        );
    }

    return (
        <EcashSvg width={layerIconSize} height={layerIconSize} circle={false} />
    );
};

const ActivityText = ({
    children,
    italic = false
}: {
    children: React.ReactNode;
    italic?: boolean;
}) => (
    <Text
        style={{
            color: themeColor('secondaryText'),
            fontFamily: 'PPNeueMontreal-Book',
            fontStyle: italic ? 'italic' : 'normal'
        }}
    >
        {children}
    </Text>
);

const formatOrderState = (state: string) =>
    state.toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase());

const stateSubtitle = (state: string) => (
    <ActivityText>
        {localeString('general.label_value', {
            label: localeString('general.state'),
            value: formatOrderState(state)
        })}
    </ActivityText>
);

const ActivityListItem = observer(
    ({
        item,
        selectedPaymentForOrder,
        onItemPress,
        getRightTitleTheme,
        order,
        swapStore
    }: ActivityListItemProps) => {
        const note = item.getNote;
        let displayName: React.ReactNode = item.model;
        let displayNameLabel = item.model;
        let showDisplayName = true;
        let activityIconName = 'receipt';
        let activityIconColor = themeColor('secondaryText');
        let subTitle: React.ReactNode = item.model;

        const setTitle = ({
            label,
            icon,
            color,
            showLabel = true
        }: {
            label: string;
            icon: string;
            color: string;
            showLabel?: boolean;
        }) => {
            displayName = label;
            displayNameLabel = label;
            activityIconName = icon;
            activityIconColor = color;
            showDisplayName = showLabel;
        };

        const layerSubtitle = ({
            layer,
            label,
            detail,
            status
        }: {
            layer: 'lightning' | 'onchain' | 'cashu';
            label: string;
            detail?: string;
            status?: string;
        }) => (
            <View
                style={styles.iconTextRow}
                accessibilityLabel={[
                    label,
                    status,
                    detail
                        ? PrivacyUtils.sensitiveValue({
                              input: detail,
                              condenseAtLength: 100
                          })?.toString()
                        : undefined
                ]
                    .filter(Boolean)
                    .join(': ')}
            >
                <LayerIcon layer={layer} />
                {status ? (
                    <ActivityText>{status}</ActivityText>
                ) : detail ? (
                    <>
                        <ActivityText>:</ActivityText>
                        <ActivityText italic>
                            {PrivacyUtils.sensitiveValue({
                                input: detail,
                                condenseAtLength: 100
                            })?.toString()}
                        </ActivityText>
                    </>
                ) : null}
            </View>
        );

        if (item instanceof Invoice) {
            const label = item.isPaid
                ? item.is_amp
                    ? localeString('views.Activity.youReceivedAmp')
                    : localeString('views.Activity.youReceived')
                : item.isExpired
                ? localeString('views.Activity.expiredRequested')
                : item.is_amp
                ? localeString('views.Activity.requestedPaymentAmp')
                : localeString('views.Activity.requestedPayment');
            setTitle({
                label,
                icon: item.isPaid
                    ? 'call-received'
                    : item.isExpired
                    ? 'cancel'
                    : 'receipt',
                color: item.isPaid
                    ? themeColor('success')
                    : item.isExpired
                    ? themeColor('secondaryText')
                    : themeColor('highlight'),
                showLabel: !item.isPaid
            });
            const keysendMessageOrMemo = item.getKeysendMessageOrMemo;
            subTitle = layerSubtitle({
                layer: 'lightning',
                label: item.isPaid
                    ? localeString('general.lightning')
                    : localeString('views.PaymentRequest.title'),
                detail: keysendMessageOrMemo
            });
        } else if (item instanceof CashuToken) {
            const label = item.pendingClaim
                ? localeString('cashu.offlinePending.title')
                : item.received
                ? localeString('views.Activity.youReceived')
                : item.spent
                ? localeString('views.Activity.youSent')
                : localeString('general.unspent');
            setTitle({
                label,
                icon: item.pendingClaim
                    ? 'schedule'
                    : item.received
                    ? 'call-received'
                    : item.spent
                    ? 'call-made'
                    : 'radio-button-unchecked',
                color: item.pendingClaim
                    ? themeColor('highlight')
                    : item.received
                    ? themeColor('success')
                    : item.spent
                    ? themeColor('warning')
                    : themeColor('secondaryText'),
                showLabel: item.pendingClaim || (!item.received && !item.spent)
            });
            const memo = item.getMemo;
            subTitle = layerSubtitle({
                layer: 'cashu',
                label: localeString('cashu.token'),
                detail: memo
            });
        } else if (item instanceof CashuInvoice) {
            const label = item.isPaid
                ? localeString('views.Activity.youReceived')
                : item.isExpired
                ? localeString('views.Activity.expiredRequested')
                : localeString('views.Activity.requestedPayment');
            setTitle({
                label,
                icon: item.isPaid
                    ? 'call-received'
                    : item.isExpired
                    ? 'cancel'
                    : 'receipt',
                color: item.isPaid
                    ? themeColor('success')
                    : item.isExpired
                    ? themeColor('secondaryText')
                    : themeColor('highlight'),
                showLabel: !item.isPaid
            });
            const memo = item.getMemo;
            subTitle = layerSubtitle({
                layer: 'cashu',
                label: item.isPaid
                    ? localeString('general.cashu')
                    : localeString('views.Cashu.CashuInvoice.title'),
                detail: memo
            });
        } else if (item instanceof CashuPayment) {
            const label = item.isFailed
                ? localeString('views.Cashu.CashuPayment.failedPayment')
                : item.isInTransit
                ? localeString('views.Cashu.CashuPayment.inTransitPayment')
                : localeString('views.Activity.youSent');
            setTitle({
                label,
                icon: item.isFailed
                    ? 'error-outline'
                    : item.isInTransit
                    ? 'schedule'
                    : 'call-made',
                color: item.isFailed
                    ? themeColor('secondaryText')
                    : item.isInTransit
                    ? themeColor('highlight')
                    : themeColor('warning'),
                showLabel: item.isFailed || item.isInTransit
            });
            const keysendMessageOrMemo = item.getKeysendMessageOrMemo;
            subTitle = layerSubtitle({
                layer: 'cashu',
                label: localeString('general.cashu'),
                detail: keysendMessageOrMemo
            });
        } else if (item.model === localeString('views.Payment.title')) {
            const label = item.isFailed
                ? localeString('views.Payment.failedPayment')
                : item.isInTransit
                ? localeString('views.Payment.inTransitPayment')
                : localeString('views.Activity.youSent');
            setTitle({
                label,
                icon: item.isFailed
                    ? 'error-outline'
                    : item.isInTransit
                    ? 'schedule'
                    : 'call-made',
                color: item.isFailed
                    ? themeColor('secondaryText')
                    : item.isInTransit
                    ? themeColor('highlight')
                    : themeColor('warning'),
                showLabel: item.isFailed || item.isInTransit
            });
            const keysendMessageOrMemo = item.getKeysendMessageOrMemo;
            subTitle = layerSubtitle({
                layer: 'lightning',
                label: localeString('general.lightning'),
                detail: keysendMessageOrMemo
            });
        } else if (item.model === localeString('general.transaction')) {
            const isChannelOperation = item.getAmount == 0;
            const isReceived = !item.getAmount.toString().includes('-');
            const label = isChannelOperation
                ? localeString('views.Activity.channelOperation')
                : isReceived
                ? localeString('views.Activity.youReceived')
                : localeString('views.Activity.youSent');
            setTitle({
                label,
                icon: isChannelOperation
                    ? 'swap-horiz'
                    : isReceived
                    ? 'call-received'
                    : 'call-made',
                color: isChannelOperation
                    ? themeColor('secondaryText')
                    : isReceived
                    ? themeColor('success')
                    : themeColor('warning'),
                showLabel: isChannelOperation
            });
            subTitle = layerSubtitle({
                layer: 'onchain',
                label: localeString('general.onchain'),
                status:
                    item.num_confirmations == 0
                        ? localeString('general.unconfirmed')
                        : undefined
            });
        } else if (item.model === localeString('views.Swaps.title')) {
            const label =
                item.type === SwapType.Submarine
                    ? localeString('views.Swaps.submarine')
                    : localeString('views.Swaps.reverse');
            setTitle({
                label,
                icon: 'swap-horiz',
                color: themeColor('text')
            });
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
                    {item?.status && (
                        <>
                            {'\n'}
                            {`${localeString(
                                'general.status'
                            )}: ${swapStore.formatStatus(item.status)}`}
                        </>
                    )}
                </Text>
            );
        } else if (item.model === 'LSPS1Order') {
            setTitle({
                label: localeString('views.LSPS1.type'),
                icon: 'account-tree',
                color: themeColor('highlight')
            });
            subTitle = stateSubtitle(item.state);
        } else if (item.model === 'LSPS7Order') {
            setTitle({
                label: localeString('views.LSPS7.type'),
                icon: 'account-tree',
                color: themeColor('highlight')
            });
            subTitle = stateSubtitle(item.state);
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
                        <View
                            style={{
                                ...styles.leftCell,
                                ...styles.iconTextRow
                            }}
                            accessibilityLabel={displayNameLabel}
                        >
                            <ActivityIcon
                                name={activityIconName}
                                color={
                                    item === selectedPaymentForOrder
                                        ? themeColor('highlight')
                                        : activityIconColor
                                }
                            />
                            {showDisplayName && (
                                <ListItem.Title
                                    style={{
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
                            )}
                        </View>

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
                                sats={
                                    item.isReverseSwap
                                        ? swapStore?.getReverseSwapReceiveAmount(
                                              item.getAmount,
                                              item.claimMinerFee
                                          )
                                        : item.getAmount
                                }
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
                        <View
                            style={{
                                ...styles.leftCell
                            }}
                        >
                            {subTitle}
                        </View>

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
                                {PrivacyUtils.sensitiveValue({
                                    input: note,
                                    condenseAtLength: 100
                                })?.toString()}
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

    // TODO this feels like an odd place to do all this deciding
    // TODO on-chain has "-" sign but lightning doesn't?
    getRightTitleTheme = (item: any) => {
        if (item.getAmount == 0) return 'secondaryText';

        if (item.model === localeString('general.transaction')) {
            if (item.getAmount.toString().includes('-')) return 'warning';
            return 'success';
        }

        if (item.model === localeString('views.Payment.title')) {
            if (item.isFailed) return 'secondaryText';
            return 'warning';
        }

        if (item.model === localeString('views.Cashu.CashuPayment.title')) {
            if (item.isFailed) return 'secondaryText';
            return 'warning';
        }

        if (item.model === localeString('views.Swaps.title')) {
            return 'text';
        }

        if (item.model === 'LSPS1Order' || item.model === 'LSPS7Order') {
            switch (item.state) {
                case LSPOrderState.CREATED:
                    return 'highlight';
                case LSPOrderState.COMPLETED:
                    return 'success';
                case LSPOrderState.FAILED:
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
                            <ActivityListItem
                                item={item}
                                selectedPaymentForOrder={
                                    selectedPaymentForOrder
                                }
                                onItemPress={this.handleItemPress}
                                getRightTitleTheme={this.getRightTitleTheme}
                                order={route.params?.order}
                                swapStore={SwapStore}
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
        flexShrink: 1,
        minWidth: 0
    },
    rightCell: {
        flexGrow: 0,
        flexShrink: 1,
        textAlign: 'right'
    },
    iconTextRow: {
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 6,
        minHeight: 24,
        minWidth: 0
    }
});
