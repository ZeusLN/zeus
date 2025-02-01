import * as React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../components/Button';
import CopyBox from '../components/CopyBox';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import SuccessAnimation from '../components/SuccessAnimation';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

import Storage from '../storage';

import NodeInfoStore from '../stores/NodeInfoStore';
import TransactionsStore from '../stores/TransactionsStore';

import ErrorIcon from '../assets/images/SVG/ErrorIcon.svg';
import Wordmark from '../assets/images/SVG/wordmark-black.svg';

interface SendingOnChainProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
}

@inject('NodeInfoStore', 'TransactionsStore')
@observer
export default class SendingOnChain extends React.Component<
    SendingOnChainProps,
    {}
> {
    state = {
        storedNotes: ''
    };
    async componentDidMount() {
        const { TransactionsStore, navigation } = this.props;
        navigation.addListener('focus', () => {
            if (!TransactionsStore.txid) return;
            Storage.getItem('note-' + TransactionsStore.txid)
                .then((storedNotes) => {
                    this.setState({ storedNotes });
                })
                .catch((error) => {
                    console.error('Error retrieving notes:', error);
                });
        });
    }
    render() {
        const { NodeInfoStore, TransactionsStore, navigation } = this.props;
        const {
            loading,
            crafting,
            publishSuccess,
            error,
            error_msg,
            txid,
            funded_psbt
        } = TransactionsStore;
        const { testnet } = NodeInfoStore;
        const { storedNotes } = this.state;
        const windowSize = Dimensions.get('window');

        if (funded_psbt)
            navigation.navigate('PSBT', {
                psbt: funded_psbt
            });

        return (
            <Screen>
                {loading && (
                    <View
                        style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%'
                        }}
                    >
                        <LoadingIndicator size={windowSize.height / 24} />
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('text'),
                                paddingTop: 30,
                                // paddingBottom for centering
                                paddingBottom: windowSize.height / 10,
                                fontSize:
                                    windowSize.width * windowSize.scale * 0.014
                            }}
                        >
                            {crafting
                                ? localeString('views.SendingOnChain.crafting')
                                : localeString(
                                      'views.SendingOnChain.broadcasting'
                                  )}
                        </Text>
                    </View>
                )}
                {!loading && (
                    <View style={{ flex: 1 }}>
                        <View
                            style={{
                                ...styles.content,
                                paddingTop: windowSize.height * 0.05
                            }}
                        >
                            {publishSuccess && (
                                <>
                                    <Wordmark
                                        height={windowSize.width * 0.25}
                                        width={windowSize.width}
                                        fill={themeColor('highlight')}
                                    />
                                    <View style={{ alignItems: 'center' }}>
                                        <SuccessAnimation />
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text'),
                                                paddingTop:
                                                    windowSize.height * 0.03,
                                                fontSize:
                                                    windowSize.width *
                                                    windowSize.scale *
                                                    0.017,
                                                alignSelf: 'center'
                                            }}
                                        >
                                            {localeString(
                                                'views.SendingOnChain.success'
                                            )}
                                        </Text>
                                    </View>
                                </>
                            )}
                            {(error || error_msg) && (
                                <View style={{ alignItems: 'center' }}>
                                    <ErrorIcon
                                        width={windowSize.height * 0.13}
                                        height={windowSize.height * 0.13}
                                    />
                                    <Text
                                        style={{
                                            color: themeColor('warning'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 32,
                                            margin: 15,
                                            marginTop: windowSize.height * 0.07
                                        }}
                                    >
                                        {localeString('general.error')}
                                    </Text>
                                    {error_msg && (
                                        <Text
                                            style={{
                                                color: themeColor('text'),
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                fontSize:
                                                    windowSize.width *
                                                    windowSize.scale *
                                                    0.014,
                                                textAlign: 'center',
                                                marginTop:
                                                    windowSize.height * 0.025
                                            }}
                                        >
                                            {error_msg}
                                        </Text>
                                    )}
                                </View>
                            )}
                            {txid && (
                                <View style={{ width: '90%' }}>
                                    <CopyBox
                                        heading={localeString(
                                            'views.SendingOnChain.txid'
                                        )}
                                        headingCopied={`${localeString(
                                            'views.SendingOnChain.txid'
                                        )} ${localeString(
                                            'components.ExternalLinkModal.copied'
                                        )}`}
                                        URL={txid}
                                        theme="dark"
                                    />
                                </View>
                            )}
                        </View>

                        <View style={styles.buttons}>
                            {txid && (
                                <>
                                    <Button
                                        title={
                                            storedNotes
                                                ? localeString(
                                                      'views.SendingLightning.UpdateNote'
                                                  )
                                                : localeString(
                                                      'views.SendingLightning.AddANote'
                                                  )
                                        }
                                        onPress={() =>
                                            navigation.navigate('AddNotes', {
                                                noteKey: txid
                                            })
                                        }
                                        secondary
                                        buttonStyle={{ height: 40 }}
                                    />
                                    <Button
                                        title={localeString(
                                            'views.SendingOnChain.goToBlockExplorer'
                                        )}
                                        onPress={() =>
                                            UrlUtils.goToBlockExplorerTXID(
                                                txid,
                                                testnet
                                            )
                                        }
                                        containerStyle={{ width: '100%' }}
                                        secondary
                                        icon={{
                                            name: 'exit-to-app',
                                            size: 25
                                        }}
                                        buttonStyle={{ height: 40 }}
                                    />
                                </>
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
                                    containerStyle={{ width: '100%' }}
                                    buttonStyle={{ height: 40 }}
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
                                    onPress={() => navigation.popTo('Wallet')}
                                    buttonStyle={{ height: 40 }}
                                />
                            )}
                        </View>
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    container: {
        flex: 1
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-evenly',
        height: '100%'
    },
    buttons: {
        justifyContent: 'flex-end',
        width: '100%',
        gap: 15,
        bottom: 15
    }
});
