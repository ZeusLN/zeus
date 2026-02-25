import * as React from 'react';
import { Alert, Text, View } from 'react-native';
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

import { ErrorMessage } from '../../components/SuccessErrorMessage';
import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';
import LoadingIndicator from '../../components/LoadingIndicator';
import DropdownSetting from '../../components/DropdownSetting';
import SeedWordInput from '../../components/SeedWordInput';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { SWAPS_RESCUE_KEY } from '../../utils/SwapUtils';

import SettingsStore, {
    DEFAULT_SWAP_HOST_MAINNET,
    DEFAULT_SWAP_HOST_TESTNET,
    SWAP_HOST_KEYS_MAINNET,
    SWAP_HOST_KEYS_TESTNET
} from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SwapStore from '../../stores/SwapStore';

import Storage from '../../storage';

interface SwapsRecoveryProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
    SwapStore: SwapStore;
    route: Route<
        'SwapsRecovery',
        { restoreSwaps?: boolean; restoreRescueKey?: boolean }
    >;
}

interface SwapsRecoveryState {
    loading: boolean;
    seedArray: string[];
    errorMsg: string;
    restoreSwaps: boolean;
    restoreRescueKey: boolean;
    rescueHost: string;
    customRescueHost: string;
    showSuggestions: boolean;
}

@inject('NodeInfoStore', 'SettingsStore', 'SwapStore')
@observer
export default class SwapsRecovery extends React.PureComponent<
    SwapsRecoveryProps,
    SwapsRecoveryState
> {
    constructor(props: SwapsRecoveryProps) {
        super(props);

        const isTestnet = props.NodeInfoStore?.nodeInfo?.isTestNet;
        const { settings } = props.SettingsStore;

        this.state = {
            loading: false,
            seedArray: [],
            errorMsg: '',
            restoreSwaps: props.route.params?.restoreSwaps ?? false,
            restoreRescueKey: props.route.params?.restoreRescueKey ?? false,
            rescueHost: isTestnet
                ? settings.swaps?.hostTestnet || DEFAULT_SWAP_HOST_TESTNET
                : settings.swaps?.hostMainnet || DEFAULT_SWAP_HOST_MAINNET,
            customRescueHost: settings.swaps?.customHost || '',
            showSuggestions: false
        };
    }

    async componentDidUpdate(prevProps: SwapsRecoveryProps) {
        if (this.props.route.params !== prevProps.route.params) {
            const restoreSwaps = this.props.route.params?.restoreSwaps ?? false;
            const restoreRescueKey =
                this.props.route.params?.restoreRescueKey ?? false;
            this.setState({ restoreSwaps, restoreRescueKey });
        }
    }

    render() {
        const { navigation, NodeInfoStore, SwapStore } = this.props;
        const {
            loading,
            seedArray,
            errorMsg,
            restoreSwaps,
            rescueHost,
            customRescueHost,
            showSuggestions
        } = this.state;

        const isTestnet = NodeInfoStore?.nodeInfo?.isTestNet;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: restoreSwaps
                            ? localeString(
                                  'views.Swaps.SwapsPane.swapsRecovery'
                              )
                            : localeString('views.Swaps.rescueKey.recovery'),
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
                        <SeedWordInput
                            wordCount={12}
                            seedArray={seedArray}
                            onSeedArrayChange={(arr) =>
                                this.setState({ seedArray: arr })
                            }
                            onErrorMsgChange={(msg) =>
                                this.setState({ errorMsg: msg })
                            }
                            onShowSuggestionsChange={(showing) =>
                                this.setState({ showSuggestions: showing })
                            }
                        />
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
                                <Button
                                    title={localeString(
                                        'views.Swaps.rescueKey.upload'
                                    )}
                                    secondary
                                    onPress={async () => {
                                        this.setState({
                                            errorMsg: '',
                                            seedArray: []
                                        });
                                        try {
                                            const [res] = await pick({
                                                type: [types.allFiles]
                                            });

                                            const content = await RNFS.readFile(
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
                                        } else {
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
                                        }
                                    }}
                                    title={
                                        restoreSwaps
                                            ? localeString(
                                                  'views.Swaps.SwapsPane.restoreSwaps'
                                              )
                                            : localeString(
                                                  'views.Swaps.rescueKey.restore'
                                              )
                                    }
                                    disabled={
                                        (restoreSwaps &&
                                            rescueHost === 'Custom' &&
                                            !customRescueHost) ||
                                        seedArray.length !== 12 ||
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
