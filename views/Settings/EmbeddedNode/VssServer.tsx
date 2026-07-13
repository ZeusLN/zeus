import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../../components/Button';
import DropdownSetting from '../../../components/DropdownSetting';
import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import TextInput from '../../../components/TextInput';

import SettingsStore, {
    LDK_VSS_SERVER_KEYS
} from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { restartNeeded } from '../../../utils/RestartUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import UrlUtils from '../../../utils/UrlUtils';
import { DEFAULT_VSS_SERVER } from '../../../utils/LdkNodeUtils';

const CUSTOM_VALUE = 'custom';

interface VssServerProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface VssServerState {
    selectedValue: string;
    customServer: string;
    savedVssServer: string;
}

@inject('SettingsStore')
@observer
export default class VssServer extends React.Component<
    VssServerProps,
    VssServerState
> {
    state = (() => {
        const { settings } = this.props.SettingsStore;
        const selectedNode = settings.selectedNode || 0;
        const saved =
            settings.nodes?.[selectedNode]?.ldkVssServer || DEFAULT_VSS_SERVER;

        const presetValues = LDK_VSS_SERVER_KEYS.map((s) => s.value);
        const isPreset = presetValues.includes(saved);

        return {
            selectedValue: isPreset ? saved : CUSTOM_VALUE,
            customServer: isPreset ? '' : saved,
            savedVssServer: saved
        };
    })();

    getEffectiveServer = (): string => {
        const { selectedValue, customServer } = this.state;
        return selectedValue === CUSTOM_VALUE
            ? customServer.trim()
            : selectedValue;
    };

    saveSettings = async (server: string) => {
        const { SettingsStore } = this.props;
        const { settings, updateSettings } = SettingsStore;
        const selectedNode = settings.selectedNode || 0;
        const nodes = [...(settings.nodes || [])];
        if (nodes[selectedNode]) {
            nodes[selectedNode] = {
                ...nodes[selectedNode],
                ldkVssServer: server
            };
            await updateSettings({ nodes });
            this.setState({ savedVssServer: server });
            restartNeeded();
        }
    };

    render() {
        const { navigation } = this.props;
        const { selectedValue, customServer, savedVssServer } = this.state;

        const isCustom = selectedValue === CUSTOM_VALUE;
        const effectiveServer = this.getEffectiveServer();
        const customServerTrimmed = customServer.trim();
        const showInvalidUrlError =
            isCustom &&
            customServerTrimmed !== '' &&
            !UrlUtils.isValidUrl(customServer);
        const hasUnsavedChanges =
            effectiveServer !== '' &&
            effectiveServer !== savedVssServer &&
            !showInvalidUrlError;
        const showReset = effectiveServer !== DEFAULT_VSS_SERVER;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.VssServer.title'
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
                                    'views.Settings.EmbeddedNode.VssServer.subtitle'
                                )}
                            </Text>
                        </View>

                        <DropdownSetting
                            title={localeString(
                                'views.Settings.EmbeddedNode.VssServer.serverUrl'
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
                            values={LDK_VSS_SERVER_KEYS}
                        />

                        {isCustom && (
                            <>
                                <TextInput
                                    value={customServer}
                                    placeholder={DEFAULT_VSS_SERVER}
                                    onChangeText={(text: string) => {
                                        this.setState({ customServer: text });
                                    }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {showInvalidUrlError && (
                                    <Text
                                        style={{
                                            color: themeColor('error'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 12,
                                            marginTop: 4
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.EmbeddedNode.invalidServerUrl'
                                        )}
                                    </Text>
                                )}
                            </>
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
                                : {DEFAULT_VSS_SERVER}
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
                                            selectedValue: DEFAULT_VSS_SERVER,
                                            customServer: ''
                                        });
                                        await this.saveSettings(
                                            DEFAULT_VSS_SERVER
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
