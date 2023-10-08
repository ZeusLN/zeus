import * as React from 'react';
import EncryptedStorage from 'react-native-encrypted-storage';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../components/Button';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

import NodeInfoStore from '../stores/NodeInfoStore';
import TransactionsStore from '../stores/TransactionsStore';

import Error from '../assets/images/SVG/Error.svg';
import Success from '../assets/images/GIF/Success.gif';
import WordLogo from '../assets/images/SVG/Word Logo.svg';
import CopyBox from '../components/CopyBox';

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
    state = {
        storedNotes: ''
    };
    async componentDidMount() {
        const { TransactionsStore, navigation } = this.props;
        navigation.addListener('didFocus', () => {
            EncryptedStorage.getItem('note-' + TransactionsStore.txid)
                .then((storedNotes) => {
                    this.setState({ storedNotes });
                })
                .catch((error) => {
                    console.error('Error retrieving notes:', error);
                });
        });
    }
    render() {
        const { navigation } = this.props;
        const { loading, publishSuccess, error, error_msg, txid } =
            this.props.TransactionsStore;
        const { testnet } = this.props.NodeInfoStore;
        const { storedNotes } = this.state;

        return (
            <Screen>
                <ScrollView keyboardShouldPersistTaps="handled">
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
                                {localeString(
                                    'views.SendingOnChain.broadcasting'
                                )}
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
                            <View style={{ padding: 20 }}>
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
                                                txid
                                            })
                                        }
                                        secondary
                                        buttonStyle={{ padding: 14 }}
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
                                        containerStyle={{
                                            width: '100%',
                                            margin: 20
                                        }}
                                        secondary
                                        icon={{
                                            name: 'exit-to-app',
                                            size: 25
                                        }}
                                        buttonStyle={{ padding: 10 }}
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
                                    onPress={() =>
                                        navigation.navigate('Wallet')
                                    }
                                />
                            )}
                        </View>
                    </View>
                </ScrollView>
            </Screen>
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
        marginBottom: 35,
        width: '100%'
    }
});
