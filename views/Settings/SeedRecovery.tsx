import * as React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    TextInput as TextInputRN,
    Keyboard,
    Alert
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';
import RNFS from 'react-native-fs';
import {
    pick,
    types,
    isErrorWithCode,
    errorCodes
} from '@react-native-documents/picker';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { v4 as uuidv4 } from 'uuid';

import { ErrorMessage } from '../../components/SuccessErrorMessage';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';
import LoadingIndicator from '../../components/LoadingIndicator';
import DropdownSetting from '../../components/DropdownSetting';

import { restartNeeded } from '../../utils/RestartUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import {
    createLndWallet,
    optimizeNeutrinoPeers,
    stopLnd
} from '../../utils/LndMobileUtils';

import { BIP39_WORD_LIST } from '../../utils/Bip39Utils';

import SettingsStore, {
    DEFAULT_SWAP_HOST_MAINNET,
    DEFAULT_SWAP_HOST_TESTNET,
    SWAP_HOST_KEYS_MAINNET,
    SWAP_HOST_KEYS_TESTNET
} from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SwapStore from '../../stores/SwapStore';
import { SWAPS_RESCUE_KEY } from '../../utils/SwapUtils';

import Storage from '../../storage';

interface SeedRecoveryProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
    SwapStore: SwapStore;
    route: Route<
        'SeedRecovery',
        { network: string; restoreSwaps?: boolean; restoreRescueKey?: boolean }
    >;
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
    lndDir: string;
    recoveryCipherSeed: string;
    channelBackupsBase64: string;
    errorCreatingWallet: boolean;
    errorMsg: string;
    restoreSwaps?: boolean;
    restoreRescueKey?: boolean;
    rescueHost: string;
    customRescueHost: string;
    invalidInput: boolean;
}

@inject('NodeInfoStore', 'SettingsStore', 'SwapStore')
@observer
export default class SeedRecovery extends React.PureComponent<
    SeedRecoveryProps,
    SeedRecoveryState
> {
    textInput: React.RefObject<TextInputRN | null>;
    constructor(props: SeedRecoveryProps) {
        super(props);

        const isTestnet = props.NodeInfoStore?.nodeInfo?.isTestNet;
        const { settings } = props.SettingsStore;

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
            lndDir: '',
            recoveryCipherSeed: '',
            channelBackupsBase64: '',
            errorCreatingWallet: false,
            errorMsg: '',
            rescueHost: isTestnet
                ? settings.swaps?.hostTestnet || DEFAULT_SWAP_HOST_TESTNET
                : settings.swaps?.hostMainnet || DEFAULT_SWAP_HOST_MAINNET,
            customRescueHost: settings.swaps?.customHost || '',
            invalidInput: false
        };
    }

    async componentDidMount() {
        await this.initFromProps(this.props);

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

    async componentDidUpdate(prevProps: SeedRecoveryProps) {
        if (this.props.route.params !== prevProps.route.params) {
            await this.initFromProps(this.props);
        }
    }

    async initFromProps(props: SeedRecoveryProps) {
        const network = props.route.params?.network ?? 'mainnet';
        const restoreSwaps = props.route.params?.restoreSwaps ?? false;
        const restoreRescueKey = props.route.params?.restoreRescueKey ?? false;
        this.setState({ network, restoreSwaps, restoreRescueKey });
    }

    saveWalletConfiguration = (recoveryCipherSeed?: string) => {
        const { SettingsStore, navigation } = this.props;
        const {
            walletPassword,
            adminMacaroon,
            embeddedLndNetwork,
            seedPhrase,
            lndDir
        } = this.state;
        const {
            setConnectingStatus,
            updateSettings,
            settings,
            embeddedLndStarted
        } = SettingsStore;

        const node = {
            seedPhrase,
            walletPassword,
            adminMacaroon,
            embeddedLndNetwork,
            implementation: 'embedded-lnd',
            lndDir,
            isSqlite: true
        };

        let nodes: any;
        if (settings.nodes) {
            nodes = settings.nodes || [];
            nodes[nodes.length] = node;
        } else {
            nodes = [node];
        }

        updateSettings({
            nodes,
            selectedNode: nodes.length - 1,
            recovery: recoveryCipherSeed ? true : false,
            initialLoad: false
        }).then(async () => {
            if (nodes.length === 1) {
                setConnectingStatus(true);
                navigation.popTo('Wallet');
            } else {
                if (Platform.OS === 'android' && embeddedLndStarted) {
                    restartNeeded(true);
                } else {
                    navigation.popTo('Wallets');
                }
            }
        });
    };

    render() {
        const { navigation, NodeInfoStore, SwapStore } = this.props;
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
            errorMsg,
            restoreSwaps,
            restoreRescueKey,
            rescueHost,
            customRescueHost
        } = this.state;

        const isTestnet = NodeInfoStore?.nodeInfo?.isTestNet;

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
                                const isRestoreMode =
                                    restoreSwaps || restoreRescueKey;
                                if (
                                    (isRestoreMode && selectedWordIndex < 11) ||
                                    (!isRestoreMode && selectedWordIndex < 23)
                                ) {
                                    this.setState({
                                        selectedWordIndex:
                                            selectedWordIndex + 1,
                                        selectedText:
                                            seedArray[selectedWordIndex + 1]
                                    });
                                } else {
                                    this.setState({
                                        selectedText: text || ''
                                    });
                                    Keyboard.dismiss();
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
                        {index != null &&
                        text &&
                        !(
                            selectedInputType === 'word' &&
                            selectedWordIndex === index
                        )
                            ? '********'
                            : text}
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

            await stopLnd();

            await optimizeNeutrinoPeers(network === 'testnet');

            const recoveryCipherSeed = seedArray.join(' ');

            const lndDir = uuidv4();

            try {
                const response = await createLndWallet({
                    lndDir,
                    seedMnemonic: recoveryCipherSeed,
                    isTestnet: network === 'testnet',
                    channelBackupsBase64
                });

                const { wallet, seed, randomBase64 }: any = response;

                if (wallet && wallet.admin_macaroon) {
                    this.setState(
                        {
                            adminMacaroon: wallet.admin_macaroon,
                            seedPhrase: seed.cipher_seed_mnemonic,
                            walletPassword: randomBase64,
                            embeddedLndNetwork:
                                network.charAt(0).toUpperCase() +
                                network.slice(1),
                            lndDir
                        },
                        () => {
                            // Use callback to ensure state is updated before saving
                            this.saveWalletConfiguration(recoveryCipherSeed);
                        }
                    );
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
                        text: restoreSwaps
                            ? localeString(
                                  'views.Swaps.SwapsPane.swapsRecovery'
                              )
                            : restoreRescueKey
                            ? localeString('views.Swaps.rescueKey.recovery')
                            : localeString('views.Settings.SeedRecovery.title'),
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
                                        if (selectedText?.length === 0) {
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
                                    textColor={
                                        this.state.invalidInput
                                            ? themeColor('error')
                                            : undefined
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

                                        if (text.length > 0) {
                                            const filtered = filterData(text);
                                            this.setState({
                                                filteredData: filtered,
                                                invalidInput:
                                                    selectedInputType ===
                                                        'word' &&
                                                    filtered.length === 0
                                            });
                                        } else {
                                            this.setState({
                                                filteredData: BIP39_WORD_LIST,
                                                invalidInput: false
                                            });
                                        }

                                        if (selectedInputType === 'scb') {
                                            this.setState({
                                                channelBackupsBase64: text
                                            });
                                        }
                                        if (
                                            (restoreSwaps ||
                                                restoreRescueKey) &&
                                            (selectedWordIndex == null ||
                                                selectedWordIndex >= 12)
                                        ) {
                                            return;
                                        } else if (selectedWordIndex != null) {
                                            seedArray[selectedWordIndex] = text;
                                            this.setState({ seedArray });
                                        }
                                    }}
                                />
                            )}
                            {selectedInputType === 'word' &&
                                this.state.invalidInput && (
                                    <Text
                                        style={{
                                            color: themeColor('error'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 14,
                                            marginTop: 5,
                                            marginLeft: 30
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.NodeConfiguration.invalidSeedWord'
                                        )}
                                    </Text>
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
                                    {restoreSwaps || restoreRescueKey ? (
                                        <>
                                            <View
                                                style={{
                                                    ...styles.column,
                                                    alignSelf:
                                                        !selectedInputType
                                                            ? 'center'
                                                            : undefined
                                                }}
                                            >
                                                {[0, 1, 2, 3, 4, 5].map((i) => (
                                                    <RecoveryLabel
                                                        key={i}
                                                        type="mnemonicWord"
                                                        index={i}
                                                        text={
                                                            this.state
                                                                .seedArray[i]
                                                        }
                                                    />
                                                ))}
                                            </View>
                                            <View
                                                style={{
                                                    ...styles.column,
                                                    alignSelf:
                                                        !selectedInputType
                                                            ? 'center'
                                                            : undefined
                                                }}
                                            >
                                                {[6, 7, 8, 9, 10, 11].map(
                                                    (i) => (
                                                        <RecoveryLabel
                                                            key={i}
                                                            type="mnemonicWord"
                                                            index={i}
                                                            text={
                                                                this.state
                                                                    .seedArray[
                                                                    i
                                                                ]
                                                            }
                                                        />
                                                    )
                                                )}
                                            </View>
                                        </>
                                    ) : (
                                        <>
                                            <View
                                                style={{
                                                    ...styles.column,
                                                    alignSelf:
                                                        !selectedInputType
                                                            ? 'center'
                                                            : undefined
                                                }}
                                            >
                                                {[
                                                    0, 1, 2, 3, 4, 5, 6, 7, 8,
                                                    9, 10, 11
                                                ].map((index: number) => {
                                                    return (
                                                        <RecoveryLabel
                                                            key={index}
                                                            type="mnemonicWord"
                                                            index={index}
                                                            text={
                                                                seedArray[index]
                                                            }
                                                        />
                                                    );
                                                })}
                                            </View>
                                            <View
                                                style={{
                                                    ...styles.column,
                                                    alignSelf:
                                                        !selectedInputType
                                                            ? 'center'
                                                            : undefined
                                                }}
                                            >
                                                {[
                                                    12, 13, 14, 15, 16, 17, 18,
                                                    19, 20, 21, 22, 23
                                                ].map((index: number) => {
                                                    return (
                                                        <RecoveryLabel
                                                            key={index}
                                                            type="mnemonicWord"
                                                            index={index}
                                                            text={
                                                                seedArray[index]
                                                            }
                                                        />
                                                    );
                                                })}
                                            </View>
                                        </>
                                    )}
                                </ScrollView>

                                {!(restoreSwaps || restoreRescueKey) && (
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
                                )}
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
                                                key={key}
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
                                                key={key}
                                                type="mnemonicWord"
                                                text={key}
                                            />
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        )}
                        {!showSuggestions && (
                            <>
                                {restoreSwaps && (
                                    <View style={{ paddingHorizontal: 20 }}>
                                        <DropdownSetting
                                            title={localeString(
                                                'general.serviceProvider'
                                            )}
                                            selectedValue={rescueHost}
                                            onValueChange={async (
                                                value: string
                                            ) => {
                                                this.setState({
                                                    rescueHost: value,
                                                    errorMsg: ''
                                                });
                                            }}
                                            values={(isTestnet
                                                ? SWAP_HOST_KEYS_TESTNET
                                                : SWAP_HOST_KEYS_MAINNET
                                            ).filter(
                                                (provider) =>
                                                    provider.supportsRescue
                                            )}
                                        />
                                        {rescueHost === 'Custom' && (
                                            <>
                                                <Text
                                                    style={{
                                                        color: themeColor(
                                                            'secondaryText'
                                                        ),
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.OpenChannel.host'
                                                    )}
                                                </Text>
                                                <TextInput
                                                    value={customRescueHost}
                                                    placeholder={
                                                        isTestnet
                                                            ? DEFAULT_SWAP_HOST_TESTNET
                                                            : DEFAULT_SWAP_HOST_MAINNET
                                                    }
                                                    onChangeText={async (
                                                        text: string
                                                    ) => {
                                                        this.setState({
                                                            customRescueHost:
                                                                text
                                                        });
                                                    }}
                                                    autoCapitalize="none"
                                                    error={!customRescueHost}
                                                />
                                            </>
                                        )}
                                    </View>
                                )}
                                {(restoreSwaps || restoreRescueKey) && (
                                    <Button
                                        title={localeString(
                                            'views.Swaps.rescueKey.upload'
                                        )}
                                        secondary
                                        onPress={async () => {
                                            this.setState({
                                                errorMsg: '',
                                                seedArray: [],
                                                selectedText: '',
                                                selectedInputType: null,
                                                selectedWordIndex: null
                                            });
                                            try {
                                                const [res] = await pick({
                                                    type: [types.allFiles]
                                                });

                                                const content =
                                                    await RNFS.readFile(
                                                        res.uri,
                                                        'utf8'
                                                    );
                                                const importedData =
                                                    JSON.parse(content);

                                                if (importedData.mnemonic) {
                                                    const words =
                                                        importedData.mnemonic
                                                            .trim()
                                                            .split(/\s+/);
                                                    if (words.length === 12) {
                                                        this.setState({
                                                            seedArray: words
                                                        });
                                                    } else {
                                                        Alert.alert(
                                                            localeString(
                                                                'views.Swaps.rescueKey.invalid'
                                                            )
                                                        );
                                                    }
                                                } else {
                                                    Alert.alert(
                                                        localeString(
                                                            'general.error'
                                                        ),
                                                        localeString(
                                                            'views.Tools.nodeConfigExportImport.importError'
                                                        )
                                                    );
                                                }
                                            } catch (err) {
                                                if (
                                                    isErrorWithCode(err) &&
                                                    err.code ===
                                                        errorCodes.OPERATION_CANCELED
                                                ) {
                                                    this.setState({
                                                        loading: false
                                                    });
                                                } else {
                                                    Alert.alert(
                                                        localeString(
                                                            'general.error'
                                                        ),
                                                        localeString(
                                                            'views.Tools.nodeConfigExportImport.importError'
                                                        )
                                                    );
                                                }
                                            }
                                        }}
                                    />
                                )}
                            </>
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
                                    onPress={async () => {
                                        if (restoreSwaps) {
                                            this.setState(
                                                { loading: true },
                                                async () => {
                                                    this.setState({
                                                        errorMsg: ''
                                                    });
                                                    const result =
                                                        await SwapStore.getRescuableSwaps(
                                                            {
                                                                seedArray,
                                                                host:
                                                                    rescueHost ===
                                                                    'Custom'
                                                                        ? customRescueHost
                                                                        : rescueHost
                                                            }
                                                        );
                                                    this.setState({
                                                        loading: false
                                                    });
                                                    if (result?.success) {
                                                        navigation.navigate(
                                                            'SwapsPane'
                                                        );
                                                    } else {
                                                        this.setState({
                                                            errorMsg:
                                                                result?.error ||
                                                                ''
                                                        });
                                                    }
                                                }
                                            );
                                        } else if (restoreRescueKey) {
                                            console.log(
                                                'Verifying rescue key...'
                                            );

                                            const mnemonic = seedArray
                                                .join(' ')
                                                .trim();

                                            await Storage.setItem(
                                                SWAPS_RESCUE_KEY,
                                                mnemonic
                                            );

                                            console.log(
                                                'Rescue key verified and saved!',
                                                mnemonic
                                            );

                                            navigation.goBack();
                                        } else {
                                            restore();
                                        }
                                    }}
                                    title={
                                        restoreSwaps
                                            ? localeString(
                                                  'views.Swaps.SwapsPane.restoreSwaps'
                                              )
                                            : restoreRescueKey
                                            ? localeString(
                                                  'views.Swaps.rescueKey.restore'
                                              )
                                            : network === 'mainnet'
                                            ? localeString(
                                                  'views.Settings.NodeConfiguration.restoreMainnetWallet'
                                              )
                                            : localeString(
                                                  'views.Settings.NodeConfiguration.restoreTestnetWallet'
                                              )
                                    }
                                    disabled={
                                        restoreSwaps || restoreRescueKey
                                            ? (rescueHost === 'Custom' &&
                                                  !customRescueHost) ||
                                              seedArray.length !== 12 ||
                                              seedArray.some((seed) => !seed)
                                            : seedArray.length !== 24 ||
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
