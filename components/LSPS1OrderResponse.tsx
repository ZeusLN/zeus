import * as React from 'react';
import { inject, observer } from 'mobx-react';
import { ScrollView, View } from 'react-native';
import moment from 'moment';

import Screen from './Screen';
import KeyValue from './KeyValue';
import Amount from './Amount';
import Button from './Button';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

import InvoicesStore from '../stores/InvoicesStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import FiatStore from '../stores/FiatStore';

interface LSPS1OrderResponseProps {
    navigation: any;
    orderResponse: any;
    InvoicesStore: InvoicesStore;
    NodeInfoStore: NodeInfoStore;
    FiatStore: FiatStore;
    orderView: boolean;
}

@inject('InvoicesStore', 'NodeInfoStore', 'FiatStore')
@observer
export default class LSPS1OrderResponse extends React.Component<
    LSPS1OrderResponseProps,
    null
> {
    render() {
        const {
            orderResponse,
            InvoicesStore,
            NodeInfoStore,
            FiatStore,
            orderView
        } = this.props;
        const { testnet } = NodeInfoStore;
        const payment = orderResponse?.payment;
        const channel = orderResponse?.channel;
        return (
            <Screen>
                <ScrollView>
                    <View style={{ paddingHorizontal: 20 }}>
                        {orderResponse?.lsp_balance_sat && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.LSPS1.lspBalance'
                                )}
                                value={
                                    <Amount
                                        sats={orderResponse?.lsp_balance_sat}
                                        sensitive
                                        toggleable
                                    />
                                }
                            />
                        )}
                        {orderResponse?.client_balance_sat && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.LSPS1.clientBalance'
                                )}
                                value={
                                    <Amount
                                        sats={orderResponse?.client_balance_sat}
                                        sensitive
                                        toggleable
                                    />
                                }
                            />
                        )}
                        {orderResponse?.lsp_balance_sat &&
                            orderResponse?.client_balance_sat && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.LSPS1.totalBalance'
                                    )}
                                    value={
                                        <Amount
                                            sats={
                                                orderResponse?.client_balance_sat +
                                                orderResponse?.lsp_balance_sat
                                            }
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
                                value={FiatStore.numberWithCommas(
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
                        {orderResponse?.created_at && (
                            <KeyValue
                                keyValue={localeString('general.createdAt')}
                                value={moment(orderResponse?.createdAt).format(
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

                        {orderResponse?.order_id && (
                            <KeyValue
                                keyValue={localeString('views.LSPS1.orderId')}
                                value={orderResponse?.order_id}
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
                        <KeyValue
                            keyValue={localeString('views.Payment.title')}
                        />
                        {payment?.fee_total_sat && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Transaction.totalFees'
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
                        {payment?.state && (
                            <KeyValue
                                keyValue={localeString('general.state')}
                                value={payment?.state}
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
                        {payment?.order_total_sat && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.LSPS1.totalOrderValue'
                                )}
                                value={
                                    <Amount
                                        sats={payment.order_total_sat}
                                        toggleable
                                        sensitive
                                    />
                                }
                            />
                        )}
                        {channel && (
                            <>
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Channel.title'
                                    )}
                                />
                                <KeyValue
                                    keyValue={localeString('general.expiresAt')}
                                    value={moment(channel?.expires_at).format(
                                        'MMM Do YYYY, h:mm:ss a'
                                    )}
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
                            </>
                        )}
                        {orderResponse?.order_state === 'CREATED' && orderView && (
                            <Button
                                title={localeString('views.LSPS1.makePayment')}
                                containerStyle={{
                                    paddingVertical: 20
                                }}
                                onPress={() => {
                                    InvoicesStore.getPayReq(
                                        payment.lightning_invoice ||
                                            payment.bolt11_invoice
                                    )
                                        .then(() => {
                                            this.props.navigation.navigate(
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
                        )}
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}
