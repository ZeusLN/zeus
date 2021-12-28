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
import { inject, observer } from 'mobx-react';
import UrlUtils from './../utils/UrlUtils';
import Transaction from './../models/Transaction';
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
            getBlockHeight,
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
                color={themeColor('text')}
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
            <ScrollView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Transaction.title'),
                        style: { color: themeColor('text') }
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
                        >{`${amount > 0 ? '+' : ''}${
                            units && amountDisplay
                        }`}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    {total_fees ? (
                        <View>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Transaction.totalFees')}:
                            </Text>
                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text
                                    style={{
                                        ...styles.value,
                                        color: themeColor('text')
                                    }}
                                >
                                    {units && totalFees}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    <Text
                        style={{ ...styles.label, color: themeColor('text') }}
                    >
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
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
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

                    {!!getBlockHeight && (
                        <Text
                            style={{
                                ...styles.label,
                                color: themeColor('text')
                            }}
                        >
                            {localeString('views.Transaction.blockHeight')}:
                        </Text>
                    )}
                    {!!getBlockHeight && (
                        <TouchableOpacity
                            onPress={() =>
                                UrlUtils.goToBlockExplorerBlockHeight(
                                    getBlockHeight.toString(),
                                    testnet
                                )
                            }
                        >
                            <Text style={styles.valueWithLink}>
                                {PrivacyUtils.sensitiveValue(
                                    getBlockHeight.toString(),
                                    5,
                                    true
                                )}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {!!num_confirmations && !isNull(num_confirmations) && (
                        <View>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
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
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Transaction.status')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {status}
                            </Text>
                        </View>
                    )}

                    {!!date && (
                        <View>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.Transaction.timestamp')}:
                            </Text>
                            <Text
                                style={{
                                    ...styles.value,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(
                                    date.toString(),
                                    14
                                )}
                            </Text>
                        </View>
                    )}

                    {destAddresses && (
                        <View>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
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
