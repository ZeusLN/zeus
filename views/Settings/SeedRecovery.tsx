import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';

import { ErrorMessage } from '../../components/SuccessErrorMessage';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import { createLndWallet } from '../../utils/LndMobileUtils';

import { BIP39_WORD_LIST } from '../../utils/Bip39Utils';

import SettingsStore from '../../stores/SettingsStore';
import LoadingIndicator from '../../components/LoadingIndicator';

interface SeedRecoveryProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface SeedRecoveryState {
    loading: boolean;
    network: string;
    selectedIndex: number | null;
    selectedText: string;
    seed0: string;
    seed1: string;
    seed2: string;
    seed3: string;
    seed4: string;
    seed5: string;
    seed6: string;
    seed7: string;
    seed8: string;
    seed9: string;
    seed10: string;
    seed11: string;
    seed12: string;
    seed13: string;
    seed14: string;
    seed15: string;
    seed16: string;
    seed17: string;
    seed18: string;
    seed19: string;
    seed20: string;
    seed21: string;
    seed22: string;
    seed23: string;
    filteredData: Array<string>;
    showSuggestions: boolean;
    //
    seedPhrase: Array<string>;
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
    textInput: any;
    constructor(props: SeedRecoveryProps) {
        super(props);

        this.textInput = React.createRef();
        this.state = {
            loading: false,
            network: 'mainnet',
            selectedIndex: null,
            selectedText: '',
            seedPhrase: [],
            seed0: '',
            seed1: '',
            seed2: '',
            seed3: '',
            seed4: '',
            seed5: '',
            seed6: '',
            seed7: '',
            seed8: '',
            seed9: '',
            seed10: '',
            seed11: '',
            seed12: '',
            seed13: '',
            seed14: '',
            seed15: '',
            seed16: '',
            seed17: '',
            seed18: '',
            seed19: '',
            seed20: '',
            seed21: '',
            seed22: '',
            seed23: '',
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

    async initFromProps(props: any) {
        const { navigation } = props;

        const network = navigation.getParam('network', 'mainnet');

        this.setState({
            network
        });
    }

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        if (settings.privacy && settings.privacy.clipboard) {
            const clipboard = await Clipboard.getString();

            const seedArrray = clipboard.split(' ');
            if (seedArrray.length === 24) {
                const [
                    seed0,
                    seed1,
                    seed2,
                    seed3,
                    seed4,
                    seed5,
                    seed6,
                    seed7,
                    seed8,
                    seed9,
                    seed10,
                    seed11,
                    seed12,
                    seed13,
                    seed14,
                    seed15,
                    seed16,
                    seed17,
                    seed18,
                    seed19,
                    seed20,
                    seed21,
                    seed22,
                    seed23
                ] = seedArrray;

                this.setState({
                    seed0,
                    seed1,
                    seed2,
                    seed3,
                    seed4,
                    seed5,
                    seed6,
                    seed7,
                    seed8,
                    seed9,
                    seed10,
                    seed11,
                    seed12,
                    seed13,
                    seed14,
                    seed15,
                    seed16,
                    seed17,
                    seed18,
                    seed19,
                    seed20,
                    seed21,
                    seed22,
                    seed23
                });
            }
        }
    }

    saveNodeConfiguration = (recoveryCipherSeed?: string) => {
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
                navigation.navigate('Wallet', { refresh: true });
            } else {
                navigation.navigate('Nodes', { refresh: true });
            }
        });
    };

    render() {
        const { navigation } = this.props;
        const {
            loading,
            network,
            selectedIndex,
            selectedText,
            seed0,
            seed1,
            seed2,
            seed3,
            seed4,
            seed5,
            seed6,
            seed7,
            seed8,
            seed9,
            seed10,
            seed11,
            seed12,
            seed13,
            seed14,
            seed15,
            seed16,
            seed17,
            seed18,
            seed19,
            seed20,
            seed21,
            seed22,
            seed23,
            channelBackupsBase64,
            showSuggestions,
            filteredData,
            errorMsg
        } = this.state;

        const filterData = (text: string) =>
            BIP39_WORD_LIST.filter((val: string) =>
                val?.toLowerCase()?.startsWith(text?.toLowerCase())
            );

        const MnemonicWord = ({ index, word }) => {
            return (
                <TouchableOpacity
                    key={index}
                    onPress={() => {
                        if (showSuggestions) {
                            this.setState(
                                selectedIndex === 0
                                    ? {
                                          seed0: word
                                      }
                                    : selectedIndex === 1
                                    ? {
                                          seed1: word
                                      }
                                    : selectedIndex === 2
                                    ? {
                                          seed2: word
                                      }
                                    : selectedIndex === 3
                                    ? {
                                          seed3: word
                                      }
                                    : selectedIndex === 4
                                    ? {
                                          seed4: word
                                      }
                                    : selectedIndex === 5
                                    ? {
                                          seed5: word
                                      }
                                    : selectedIndex === 6
                                    ? {
                                          seed6: word
                                      }
                                    : selectedIndex === 7
                                    ? {
                                          seed7: word
                                      }
                                    : selectedIndex === 8
                                    ? {
                                          seed8: word
                                      }
                                    : selectedIndex === 9
                                    ? {
                                          seed9: word
                                      }
                                    : selectedIndex === 10
                                    ? {
                                          seed10: word
                                      }
                                    : selectedIndex === 11
                                    ? {
                                          seed11: word
                                      }
                                    : selectedIndex === 12
                                    ? {
                                          seed12: word
                                      }
                                    : selectedIndex === 13
                                    ? {
                                          seed13: word
                                      }
                                    : selectedIndex === 14
                                    ? {
                                          seed14: word
                                      }
                                    : selectedIndex === 15
                                    ? {
                                          seed15: word
                                      }
                                    : selectedIndex === 16
                                    ? {
                                          seed16: word
                                      }
                                    : selectedIndex === 17
                                    ? {
                                          seed17: word
                                      }
                                    : selectedIndex === 18
                                    ? {
                                          seed18: word
                                      }
                                    : selectedIndex === 19
                                    ? {
                                          seed19: word
                                      }
                                    : selectedIndex === 20
                                    ? {
                                          seed20: word
                                      }
                                    : selectedIndex === 21
                                    ? {
                                          seed21: word
                                      }
                                    : selectedIndex === 22
                                    ? {
                                          seed22: word
                                      }
                                    : selectedIndex === 23
                                    ? {
                                          seed23: word
                                      }
                                    : {
                                          channelBackupsBase64: word
                                      }
                            );
                            this.setState({
                                selectedText: word
                            });
                        } else {
                            this.setState({
                                selectedText:
                                    index === 0
                                        ? seed0
                                        : index === 1
                                        ? seed1
                                        : index === 2
                                        ? seed2
                                        : index === 3
                                        ? seed3
                                        : index === 4
                                        ? seed4
                                        : index === 5
                                        ? seed5
                                        : index === 6
                                        ? seed6
                                        : index === 7
                                        ? seed7
                                        : index === 8
                                        ? seed8
                                        : index === 9
                                        ? seed9
                                        : index === 10
                                        ? seed10
                                        : index === 11
                                        ? seed11
                                        : index === 12
                                        ? seed12
                                        : index === 13
                                        ? seed13
                                        : index === 14
                                        ? seed14
                                        : index === 15
                                        ? seed15
                                        : index === 16
                                        ? seed16
                                        : index === 17
                                        ? seed17
                                        : index === 18
                                        ? seed18
                                        : index === 19
                                        ? seed19
                                        : index === 20
                                        ? seed20
                                        : index === 21
                                        ? seed21
                                        : index === 22
                                        ? seed22
                                        : index === 23
                                        ? seed23
                                        : channelBackupsBase64,
                                selectedIndex: index
                            });
                        }

                        this.setState({
                            showSuggestions: false
                        });

                        // set focus
                        this.textInput?.current?.focus();
                    }}
                    style={{
                        padding: 8,
                        backgroundColor: themeColor('secondary'),
                        borderRadius: 5,
                        margin: 6,
                        marginTop: 4,
                        marginBottom: 4,
                        flexDirection: 'row'
                    }}
                >
                    {!showSuggestions && word !== 'scb' && (
                        <View>
                            <Text
                                style={{
                                    flex: 1,
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('secondaryText'),
                                    fontSize: 18,
                                    alignSelf: 'flex-start'
                                }}
                            >
                                {index + 1}
                            </Text>
                        </View>
                    )}
                    {!showSuggestions && word === 'scb' && (
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                color: themeColor('secondaryText'),
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
                            alignSelf: 'flex-end',
                            margin: 0,
                            marginLeft: 10,
                            padding: 0,
                            maxHeight: 20
                        }}
                    >
                        {showSuggestions
                            ? word
                            : index === 0
                            ? seed0
                            : index === 1
                            ? seed1
                            : index === 2
                            ? seed2
                            : index === 3
                            ? seed3
                            : index === 4
                            ? seed4
                            : index === 5
                            ? seed5
                            : index === 6
                            ? seed6
                            : index === 7
                            ? seed7
                            : index === 8
                            ? seed8
                            : index === 9
                            ? seed9
                            : index === 10
                            ? seed10
                            : index === 11
                            ? seed11
                            : index === 12
                            ? seed12
                            : index === 13
                            ? seed13
                            : index === 14
                            ? seed14
                            : index === 15
                            ? seed15
                            : index === 16
                            ? seed16
                            : index === 17
                            ? seed17
                            : index === 18
                            ? seed18
                            : index === 19
                            ? seed19
                            : index === 20
                            ? seed20
                            : index === 21
                            ? seed21
                            : index === 22
                            ? seed22
                            : index === 23
                            ? seed23
                            : channelBackupsBase64}
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

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text:
                            'Wallet recovery' ||
                            localeString('views.Settings.Seed.title'),
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
                            {selectedIndex !== null && (
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
                                        typeof selectedIndex === 'number'
                                            ? selectedIndex + 1
                                            : 'SCB'
                                    }
                                    style={{
                                        margin: 20,
                                        marginLeft: 10,
                                        marginRight: 10,
                                        width: '90%',
                                        alignSelf: 'center'
                                    }}
                                    autoCapitalize="none"
                                    autoFocus
                                    onChangeText={(text) => {
                                        this.setState({
                                            errorMsg: '',
                                            selectedText: text
                                        });

                                        if (typeof selectedIndex === 'number') {
                                            this.setState({
                                                showSuggestions: true
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

                                        this.setState(
                                            selectedIndex === 0
                                                ? {
                                                      seed0: text
                                                  }
                                                : selectedIndex === 1
                                                ? {
                                                      seed1: text
                                                  }
                                                : selectedIndex === 2
                                                ? {
                                                      seed2: text
                                                  }
                                                : selectedIndex === 3
                                                ? {
                                                      seed3: text
                                                  }
                                                : selectedIndex === 4
                                                ? {
                                                      seed4: text
                                                  }
                                                : selectedIndex === 5
                                                ? {
                                                      seed5: text
                                                  }
                                                : selectedIndex === 6
                                                ? {
                                                      seed6: text
                                                  }
                                                : selectedIndex === 7
                                                ? {
                                                      seed7: text
                                                  }
                                                : selectedIndex === 8
                                                ? {
                                                      seed8: text
                                                  }
                                                : selectedIndex === 9
                                                ? {
                                                      seed9: text
                                                  }
                                                : selectedIndex === 10
                                                ? {
                                                      seed10: text
                                                  }
                                                : selectedIndex === 11
                                                ? {
                                                      seed11: text
                                                  }
                                                : selectedIndex === 12
                                                ? {
                                                      seed12: text
                                                  }
                                                : selectedIndex === 13
                                                ? {
                                                      seed13: text
                                                  }
                                                : selectedIndex === 14
                                                ? {
                                                      seed14: text
                                                  }
                                                : selectedIndex === 15
                                                ? {
                                                      seed15: text
                                                  }
                                                : selectedIndex === 16
                                                ? {
                                                      seed16: text
                                                  }
                                                : selectedIndex === 17
                                                ? {
                                                      seed17: text
                                                  }
                                                : selectedIndex === 18
                                                ? {
                                                      seed18: text
                                                  }
                                                : selectedIndex === 19
                                                ? {
                                                      seed19: text
                                                  }
                                                : selectedIndex === 20
                                                ? {
                                                      seed20: text
                                                  }
                                                : selectedIndex === 21
                                                ? {
                                                      seed21: text
                                                  }
                                                : selectedIndex === 22
                                                ? {
                                                      seed22: text
                                                  }
                                                : selectedIndex === 23
                                                ? {
                                                      seed23: text
                                                  }
                                                : {
                                                      channelBackupsBase64: text
                                                  }
                                        );
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
                                >
                                    <View
                                        style={{
                                            ...styles.column,
                                            flexDirection: 'row'
                                        }}
                                    >
                                        {[
                                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
                                        ].map((index: number) => {
                                            return (
                                                <MnemonicWord
                                                    index={index}
                                                    key={`mnemonic-${index}`}
                                                />
                                            );
                                        })}
                                    </View>
                                    <View style={styles.column}>
                                        {[
                                            12, 13, 14, 15, 16, 17, 18, 19, 20,
                                            21, 22, 23
                                        ].map((index: number) => {
                                            return (
                                                <MnemonicWord
                                                    index={index}
                                                    key={`mnemonic-${index}`}
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
                                        <MnemonicWord
                                            index={localeString(
                                                'views.Settings.AddEditNode.disasterRecoveryBase64'
                                            )}
                                            key="scb"
                                            word="scb"
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
                            >
                                <View style={styles.columnSuggestion}>
                                    {suggestionsOne.map((key, index) => {
                                        return (
                                            <MnemonicWord
                                                index={index}
                                                word={key}
                                                key={key}
                                            />
                                        );
                                    })}
                                </View>
                                <View style={styles.columnSuggestion}>
                                    {suggestionsTwo.map((key, index) => {
                                        return (
                                            <MnemonicWord
                                                index={index}
                                                word={key}
                                                key={key}
                                            />
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        )}
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
                                onPress={async () => {
                                    const { channelBackupsBase64 } = this.state;

                                    const recoveryCipherSeed = `${seed0} ${seed1} ${seed2} ${seed3} ${seed4} ${seed5} ${seed6} ${seed7} ${seed8} ${seed9} ${seed10} ${seed11} ${seed12} ${seed13} ${seed14} ${seed15} ${seed16} ${seed17} ${seed18} ${seed19} ${seed20} ${seed21} ${seed22} ${seed23}`;

                                    this.setState({
                                        loading: true
                                    });

                                    try {
                                        const response = await createLndWallet(
                                            recoveryCipherSeed,
                                            undefined,
                                            false,
                                            network === 'testnet',
                                            channelBackupsBase64
                                        );

                                        const {
                                            wallet,
                                            seed,
                                            randomBase64
                                        }: any = response;

                                        if (wallet && wallet.admin_macaroon) {
                                            this.setState({
                                                adminMacaroon:
                                                    wallet.admin_macaroon,
                                                seedPhrase:
                                                    seed.cipher_seed_mnemonic,
                                                walletPassword: randomBase64,
                                                embeddedLndNetwork:
                                                    network
                                                        .charAt(0)
                                                        .toUpperCase() +
                                                    network.slice(1)
                                            });

                                            this.saveNodeConfiguration(
                                                recoveryCipherSeed
                                            );
                                        } else {
                                            this.setState({
                                                loading: false,
                                                errorCreatingWallet: true
                                            });
                                        }
                                    } catch (e) {
                                        this.setState({
                                            errorCreatingWallet: true,
                                            errorMsg: e.toString(),
                                            loading: false
                                        });
                                    }
                                }}
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
                                    !seed0 ||
                                    !seed1 ||
                                    !seed2 ||
                                    !seed3 ||
                                    !seed4 ||
                                    !seed5 ||
                                    !seed6 ||
                                    !seed7 ||
                                    !seed8 ||
                                    !seed9 ||
                                    !seed10 ||
                                    !seed11 ||
                                    !seed12 ||
                                    !seed13 ||
                                    !seed14 ||
                                    !seed15 ||
                                    !seed16 ||
                                    !seed17 ||
                                    !seed18 ||
                                    !seed19 ||
                                    !seed20 ||
                                    !seed21 ||
                                    !seed22 ||
                                    !seed23
                                }
                            />
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
        alignSelf: 'center',
        flexDirection: 'column',
        width: '50%'
    },
    columnSuggestion: {
        marginTop: 8,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        flexDirection: 'column',
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
