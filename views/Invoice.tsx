import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Header, Icon } from 'react-native-elements';
import Invoice from './../models/Invoice';
import { inject, observer } from 'mobx-react';
import PrivacyUtils from './../utils/PrivacyUtils';
import CollapsedQR from './../components/CollapsedQR';
import { localeString } from './../utils/LocaleUtils';

import UnitsStore from './../stores/UnitsStore';
import SettingsStore from './../stores/SettingsStore';

interface InvoiceProps {
    navigation: any;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

@inject('UnitsStore', 'SettingsStore')
@observer
export default class InvoiceView extends React.Component<InvoiceProps> {
    render() {
        const { navigation, UnitsStore, SettingsStore } = this.props;
        const { changeUnits, getAmount, units } = UnitsStore;
        const { settings } = SettingsStore;
        const { theme, lurkerMode } = settings;

        const invoice: Invoice = navigation.getParam('invoice', null);
        const {
            fallback_addr,
            r_hash,
            isPaid,
            getMemo,
            receipt,
            creation_date,
            description_hash,
            r_preimage,
            cltv_expiry,
            expirationDate,
            payment_request
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

        const amount = lurkerMode
            ? PrivacyUtils.hideValue(getAmount(invoice.getAmount), 8, true)
            : getAmount(invoice.getAmount);

        return (
            <ScrollView
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Invoice.title'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor={theme === 'dark' ? '#261339' : 'orange'}
                />
                <View style={styles.center}>
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.amountDark
                                    : styles.amount
                            }
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
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.Invoice.memo')}:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(getMemo)
                                    : getMemo}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!receipt && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.Invoice.receipt')}:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(receipt)
                                    : receipt}
                            </Text>
                        </React.Fragment>
                    )}

                    {isPaid && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.Invoice.settleDate')}:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(
                                          invoice.settleDate,
                                          14
                                      )
                                    : invoice.settleDate}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!creation_date && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.Invoice.creationDate')}:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(
                                          invoice.creationDate,
                                          14
                                      )
                                    : invoice.creationDate}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!expirationDate && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.Invoice.expiration')}:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(expirationDate, 14)
                                    : expirationDate}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!privateInvoice && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.Invoice.private')}:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {privateInvoice}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!fallback_addr && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.Invoice.fallbackAddress')}:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(fallback_addr)
                                    : fallback_addr}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!cltv_expiry && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.Invoice.cltvExpiry')}:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {cltv_expiry}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!r_hash && typeof r_hash === 'string' && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.Invoice.rHash')}:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(r_hash)
                                    : r_hash}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!r_preimage && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.Invoice.rPreimage')}:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(r_preimage)
                                    : r_preimage}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!description_hash && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.Invoice.descriptionHash')}:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(description_hash)
                                    : description_hash}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!payment_request && (
                        <React.Fragment>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {localeString('views.Invoice.paymentRequest')}:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(payment_request)
                                    : payment_request}
                            </Text>
                        </React.Fragment>
                    )}

                    {!!payment_request && (
                        <CollapsedQR
                            value={payment_request}
                            theme={theme}
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
    lightThemeStyle: {
        flex: 1,
        backgroundColor: 'white'
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
    },
    amount: {
        fontSize: 25,
        fontWeight: 'bold'
    },
    amountDark: {
        fontSize: 25,
        fontWeight: 'bold',
        color: 'white'
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
    },
    labelDark: {
        paddingTop: 5,
        color: 'white'
    },
    valueDark: {
        paddingBottom: 5,
        color: 'white'
    }
});
