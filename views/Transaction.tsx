import * as React from 'react';
import { forEach } from 'lodash';
import { StyleSheet, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import UrlUtils from './../utils/UrlUtils';
import Transaction from './../models/Transaction';
import { inject, observer } from 'mobx-react';

import NodeInfoStore from './../stores/NodeInfoStore';
import UnitsStore from './../stores/UnitsStore';

interface TransactionProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    UnitsStore: UnitsStore;
}

@inject('NodeInfoStore', 'UnitsStore')
@observer
export default class TransactionView extends React.Component<TransactionProps> {
    render() {
        const { NodeInfoStore, UnitsStore, navigation } = this.props;
        const { changeUnits, getAmount, units } = UnitsStore;
        const transaction: Transaction = navigation.getParam('transaction', null);
        const { testnet } = NodeInfoStore;
        const { amount, tx_hash, block_hash, block_height, num_confirmations, time_stamp, dest_addresses } = transaction;
        const date = new Date(Number(time_stamp) * 1000);
        const addresses: Array<any> = [];

        forEach(dest_addresses, (address: any, key: string) => (
            addresses.push(
                <TouchableOpacity key={`${address}-${key}`} onPress={() => UrlUtils.goToBlockExplorerAddress(address, testnet)}>
                    <Text style={styles.valueWithLink}>{address}</Text>
                </TouchableOpacity>
            )
        ));

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
                    centerComponent={{ text: 'Transaction', style: { color: '#fff' } }}
                    backgroundColor='orange'
                />
                <View style={styles.center}>
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text style={{ color: amount > 0 ? 'green' : 'red', fontSize: 30, fontWeight: 'bold' }}>{`${amount > 0 ? '+' : ''}${units && getAmount(amount)}`}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <Text style={styles.label}>Transaction Hash:</Text>
                    <TouchableOpacity onPress={() => UrlUtils.goToBlockExplorerTXID(tx_hash, testnet)}><Text style={styles.valueWithLink}>{tx_hash}</Text></TouchableOpacity>

                    {block_hash && <Text style={styles.label}>Block Hash:</Text>}
                    {block_hash && <TouchableOpacity onPress={() => UrlUtils.goToBlockExplorerBlockHash(block_hash, testnet)}><Text style={styles.valueWithLink}>{block_hash}</Text></TouchableOpacity>}

                    {block_height && <Text style={styles.label}>Block Height:</Text>}
                    {block_height && <TouchableOpacity onPress={() => UrlUtils.goToBlockExplorerBlockHeight(block_height, testnet)}><Text style={styles.valueWithLink}>{block_height}</Text></TouchableOpacity>}

                    <Text style={styles.label}>Number of Confirmations:</Text>
                    <Text style={{ ...styles.value, color: num_confirmations > 0 ? 'black' : 'red' }}>{num_confirmations || 0}</Text>

                    <Text style={styles.label}>Timestamp:</Text>
                    <Text style={styles.value}>{date.toString()}</Text>

                    {dest_addresses && <Text style={styles.label}>{dest_addresses.length > 1 ? 'Destination Addresses:' : 'Destination Address:'}</Text>}
                    {dest_addresses && <React.Fragment>{addresses}</React.Fragment>}
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