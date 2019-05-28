import * as React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button } from 'react-native-elements';
import UrlUtils from './../utils/UrlUtils';
import CopyButton from './../components/CopyButton';

import NodeInfoStore from './../stores/NodeInfoStore';
import TransactionsStore from './../stores/TransactionsStore';

interface SendingOnChainProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
}

@inject('NodeInfoStore', 'TransactionsStore')
@observer
export default class SendingOnChain extends React.Component<SendingOnChainProps, {}> {
    getBackgroundColor() {
        const { TransactionsStore } = this.props;
        const { txid, error } = TransactionsStore;

        if (error) {
            return 'darkred';
        } else if (txid) {
            return 'green'
        }

        return 'white';
    }

    render() {
        const { NodeInfoStore, TransactionsStore, navigation } = this.props;
        const { loading, error, error_msg, txid } = TransactionsStore;
        const { testnet } = NodeInfoStore;

        return (
            <View style={{ ...styles.container, backgroundColor: this.getBackgroundColor() }}>
                <View style={styles.content}>
                    {loading && <ActivityIndicator size="large" color="#0000ff" />}
                    {loading && <Text>Broadcasting Transaction</Text>}
                    {error && <Text style={{ color: 'white', padding: 20, fontSize: 30 , alignSelf: 'center' }}>{error_msg}</Text>}
                    {txid && <Text style={{ color: 'white', padding: 20, fontSize: 30, alignSelf: 'center' }}>Transaction successfully sent</Text>}
                    {txid && <TouchableOpacity onPress={() => UrlUtils.goToBlockExplorerTXID(txid, testnet)}>
                        <Text style={{ color: 'white', padding: 20, fontSize: 15 }}>
                            {`TXID: ${txid}`}
                        </Text>
                    </TouchableOpacity>}
                    {txid && <View style={styles.button}>
                        <Button
                            title=""
                            icon={{
                                name: "check",
                                size: 125,
                                color: "white"
                            }}
                            onPress={() => void(0)}
                            buttonStyle={{
                                backgroundColor: "transparent"
                            }}
                        />
                    </View>}
                    {error && <View style={styles.button}>
                        <Button
                            title=""
                            icon={{
                                name: "error",
                                size: 125,
                                color: "white"
                            }}
                            buttonStyle={{
                                backgroundColor: "transparent",
                                borderRadius: 30
                            }}
                            onPress={() => void(0)}
                        />
                    </View>}
                    {txid && <View style={styles.button}>
                        <CopyButton
                            title="Copy TXID to Clipboard"
                            copyValue={txid}
                        />
                    </View>}

                    {txid && <View style={styles.button}>
                        <Button
                            title="Go to Wallet"
                            icon={{
                                name: "list",
                                size: 25,
                                color: "green"
                            }}
                            buttonStyle={{
                                backgroundColor: "#fff",
                                borderRadius: 30
                            }}
                            titleStyle={{
                                color: "green"
                            }}
                            onPress={() => navigation.navigate('Wallet')}
                        />
                    </View>}
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10
    }
});