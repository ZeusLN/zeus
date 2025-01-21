import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    TextInput as TextInputRN,
    Keyboard
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { ErrorMessage } from '../../components/SuccessErrorMessage';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import {
    createLndWallet,
    optimizeNeutrinoPeers
} from '../../utils/LndMobileUtils';

import { BIP39_WORD_LIST } from '../../utils/Bip39Utils';

import SettingsStore from '../../stores/SettingsStore';
import LoadingIndicator from '../../components/LoadingIndicator';

interface SeedRecoveryProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    route: Route<'SeedRecovery', { network: string }>;
}

interface SeedRecoveryState {
    loading: boolean;
    network: string;
    selectedInputType: 'word' | 'scb' | null;
    selectedWordIndex: number | null;
    selectedText: string;
    seedArray: string[];
    filteredData: string[];
    showSuggestions: boolean;
    seedPhrase: string[];
    walletPassword: string;
    adminMacaroon: string;
    embeddedLndNetwork: string;
    recoveryCipherSeed: string;
    channelBackupsBase64: string;
    errorCreatingWallet: boolean;
    errorMsg: string;
}

@inject('SettingsStore')
@observer
export default class SeedRecovery extends React.PureComponent<
    SeedRecoveryProps,
    SeedRecoveryState
> {
    textInput: React.RefObject<TextInputRN>;
    constructor(props: SeedRecoveryProps) {
        super(props);

        this.textInput = React.createRef<TextInputRN>();
        this.state = {
            loading: false,
            network: 'mainnet',
            selectedInputType: null,
            selectedWordIndex: null,
            selectedText: '',
            seedArray: [],
            seedPhrase: [],
            filteredData: [],
            showSuggestions: false,
            walletPassword: '',
            adminMacaroon: '',
            embeddedLndNetwork: 'mainnet',
            recoveryCipherSeed: '',
            channelBackupsBase64: '',
            errorCreatingWallet: false,
            errorMsg: ''
        };
    }

    async componentDidMount() {
        await this.initFromProps(this.props);
    }

    UNSAFE_componentWillReceiveProps(nextProps: any) {
        this.initFromProps(nextProps);
    }

    async initFromProps(props: SeedRecoveryProps) {
        const network = props.route.params?.network ?? 'mainnet';
        this.setState({ network });
    }

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        if (settings.privacy && settings.privacy.clipboard) {
            const clipboard = await Clipboard.getString();

            const seedArray = clipboard.split(' ');
            if (seedArray.length === 24) {
                this.setState({ seedArray });
            }
        }
    }

    saveWalletConfiguration = (recoveryCipherSeed?: string) => {
        const { SettingsStore, navigation } = this.props;
        const {
            walletPassword,
            adminMacaroon,
            embeddedLndNetwork,
            seedPhrase
        } = this.state;
        const { setConnectingStatus, updateSettings, settings } = SettingsStore;

        const node = {
            seedPhrase,
            walletPassword,
            adminMacaroon,
            embeddedLndNetwork,
            implementation: 'embedded-lnd'
        };

        let nodes: any;
        if (settings.nodes) {
            nodes = settings.nodes || [];
            nodes[nodes.length] = node;
        } else {
            nodes = [node];
        }

        updateSettings({ nodes }).then(async () => {
            if (recoveryCipherSeed) {
                await updateSettings({
                    recovery: true
                });
            }

            if (nodes.length === 1) {
                setConnectingStatus(true);
                SettingsStore.triggerSettingsRefresh = true;
                navigation.popTo('Wallet');
            } else {
                navigation.popTo('Wallets');
            }
        });
    };

    render() {
        const { navigation } = this.props;
        const {
            loading,
            network,
            selectedWordIndex,
            selectedInputType,
            selectedText,
            seedArray,
            channelBackupsBase64,
            showSuggestions,
            filteredData,
            errorMsg
        } = this.state;

        const filterData = (text: string) =>
            BIP39_WORD_LIST.filter((val: string) =>
                val?.toLowerCase()?.startsWith(text?.toLowerCase())
            );

        const RecoveryLabel = ({
            type,
            index,
            text
        }: {
            type: 'mnemonicWord' | 'scb';
            index?: number;
            text?: string;
        }) => {
            return (
                <TouchableOpacity
                    onPress={() => {
                        if (showSuggestions) {
                            if (type === 'scb') {
                                this.setState({
                                    channelBackupsBase64: text || '',
                                    selectedText: text || ''
                                });
                            } else if (selectedWordIndex != null) {
                                seedArray[selectedWordIndex] = text || '';
                                this.setState({ seedArray } as any);
                                if (selectedWordIndex < 23) {
                                    this.setState({
                                        selectedWordIndex:
                                            selectedWordIndex + 1,
                                        selectedText:
                                            seedArray[selectedWordIndex + 1]
                                    });
                                } else {
                                    this.setState({ selectedText: text || '' });
                                }
                            }
                        } else {
                            this.setState({ selectedText: text || '' });
                            if (index != null) {
                                this.setState({
                                    selectedInputType: 'word',
                                    selectedWordIndex: index
                                });
                            } else {
                                this.setState({ selectedInputType: 'scb' });
                            }
                        }

                        this.setState({ showSuggestions: false });

                        // set focus
                        if (!Keyboard.isVisible()) {
                            this.textInput?.current?.blur();
                            this.textInput?.current?.focus();
                        }
                    }}
                    style={{
                        padding: 8,
                        backgroundColor: themeColor('secondary'),
                        borderRadius: 5,
                        marginTop: 4,
                        marginBottom: 4,
                        marginLeft: 6,
                        marginRight: 6,
                        flexDirection: 'row',
                        maxHeight: type === 'scb' ? 60 : undefined
                    }}
                >
                    {!showSuggestions && index != null && (
                        <View>
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color:
                                        selectedInputType === 'word' &&
                                        selectedWordIndex === index
                                            ? themeColor('highlight')
                                            : themeColor('secondaryText'),
                                    fontSize: 18,
                                    alignSelf: 'flex-start'
                                }}
                            >
                                {index + 1}
                            </Text>
                        </View>
                    )}
                    {!showSuggestions && type === 'scb' && (
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                color:
                                    selectedInputType === 'scb'
                                        ? themeColor('highlight')
                                        : themeColor('secondaryText'),
                                fontSize: 18,
                                alignSelf: 'flex-start'
                            }}
                        >
                            {localeString(
                                'views.Settings.AddEditNode.disasterRecoveryBase64'
                            )}
                        </Text>
                    )}
                    <Text
                        style={{
                            flex: 1,
                            fontFamily: 'PPNeueMontreal-Medium',
                            color: themeColor('text'),
                            fontSize: 18,
                            alignSelf:
                                type === 'mnemonicWord'
                                    ? 'flex-end'
                                    : undefined,
                            margin: 0,
                            marginLeft: showSuggestions ? 0 : 10,
                            padding: 0
                        }}
                    >
                        {text}
                    </Text>
                </TouchableOpacity>
            );
        };

        const halfwayThrough = Math.ceil(filteredData.length / 2);
        const suggestionsOne = filteredData.slice(0, halfwayThrough);
        const suggestionsTwo = filteredData.slice(
            halfwayThrough,
            filteredData.length
        );

        const restore = async () => {
            this.setState({ loading: true });

            await optimizeNeutrinoPeers(network === 'testnet');

            const recoveryCipherSeed = seedArray.join(' ');

            try {
                const response = await createLndWallet(
                    recoveryCipherSeed,
                    undefined,
                    false,
                    network === 'testnet',
                    channelBackupsBase64
                );

                const { wallet, seed, randomBase64 }: any = response;

                if (wallet && wallet.admin_macaroon) {
                    this.setState({
                        adminMacaroon: wallet.admin_macaroon,
                        seedPhrase: seed.cipher_seed_mnemonic,
                        walletPassword: randomBase64,
                        embeddedLndNetwork:
                            network.charAt(0).toUpperCase() + network.slice(1)
                    });

                    this.saveWalletConfiguration(recoveryCipherSeed);
                } else {
                    this.setState({
                        loading: false,
                        errorCreatingWallet: true
                    });
                }
            } catch (e: any) {
                this.setState({
                    errorCreatingWallet: true,
                    errorMsg: e.toString(),
                    loading: false
                });
            }
        };

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.SeedRecovery.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                {errorMsg && <ErrorMessage message={errorMsg} dismissable />}
                {loading && <LoadingIndicator />}
                {!loading && (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <View>
                            {selectedInputType != null && (
                                <TextInput
                                    ref={this.textInput}
                                    onFocus={() => {
                                        if (selectedText.length === 0) {
                                            this.setState({
                                                showSuggestions: true
                                            });
                                        }
                                    }}
                                    value={selectedText}
                                    prefix={
                                        selectedInputType === 'word'
                                            ? (selectedWordIndex as number) + 1
                                            : 'SCB'
                                    }
                                    prefixStyle={{
                                        color: themeColor('highlight')
                                    }}
                                    style={{
                                        margin: 20,
                                        marginLeft: 10,
                                        marginRight: 10,
                                        width: '90%',
                                        alignSelf: 'center'
                                    }}
                                    autoCapitalize="none"
                                    autoFocus
                                    onChangeText={(text: string) => {
                                        this.setState({
                                            errorMsg: '',
                                            selectedText: text
                                        });

                                        if (selectedInputType === 'word') {
                                            this.setState({
                                                showSuggestions:
                                                    text.length > 0
                                                        ? true
                                                        : false
                                            });
                                        }

                                        if (text && text.length > 0) {
                                            this.setState({
                                                filteredData: filterData(text)
                                            });
                                        } else if (text && text.length === 0) {
                                            this.setState({
                                                filteredData: BIP39_WORD_LIST
                                            });
                                        }

                                        if (selectedInputType === 'scb') {
                                            this.setState({
                                                channelBackupsBase64: text
                                            });
                                        } else if (selectedWordIndex != null) {
                                            seedArray[selectedWordIndex] = text;
                                            this.setState({ seedArray });
                                        }
                                    }}
                                />
                            )}
                        </View>
                        {!showSuggestions && (
                            <>
                                <ScrollView
                                    contentContainerStyle={{
                                        flexGrow: 1,
                                        flexDirection: 'row'
                                    }}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    <View
                                        style={{
                                            ...styles.column,
                                            alignSelf: !selectedInputType
                                                ? 'center'
                                                : undefined
                                        }}
                                    >
                                        {[
                                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
                                        ].map((index: number) => {
                                            return (
                                                <RecoveryLabel
                                                    type="mnemonicWord"
                                                    index={index}
                                                    text={seedArray[index]}
                                                />
                                            );
                                        })}
                                    </View>
                                    <View
                                        style={{
                                            ...styles.column,
                                            alignSelf: !selectedInputType
                                                ? 'center'
                                                : undefined
                                        }}
                                    >
                                        {[
                                            12, 13, 14, 15, 16, 17, 18, 19, 20,
                                            21, 22, 23
                                        ].map((index: number) => {
                                            return (
                                                <RecoveryLabel
                                                    type="mnemonicWord"
                                                    index={index}
                                                    text={seedArray[index]}
                                                />
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                                <View
                                    style={{
                                        flexGrow: 1,
                                        flexDirection: 'row'
                                    }}
                                >
                                    <View style={styles.scb}>
                                        <RecoveryLabel
                                            type="scb"
                                            text={channelBackupsBase64}
                                        />
                                    </View>
                                </View>
                            </>
                        )}
                        {showSuggestions && (
                            <ScrollView
                                contentContainerStyle={{
                                    flexGrow: 1,
                                    flexDirection: 'row'
                                }}
                                keyboardShouldPersistTaps="handled"
                            >
                                <View style={styles.column}>
                                    {suggestionsOne.map((key) => {
                                        return (
                                            <RecoveryLabel
                                                type="mnemonicWord"
                                                text={key}
                                            />
                                        );
                                    })}
                                </View>
                                <View style={styles.column}>
                                    {suggestionsTwo.map((key) => {
                                        return (
                                            <RecoveryLabel
                                                type="mnemonicWord"
                                                text={key}
                                            />
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        )}
                        {!showSuggestions && (
                            <View
                                style={{
                                    alignSelf: 'center',
                                    marginTop: 45,
                                    bottom: 35,
                                    backgroundColor: themeColor('background'),
                                    width: '100%'
                                }}
                            >
                                <Button
                                    onPress={() => restore()}
                                    title={
                                        network === 'mainnet'
                                            ? localeString(
                                                  'views.Settings.NodeConfiguration.restoreMainnetWallet'
                                              )
                                            : localeString(
                                                  'views.Settings.NodeConfiguration.restoreTestnetWallet'
                                              )
                                    }
                                    disabled={
                                        seedArray.length !== 24 ||
                                        seedArray.some((seed) => !seed)
                                    }
                                />
                            </View>
                        )}
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
    whiteText: {
        color: 'white',
        fontFamily: 'PPNeueMontreal-Book'
    },
    blackText: {
        color: 'black',
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10,
        width: 350,
        alignSelf: 'center'
    },
    modal: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 35,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 22
    },
    column: {
        marginTop: 8,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        flexDirection: 'row',
        width: '50%'
    },
    scb: {
        alignItems: 'flex-start',
        flexDirection: 'column',
        marginTop: 8,
        width: '100%',
        lineHeight: 1
    }
});
