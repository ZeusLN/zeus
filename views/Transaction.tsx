import * as React from 'react';
import forEach from 'lodash/forEach';
import isNull from 'lodash/isNull';
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
import PrivacyUtils from './../utils/PrivacyUtils';

import NodeInfoStore from './../stores/NodeInfoStore';
import UnitsStore from './../stores/UnitsStore';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

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
        const transaction: Transaction = navigation.getParam(
            'transaction',
            null
        );
        const { testnet } = NodeInfoStore;

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
                    <Text style={styles.valueWithLink}>
                        {PrivacyUtils.sensitiveValue(address)}
                    </Text>
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

        const amountDisplay = PrivacyUtils.sensitiveValue(
            getAmount(amount),
            8,
            true
        );
        const totalFees = PrivacyUtils.sensitiveValue(
            getAmount(total_fees || 0),
            4,
            true
        );

        return (
            <ScrollView style={styles.scrollView}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Transaction.title'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor="#1f2328"
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
                            amountDisplay}`}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    {total_fees ? (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Transaction.totalFees')}:
                            </Text>
                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text style={styles.value}>
                                    {units && totalFees}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    <Text style={styles.label}>
                        {localeString('views.Transaction.transactionHash')}:
                    </Text>
                    <TouchableOpacity
                        onPress={() =>
                            UrlUtils.goToBlockExplorerTXID(tx, testnet)
                        }
                    >
                        <Text style={styles.valueWithLink}>
                            {PrivacyUtils.sensitiveValue(tx)}
                        </Text>
                    </TouchableOpacity>

                    {!!block_hash && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Transaction.blockHash')}:
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
                                    {PrivacyUtils.sensitiveValue(block_hash)}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {!!block_height && (
                        <Text style={styles.label}>
                            {localeString('views.Transaction.blockHeight')}:
                        </Text>
                    )}
                    {!!block_height && (
                        <TouchableOpacity
                            onPress={() =>
                                UrlUtils.goToBlockExplorerBlockHeight(
                                    block_height,
                                    testnet
                                )
                            }
                        >
                            <Text style={styles.valueWithLink}>
                                {PrivacyUtils.sensitiveValue(
                                    block_height,
                                    5,
                                    true
                                )}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {!isNull(num_confirmations) && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Transaction.numConf')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color:
                                        num_confirmations > 0 ? 'green' : 'red'
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(
                                    num_confirmations,
                                    3,
                                    true
                                )}
                            </Text>
                        </View>
                    )}

                    {!!status && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Transaction.status')}:
                            </Text>
                            <Text style={styles.value}>{status}</Text>
                        </View>
                    )}

                    {!!date && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Transaction.timestamp')}:
                            </Text>
                            <Text style={styles.value}>
                                {PrivacyUtils.sensitiveValue(
                                    date.toString(),
                                    14
                                )}
                            </Text>
                        </View>
                    )}

                    {destAddresses && (
                        <View>
                            <Text style={styles.label}>
                                {destAddresses.length > 1
                                    ? `${localeString(
                                          'views.Transaction.destAddresses'
                                      )}:`
                                    : `${localeString(
                                          'views.Transaction.destAddress'
                                      )}:`}
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
    scrollView: {
        flex: 1,
        backgroundColor: themeColor('background'),
        color: themeColor('text')
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
        paddingTop: 5,
        color: themeColor('text')
    },
    value: {
        paddingBottom: 5,
        color: themeColor('text')
    },
    valueWithLink: {
        paddingBottom: 5,
        color: 'rgba(92, 99,216, 1)'
    }
});
