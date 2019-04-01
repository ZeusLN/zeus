import * as React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';

import InvoicesStore from './../stores/InvoicesStore';
import TransactionsStore from './../stores/TransactionsStore';
import UnitsStore from './../stores/UnitsStore';
import SettingsStore from './../stores/SettingsStore';

interface InvoiceProps {
    exitSetup: any;
    navigation: any;
    InvoicesStore: InvoicesStore;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

@inject('InvoicesStore', 'TransactionsStore', 'UnitsStore', 'SettingsStore')
@observer
export default class PaymentRequest extends React.Component<InvoiceProps, {}> {
    render() {
        const { TransactionsStore, InvoicesStore, UnitsStore, SettingsStore, navigation } = this.props;
        const { pay_req, paymentRequest, getPayReqError, loading } = InvoicesStore;
        const { units, changeUnits, getAmount } = UnitsStore;
        const {
            num_satoshis,
            expiry,
            cltv_expiry,
            destination,
            description,
            payment_hash,
            timestamp
        } = pay_req;
        const date = new Date(Number(timestamp) * 1000).toString();

        const { settings } = SettingsStore;
        const { theme } = settings;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Send')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View style={theme === 'dark' ? styles.darkThemeStyle : styles.lightThemeStyle}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Lightning Invoice', style: { color: '#fff' } }}
                    backgroundColor={theme === "dark" ? "#261339" : "rgba(92, 99,216, 1)"}
                />

                {loading && <ActivityIndicator size="large" color="#0000ff" />}

                {!!getPayReqError && <View style={styles.content}>
                    <Text style={theme === 'dark' ? styles.labelDark : styles.label}>Error loading invoice</Text>
                </View>}

                {pay_req && <View style={styles.content}>
                    <View style={styles.center}>
                        <TouchableOpacity onPress={() => changeUnits()}>
                            <Text style={theme === 'dark' ? styles.amountDark : styles.amount}>{units && getAmount(num_satoshis)}</Text>
                        </TouchableOpacity>
                    </View>

                    {description && <Text style={theme === 'dark' ? styles.labelDark : styles.label}>Description:</Text>}
                    {description && <Text style={theme === 'dark' ? styles.valueDark : styles.value}>{description}</Text>}

                    {timestamp && <Text style={theme === 'dark' ? styles.labelDark : styles.label}>Timestamp:</Text>}
                    {timestamp && <Text style={theme === 'dark' ? styles.valueDark : styles.value}>{date}</Text>}

                    {expiry && <Text style={theme === 'dark' ? styles.labelDark : styles.label}>Expiry:</Text>}
                    {expiry && <Text style={theme === 'dark' ? styles.valueDark : styles.value}>{expiry}</Text>}

                    {cltv_expiry && <Text style={theme === 'dark' ? styles.labelDark : styles.label}>CLTV Expiry:</Text>}
                    {cltv_expiry && <Text style={theme === 'dark' ? styles.valueDark : styles.value}>{cltv_expiry}</Text>}

                    {destination && <Text style={theme === 'dark' ? styles.labelDark : styles.label}>Destination:</Text>}
                    {destination && <Text style={theme === 'dark' ? styles.valueDark : styles.value}>{destination}</Text>}

                    {payment_hash && <Text style={theme === 'dark' ? styles.labelDark : styles.label}>Payment Hash:</Text>}
                    {payment_hash && <Text style={theme === 'dark' ? styles.valueDark : styles.value}>{payment_hash}</Text>}
                </View>}

                {pay_req && <Button
                    title="Pay this invoice"
                    icon={{
                        name: "send",
                        size: 25,
                        color: "white"
                    }}
                    backgroundColor="orange"
                    onPress={() => {
                        TransactionsStore.sendPayment(paymentRequest);
                        navigation.navigate('SendingLightning');
                    }}
                    style={styles.button}
                    borderRadius={30}
                />}
            </View>
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
    content: {
        padding: 20
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
    },
    button: {
        paddingTop: 5,
        paddingBottom: 5
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
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    }
});