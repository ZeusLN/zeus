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
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { Row } from '../components/layout/Row';
import Amount from '../components/Amount';
import Button from '../components/Button';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';

import BackendUtils from '../utils/BackendUtils';
import PrivacyUtils from '../utils/PrivacyUtils';
import Transaction from '../models/Transaction';
import UrlUtils from '../utils/UrlUtils';

import NodeInfoStore from '../stores/NodeInfoStore';
import TransactionsStore from '../stores/TransactionsStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import CaretRight from '../assets/images/SVG/Caret Right.svg';
import EditNotes from '../assets/images/SVG/Pen.svg';

interface TransactionProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
    route: Route<'Transaction', { transaction: Transaction }>;
}

interface TransactionState {
    storedNote: string;
}

@inject('NodeInfoStore', 'TransactionsStore')
@observer
export default class TransactionView extends React.Component<
    TransactionProps,
    TransactionState
> {
    state = {
        storedNote: ''
    };
    async componentDidMount() {
        const { navigation, route } = this.props;
        const transaction = route.params?.transaction;
        navigation.addListener('focus', () => {
            this.props.TransactionsStore.resetBroadcast();
            const note = transaction.getNote;
            this.setState({ storedNote: note });
        });
    }
    render() {
        const { NodeInfoStore, navigation, route } = this.props;
        const transaction = route.params?.transaction;
        const { storedNote } = this.state;
        const { testnet } = NodeInfoStore;

        const {
            tx,
            isConfirmed,
            block_hash,
            getBlockHeight,
            num_confirmations,
            time_stamp,
            destAddresses,
            getFee,
            getFeePercentage,
            status,
            getOutpoint,
            raw_tx_hex,
            getNoteKey
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
                                {`${
                                    typeof address === 'string' &&
                                    PrivacyUtils.sensitiveValue(address)
                                }`}
                            </Text>
                        </TouchableOpacity>
                    }
                    key={key}
                    sensitive
                />
            )
        );
        const EditNotesButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('AddNotes', { noteKey: getNoteKey })
                }
            >
                <EditNotes
                    style={{ alignSelf: 'center' }}
                    fill={themeColor('text')}
                />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Transaction.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={<EditNotesButton />}
                    navigation={navigation}
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

                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {getFee ? (
                        <KeyValue
                            keyValue={localeString(
                                'views.Transaction.totalFees'
                            )}
                            value={
                                <Row>
                                    <Amount
                                        sats={getFee || 0}
                                        debit
                                        toggleable
                                        sensitive
                                    />
                                    {getFeePercentage && (
                                        <Text
                                            style={{
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                color: themeColor('text')
                                            }}
                                        >
                                            {` (${getFeePercentage})`}
                                        </Text>
                                    )}
                                </Row>
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
                                    {`${
                                        typeof tx === 'string' &&
                                        PrivacyUtils.sensitiveValue(tx)
                                    }`}
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
                                        {`${
                                            typeof block_hash === 'string' &&
                                            PrivacyUtils.sensitiveValue(
                                                block_hash
                                            )
                                        }`}
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
                                        {`${
                                            typeof getBlockHeight ===
                                                'string' &&
                                            PrivacyUtils.sensitiveValue(
                                                getBlockHeight.toString(),
                                                5,
                                                true
                                            )
                                        }`}
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

                    {raw_tx_hex && (
                        <>
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate('RawTxHex', {
                                        value: raw_tx_hex
                                    })
                                }
                            >
                                <View
                                    style={{
                                        marginTop: 10,
                                        marginBottom: 10
                                    }}
                                >
                                    <Row justify="space-between">
                                        <View style={{ width: '95%' }}>
                                            <KeyValue
                                                keyValue={localeString(
                                                    'views.Transaction.rawTxHex'
                                                )}
                                            />
                                        </View>
                                        <CaretRight
                                            fill={themeColor('text')}
                                            width="20"
                                            height="20"
                                        />
                                    </Row>
                                </View>
                            </TouchableOpacity>
                        </>
                    )}

                    {storedNote && (
                        <TouchableOpacity
                            onPress={() =>
                                navigation.navigate('AddNotes', {
                                    noteKey: getNoteKey
                                })
                            }
                        >
                            <KeyValue
                                keyValue={localeString('general.note')}
                                value={storedNote}
                                sensitive
                            />
                        </TouchableOpacity>
                    )}
                </ScrollView>
                <View style={{ bottom: 15 }}>
                    {!isConfirmed && BackendUtils.supportsBumpFee() && (
                        <Button
                            title={localeString('views.BumpFee.title')}
                            onPress={() =>
                                navigation.navigate('BumpFee', {
                                    outpoint: getOutpoint
                                })
                            }
                            noUppercase
                            containerStyle={{ marginTop: 20 }}
                        />
                    )}

                    {getNoteKey && (
                        <Button
                            title={
                                storedNote
                                    ? localeString(
                                          'views.SendingLightning.UpdateNote'
                                      )
                                    : localeString(
                                          'views.SendingLightning.AddANote'
                                      )
                            }
                            onPress={() =>
                                navigation.navigate('AddNotes', {
                                    noteKey: getNoteKey
                                })
                            }
                            containerStyle={{ marginTop: 20 }}
                            noUppercase
                        />
                    )}
                </View>
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
        fontFamily: 'PPNeueMontreal-Book'
    }
});
