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
import {
    getDefaultEsploraServer,
    SupportedNetwork
} from '../../../utils/LdkNodeUtils';

interface EsploraServerProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface EsploraServerState {
    esploraServer: string;
    savedEsploraServer: string;
}

@inject('SettingsStore')
@observer
export default class EsploraServer extends React.Component<
    EsploraServerProps,
    EsploraServerState
> {
    state = {
        esploraServer: this.props.SettingsStore.ldkEsploraServer || '',
        savedEsploraServer: this.props.SettingsStore.ldkEsploraServer || ''
    };

    saveSettings = async (server: string) => {
        const { SettingsStore } = this.props;
        const { settings, updateSettings } = SettingsStore;
        const selectedNode = settings.selectedNode || 0;
        const nodes = [...(settings.nodes || [])];
        if (nodes[selectedNode]) {
            nodes[selectedNode] = {
                ...nodes[selectedNode],
                ldkEsploraServer: server
            };
            await updateSettings({ nodes });
            this.setState({ savedEsploraServer: server });
            restartNeeded();
        }
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { esploraServer, savedEsploraServer } = this.state;
        const { ldkNetwork } = SettingsStore;

        const defaultServer = getDefaultEsploraServer(
            (ldkNetwork?.toLowerCase() as SupportedNetwork) || 'mainnet'
        );

        const showReset =
            esploraServer !== '' && esploraServer !== defaultServer;

        const hasUnsavedChanges = esploraServer !== savedEsploraServer;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.EsploraServer.title'
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
                                    'views.Settings.EmbeddedNode.EsploraServer.subtitle'
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
                                'views.Settings.EmbeddedNode.EsploraServer.serverUrl'
                            )}
                        </Text>
                        <TextInput
                            value={esploraServer}
                            placeholder={defaultServer || ''}
                            onChangeText={(text: string) => {
                                this.setState({
                                    esploraServer: text
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
                                :{' '}
                                {defaultServer || localeString('general.none')}
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
                                        this.saveSettings(esploraServer)
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
                                            esploraServer: defaultServer
                                        });
                                        await this.saveSettings(defaultServer);
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
