import * as React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';

import InvoicesStore from './../stores/InvoicesStore';
import TransactionsStore from './../stores/TransactionsStore';
import UnitsStore from './../stores/UnitsStore';

interface InvoiceProps {
    exitSetup: any;
    navigation: any;
    InvoicesStore: InvoicesStore;
    TransactionsStore: TransactionsStore;
    UnitsStore: UnitsStore;
}

@inject('InvoicesStore', 'TransactionsStore', 'UnitsStore')
@observer
export default class PaymentRequest extends React.Component<InvoiceProps, {}> {
    render() {
        const { TransactionsStore, InvoicesStore, UnitsStore, navigation } = this.props;
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

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Send')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View style={styles.container}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Lightning Invoice', style: { color: '#fff' } }}
                />

                {loading && <ActivityIndicator size="large" color="#0000ff" />}

                {!!getPayReqError && <View style={styles.content}>
                    <Text style={styles.label}>Error loading invoice</Text>
                </View>}

                {pay_req && <View style={styles.content}>
                    <View style={styles.center}>
                        <TouchableOpacity onPress={() => changeUnits()}>
                            <Text style={styles.amount}>{units && getAmount(num_satoshis)}</Text>
                        </TouchableOpacity>
                    </View>

                    {description && <Text style={styles.label}>Description:</Text>}
                    {description && <Text style={styles.value}>{description}</Text>}

                    {timestamp && <Text style={styles.label}>Timestamp:</Text>}
                    {timestamp && <Text style={styles.value}>{date}</Text>}

                    {expiry && <Text style={styles.label}>Expiry:</Text>}
                    {expiry && <Text style={styles.value}>{expiry}</Text>}

                    {cltv_expiry && <Text style={styles.label}>CLTV Expiry:</Text>}
                    {cltv_expiry && <Text style={styles.value}>{cltv_expiry}</Text>}

                    {destination && <Text style={styles.label}>Destination:</Text>}
                    {destination && <Text style={styles.value}>{destination}</Text>}

                    {payment_hash && <Text style={styles.label}>Payment Hash:</Text>}
                    {payment_hash && <Text style={styles.value}>{payment_hash}</Text>}
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
    container: {
        flex: 1
    },
    content: {
        backgroundColor: '#fff',
        padding: 20
    },
    label: {
        paddingTop: 5
    },
    value: {
        paddingBottom: 5
    },
    button: {
        paddingTop: 5,
        paddingBottom: 5
    },
    amount: {
        fontSize: 25,
        fontWeight: 'bold'
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    }
});