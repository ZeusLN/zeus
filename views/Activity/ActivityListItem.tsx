import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ListItem } from '@rneui/themed';
import { observer } from 'mobx-react';

import Amount from '../../components/Amount';

import { getRightTitleTheme } from '../../utils/ActivityUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import PrivacyUtils from '../../utils/PrivacyUtils';

import SwapStore from '../../stores/SwapStore';

import Invoice from '../../models/Invoice';
import CashuInvoice from '../../models/CashuInvoice';
import CashuPayment from '../../models/CashuPayment';
import CashuToken from '../../models/CashuToken';

import { SwapType } from '../../models/Swap';

export interface OrderItem {
    id: string;
    total_money: {
        amount: number;
    };
}

export interface Order {
    item: OrderItem;
}

export interface ActivityListItemProps {
    item: any;
    selectedPaymentForOrder?: any;
    onItemPress: (item: any) => void;
    order?: Order;
    swapStore: SwapStore;
}

const ActivityListItem = observer(
    ({
        item,
        selectedPaymentForOrder,
        onItemPress,
        order,
        swapStore
    }: ActivityListItemProps) => {
        const note = item.getNote;
        let displayName = item.model;
        let subTitle = item.model;

        if (item instanceof Invoice) {
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
                            {PrivacyUtils.sensitiveValue({
                                input: keysendMessageOrMemo,
                                condenseAtLength: 100
                            })?.toString()}
                        </Text>
                    ) : (
                        ''
                    )}
                </Text>
            );
        } else if (item instanceof CashuToken) {
            displayName = item.pendingClaim
                ? localeString('cashu.offlinePending.title')
                : item.received
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
                            {PrivacyUtils.sensitiveValue({
                                input: keysendMessageOrMemo,
                                condenseAtLength: 100
                            })?.toString()}
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
                            {PrivacyUtils.sensitiveValue({
                                input: keysendMessageOrMemo,
                                condenseAtLength: 100
                            })?.toString()}
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
            displayName = localeString('views.LSPS1.type');
            subTitle = `${localeString('general.state')}: ${item.state
                .toLowerCase()
                .replace(/^\w/, (c: string) => c.toUpperCase())}`;
        } else if (item.model === 'LSPS7Order') {
            displayName = localeString('views.LSPS7.type');
            subTitle = `${localeString('general.state')}: ${item.state
                .toLowerCase()
                .replace(/^\w/, (c: string) => c.toUpperCase())}`;
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

export default ActivityListItem;

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
