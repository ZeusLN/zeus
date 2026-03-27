import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import TextInput from '../../../components/TextInput';

import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { restartNeeded } from '../../../utils/RestartUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import { DEFAULT_VSS_SERVER } from '../../../utils/LdkNodeUtils';

interface VssServerProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface VssServerState {
    vssServer: string;
    savedVssServer: string;
}

@inject('SettingsStore')
@observer
export default class VssServer extends React.Component<
    VssServerProps,
    VssServerState
> {
    state = {
        vssServer: this.props.SettingsStore.ldkVssServer || '',
        savedVssServer: this.props.SettingsStore.ldkVssServer || ''
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
        const { vssServer, savedVssServer } = this.state;

        const showReset = vssServer !== '' && vssServer !== DEFAULT_VSS_SERVER;

        const hasUnsavedChanges = vssServer !== savedVssServer;

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

                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {localeString(
                                'views.Settings.EmbeddedNode.VssServer.serverUrl'
                            )}
                        </Text>
                        <TextInput
                            value={vssServer}
                            placeholder={DEFAULT_VSS_SERVER}
                            onChangeText={(text: string) => {
                                this.setState({
                                    vssServer: text
                                });
                            }}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

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
                                    onPress={() => this.saveSettings(vssServer)}
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
                                            vssServer: DEFAULT_VSS_SERVER
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
