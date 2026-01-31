import * as React from 'react';
import { NativeModules, ScrollView, Text, View } from 'react-native';
import { Icon, ListItem } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import DropdownSetting from '../../../components/DropdownSetting';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import Screen from '../../../components/Screen';
import TextInput from '../../../components/TextInput';

import SettingsStore, {
    ESPLORA_MAINNET_KEYS,
    ESPLORA_TESTNET_KEYS,
    DEFAULT_ESPLORA_MAINNET,
    DEFAULT_ESPLORA_TESTNET
} from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { restartNeeded } from '../../../utils/RestartUtils';
import { sleep } from '../../../utils/SleepUtils';
import { themeColor } from '../../../utils/ThemeUtils';

interface BlockchainBackendProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface BlockchainBackendState {
    embeddedLndBackend: 'neutrino' | 'esplora';
    esploraMainnet: string;
    esploraTestnet: string;
    customEsplora: string;
    loading: boolean;
}

const BACKEND_KEYS = [
    {
        key: 'Neutrino',
        value: 'neutrino'
    },
    {
        key: 'Esplora',
        value: 'esplora'
    }
];

@inject('SettingsStore')
@observer
export default class BlockchainBackend extends React.Component<
    BlockchainBackendProps,
    BlockchainBackendState
> {
    constructor(props: BlockchainBackendProps) {
        super(props);

        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.state = {
            embeddedLndBackend: settings.embeddedLndBackend || 'neutrino',
            esploraMainnet: settings.esploraMainnet || DEFAULT_ESPLORA_MAINNET,
            esploraTestnet: settings.esploraTestnet || DEFAULT_ESPLORA_TESTNET,
            customEsplora: settings.customEsplora || '',
            loading: false
        };
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            embeddedLndBackend,
            esploraMainnet,
            esploraTestnet,
            customEsplora,
            loading
        } = this.state;
        const { updateSettings, embeddedLndNetwork, lndDir, settings }: any =
            SettingsStore;
        const {
            neutrinoPeersMainnet,
            neutrinoPeersTestnet,
            dontAllowOtherPeers
        } = settings;

        const isMainnet = embeddedLndNetwork === 'Mainnet';
        const neutrinoPeers = isMainnet
            ? neutrinoPeersMainnet
            : neutrinoPeersTestnet;
        const esploraKeys = isMainnet
            ? ESPLORA_MAINNET_KEYS
            : ESPLORA_TESTNET_KEYS;
        const currentEsploraUrl = isMainnet ? esploraMainnet : esploraTestnet;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.BlockchainBackend.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        rightComponent={
                            loading ? <LoadingIndicator size={30} /> : undefined
                        }
                        navigation={navigation}
                    />
                    <ScrollView>
                        <View style={{ margin: 10 }}>
                            <DropdownSetting
                                title={localeString(
                                    'views.Settings.EmbeddedNode.BlockchainBackend.backend'
                                )}
                                selectedValue={embeddedLndBackend}
                                onValueChange={async (value: string) => {
                                    const previousBackend = embeddedLndBackend;
                                    this.setState({
                                        embeddedLndBackend: value as
                                            | 'neutrino'
                                            | 'esplora'
                                    });
                                    await updateSettings({
                                        embeddedLndBackend: value
                                    });

                                    // If switching to Esplora, stop LND and delete Neutrino files
                                    if (
                                        previousBackend === 'neutrino' &&
                                        value === 'esplora'
                                    ) {
                                        this.setState({ loading: true });
                                        try {
                                            await NativeModules.LndMobile.stopLnd();
                                            await sleep(5000); // Let lnd close down
                                        } catch (e: any) {
                                            // If lnd was closed down already
                                            if (
                                                !e?.message?.includes?.(
                                                    'closed'
                                                )
                                            ) {
                                                console.error(e.message);
                                            }
                                        }

                                        try {
                                            await NativeModules.LndMobileTools.DEBUG_deleteNeutrinoFiles(
                                                lndDir || 'lnd',
                                                isMainnet
                                                    ? 'mainnet'
                                                    : 'testnet'
                                            );
                                        } catch (e: any) {
                                            console.error(
                                                'Error deleting Neutrino files:',
                                                e
                                            );
                                        }
                                        this.setState({ loading: false });
                                    }

                                    restartNeeded();
                                }}
                                values={BACKEND_KEYS}
                            />
                        </View>

                        <View
                            style={{
                                margin: 10
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString(
                                    'views.Settings.EmbeddedNode.BlockchainBackend.neutrino.subtitle'
                                )}
                            </Text>
                        </View>

                        <View
                            style={{
                                margin: 10
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString(
                                    'views.Settings.EmbeddedNode.BlockchainBackend.esplora.subtitle'
                                )}
                            </Text>
                        </View>

                        {embeddedLndBackend === 'neutrino' && (
                            <>
                                <ListItem
                                    containerStyle={{
                                        backgroundColor: 'transparent'
                                    }}
                                    onPress={() =>
                                        navigation.navigate('NeutrinoPeers')
                                    }
                                >
                                    <ListItem.Content>
                                        <ListItem.Title
                                            style={{
                                                color: themeColor('text'),
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.EmbeddedNode.NeutrinoPeers.title'
                                            )}
                                        </ListItem.Title>
                                        <ListItem.Title
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            {neutrinoPeers &&
                                            neutrinoPeers.length > 0
                                                ? `${neutrinoPeers.length} ${
                                                      neutrinoPeers.length > 1
                                                          ? localeString(
                                                                'general.peers'
                                                            ).toLowerCase()
                                                          : localeString(
                                                                'general.peer'
                                                            ).toLowerCase()
                                                  } ${localeString(
                                                      'general.selected'
                                                  ).toLowerCase()}.`
                                                : `${localeString(
                                                      'general.noneSelected'
                                                  )}. ${localeString(
                                                      'general.zeusDefaults'
                                                  ).replace(
                                                      'Zeus',
                                                      'ZEUS'
                                                  )}.`}{' '}
                                            {dontAllowOtherPeers
                                                ? localeString(
                                                      'views.Settings.EmbeddedNode.NeutrinoPeers.notAllowingOtherPeers'
                                                  )
                                                : localeString(
                                                      'views.Settings.EmbeddedNode.NeutrinoPeers.allowingOtherPeers'
                                                  )}
                                        </ListItem.Title>
                                    </ListItem.Content>
                                    <Icon
                                        name="keyboard-arrow-right"
                                        color={themeColor('secondaryText')}
                                    />
                                </ListItem>
                                <View
                                    style={{
                                        margin: 10
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.EmbeddedNode.NeutrinoPeers.subtitle'
                                        )}
                                    </Text>
                                </View>
                            </>
                        )}

                        {embeddedLndBackend === 'esplora' && (
                            <View style={{ margin: 10 }}>
                                <DropdownSetting
                                    title={localeString(
                                        'views.Settings.EmbeddedNode.BlockchainBackend.esploraUrl'
                                    )}
                                    selectedValue={currentEsploraUrl}
                                    onValueChange={async (value: string) => {
                                        if (isMainnet) {
                                            this.setState({
                                                esploraMainnet: value
                                            });
                                            await updateSettings({
                                                esploraMainnet: value
                                            });
                                        } else {
                                            this.setState({
                                                esploraTestnet: value
                                            });
                                            await updateSettings({
                                                esploraTestnet: value
                                            });
                                        }
                                        restartNeeded();
                                    }}
                                    values={esploraKeys}
                                />

                                {currentEsploraUrl === 'Custom' && (
                                    <>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                marginTop: 10
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.EmbeddedNode.BlockchainBackend.customEsploraUrl'
                                            )}
                                        </Text>
                                        <TextInput
                                            value={customEsplora}
                                            placeholder={
                                                isMainnet
                                                    ? DEFAULT_ESPLORA_MAINNET
                                                    : DEFAULT_ESPLORA_TESTNET
                                            }
                                            onChangeText={(text: string) => {
                                                this.setState({
                                                    customEsplora: text
                                                });
                                            }}
                                            onEndEditing={async (e) => {
                                                await updateSettings({
                                                    customEsplora:
                                                        e.nativeEvent.text
                                                });
                                                restartNeeded();
                                            }}
                                            autoCapitalize="none"
                                            error={!customEsplora}
                                        />
                                    </>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
