import * as React from 'react';
import {
    Image,
    StyleSheet,
    Text,
    ScrollView,
    View,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button } from 'react-native-elements';

import CopyButton from './../components/CopyButton';
import LoadingIndicator from './../components/LoadingIndicator';

import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';
import UrlUtils from './../utils/UrlUtils';

import NodeInfoStore from './../stores/NodeInfoStore';
import TransactionsStore from './../stores/TransactionsStore';

import Success from './../images/GIF/Success.gif';
import WordLogo from './../images/SVG/Word Logo.svg';

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
        }

        return themeColor('background');
    }

    render() {
        const { NodeInfoStore, TransactionsStore, navigation } = this.props;
        const { loading, publishSuccess, error, error_msg, txid } =
            TransactionsStore;
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
                    {loading && <LoadingIndicator />}
                    {loading && (
                        <Text
                            style={{
                                color: themeColor('text')
                            }}
                        >
                            {localeString('views.SendingOnChain.broadcasting')}
                        </Text>
                    )}
                    {publishSuccess && (
                        <View style={styles.success}>
                            <WordLogo
                                width={250}
                                style={{
                                    alignSelf: 'center',
                                    top: -100,
                                    marginBottom: -250
                                }}
                            />
                            <Image
                                source={Success}
                                style={{
                                    width: 290,
                                    height: 290,
                                    marginTop: -50,
                                    marginBottom: -50
                                }}
                            />
                        </View>
                    )}
                    {error && error_msg && (
                        <Text
                            style={{
                                color: themeColor('text'),
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
                                fontSize: 22,
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
                                    color: publishSuccess
                                        ? themeColor('background')
                                        : 'darkred'
                                }}
                                buttonStyle={{
                                    backgroundColor: '#fff',
                                    borderRadius: 30
                                }}
                                titleStyle={{
                                    color: publishSuccess
                                        ? themeColor('background')
                                        : 'darkred'
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
    },
    success: {
        margin: 0
    }
});
