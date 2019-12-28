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
        const { theme } = settings;

        const invoice: Invoice = navigation.getParam('invoice', null);
        const {
            amt_paid_sat,
            fallback_addr,
            r_hash,
            settle_date,
            isPaid,
            expiry,
            getMemo,
            receipt,
            value,
            creation_date,
            description_hash,
            r_preimage,
            cltv_expiry,
            settleDate,
            creationDate
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
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Invoice',
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
                        >{`${isPaid ? 'Paid' : 'Unpaid'}: ${units &&
                            getAmount(invoice.getAmount)}`}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    {getMemo && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Memo:
                        </Text>
                    )}
                    {getMemo && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {getMemo}
                        </Text>
                    )}

                    {receipt && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Receipt:
                        </Text>
                    )}
                    {receipt && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {receipt}
                        </Text>
                    )}

                    {settle_date && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Settle Date:
                        </Text>
                    )}
                    {settle_date && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {settleDate}
                        </Text>
                    )}

                    {creation_date && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Creation Date:
                        </Text>
                    )}
                    {creation_date && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {creationDate}
                        </Text>
                    )}

                    {expiry && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Expiry:
                        </Text>
                    )}
                    {expiry && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {expiry}
                        </Text>
                    )}

                    {privateInvoice && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Private:
                        </Text>
                    )}
                    {privateInvoice && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {privateInvoice}
                        </Text>
                    )}

                    {fallback_addr && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Fallback Address:
                        </Text>
                    )}
                    {fallback_addr && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {fallback_addr}
                        </Text>
                    )}

                    {cltv_expiry && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            CLTV Expiry:
                        </Text>
                    )}
                    {cltv_expiry && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {cltv_expiry}
                        </Text>
                    )}

                    {r_hash && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            R Hash:
                        </Text>
                    )}
                    {r_hash && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {r_hash}
                        </Text>
                    )}

                    {r_preimage && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            R Pre-Image:
                        </Text>
                    )}
                    {r_preimage && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {r_preimage}
                        </Text>
                    )}

                    {description_hash && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Description Hash:
                        </Text>
                    )}
                    {description_hash && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.valueDark
                                    : styles.value
                            }
                        >
                            {description_hash}
                        </Text>
                    )}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1
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
