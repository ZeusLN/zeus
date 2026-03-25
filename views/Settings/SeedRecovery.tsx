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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { v4 as uuidv4 } from 'uuid';

import { ErrorMessage } from '../../components/SuccessErrorMessage';

import Button from '../../components/Button';
import Header from '../../components/Header';
import ModalBox from '../../components/ModalBox';
import Screen from '../../components/Screen';
import ZeusText from '../../components/Text';
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
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
    SwapStore: SwapStore;
    route: Route<
        'SeedRecovery',
        {
            network: string;
            restoreSwaps?: boolean;
            restoreRescueKey?: boolean;
            nickname?: string;
            photo?: string;
        }
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
    aezeedPassphrase: string;
    errorCreatingWallet: boolean;
    errorMsg: string;
    restoreSwaps?: boolean;
    restoreRescueKey?: boolean;
    rescueHost: string;
    customRescueHost: string;
    invalidInput: boolean;
    showClipboardPrompt: boolean;
    clipboardSeedArray: string[];
    showValidation: boolean;
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
            aezeedPassphrase: '',
            errorCreatingWallet: false,
            errorMsg: '',
            rescueHost: isTestnet
                ? settings.swaps?.hostTestnet || DEFAULT_SWAP_HOST_TESTNET
                : settings.swaps?.hostMainnet || DEFAULT_SWAP_HOST_MAINNET,
            customRescueHost: settings.swaps?.customHost || '',
            invalidInput: false,
            showClipboardPrompt: false,
            clipboardSeedArray: [],
            showValidation: false
        };
    }

    async componentDidMount() {
        await this.initFromProps(this.props);

        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        if (settings.privacy && settings.privacy.clipboard) {
            const clipboard = await Clipboard.getString();

            const clipboardSeedArray = clipboard.trim().split(/\s+/);
            if (clipboardSeedArray.length === 24) {
                this.setState({
                    showClipboardPrompt: true,
                    clipboardSeedArray
                });
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
        const { SettingsStore, navigation, route } = this.props;
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

        const nickname = route.params?.nickname;
        const photo = route.params?.photo;

        const node = {
            nickname,
            photo,
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
            aezeedPassphrase,
            showSuggestions,
            filteredData,
            errorMsg,
            restoreSwaps,
            restoreRescueKey,
            rescueHost,
            customRescueHost,
            showValidation
        } = this.state;

        const invalidWordIndices: number[] = showValidation
            ? seedArray.reduce((acc: number[], word, i) => {
                  if (!BIP39_WORD_LIST.includes(word?.toLowerCase()?.trim())) {
                      acc.push(i);
                  }
                  return acc;
              }, [])
            : [];

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
                                this.setState({
                                    selectedInputType: 'scb',
                                    selectedWordIndex: null
                                });
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
                        maxHeight: type === 'scb' ? 60 : undefined,
                        ...(!showSuggestions &&
                            index != null &&
                            invalidWordIndices.includes(index) && {
                                borderWidth: 1,
                                borderColor: themeColor('warning')
                            })
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
            // Validate all seed words against BIP39 wordlist before attempting restore
            const invalidWords: number[] = [];
            seedArray.forEach((word: string, i: number) => {
                if (!BIP39_WORD_LIST.includes(word?.toLowerCase()?.trim())) {
                    invalidWords.push(i + 1); // 1-based index to match UI
                }
            });
            if (invalidWords.length > 0) {
                this.setState({
                    errorMsg: `${localeString(
                        'views.Settings.NodeConfiguration.invalidSeedWord'
                    )}: #${invalidWords.join(', #')}`
                });
                return;
            }

            this.setState({ loading: true });

            await stopLnd();

            await optimizeNeutrinoPeers(network === 'testnet');

            const recoveryCipherSeed = seedArray.join(' ');

            const lndDir = uuidv4();

            try {
                const response = await createLndWallet({
                    lndDir,
                    seedMnemonic: recoveryCipherSeed,
                    walletPassphrase: aezeedPassphrase || undefined,
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
                {errorMsg && <ErrorMessage message={errorMsg} />}
                {invalidWordIndices.length > 0 && (
                    <ErrorMessage
                        message={`${localeString(
                            'views.Settings.NodeConfiguration.invalidSeedWord'
                        )}: #${invalidWordIndices
                            .map((i) => i + 1)
                            .join(', #')}`}
                    />
                )}
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
                                    autoCorrect={false}
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
                                        } else if (
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
                            {selectedInputType === 'scb' && (
                                <Button
                                    title={localeString('general.confirm')}
                                    onPress={() => {
                                        this.textInput?.current?.blur();
                                        Keyboard.dismiss();
                                        this.setState({
                                            selectedInputType: null,
                                            selectedWordIndex: null,
                                            selectedText: '',
                                            showSuggestions: false
                                        });
                                    }}
                                    buttonStyle={{
                                        marginHorizontal: 20,
                                        marginTop: 10
                                    }}
                                    disabled={!channelBackupsBase64}
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
                                    <>
                                        <View
                                            style={{
                                                paddingHorizontal: 20,
                                                marginTop: 10
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',
                                                    fontSize: 14,
                                                    marginBottom: 5
                                                }}
                                            >
                                                {localeString(
                                                    'views.Settings.SeedRecovery.aezeedPassphrase'
                                                )}
                                            </Text>
                                            <TextInputRN
                                                value={aezeedPassphrase}
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        aezeedPassphrase: text
                                                    })
                                                }
                                                placeholder={localeString(
                                                    'views.Settings.SeedRecovery.aezeedPassphrasePlaceholder'
                                                )}
                                                placeholderTextColor={themeColor(
                                                    'secondaryText'
                                                )}
                                                secureTextEntry
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                style={{
                                                    color: themeColor('text'),
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',
                                                    fontSize: 16,
                                                    padding: 10,
                                                    backgroundColor:
                                                        themeColor('secondary'),
                                                    borderRadius: 5
                                                }}
                                            />
                                        </View>
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
                                                'Rescue key verified and saved!'
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
                                              seedArray.some(
                                                  (seed) =>
                                                      !BIP39_WORD_LIST.includes(
                                                          seed
                                                              ?.toLowerCase()
                                                              ?.trim()
                                                      )
                                              )
                                            : seedArray.length !== 24 ||
                                              seedArray.some(
                                                  (seed) =>
                                                      !BIP39_WORD_LIST.includes(
                                                          seed
                                                              ?.toLowerCase()
                                                              ?.trim()
                                                      )
                                              )
                                    }
                                />
                            </View>
                        )}
                    </View>
                )}
                <ModalBox
                    isOpen={this.state.showClipboardPrompt}
                    style={{ backgroundColor: 'transparent' }}
                    swipeToClose
                    backButtonClose
                    onClosed={() =>
                        this.setState({
                            showClipboardPrompt: false,
                            clipboardSeedArray: []
                        })
                    }
                >
                    <View style={styles.modalWrapper}>
                        <View
                            style={{
                                backgroundColor: themeColor('modalBackground'),
                                borderRadius: 30,
                                padding: 30,
                                width: '85%'
                            }}
                        >
                            <ZeusText style={styles.modalTitle}>
                                {localeString(
                                    'views.Settings.SeedRecovery.clipboardSeedWords'
                                )}
                            </ZeusText>
                            <ZeusText style={styles.modalBody}>
                                {localeString(
                                    'views.Settings.SeedRecovery.clipboardSeedWordsPrompt'
                                )}
                            </ZeusText>
                            <View style={{ marginBottom: 12 }}>
                                <Button
                                    title={localeString('general.yes')}
                                    onPress={() =>
                                        this.setState({
                                            seedArray:
                                                this.state.clipboardSeedArray.map(
                                                    (w) =>
                                                        w.toLowerCase().trim()
                                                ),
                                            showClipboardPrompt: false,
                                            clipboardSeedArray: [],
                                            showValidation: true
                                        })
                                    }
                                    tertiary
                                />
                            </View>
                            <Button
                                title={localeString('general.cancel')}
                                onPress={() =>
                                    this.setState({
                                        showClipboardPrompt: false
                                    })
                                }
                            />
                        </View>
                    </View>
                </ModalBox>
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
    },
    modalWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalTitle: {
        textAlign: 'center',
        fontSize: 20,
        marginBottom: 12
    },
    modalBody: {
        textAlign: 'center',
        fontSize: 16,
        marginBottom: 24
    }
});
