import * as React from 'react';
import { inject, observer } from 'mobx-react';
import { ScrollView, View } from 'react-native';
import moment from 'moment';
import BigNumber from 'bignumber.js';

import Screen from '../../components/Screen';
import KeyValue from '../../components/KeyValue';
import Amount from '../../components/Amount';
import Button from '../../components/Button';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { numberWithCommas } from '../../utils/UnitsUtils';
import UrlUtils from '../../utils/UrlUtils';

import InvoicesStore from '../../stores/InvoicesStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import { ChannelItem } from '../../components/Channels/ChannelItem';

interface LSPS1OrderResponseProps {
    navigation: any;
    orderResponse: any;
    InvoicesStore?: InvoicesStore;
    NodeInfoStore?: NodeInfoStore;
    orderView: boolean;
}

@inject('InvoicesStore', 'NodeInfoStore')
@observer
export default class LSPS1OrderResponse extends React.Component<
    LSPS1OrderResponseProps,
    {}
> {
    render() {
        const {
            orderResponse,
            InvoicesStore,
            NodeInfoStore,
            orderView,
            navigation
        } = this.props;
        const { testnet } = NodeInfoStore!;
        const payment = orderResponse?.payment;
        const channel = orderResponse?.channel;
        return (
            <Screen>
                <ScrollView>
                    <View style={{ paddingHorizontal: 20 }}>
                        <ChannelItem
                            localBalance={orderResponse?.client_balance_sat}
                            remoteBalance={orderResponse?.lsp_balance_sat}
                            title={localeString('views.LSPS1.yourBalance')}
                            secondTitle={localeString(
                                'views.LSPS1.receiveLimit'
                            )}
                            noBorder
                            highlightLabels
                        />
                        {orderResponse?.order_id && (
                            <KeyValue
                                keyValue={localeString('views.LSPS1.orderId')}
                                value={orderResponse?.order_id}
                            />
                        )}
                        {orderResponse?.lsp_balance_sat &&
                            orderResponse?.client_balance_sat && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Channel.channelBalance'
                                    )}
                                    value={
                                        <Amount
                                            sats={new BigNumber(
                                                orderResponse?.client_balance_sat
                                            )
                                                .plus(
                                                    orderResponse?.lsp_balance_sat
                                                )
                                                .toNumber()}
                                            sensitive
                                            toggleable
                                        />
                                    }
                                />
                            )}
                        {orderResponse?.announce_channel && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.OpenChannel.announceChannel'
                                )}
                                value={
                                    orderResponse?.announce_channel
                                        ? localeString('general.true')
                                        : localeString('general.false')
                                }
                                color={
                                    orderResponse?.announce_channel
                                        ? 'green'
                                        : '#808000'
                                }
                            />
                        )}
                        {orderResponse?.channel_expiry_blocks && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.LSPS1.channelExpiryBlocks'
                                )}
                                value={numberWithCommas(
                                    orderResponse?.channel_expiry_blocks
                                )}
                            />
                        )}

                        {orderResponse?.funding_confirms_within_blocks && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.LSPS1.confirmWithinBlocks'
                                )}
                                value={
                                    orderResponse?.funding_confirms_within_blocks
                                }
                            />
                        )}
                        {orderResponse?.order_state && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.LSPS1.orderState'
                                )}
                                value={orderResponse?.order_state}
                                color={
                                    orderResponse?.order_state === 'CREATED'
                                        ? 'orange'
                                        : orderResponse?.order_state ===
                                          'COMPLETED'
                                        ? 'green'
                                        : orderResponse?.order_state ===
                                          'FAILED'
                                        ? 'red'
                                        : ''
                                }
                            />
                        )}
                        {orderResponse?.created_at && (
                            <KeyValue
                                keyValue={localeString('general.createdAt')}
                                value={moment(orderResponse?.created_at).format(
                                    'MMM Do YYYY, h:mm:ss a'
                                )}
                            />
                        )}
                        {orderResponse?.expires_at && (
                            <KeyValue
                                keyValue={localeString('general.expiresAt')}
                                value={moment(orderResponse?.expires_at).format(
                                    'MMM Do YYYY, h:mm:ss a'
                                )}
                            />
                        )}
                        {/* Legacy format */}
                        {payment && !payment.bolt11 && !payment.onchain && (
                            <>
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Payment.title'
                                    )}
                                />
                                {payment?.state && (
                                    <KeyValue
                                        keyValue={localeString('general.state')}
                                        value={payment?.state}
                                    />
                                )}
                                {payment?.order_total_sat && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.LSPS1.orderTotal'
                                        )}
                                        value={
                                            <Amount
                                                sats={payment?.order_total_sat}
                                                toggleable
                                                sensitive
                                            />
                                        }
                                    />
                                )}
                                {payment?.fee_total_sat && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.LSPS1.feeTotal'
                                        )}
                                        value={
                                            <Amount
                                                sats={payment?.fee_total_sat}
                                                sensitive
                                                toggleable
                                            />
                                        }
                                    />
                                )}
                                {(payment?.lightning_invoice ||
                                    payment?.bolt11_invoice) && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'general.lightningInvoice'
                                        )}
                                        value={
                                            payment?.lightning_invoice ||
                                            payment?.bolt11_invoice
                                        }
                                    />
                                )}
                                {payment?.min_fee_for_0conf && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.LSPS1.miniFeeFor0Conf'
                                        )}
                                        value={payment?.min_fee_for_0conf}
                                    />
                                )}
                                {payment?.min_onchain_payment_confirmations && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.LSPS1.minOnchainPaymentConfirmations'
                                        )}
                                        value={
                                            payment?.min_onchain_payment_confirmations
                                        }
                                    />
                                )}
                                {payment?.onchain_address && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Settings.AddContact.onchainAddress'
                                        )}
                                        value={payment?.onchain_address}
                                    />
                                )}
                                {payment?.onchain_payment && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.LSPS1.onchainPayment'
                                        )}
                                        value={payment?.onchain_payment}
                                    />
                                )}
                            </>
                        )}
                        {/* BOLT11 */}
                        {payment && payment.bolt11 && (
                            <>
                                <KeyValue
                                    keyValue={localeString(
                                        'views.LSPS1.bolt11Payment'
                                    )}
                                />
                                {payment?.bolt11.state && (
                                    <KeyValue
                                        keyValue={localeString('general.state')}
                                        value={payment?.bolt11.state}
                                    />
                                )}
                                {payment?.bolt11?.order_total_sat && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.LSPS1.orderTotal'
                                        )}
                                        value={
                                            <Amount
                                                sats={
                                                    payment?.bolt11
                                                        ?.order_total_sat
                                                }
                                                toggleable
                                                sensitive
                                            />
                                        }
                                    />
                                )}
                                {payment?.bolt11?.fee_total_sat &&
                                    payment?.bolt11?.fee_total_sat !==
                                        payment?.bolt11?.order_total_sat && (
                                        <KeyValue
                                            keyValue={localeString(
                                                'views.LSPS1.feeTotal'
                                            )}
                                            value={
                                                <Amount
                                                    sats={
                                                        payment?.bolt11
                                                            ?.fee_total_sat
                                                    }
                                                    sensitive
                                                    toggleable
                                                />
                                            }
                                        />
                                    )}
                                {payment?.bolt11.expires_at && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'general.expiresAt'
                                        )}
                                        value={moment(
                                            payment?.bolt11.expires_at
                                        ).format('MMM Do YYYY, h:mm:ss a')}
                                    />
                                )}
                                {payment?.bolt11.invoice && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Invoice.title'
                                        )}
                                        value={payment?.bolt11.invoice}
                                    />
                                )}
                            </>
                        )}
                        {/* On-chain */}
                        {payment && payment.onchain && (
                            <>
                                <KeyValue
                                    keyValue={localeString(
                                        'iews.LSPS1.onchainPayment'
                                    )}
                                />
                                {payment?.onchain.fee_total_sat && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Transaction.totalFees'
                                        )}
                                        value={
                                            <Amount
                                                sats={
                                                    payment?.onchain
                                                        .fee_total_sat
                                                }
                                                sensitive
                                                toggleable
                                            />
                                        }
                                    />
                                )}
                                {payment?.onchain.order_total_sat && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.LSPS1.totalOrderValue'
                                        )}
                                        value={
                                            <Amount
                                                sats={
                                                    payment?.onchain
                                                        .order_total_sat
                                                }
                                                toggleable
                                                sensitive
                                            />
                                        }
                                    />
                                )}
                                {payment?.onchain.expires_at && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'general.expiresAt'
                                        )}
                                        value={moment(
                                            payment?.onchain.expires_at
                                        ).format('MMM Do YYYY, h:mm:ss a')}
                                    />
                                )}
                                {payment?.onchain.address && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'general.address'
                                        )}
                                        value={payment?.onchain.address}
                                    />
                                )}
                                {payment?.onchain.min_fee_for_0conf && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.LSPS1.miniFeeFor0Conf'
                                        )}
                                        value={
                                            payment?.onchain.min_fee_for_0conf
                                        }
                                    />
                                )}
                                {payment?.onchain
                                    .min_onchain_payment_confirmations && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.LSPS1.minOnchainPaymentConfirmations'
                                        )}
                                        value={
                                            payment?.onchain
                                                .min_onchain_payment_confirmations
                                        }
                                    />
                                )}
                            </>
                        )}
                        {channel && (
                            <>
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Channel.title'
                                    )}
                                />
                                <KeyValue
                                    keyValue={localeString(
                                        'views.LSPS1.fundingOutpoint'
                                    )}
                                    value={channel?.funding_outpoint}
                                    sensitive
                                    color={themeColor('highlight')}
                                    mempoolLink={() =>
                                        UrlUtils.goToBlockExplorerTXID(
                                            channel?.funding_outpoint,
                                            testnet
                                        )
                                    }
                                />
                                <KeyValue
                                    keyValue={localeString(
                                        'views.LSPS1.fundedAt'
                                    )}
                                    value={moment(channel?.funded_at).format(
                                        'MMM Do YYYY, h:mm:ss a'
                                    )}
                                />
                                <KeyValue
                                    keyValue={localeString('general.expiresAt')}
                                    value={moment(channel?.expires_at).format(
                                        'MMM Do YYYY, h:mm:ss a'
                                    )}
                                />
                            </>
                        )}
                        {orderResponse?.order_state === 'CREATED' && orderView && (
                            <>
                                {(payment.bolt11?.invoice ||
                                    payment.lightning_invoice ||
                                    payment.bolt11_invoice) && (
                                    <>
                                        <Button
                                            title={
                                                payment.onchain
                                                    ? localeString(
                                                          'views.LSPS1.makePaymentLN'
                                                      )
                                                    : localeString(
                                                          'views.LSPS1.makePayment'
                                                      )
                                            }
                                            containerStyle={{
                                                paddingVertical: 20
                                            }}
                                            onPress={() => {
                                                InvoicesStore!
                                                    .getPayReq(
                                                        payment.bolt11
                                                            ?.invoice ||
                                                            payment.lightning_invoice ||
                                                            payment.bolt11_invoice
                                                    )
                                                    .then(() => {
                                                        navigation.navigate(
                                                            'PaymentRequest',
                                                            {}
                                                        );
                                                    })
                                                    .catch((error: any) =>
                                                        console.error(
                                                            'Error fetching payment request:',
                                                            error
                                                        )
                                                    );
                                            }}
                                        />
                                    </>
                                )}
                                {payment.onchain?.address &&
                                    payment.onchain?.fee_total_sat && (
                                        <>
                                            <Button
                                                title={
                                                    payment.bolt11
                                                        ? localeString(
                                                              'views.LSPS1.makePaymentOnchain'
                                                          )
                                                        : localeString(
                                                              'views.LSPS1.makePayment'
                                                          )
                                                }
                                                containerStyle={{
                                                    paddingVertical: 20
                                                }}
                                                onPress={() => {
                                                    navigation.navigate(
                                                        'Send',
                                                        {
                                                            destination:
                                                                payment.onchain
                                                                    ?.address,
                                                            amount: payment
                                                                .onchain
                                                                ?.fee_total_sat,
                                                            transactionType:
                                                                'On-chain'
                                                        }
                                                    );
                                                }}
                                            />
                                        </>
                                    )}
                            </>
                        )}
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}
