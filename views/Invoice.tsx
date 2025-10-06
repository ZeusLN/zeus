import * as React from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Icon, ListItem } from 'react-native-elements';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import SettingsStore from '../stores/SettingsStore';
import InvoicesStore from '../stores/InvoicesStore';

import Amount from '../components/Amount';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';
import Button from '../components/Button';
import { Row } from '../components/layout/Row';
import AttestationButton from '../components/AttestationButton';
import LoadingIndicator from '../components/LoadingIndicator';

import Invoice from '../models/Invoice';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import EditNotes from '../assets/images/SVG/Pen.svg';
import QR from '../assets/images/SVG/QR.svg';
import BackendUtils from '../utils/BackendUtils';

interface InvoiceProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore?: SettingsStore;
    InvoicesStore?: InvoicesStore;
    route: Route<'InvoiceView', { invoice: Invoice }>;
}

interface InvoiceState {
    storedNote: string;
    enhancedPath: any[];
    loading: boolean;
}

@inject('SettingsStore', 'InvoicesStore')
@observer
export default class InvoiceView extends React.Component<
    InvoiceProps,
    InvoiceState
> {
    state: InvoiceState = {
        storedNote: '',
        enhancedPath: [],
        loading: false
    };

    async componentDidMount() {
        const { navigation, route, InvoicesStore } = this.props;
        const invoice = route.params?.invoice;
        navigation.addListener('focus', () => {
            const note = invoice.getNote;
            this.setState({ storedNote: note });
        });
        if (BackendUtils.isLNDBased()) {
            this.setState({ loading: true });
            const enhancedPath = await InvoicesStore?.fetchIncomingChannel(
                invoice.getRHash
            );
            this.setState({ enhancedPath: enhancedPath!, loading: false });
        }
    }

    render() {
        const { navigation, SettingsStore, route } = this.props;
        const { storedNote, enhancedPath, loading } = this.state;
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
            bolt12,
            payment_preimage
        } = invoice;
        const privateInvoice = invoice.private;

        const QRButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('QR', {
                        value: `lightning:${getPaymentRequest}`,
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
                    navigation.navigate('AddNotes', { noteKey: getNoteKey })
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
                        text: is_amp
                            ? localeString('views.Receive.ampInvoice')
                            : localeString('views.Invoice.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <Row>
                            {loading && <LoadingIndicator />}
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

                        {!!formattedOriginalTimeUntilExpiry && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.originalExpiration'
                                )}
                                value={formattedOriginalTimeUntilExpiry}
                                sensitive
                            />
                        )}

                        {!!formattedTimeUntilExpiry && (
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

                        {!!payment_preimage && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Payment.paymentPreimage'
                                )}
                                value={payment_hash}
                                sensitive
                            />
                        )}

                        {!!bolt12 && (
                            <KeyValue
                                keyValue={localeString('views.PayCode.bolt12')}
                                value={bolt12}
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

                        {enhancedPath.length > 0 && enhancedPath[0][0] && (
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent',
                                    marginLeft: -16,
                                    marginRight: -16
                                }}
                                onPress={() =>
                                    navigation.navigate('PaymentPaths', {
                                        enhancedPath
                                    })
                                }
                            >
                                <ListItem.Content>
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {(() => {
                                            const isIncoming =
                                                enhancedPath[
                                                    enhancedPath.length - 1
                                                ] === 'incoming';
                                            const numberOfPaths = isIncoming
                                                ? enhancedPath.length - 1
                                                : enhancedPath.length;

                                            return numberOfPaths > 1
                                                ? `${localeString(
                                                      'views.Payment.paths'
                                                  )} (${numberOfPaths})`
                                                : localeString(
                                                      'views.Payment.path'
                                                  );
                                        })()}
                                    </ListItem.Title>
                                </ListItem.Content>
                                <Icon
                                    name="keyboard-arrow-right"
                                    color={themeColor('secondaryText')}
                                />
                            </ListItem>
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
