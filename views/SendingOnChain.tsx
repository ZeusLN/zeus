import * as React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    ScrollView,
    View,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button } from 'react-native-elements';
import UrlUtils from './../utils/UrlUtils';
import CopyButton from './../components/CopyButton';
import { localeString } from './../utils/LocaleUtils';

import NodeInfoStore from './../stores/NodeInfoStore';
import TransactionsStore from './../stores/TransactionsStore';

interface SendingOnChainProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
}

@inject('NodeInfoStore', 'TransactionsStore')
@observer
export default class SendingOnChain extends React.Component<
    SendingOnChainProps,
    {}
> {
    getBackgroundColor() {
        const { TransactionsStore } = this.props;
        const { txid, publishSuccess, error } = TransactionsStore;

        if (error) {
            return 'darkred';
        } else if (txid || publishSuccess) {
            return 'green';
        }

        return 'white';
    }

    render() {
        const { NodeInfoStore, TransactionsStore, navigation } = this.props;
        const {
            loading,
            publishSuccess,
            error,
            error_msg,
            txid
        } = TransactionsStore;
        const { testnet } = NodeInfoStore;

        return (
            <View
                style={{
                    ...styles.container,
                    backgroundColor: this.getBackgroundColor()
                }}
            >
                <ScrollView
                    contentContainerStyle={{
                        ...styles.content,
                        height: '100%'
                    }}
                >
                    {loading && (
                        <ActivityIndicator size="large" color="#0000ff" />
                    )}
                    {loading && (
                        <Text>
                            {localeString('views.SendingOnChain.broadcasting')}
                        </Text>
                    )}
                    {error && error_msg && (
                        <Text
                            style={{
                                color: 'white',
                                padding: 20,
                                fontSize: 30,
                                alignSelf: 'center'
                            }}
                        >
                            {error_msg}
                        </Text>
                    )}
                    {publishSuccess && (
                        <Text
                            style={{
                                color: 'white',
                                padding: 20,
                                fontSize: 30,
                                alignSelf: 'center'
                            }}
                        >
                            {localeString('views.SendingOnChain.success')}
                        </Text>
                    )}
                    {txid && (
                        <TouchableOpacity
                            onPress={() =>
                                UrlUtils.goToBlockExplorerTXID(txid, testnet)
                            }
                        >
                            <Text
                                style={{
                                    color: 'white',
                                    padding: 20,
                                    fontSize: 15
                                }}
                            >
                                {`${localeString(
                                    'views.SendingOnChain.txid'
                                )}: ${txid}`}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {publishSuccess && (
                        <View style={styles.button}>
                            <Button
                                title=""
                                icon={{
                                    name: 'check',
                                    size: 125,
                                    color: 'white'
                                }}
                                onPress={() => void 0}
                                buttonStyle={{
                                    backgroundColor: 'transparent'
                                }}
                            />
                        </View>
                    )}
                    {error && (
                        <View style={styles.button}>
                            <Button
                                title=""
                                icon={{
                                    name: 'error',
                                    size: 125,
                                    color: 'white'
                                }}
                                buttonStyle={{
                                    backgroundColor: 'transparent',
                                    borderRadius: 30
                                }}
                                onPress={() => void 0}
                            />
                        </View>
                    )}
                    {txid && (
                        <View style={styles.button}>
                            <CopyButton
                                title={localeString(
                                    'views.SendingOnChain.copyTxid'
                                )}
                                copyValue={txid}
                            />
                        </View>
                    )}

                    {(publishSuccess || error) && (
                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.SendingOnChain.goToWallet'
                                )}
                                icon={{
                                    name: 'list',
                                    size: 25,
                                    color: publishSuccess ? 'green' : 'darkred'
                                }}
                                buttonStyle={{
                                    backgroundColor: '#fff',
                                    borderRadius: 30
                                }}
                                titleStyle={{
                                    color: publishSuccess ? 'green' : 'darkred'
                                }}
                                onPress={() => navigation.navigate('Wallet')}
                            />
                        </View>
                    )}
                </ScrollView>
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
        paddingTop: 15,
        paddingBottom: 15
    }
});
