import * as React from 'react';
import { ActivityIndicator, Clipboard, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, Header, Icon } from 'react-native-elements';
import UrlUtils from './../utils/UrlUtils';

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

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Send')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View style={{ ...styles.container, backgroundColor: this.getBackgroundColor() }}>
              <Header
                  leftComponent={<BackButton />}
                  centerComponent={{ text: 'Sending On-chain Transaction', style: { color: '#fff' } }}
                  backgroundColor="transparent"
              />
                <View style={styles.content}>
                    {loading && <ActivityIndicator size="large" color="#0000ff" />}
                    {loading && <Text>Broadcasting Transaction</Text>}
                    {error && <Text style={{ color: 'white', padding: 20, fontSize: 40 }}>{error_msg}</Text>}
                    {txid && <Text style={{ color: 'white', padding: 20, fontSize: 40 }}>Transaction successfully sent</Text>}
                    {txid && <TouchableOpacity onPress={() => UrlUtils.goToBlockExplorerTXID(txid, testnet)}>
                        <Text style={{ color: 'white', padding: 20, fontSize: 15 }}>
                            {`TXID: ${txid}`}
                        </Text>
                    </TouchableOpacity>}
                    {txid && <Button
                        title=""
                        icon={{
                            name: "check",
                            size: 125,
                            color: "white"
                        }}
                        backgroundColor="transparent"
                        style={{ padding: 20 }}
                        onPress={() => void(0)}
                    />}
                    {error && <Button
                        title=""
                        icon={{
                            name: "error",
                            size: 125,
                            color: "white"
                        }}
                        backgroundColor="transparent"
                        style={{ padding: 20 }}
                        onPress={() => void(0)}
                    />}
                    {txid && <Button
                        title="Copy TXID to Clipboard"
                        icon={{
                            name: "content-copy",
                            size: 25,
                            color: "green"
                        }}
                        color="green"
                        backgroundColor="#fff"
                        onPress={() => Clipboard.setString(txid)}
                        style={styles.button}
                        borderRadius={30}
                    />}

                    {txid && <Button
                        title="Go to Wallet"
                        icon={{
                            name: "list",
                            size: 25,
                            color: "green"
                        }}
                        color="green"
                        backgroundColor="#fff"
                        onPress={() => navigation.navigate('Wallet')}
                        style={styles.button}
                        borderRadius={30}
                    />}
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