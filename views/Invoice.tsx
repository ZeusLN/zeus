import * as React from 'react';
import EncryptedStorage from 'react-native-encrypted-storage';

import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-elements';

import Amount from '../components/Amount';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';
import Button from '../components/Button';
import { Row } from '../components/layout/Row';

import Invoice from '../models/Invoice';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import EditNotes from '../assets/images/SVG/Pen.svg';

interface InvoiceProps {
    navigation: any;
}

export default class InvoiceView extends React.Component<InvoiceProps> {
    state = {
        storedNotes: ''
    };
    async componentDidMount() {
        const { navigation } = this.props;
        const invoice: Invoice = navigation.getParam('invoice', null);
        navigation.addListener('didFocus', () => {
            const noteKey = invoice.getRPreimage || invoice.payment_hash;
            EncryptedStorage.getItem('note-' + noteKey)
                .then((storedNotes) => {
                    this.setState({ storedNotes });
                })
                .catch((error) => {
                    console.error('Error retrieving notes:', error);
                });
        });
    }

    render() {
        const { navigation } = this.props;
        const { storedNotes } = this.state;
        const invoice: Invoice = navigation.getParam('invoice', null);
        const {
            fallback_addr,
            getRHash,
            isPaid,
            getMemo,
            receipt,
            creation_date,
            getDescriptionHash,
            payment_hash,
            getRPreimage,
            cltv_expiry,
            expirationDate,
            getPaymentRequest,
            getKeysendMessage
        } = invoice;
        const privateInvoice = invoice.private;
        const noteKey = getRPreimage || payment_hash;

        const QRButton = () => (
            <View style={{ marginTop: -4 }}>
                <Icon
                    name="qr-code"
                    onPress={() => {
                        navigation.navigate('QR', { value: getPaymentRequest });
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={30}
                    tvParallaxProperties={{}}
                />
            </View>
        );
        const EditNotesButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('AddNotes', { getRPreimage: noteKey })
                }
                style={{ marginTop: -6, alignSelf: 'center', marginRight: 14 }}
            >
                <EditNotes height={40} width={40} />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Invoice.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    rightComponent={
                        <Row>
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
                        {getKeysendMessage && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoices.keysendMessage'
                                )}
                                value={getKeysendMessage}
                                sensitive
                            />
                        )}

                        <KeyValue
                            keyValue={localeString('views.Invoice.memo')}
                            value={
                                getMemo || localeString('models.Invoice.noMemo')
                            }
                            sensitive
                        />

                        {!!receipt && (
                            <KeyValue
                                keyValue={localeString('views.Invoice.receipt')}
                                value={receipt}
                                sensitive
                            />
                        )}

                        {isPaid && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.settleDate'
                                )}
                                value={invoice.formattedSettleDate}
                                sensitive
                            />
                        )}

                        {!!creation_date && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.creationDate'
                                )}
                                value={invoice.formattedCreationDate}
                                sensitive
                            />
                        )}

                        {!!expirationDate && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.expiration'
                                )}
                                value={expirationDate}
                                sensitive
                            />
                        )}

                        {!!privateInvoice && (
                            <KeyValue
                                keyValue={localeString('views.Invoice.private')}
                                value={privateInvoice}
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

                        {storedNotes && (
                            <KeyValue
                                keyValue={localeString('views.Payment.notes')}
                                value={storedNotes}
                                sensitive
                                mempoolLink={() =>
                                    navigation.navigate('AddNotes', {
                                        getRPreimage: noteKey
                                    })
                                }
                            />
                        )}

                        {noteKey && (
                            <Button
                                title={
                                    storedNotes
                                        ? localeString(
                                              'views.SendingLightning.UpdateNote'
                                          )
                                        : localeString(
                                              'views.SendingLightning.AddANote'
                                          )
                                }
                                onPress={() =>
                                    navigation.navigate('AddNotes', {
                                        getRPreimage: noteKey
                                    })
                                }
                                containerStyle={{ marginTop: 15 }}
                                secondary
                                noUppercase
                            />
                        )}
                    </View>
                </ScrollView>
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
