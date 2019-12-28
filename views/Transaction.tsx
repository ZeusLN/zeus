import * as React from 'react';
import { forEach } from 'lodash';
import {
    StyleSheet,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Header, Icon } from 'react-native-elements';
import UrlUtils from './../utils/UrlUtils';
import Transaction from './../models/Transaction';
import { inject, observer } from 'mobx-react';

import NodeInfoStore from './../stores/NodeInfoStore';
import UnitsStore from './../stores/UnitsStore';
import SettingsStore from './../stores/SettingsStore';

interface TransactionProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

@inject('NodeInfoStore', 'UnitsStore', 'SettingsStore')
@observer
export default class TransactionView extends React.Component<TransactionProps> {
    render() {
        const {
            NodeInfoStore,
            UnitsStore,
            SettingsStore,
            navigation
        } = this.props;
        const { changeUnits, getAmount, units } = UnitsStore;
        const transaction: Transaction = navigation.getParam(
            'transaction',
            null
        );
        const { testnet } = NodeInfoStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

        const {
            tx,
            block_hash,
            block_height,
            num_confirmations,
            time_stamp,
            destAddresses,
            total_fees,
            status
        } = transaction;
        const amount = transaction.getAmount;
        const date = time_stamp && new Date(Number(time_stamp) * 1000);
        const addresses: Array<any> = [];

        forEach(destAddresses, (address: any, key: string) =>
            addresses.push(
                <TouchableOpacity
                    key={`${address}-${key}`}
                    onPress={() =>
                        UrlUtils.goToBlockExplorerAddress(address, testnet)
                    }
                >
                    <Text style={styles.valueWithLink}>{address}</Text>
                </TouchableOpacity>
            )
        );

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
                        text: 'Transaction',
                        style: { color: '#fff' }
                    }}
                    backgroundColor={theme === 'dark' ? '#261339' : 'orange'}
                />
                <View style={styles.center}>
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text
                            style={{
                                color: amount > 0 ? 'green' : 'red',
                                fontSize: 30,
                                fontWeight: 'bold'
                            }}
                        >{`${amount > 0 ? '+' : ''}${units &&
                            getAmount(amount)}`}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    {total_fees && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Total Fees:
                            </Text>
                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text
                                    style={
                                        theme === 'dark'
                                            ? styles.valueDark
                                            : styles.value
                                    }
                                >
                                    {units && getAmount(total_fees || 0)}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Transaction Hash:
                    </Text>
                    <TouchableOpacity
                        onPress={() =>
                            UrlUtils.goToBlockExplorerTXID(tx, testnet)
                        }
                    >
                        <Text style={styles.valueWithLink}>{tx}</Text>
                    </TouchableOpacity>

                    {block_hash && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Block Hash:
                            </Text>
                            <TouchableOpacity
                                onPress={() =>
                                    UrlUtils.goToBlockExplorerBlockHash(
                                        block_hash,
                                        testnet
                                    )
                                }
                            >
                                <Text style={styles.valueWithLink}>
                                    {block_hash}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {block_height && (
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.labelDark
                                    : styles.label
                            }
                        >
                            Block Height:
                        </Text>
                    )}
                    {block_height && (
                        <TouchableOpacity
                            onPress={() =>
                                UrlUtils.goToBlockExplorerBlockHeight(
                                    block_height,
                                    testnet
                                )
                            }
                        >
                            <Text style={styles.valueWithLink}>
                                {block_height}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {num_confirmations && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Number of Confirmations:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color:
                                        num_confirmations > 0 ? 'green' : 'red'
                                }}
                            >
                                {num_confirmations}
                            </Text>
                        </View>
                    )}

                    {status && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Status:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value
                                }}
                            >
                                {status}
                            </Text>
                        </View>
                    )}

                    {date && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Timestamp:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {date.toString()}
                            </Text>
                        </View>
                    )}

                    {destAddresses && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                {destAddresses.length > 1
                                    ? 'Destination Addresses:'
                                    : 'Destination Address:'}
                            </Text>
                            <React.Fragment>{addresses}</React.Fragment>
                        </View>
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
    },
    valueWithLink: {
        paddingBottom: 5,
        color: 'rgba(92, 99,216, 1)'
    }
});
