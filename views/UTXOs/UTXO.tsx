import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Amount from './../../components/Amount';
import KeyValue from './../../components/KeyValue';

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
        const { NodeInfoStore, navigation } = this.props;
        const utxo: Utxo = navigation.getParam('utxo', null);
        const { testnet } = NodeInfoStore;

        const { getOutpoint, address, getConfs, isUnconfirmed, blockheight } =
            utxo;
        const amount = utxo.getAmount;
        const tx = utxo.txid || utxo.outpoint.txid_str;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('CoinControl')}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background'),
                    color: themeColor('text')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('general.utxo'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View style={styles.center}>
                    <Amount sats={amount} jumboText toggleable sensitive />
                </View>

                <View style={styles.content}>
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
    valueWithLink: {
        paddingBottom: 5,
        fontFamily: 'Lato-Regular'
    }
});
