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

import Amount from '../components/Amount';
import Button from '../components/Button';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';

import BackendUtils from '../utils/BackendUtils';
import PrivacyUtils from '../utils/PrivacyUtils';
import Transaction from '../models/Transaction';
import UrlUtils from '../utils/UrlUtils';

import NodeInfoStore from '../stores/NodeInfoStore';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface TransactionProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
}

@inject('NodeInfoStore')
@observer
export default class TransactionView extends React.Component<TransactionProps> {
    render() {
        const { NodeInfoStore, navigation } = this.props;
        const transaction: Transaction = navigation.getParam(
            'transaction',
            null
        );
        const { testnet } = NodeInfoStore;

        const {
            tx,
            isConfirmed,
            block_hash,
            getBlockHeight,
            num_confirmations,
            time_stamp,
            destAddresses,
            total_fees,
            status,
            getOutpoint
        } = transaction;
        const amount = transaction.getAmount;
        const date = time_stamp && new Date(Number(time_stamp) * 1000);
        const addresses: Array<any> = [];

        destAddresses.length > 1
            ? `${localeString('views.Transaction.destAddresses')}:`
            : `${localeString('views.Transaction.destAddress')}:`;

        forEach(destAddresses, (address: any, key: string) =>
            addresses.push(
                <KeyValue
                    keyValue={
                        destAddresses.length > 1
                            ? `${localeString(
                                  'views.Transaction.destAddresses'
                              )} #${Number(key) + 1}`
                            : localeString('views.Transaction.destAddress')
                    }
                    value={
                        <TouchableOpacity
                            key={`${address}-${key}`}
                            onPress={() =>
                                UrlUtils.goToBlockExplorerAddress(
                                    address,
                                    testnet
                                )
                            }
                        >
                            <Text
                                style={{
                                    ...styles.valueWithLink,
                                    color: themeColor('highlight')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(address)}
                            </Text>
                        </TouchableOpacity>
                    }
                    key={key}
                    sensitive
                />
            )
        );

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <Screen>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Transaction.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor="transparent"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View style={styles.center}>
                    <Amount
                        sats={amount}
                        debit={Number(amount) <= 0}
                        credit={Number(amount) > 0}
                        sensitive
                        jumboText
                        toggleable
                    />
                </View>

                <ScrollView style={styles.content}>
                    {total_fees ? (
                        <KeyValue
                            keyValue={localeString(
                                'views.Transaction.totalFees'
                            )}
                            value={
                                <Amount
                                    sats={total_fees || 0}
                                    toggleable
                                    sensitive
                                />
                            }
                        />
                    ) : null}

                    <KeyValue
                        keyValue={localeString(
                            'views.Transaction.transactionHash'
                        )}
                        value={
                            <TouchableOpacity
                                onPress={() =>
                                    UrlUtils.goToBlockExplorerTXID(tx, testnet)
                                }
                            >
                                <Text
                                    style={{
                                        ...styles.valueWithLink,
                                        color: themeColor('highlight')
                                    }}
                                >
                                    {PrivacyUtils.sensitiveValue(tx)}
                                </Text>
                            </TouchableOpacity>
                        }
                    />

                    {!!block_hash && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Transaction.blockHash'
                            )}
                            value={
                                <TouchableOpacity
                                    onPress={() =>
                                        UrlUtils.goToBlockExplorerBlockHash(
                                            block_hash,
                                            testnet
                                        )
                                    }
                                >
                                    <Text
                                        style={{
                                            ...styles.valueWithLink,
                                            color: themeColor('highlight')
                                        }}
                                    >
                                        {PrivacyUtils.sensitiveValue(
                                            block_hash
                                        )}
                                    </Text>
                                </TouchableOpacity>
                            }
                        />
                    )}

                    {!!getBlockHeight && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Transaction.blockHeight'
                            )}
                            value={
                                <TouchableOpacity
                                    onPress={() =>
                                        UrlUtils.goToBlockExplorerBlockHeight(
                                            getBlockHeight.toString(),
                                            testnet
                                        )
                                    }
                                >
                                    <Text
                                        style={{
                                            ...styles.valueWithLink,
                                            color: themeColor('highlight')
                                        }}
                                    >
                                        {PrivacyUtils.sensitiveValue(
                                            getBlockHeight.toString(),
                                            5,
                                            true
                                        )}
                                    </Text>
                                </TouchableOpacity>
                            }
                        />
                    )}

                    {!!num_confirmations && !isNull(num_confirmations) && (
                        <KeyValue
                            keyValue={localeString('views.Transaction.numConf')}
                            value={num_confirmations}
                            color={num_confirmations > 0 ? 'green' : 'red'}
                            sensitive
                        />
                    )}

                    {!!status && (
                        <KeyValue
                            keyValue={localeString('views.Transaction.status')}
                            value={status}
                        />
                    )}

                    {!!date && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Transaction.timestamp'
                            )}
                            value={date.toString()}
                            sensitive
                        />
                    )}

                    {!!destAddresses && (
                        <React.Fragment>{addresses}</React.Fragment>
                    )}

                    {!isConfirmed && BackendUtils.supportsBumpFee() && (
                        <View style={{ marginTop: 20 }}>
                            <Button
                                title={localeString('views.BumpFee.title')}
                                onPress={() =>
                                    navigation.navigate('BumpFee', {
                                        outpoint: getOutpoint
                                    })
                                }
                                noUppercase
                            />
                        </View>
                    )}
                </ScrollView>
            </Screen>
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
    valueWithLink: {
        paddingBottom: 5,
        fontFamily: 'Lato-Regular'
    }
});
