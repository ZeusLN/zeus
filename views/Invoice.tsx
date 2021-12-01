import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Invoice from './../models/Invoice';
import PrivacyUtils from './../utils/PrivacyUtils';
import CollapsedQR from './../components/CollapsedQR';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import UnitsStore from './../stores/UnitsStore';

interface InvoiceProps {
    navigation: any;
    UnitsStore: UnitsStore;
}

@inject('UnitsStore')
@observer
export default class InvoiceView extends React.Component<InvoiceProps> {
    render() {
        const { navigation, UnitsStore } = this.props;
        const { changeUnits, getAmount, units } = UnitsStore;

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

        const amount = PrivacyUtils.sensitiveValue(
            getAmount(invoice.getAmount),
            8,
            true
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
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text
                            style={{
                                ...styles.amount,
                                color: themeColor('text')
                            }}
                        >{`${
                            isPaid
                                ? localeString('views.Invoice.paid')
                                : localeString('views.Invoice.unpaid')
                        }: ${units && amount}`}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    {getMemo && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.memo')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(getMemo)}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!receipt && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.receipt')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(receipt)}
                            </Text>
                        </React.Fragment>
                    )}

                    {isPaid && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.settleDate')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(
                                    invoice.settleDate,
                                    14
                                )}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!creation_date && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.creationDate')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(
                                    invoice.creationDate,
                                    14
                                )}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!expirationDate && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.expiration')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(
                                    expirationDate,
                                    14
                                )}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!privateInvoice && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.private')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {privateInvoice}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!fallback_addr && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.fallbackAddress')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(fallback_addr)}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!cltv_expiry && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.cltvExpiry')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {cltv_expiry}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!r_hash && typeof r_hash === 'string' && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.rHash')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(r_hash)}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!r_preimage && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.rPreimage')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(r_preimage)}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!description_hash && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.descriptionHash')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(description_hash)}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!payment_hash && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.paymentHash')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(payment_hash)}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!payment_request && (
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.paymentRequest')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(payment_request)}
                            </Text>
                        </React.Fragment>
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
                        <React.Fragment>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Invoice.paymentRequest')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(bolt11)}
                            </Text>
                        </React.Fragment>
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
    },
    label: {
        paddingTop: 5
    },
    value: {
        paddingBottom: 5
    }
});
