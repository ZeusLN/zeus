import * as React from 'react';
import { Image, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../components/Button';
import CopyButton from '../components/CopyButton';
import LoadingIndicator from '../components/LoadingIndicator';
<<<<<<< Updated upstream
=======
import Screen from '../components/Screen';
>>>>>>> Stashed changes

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

import NodeInfoStore from '../stores/NodeInfoStore';
import TransactionsStore from '../stores/TransactionsStore';

import Error from '../assets/images/SVG/Error.svg';
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
    render() {
        const { NodeInfoStore, TransactionsStore, navigation } = this.props;
        const { loading, publishSuccess, error, error_msg, txid } =
            TransactionsStore;
        const { testnet } = NodeInfoStore;

        return (
<<<<<<< Updated upstream
            <View
                style={{
                    ...styles.container,
                    backgroundColor: themeColor('background')
                }}
            >
=======
            <Screen>
>>>>>>> Stashed changes
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
                    {(error || error_msg) && (
                        <>
                            <Error width="27%" />
                            <Text
                                style={{
                                    color: '#FF9090',
                                    fontFamily: 'Lato-Regular',
                                    fontSize: 32
                                }}
                            >
                                {localeString('general.error')}
                            </Text>
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

                        {error && (
                            <Button
                                title={localeString(
                                    'views.SendingLightning.tryAgain'
                                )}
                                icon={{
                                    name: 'return-up-back',
                                    type: 'ionicon',
                                    size: 25
                                }}
                                onPress={() => navigation.goBack()}
                                containerStyle={{
                                    width: '100%',
                                    margin: 20
                                }}
                            />
                        )}

                        {(publishSuccess || error) && (
                            <Button
                                title={localeString(
                                    'views.SendingOnChain.goToWallet'
                                )}
                                icon={{
                                    name: 'list',
                                    size: 25,
                                    color: themeColor('background')
                                }}
                                titleStyle={{
                                    color: themeColor('background')
                                }}
                                containerStyle={{ width: '100%' }}
                                onPress={() => navigation.navigate('Wallet')}
                            />
                        )}
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'Lato-Regular'
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
        marginBottom: 35,
        width: '100%'
    }
});
