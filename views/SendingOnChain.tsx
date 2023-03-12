import * as React from 'react';
import { Image, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../components/Button';
import CopyButton from '../components/CopyButton';
import LoadingIndicator from '../components/LoadingIndicator';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

import NodeInfoStore from '../stores/NodeInfoStore';
import TransactionsStore from '../stores/TransactionsStore';

import Success from '../assets/images/GIF/Success.gif';
import WordLogo from '../assets/images/SVG/Word Logo.svg';

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
        const { error } = TransactionsStore;

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
                <View
                    style={{
                        ...styles.content
                    }}
                >
                    {loading && <LoadingIndicator />}
                    {loading && (
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text')
                            }}
                        >
                            {localeString('views.SendingOnChain.broadcasting')}
                        </Text>
                    )}
                    {publishSuccess && (
                        <>
                            <WordLogo
                                height={150}
                                style={{
                                    alignSelf: 'center'
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
                        </>
                    )}
                    {error && error_msg && (
                        <Text
                            style={{
                                ...styles.text,
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
                                ...styles.text,
                                color: themeColor('text'),
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
                                    ...styles.text,
                                    color: themeColor('text'),
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
                            iconOnly
                        />
                    )}

                    <View style={styles.buttons}>
                        {txid && (
                            <View style={{ marginBottom: 10, width: '100%' }}>
                                <CopyButton
                                    title={localeString(
                                        'views.SendingOnChain.copyTxid'
                                    )}
                                    copyValue={txid}
                                />
                            </View>
                        )}

                        {(publishSuccess || error) && (
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
                                titleStyle={{
                                    color: publishSuccess
                                        ? themeColor('background')
                                        : 'darkred'
                                }}
                                buttonStyle={
                                    publishSuccess
                                        ? null
                                        : {
                                              backgroundColor: 'white'
                                          }
                                }
                                containerStyle={{ width: '100%' }}
                                onPress={() => navigation.navigate('Wallet')}
                            />
                        )}
                    </View>
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'Lato-Regular'
    },
    container: {
        flex: 1
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 125
    },
    buttons: {
        flex: 1,
        justifyContent: 'flex-end',
        marginBottom: 35
    }
});
