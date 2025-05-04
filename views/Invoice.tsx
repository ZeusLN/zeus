import * as React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { inject } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import SettingsStore from '../stores/SettingsStore';

import Amount from '../components/Amount';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';
import Button from '../components/Button';
import { Row } from '../components/layout/Row';
import AttestationButton from '../components/AttestationButton';

import Invoice from '../models/Invoice';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import EditNotes from '../assets/images/SVG/Pen.svg';
import QR from '../assets/images/SVG/QR.svg';
import Storage from '../storage';

interface InvoiceProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore?: SettingsStore;
    route: Route<'InvoiceView', { invoice: Invoice }>;
}

interface InvoiceState {
    storedNote: string;
    invreq_time: string | null;
}

@inject('SettingsStore', 'InvoicesStore')
export default class InvoiceView extends React.Component<
    InvoiceProps,
    InvoiceState
> {
    state = {
        storedNote: '',
        invreq_time: null
    };

    async componentDidMount() {
        const { route } = this.props;
        const invoice = route.params?.invoice;

        if (invoice.bolt12) {
            const timestamp = await Storage.getItem(
                `withdrawalRequest_${invoice.bolt12}`
            );
            if (!timestamp) {
                this.setState({
                    storedNote: invoice.getNote
                });
            } else {
                const dateTime = new Date(Number(JSON.parse(timestamp)));
                const invreq_time = dateTime.toString();
                this.setState({
                    storedNote: invoice.getNote,
                    invreq_time
                });
            }
        }
    }

    render() {
        const { navigation, SettingsStore, route } = this.props;
        const { storedNote } = this.state;
        const invoice = route.params?.invoice;
        const locale = SettingsStore?.settings.locale;
        invoice.determineFormattedOriginalTimeUntilExpiry(locale);
        invoice.determineFormattedRemainingTimeUntilExpiry(locale);
        const {
            fallback_addr,
            getRHash,
            isPaid,
            getKeysendMessage,
            getMemo,
            getNameDescReceiver,
            receipt,
            formattedCreationDate,
            getDescriptionHash,
            payment_hash,
            getRPreimage,
            cltv_expiry,
            formattedOriginalTimeUntilExpiry,
            formattedTimeUntilExpiry,
            getPaymentRequest,
            is_amp,
            value,
            getNoteKey,
            getAmount,
            invreq_id,
            active,
            single_use,
            used,
            bolt12
        } = invoice;
        const privateInvoice = invoice.private;

        const QRButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('QR', {
                        value: invreq_id
                            ? bolt12
                            : `lightning:${getPaymentRequest}`,
                        satAmount: getAmount
                    })
                }
            >
                <QR fill={themeColor('text')} style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
        );
        const EditNotesButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('AddNotes', {
                        noteKey: getNoteKey
                    })
                }
                style={{ marginRight: 15 }}
            >
                <EditNotes
                    fill={themeColor('text')}
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: invreq_id
                            ? localeString('general.withdrawalRequest')
                            : is_amp
                            ? localeString('views.Receive.ampInvoice')
                            : localeString('views.Invoice.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <Row>
                            {invoice.isZeusPay && (
                                <AttestationButton
                                    hash={invoice.payment_hash || getRHash}
                                    amount_msat={
                                        invoice.amt_paid_msat ||
                                        invoice.getAmount * 1000
                                    }
                                    navigation={navigation}
                                />
                            )}
                            <EditNotesButton />
                            {!!getPaymentRequest && <QRButton />}
                        </Row>
                    }
                    navigation={navigation}
                />
                <ScrollView keyboardShouldPersistTaps="handled">
                    {!invoice.invreq_id && (
                        <View style={styles.center}>
                            <Amount
                                sats={invoice.getAmount}
                                sensitive
                                jumboText
                                toggleable
                                pending={!invoice.isExpired && !invoice.isPaid}
                                credit={invoice.isPaid}
                            />
                        </View>
                    )}

                    {invoice.invreq_id && (
                        <View style={styles.center}>
                            <Amount
                                sats={(
                                    Number(invoice.invreq_amount_msat) / 1000
                                ).toString()}
                                sensitive
                                jumboText
                                toggleable
                            />
                        </View>
                    )}

                    <View style={styles.content}>
                        {is_amp && isPaid && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.invoiceAmount'
                                )}
                                value={
                                    <Amount sats={value} sensitive toggleable />
                                }
                                sensitive
                            />
                        )}

                        {invreq_id && (
                            <>
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.description'
                                    )}
                                    value={invoice.offer_description}
                                    sensitive
                                    color={themeColor('text')}
                                />

                                <KeyValue
                                    keyValue={localeString('general.active')}
                                    value={
                                        active
                                            ? localeString('general.true')
                                            : localeString('general.false')
                                    }
                                    sensitive
                                />

                                <KeyValue
                                    keyValue={localeString(
                                        'views.PayCode.singleUse'
                                    )}
                                    value={
                                        single_use
                                            ? localeString('general.true')
                                            : localeString('general.false')
                                    }
                                    sensitive
                                />

                                <KeyValue
                                    keyValue={localeString('general.used')}
                                    value={
                                        used
                                            ? localeString('general.true')
                                            : localeString('general.false')
                                    }
                                    sensitive
                                />

                                {this.state.invreq_time && (
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.NodeInfo.ForwardingHistory.timestamp'
                                        )}
                                        value={this.state.invreq_time}
                                        sensitive
                                    />
                                )}

                                <KeyValue
                                    keyValue={localeString(
                                        'views.withdrawal.id'
                                    )}
                                    value={invreq_id}
                                    sensitive
                                    color={themeColor('text')}
                                />

                                <KeyValue
                                    keyValue={localeString(
                                        'views.PayCode.bolt12'
                                    )}
                                    value={bolt12}
                                    sensitive
                                    color={themeColor('text')}
                                />
                            </>
                        )}

                        {getKeysendMessage && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoices.keysendMessage'
                                )}
                                value={getKeysendMessage}
                                sensitive
                            />
                        )}

                        {getNameDescReceiver && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.receiverName'
                                )}
                                value={getNameDescReceiver}
                                sensitive
                            />
                        )}

                        {getMemo && (
                            <KeyValue
                                keyValue={localeString('views.Invoice.memo')}
                                value={getMemo}
                                sensitive
                            />
                        )}

                        {!!receipt && (
                            <KeyValue
                                keyValue={localeString('views.Invoice.receipt')}
                                value={receipt}
                                sensitive
                            />
                        )}

                        {isPaid && !is_amp && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.settleDate'
                                )}
                                value={invoice.formattedSettleDate}
                                sensitive
                            />
                        )}

                        {formattedCreationDate && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.creationDate'
                                )}
                                value={formattedCreationDate}
                                sensitive
                            />
                        )}

                        {!!formattedOriginalTimeUntilExpiry && !invreq_id && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.originalExpiration'
                                )}
                                value={formattedOriginalTimeUntilExpiry}
                                sensitive
                            />
                        )}

                        {!!formattedTimeUntilExpiry && !invreq_id && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.expiration'
                                )}
                                value={formattedTimeUntilExpiry}
                                sensitive
                            />
                        )}

                        {privateInvoice && (
                            <KeyValue
                                keyValue={localeString('views.Invoice.private')}
                                value={localeString('general.true')}
                            />
                        )}

                        {!!fallback_addr && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.fallbackAddress'
                                )}
                                value={fallback_addr}
                                sensitive
                            />
                        )}

                        {!!cltv_expiry && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.cltvExpiry'
                                )}
                                value={cltv_expiry}
                            />
                        )}

                        {getRHash && (
                            <KeyValue
                                keyValue={localeString('views.Invoice.rHash')}
                                value={getRHash}
                                sensitive
                            />
                        )}

                        {getRPreimage && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.rPreimage'
                                )}
                                value={getRPreimage}
                                sensitive
                            />
                        )}

                        {!!getDescriptionHash && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.descriptionHash'
                                )}
                                value={getDescriptionHash}
                                sensitive
                            />
                        )}

                        {!!payment_hash && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.paymentHash'
                                )}
                                value={payment_hash}
                                sensitive
                            />
                        )}

                        {storedNote && (
                            <KeyValue
                                keyValue={localeString('general.note')}
                                value={storedNote}
                                sensitive
                                mempoolLink={() =>
                                    navigation.navigate('AddNotes', {
                                        noteKey: getNoteKey
                                    })
                                }
                            />
                        )}
                    </View>
                </ScrollView>
                <View style={{ bottom: 15 }}>
                    {getNoteKey && (
                        <Button
                            title={
                                storedNote
                                    ? localeString(
                                          'views.SendingLightning.UpdateNote'
                                      )
                                    : localeString(
                                          'views.SendingLightning.AddANote'
                                      )
                            }
                            onPress={() =>
                                navigation.navigate('AddNotes', {
                                    noteKey: getNoteKey
                                })
                            }
                            containerStyle={{ marginTop: 15 }}
                            noUppercase
                        />
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    }
});
