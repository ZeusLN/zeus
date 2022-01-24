import * as React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import Invoice from './../models/Invoice';
import { Amount } from './../components/Amount';
import CollapsedQR from './../components/CollapsedQR';
import KeyValue from './../components/KeyValue';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

interface InvoiceProps {
    navigation: any;
}

export default class InvoiceView extends React.Component<InvoiceProps> {
    render() {
        const { navigation } = this.props;
        const invoice: Invoice = navigation.getParam('invoice', null);
        const {
            fallback_addr,
            r_hash,
            isPaid,
            getMemo,
            receipt,
            creation_date,
            description_hash,
            payment_hash,
            r_preimage,
            cltv_expiry,
            expirationDate,
            payment_request,
            bolt11
        } = invoice;
        const privateInvoice = invoice.private;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Invoice.title'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor={themeColor('secondary')}
                />
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

                    {isPaid && (
                        <KeyValue
                            keyValue={localeString('views.Invoice.settleDate')}
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
                            keyValue={localeString('views.Invoice.expiration')}
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
                            keyValue={localeString('views.Invoice.cltvExpiry')}
                            value={cltv_expiry}
                        />
                    )}

                    {!!r_hash && typeof r_hash === 'string' && (
                        <KeyValue
                            keyValue={localeString('views.Invoice.rHash')}
                            value={r_hash}
                            sensitive
                        />
                    )}

                    {!!r_preimage && (
                        <KeyValue
                            keyValue={localeString('views.Invoice.rPreimage')}
                            value={r_preimage}
                            sensitive
                        />
                    )}

                    {!!description_hash && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Invoice.descriptionHash'
                            )}
                            value={description_hash}
                            sensitive
                        />
                    )}

                    {!!payment_hash && (
                        <KeyValue
                            keyValue={localeString('views.Invoice.paymentHash')}
                            value={payment_hash}
                            sensitive
                        />
                    )}

                    {!!payment_request && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Invoice.paymentRequest'
                            )}
                            value={payment_request}
                            sensitive
                        />
                    )}

                    {!!payment_request && (
                        <CollapsedQR
                            value={payment_request}
                            copyText={localeString(
                                'views.Invoice.copyPaymentRequest'
                            )}
                            hideText
                        />
                    )}

                    {!!bolt11 && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Invoice.paymentRequest'
                            )}
                            value={bolt11}
                            sensitive
                        />
                    )}

                    {!!bolt11 && (
                        <CollapsedQR
                            value={bolt11}
                            copyText={localeString(
                                'views.Invoice.copyPaymentRequest'
                            )}
                            hideText
                        />
                    )}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    amount: {
        fontSize: 25,
        fontWeight: 'bold'
    },
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
