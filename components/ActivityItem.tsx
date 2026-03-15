import * as React from 'react';
import { Text, View, StyleSheet } from 'react-native';

import Amount from './Amount';

import Invoice from '../models/Invoice';
import CashuInvoice from '../models/CashuInvoice';
import CashuPayment from '../models/CashuPayment';
import CashuToken from '../models/CashuToken';

import { SwapType } from '../models/Swap';
import { LSPOrderState } from '../models/LSP';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import PrivacyUtils from '../utils/PrivacyUtils';

import SwapStore from '../stores/SwapStore';

export const getActivityItemTheme = (
    item: any
):
    | 'text'
    | 'highlight'
    | 'secondaryText'
    | 'success'
    | 'warning'
    | 'warningReserve' => {
    if (item.getAmount == 0) return 'secondaryText';

    if (item.model === localeString('general.transaction')) {
        return item.getAmount.toString().includes('-') ? 'warning' : 'success';
    }
    if (item.model === localeString('views.Payment.title')) return 'warning';
    if (item.model === localeString('views.Cashu.CashuPayment.title'))
        return 'warning';

    if (item.model === localeString('views.Swaps.title')) return 'text';

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
        if (item.isExpired && !item.isPaid) return 'text';
        if (!item.isPaid) return 'highlight';
    }

    if (item.model === localeString('views.Cashu.CashuInvoice.title')) {
        if (item.isExpired && !item.isPaid) return 'text';
        if (!item.isPaid) return 'highlight';
    }

    if (item.isPaid) return 'success';
    return 'secondaryText';
};

export const getActivityItemDisplayName = (item: any): string => {
    if (item instanceof Invoice) {
        return item.isPaid
            ? item.is_amp
                ? localeString('views.Activity.youReceivedAmp')
                : localeString('views.Activity.youReceived')
            : item.isExpired
            ? localeString('views.Activity.expiredRequested')
            : item.is_amp
            ? localeString('views.Activity.requestedPaymentAmp')
            : localeString('views.Activity.requestedPayment');
    }
    if (item instanceof CashuToken) {
        return item.pendingClaim
            ? localeString('cashu.offlinePending.title')
            : item.received
            ? localeString('views.Activity.youReceived')
            : item.spent
            ? localeString('views.Activity.youSent')
            : localeString('general.unspent');
    }
    if (item instanceof CashuInvoice) {
        return item.isPaid
            ? localeString('views.Activity.youReceived')
            : item.isExpired
            ? localeString('views.Activity.expiredRequested')
            : localeString('views.Activity.requestedPayment');
    }
    if (item instanceof CashuPayment) {
        return item.isFailed
            ? localeString('views.Cashu.CashuPayment.failedPayment')
            : item.isInTransit
            ? localeString('views.Cashu.CashuPayment.inTransitPayment')
            : localeString('views.Activity.youSent');
    }
    if (item.model === localeString('views.Payment.title')) {
        return item.isFailed
            ? localeString('views.Payment.failedPayment')
            : item.isInTransit
            ? localeString('views.Payment.inTransitPayment')
            : localeString('views.Activity.youSent');
    }
    if (item.model === localeString('general.transaction')) {
        return item.getAmount == 0
            ? localeString('views.Activity.channelOperation')
            : !item.getAmount.toString().includes('-')
            ? localeString('views.Activity.youReceived')
            : localeString('views.Activity.youSent');
    }
    if (item.model === localeString('views.Swaps.title')) {
        return item.type === SwapType.Submarine
            ? localeString('views.Swaps.submarine')
            : localeString('views.Swaps.reverse');
    }
    if (item.model === 'LSPS1Order') return localeString('views.LSPS1.type');
    if (item.model === 'LSPS7Order') return localeString('views.LSPS7.type');
    return item.model;
};

export const getActivityItemSubtitle = (
    item: any,
    swapStore?: SwapStore
): React.ReactNode => {
    const renderMemo = (prefix: string, memo?: string) => (
        <Text>
            {prefix}
            {memo ? ': ' : ''}
            {memo ? (
                <Text style={{ fontStyle: 'italic' }}>
                    {PrivacyUtils.sensitiveValue({
                        input: memo,
                        condenseAtLength: 100
                    })?.toString()}
                </Text>
            ) : (
                ''
            )}
        </Text>
    );

    if (item instanceof Invoice) {
        return renderMemo(
            item.isPaid
                ? localeString('general.lightning')
                : localeString('views.PaymentRequest.title'),
            item.getKeysendMessageOrMemo
        );
    }
    if (item instanceof CashuToken) {
        return renderMemo(localeString('cashu.token'), item.getMemo);
    }
    if (item instanceof CashuInvoice) {
        return renderMemo(
            item.isPaid
                ? localeString('general.cashu')
                : localeString('views.Cashu.CashuInvoice.title'),
            item.getMemo
        );
    }
    if (item instanceof CashuPayment) {
        return renderMemo(
            localeString('general.cashu'),
            item.getKeysendMessageOrMemo
        );
    }
    if (item.model === localeString('views.Payment.title')) {
        return renderMemo(
            localeString('general.lightning'),
            item.getKeysendMessageOrMemo
        );
    }
    if (item.model === localeString('general.transaction')) {
        return item.num_confirmations == 0
            ? `${localeString('general.onchain')}: ${localeString(
                  'general.unconfirmed'
              )}`
            : localeString('general.onchain');
    }
    if (item.model === localeString('views.Swaps.title')) {
        return (
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
                {item?.status && swapStore && (
                    <>
                        {'\n'}
                        {`${localeString(
                            'views.Channel.status'
                        )}: ${swapStore.formatStatus(item.status)}`}
                    </>
                )}
            </Text>
        );
    }
    if (item.model === 'LSPS1Order') {
        return `${localeString('general.state')}: ${item.state
            .toLowerCase()
            .replace(/^\w/, (c: string) => c.toUpperCase())}`;
    }
    if (item.model === 'LSPS7Order') {
        return `${localeString('general.state')}: ${item.state
            .toLowerCase()
            .replace(/^\w/, (c: string) => c.toUpperCase())}`;
    }
    return item.model;
};

interface ActivityItemProps {
    item: any;
    onPress?: () => void;
    selectedPaymentForOrder?: any;
    order?: boolean;
    swapStore?: SwapStore;
}

const ActivityItem: React.FC<ActivityItemProps> = ({
    item,
    onPress,
    selectedPaymentForOrder,
    order,
    swapStore
}) => {
    const displayName = getActivityItemDisplayName(item);
    const subTitle = getActivityItemSubtitle(item, swapStore);
    const note = item.getNote;
    const theme = getActivityItemTheme(item);
    const isSelected = item === selectedPaymentForOrder;

    return (
        <View style={styles.container}>
            {onPress ? (
                <View style={styles.content}>
                    <ActivityItemContent
                        displayName={displayName}
                        subTitle={subTitle}
                        note={note}
                        item={item}
                        theme={theme}
                        isSelected={isSelected}
                        order={order}
                    />
                </View>
            ) : (
                <View style={styles.content}>
                    <ActivityItemContent
                        displayName={displayName}
                        subTitle={subTitle}
                        note={note}
                        item={item}
                        theme={theme}
                        isSelected={isSelected}
                        order={order}
                    />
                </View>
            )}
        </View>
    );
};

const ActivityItemContent: React.FC<{
    displayName: string;
    subTitle: React.ReactNode;
    note: string;
    item: any;
    theme: string;
    isSelected: boolean;
    order?: boolean;
}> = ({ displayName, subTitle, note, item, theme, isSelected, order }) => (
    <>
        <View style={styles.row}>
            <Text
                style={{
                    ...styles.leftCell,
                    fontWeight: '600',
                    color: isSelected
                        ? themeColor('highlight')
                        : themeColor('text'),
                    fontFamily: 'PPNeueMontreal-Book'
                }}
                numberOfLines={1}
            >
                {displayName}
            </Text>
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
                <Amount sats={item.getAmount} sensitive color={theme} />
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
                            color={theme}
                            fee
                            roundAmount
                        />
                    </>
                )}
            </View>
        </View>
        <View style={styles.row}>
            <Text
                style={{
                    ...styles.leftCell,
                    color: isSelected
                        ? themeColor('highlight')
                        : themeColor('secondaryText'),
                    fontFamily: 'PPNeueMontreal-Book'
                }}
                numberOfLines={1}
                ellipsizeMode="tail"
            >
                {subTitle}
            </Text>
            <Text
                style={{
                    ...styles.rightCell,
                    color: themeColor('secondaryText'),
                    fontFamily: 'PPNeueMontreal-Book'
                }}
            >
                {order ? item.getDisplayTimeOrder : item.getDisplayTimeShort}
            </Text>
        </View>
        {note && (
            <View style={styles.row}>
                <Text
                    style={{
                        color: themeColor('text'),
                        fontFamily: 'Lato-Regular',
                        flexShrink: 0
                    }}
                    numberOfLines={1}
                >
                    {localeString('general.note')}
                </Text>
                <Text
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
                </Text>
            </View>
        )}
    </>
);

export default React.memo(ActivityItem);

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 15,
        paddingVertical: 8
    },
    content: {
        width: '100%'
    },
    row: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        columnGap: 10
    },
    leftCell: {
        flex: 1,
        flexShrink: 1
    },
    rightCell: {
        flexShrink: 0,
        textAlign: 'right'
    }
});
