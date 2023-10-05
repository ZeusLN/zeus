import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';

import Amount from './../../components/Amount';
import Header from '../../components/Header';
import KeyValue from './../../components/KeyValue';
import Screen from './../../components/Screen';

import Utxo from './../../models/Utxo';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import UrlUtils from './../../utils/UrlUtils';

import NodeInfoStore from './../../stores/NodeInfoStore';

interface UTXOProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
}

@inject('NodeInfoStore')
@observer
export default class UTXO extends React.Component<UTXOProps> {
    render() {
        const { navigation } = this.props;
        const utxo: Utxo = navigation.getParam('utxo', null);
        const { testnet } = this.props.NodeInfoStore;

        const { getOutpoint, address, getConfs, isUnconfirmed, blockheight } =
            utxo;
        const amount = utxo.getAmount;
        const tx = utxo.txid || utxo.outpoint.txid_str;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('general.utxo'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.center}>
                        <Amount sats={amount} jumboText toggleable sensitive />
                    </View>

                    <KeyValue
                        keyValue={localeString('general.outpoint')}
                        value={getOutpoint}
                    />

                    {!!address && (
                        <KeyValue
                            keyValue={localeString('general.address')}
                            value={
                                <TouchableOpacity
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
                                        {address}
                                    </Text>
                                </TouchableOpacity>
                            }
                            sensitive
                        />
                    )}

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
                                    {tx}
                                </Text>
                            </TouchableOpacity>
                        }
                        sensitive
                    />

                    {!!getConfs && (
                        <KeyValue
                            keyValue={localeString('views.Transaction.numConf')}
                            value={getConfs}
                            color={isUnconfirmed ? 'red' : 'green'}
                            sensitive
                        />
                    )}

                    {blockheight && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Transaction.blockHeight'
                            )}
                            value={blockheight}
                            sensitive
                        />
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
