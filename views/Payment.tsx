import * as React from 'react';
import { StyleSheet, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import Payment from './../models/Payment';
import { inject, observer } from 'mobx-react';

import UnitsStore from './../stores/UnitsStore';

interface PaymentProps {
    navigation: any;
    UnitsStore: UnitsStore;
}

@inject('UnitsStore')
@observer
export default class PaymentView extends React.Component<PaymentProps> {
    render() {
        const { navigation, UnitsStore } = this.props;
        const { changeUnits, getAmount, units } = UnitsStore;
        const payment: Payment = navigation.getParam('payment', null);
        const { creation_date, fee, payment_hash, value, payment_preimage, path } = payment;
        const date = new Date(Number(creation_date) * 1000).toString();

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView style={styles.container}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Payment', style: { color: '#fff' } }}
                    backgroundColor='black'
                />
                <View style={styles.center}>
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text style={{ color: 'red', fontSize: 30, fontWeight: 'bold' }}>{getAmount(value)}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <Text style={styles.label}>Fee:</Text>
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text style={styles.value}>{units && getAmount(fee)}</Text>
                    </TouchableOpacity>

                    <Text style={styles.label}>Payment Hash</Text>
                    <Text style={styles.value}>{payment_hash}</Text>

                    <Text style={styles.label}>Payment Pre-Image</Text>
                    <Text style={styles.value}>{payment_preimage}</Text>

                    <Text style={styles.label}>Creation Date:</Text>
                    <Text style={styles.value}>{date}</Text>

                    {path && <Text style={styles.label}>{path.length > 1 ? 'Paths:' : 'Path:'}</Text>}
                    {path && <Text>{path.join(', ')}</Text>}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
    valueWithLink: {
        paddingBottom: 5,
        color: 'rgba(92, 99,216, 1)'
    }
});