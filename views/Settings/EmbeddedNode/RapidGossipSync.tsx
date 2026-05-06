import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../../components/Button';
import DropdownSetting from '../../../components/DropdownSetting';
import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import TextInput from '../../../components/TextInput';

import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { restartNeeded } from '../../../utils/RestartUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import {
    getDefaultRgsServer,
    getRgsServersForNetwork,
    SupportedNetwork
} from '../../../utils/LdkNodeUtils';

const CUSTOM_VALUE = '__custom__';

interface RapidGossipSyncProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface RapidGossipSyncState {
    selectedValue: string;
    customServer: string;
    savedRgsServer: string;
}

@inject('SettingsStore')
@observer
export default class RapidGossipSync extends React.Component<
    RapidGossipSyncProps,
    RapidGossipSyncState
> {
    constructor(props: RapidGossipSyncProps) {
        super(props);

        const { SettingsStore } = props;
        const saved = SettingsStore.ldkRgsServer || '';
        const network =
            (SettingsStore.ldkNetwork?.toLowerCase() as SupportedNetwork) ||
            'mainnet';
        const servers = getRgsServersForNetwork(network);
        const presetUrls = servers.map((s) => s.value);

        const isPreset = saved === '' || presetUrls.includes(saved);

        this.state = {
            selectedValue: isPreset
                ? saved || servers[0]?.value || ''
                : CUSTOM_VALUE,
            customServer: isPreset ? '' : saved,
            savedRgsServer: isPreset ? saved || servers[0]?.value || '' : saved
        };
    }

    saveSettings = async (server: string) => {
        const { SettingsStore } = this.props;
        const { settings, updateSettings } = SettingsStore;
        const selectedNode = settings.selectedNode || 0;
        const nodes = [...(settings.nodes || [])];
        if (nodes[selectedNode]) {
            nodes[selectedNode] = {
                ...nodes[selectedNode],
                ldkRgsServer: server
            };
            await updateSettings({ nodes });
            this.setState({ savedRgsServer: server });
            restartNeeded();
        }
    };

    getEffectiveServer = (): string => {
        const { selectedValue, customServer } = this.state;
        return selectedValue === CUSTOM_VALUE ? customServer : selectedValue;
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { selectedValue, customServer, savedRgsServer } = this.state;
        const { ldkNetwork } = SettingsStore;

        const network =
            (ldkNetwork?.toLowerCase() as SupportedNetwork) || 'mainnet';
        const servers = getRgsServersForNetwork(network);
        const defaultServer = getDefaultRgsServer(network);
        const defaultServerLabel =
            servers.find((s) => s.value === defaultServer)?.key ||
            defaultServer;

        const dropdownValues = [
            ...servers,
            {
                key: localeString('general.custom'),
                value: CUSTOM_VALUE
            }
        ];

        const effectiveServer = this.getEffectiveServer();
        const hasUnsavedChanges =
            effectiveServer !== savedRgsServer &&
            !(selectedValue === CUSTOM_VALUE && customServer.trim() === '');
        const showReset =
            effectiveServer !== '' && effectiveServer !== defaultServer;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.RapidGossipSync.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView style={{ margin: 10 }}>
                        <View style={{ marginBottom: 20 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    marginBottom: 10
                                }}
                            >
                                {localeString(
                                    'views.Settings.EmbeddedNode.RapidGossipSync.subtitle'
                                )}
                            </Text>
                        </View>

                        <DropdownSetting
                            title={localeString(
                                'views.Settings.EmbeddedNode.RapidGossipSync.serverUrl'
                            )}
                            selectedValue={selectedValue}
                            onValueChange={(value: string) => {
                                this.setState({
                                    selectedValue: value,
                                    customServer:
                                        value === CUSTOM_VALUE
                                            ? customServer
                                            : ''
                                });
                            }}
                            values={dropdownValues}
                        />

                        {selectedValue === CUSTOM_VALUE && (
                            <TextInput
                                value={customServer}
                                placeholder={localeString(
                                    'views.Settings.EmbeddedNode.RapidGossipSync.serverUrl'
                                )}
                                onChangeText={(text: string) => {
                                    this.setState({
                                        customServer: text
                                    });
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        )}

                        <View style={{ marginTop: 10 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 12
                                }}
                            >
                                {localeString(
                                    'views.Settings.EmbeddedNode.defaultServer'
                                )}
                                :{' '}
                                {defaultServerLabel ||
                                    localeString('general.none')}
                            </Text>
                        </View>

                        {hasUnsavedChanges && (
                            <View style={{ marginTop: 20 }}>
                                <Button
                                    title={localeString('general.save')}
                                    accessibilityLabel={localeString(
                                        'general.save'
                                    )}
                                    onPress={() =>
                                        this.saveSettings(effectiveServer)
                                    }
                                />
                            </View>
                        )}

                        {showReset && (
                            <View style={{ marginTop: 20 }}>
                                <Button
                                    title={localeString('general.reset')}
                                    accessibilityLabel={localeString(
                                        'general.reset'
                                    )}
                                    secondary
                                    onPress={async () => {
                                        this.setState({
                                            selectedValue: defaultServer || '',
                                            customServer: ''
                                        });
                                        await this.saveSettings(
                                            defaultServer || ''
                                        );
                                    }}
                                />
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
