import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';

import InvoicesStore from './../stores/InvoicesStore';
import TransactionsStore from './../stores/TransactionsStore';

interface InvoiceProps {
    exitSetup: any;
    navigation: any;
    InvoicesStore: InvoicesStore;
    TransactionsStore: TransactionsStore;
}

@inject('InvoicesStore', 'TransactionsStore')
@observer
export default class InvoiceLookup extends React.Component<InvoiceProps, {}> {
    render() {
        const { TransactionsStore, InvoicesStore, navigation } = this.props;
        const { pay_req, paymentRequest } = InvoicesStore;
        const { description_hash, memo, expiry, cltv_expiry, value, fallback_addr } = pay_req;

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

                <View style={styles.content}>
                    {!pay_req && <Text>Cannot load invoice</Text>}

                    {value && <Text style={styles.label}>Value:</Text>}
                    {value && <Text style={styles.value}>{`${value} satoshis`}</Text>}

                    {memo && <Text style={styles.label}>Memo:</Text>}
                    {memo && <Text style={styles.value}>{memo}</Text>}

                    {expiry && <Text style={styles.label}>Expiry:</Text>}
                    {expiry && <Text style={styles.value}>{expiry}</Text>}

                    {cltv_expiry && <Text style={styles.label}>CLTV Expiry:</Text>}
                    {cltv_expiry && <Text style={styles.value}>{cltv_expiry}</Text>}

                    {fallback_addr && <Text style={styles.label}>Fallback Address:</Text>}
                    {fallback_addr && <Text style={styles.value}>{fallback_addr}</Text>}

                    {description_hash && <Text style={styles.label}>Description Hash:</Text>}
                    {description_hash && <Text style={styles.value}>{description_hash}</Text>}
                </View>

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
    }
});