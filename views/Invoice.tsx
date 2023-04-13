import * as React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { Icon } from 'react-native-elements';

import Amount from '../components/Amount';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';

import Invoice from '../models/Invoice';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface InvoiceProps {
    navigation: any;
}

export default class InvoiceView extends React.Component<InvoiceProps> {
    render() {
        const { navigation } = this.props;
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
            getPaymentRequest
        } = invoice;
        const privateInvoice = invoice.private;

        const QRButton = () => (
            <Icon
                name="qr-code"
                onPress={() => {
                    navigation.navigate('QR', { value: getPaymentRequest });
                }}
                color={themeColor('text')}
                underlayColor="transparent"
            />
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
                    rightComponent={!!getPaymentRequest && <QRButton />}
                    navigation={navigation}
                />
                <ScrollView>
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
                                value={invoice.settleDate}
                                sensitive
                            />
                        )}

                        {!!creation_date && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Invoice.creationDate'
                                )}
                                value={invoice.creationDate}
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
