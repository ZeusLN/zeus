import * as React from 'react';
import { StyleSheet, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import Invoice from './../models/Invoice';
import { inject, observer } from 'mobx-react';

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
            settle_date,
            settled,
            expiry,
            memo,
            receipt,
            value,
            creation_date,
            description_hash,
            r_preimage,
            cltv_expiry
        } = invoice;
        const privateInvoice = invoice.private;
        const settleDate = new Date(Number(settle_date) * 1000).toString();
        const creationDate = new Date(Number(creation_date) * 1000).toString();

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
                    centerComponent={{ text: 'Invoice', style: { color: '#fff' } }}
                    backgroundColor='orange'
                />
                <View style={styles.center}>
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text style={styles.amount}>{`${settled ? 'Paid' : 'Unpaid'}: ${units && getAmount(value)}`}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    {memo && <Text style={styles.label}>Memo:</Text>}
                    {memo && <Text style={styles.value}>{memo}</Text>}

                    {receipt && <Text style={styles.label}>Receipt:</Text>}
                    {receipt && <Text style={styles.value}>{receipt}</Text>}

                    {settle_date && <Text style={styles.label}>Settle Date:</Text>}
                    {settle_date && <Text style={styles.value}>{settleDate}</Text>}

                    {creation_date && <Text style={styles.label}>Creation Date:</Text>}
                    {creation_date && <Text style={styles.value}>{creationDate}</Text>}

                    {expiry && <Text style={styles.label}>Expiry:</Text>}
                    {expiry && <Text style={styles.value}>{expiry}</Text>}

                    {privateInvoice && <Text style={styles.label}>Private:</Text>}
                    {privateInvoice && <Text style={styles.value}>{privateInvoice}</Text>}

                    {fallback_addr && <Text style={styles.label}>Fallback Address:</Text>}
                    {fallback_addr && <Text style={styles.value}>{fallback_addr}</Text>}

                    {cltv_expiry && <Text style={styles.label}>CLTV Expiry:</Text>}
                    {cltv_expiry && <Text style={styles.value}>{cltv_expiry}</Text>}

                    {r_hash && <Text style={styles.label}>R Hash:</Text>}
                    {r_hash && <Text style={styles.value}>{r_hash}</Text>}

                    {r_preimage && <Text style={styles.label}>R Pre-Image:</Text>}
                    {r_preimage && <Text style={styles.value}>{r_preimage}</Text>}

                    {description_hash && <Text style={styles.label}>Description Hash:</Text>}
                    {description_hash && <Text style={styles.value}>{description_hash}</Text>}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
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