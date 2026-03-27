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
    getDefaultRgsServer,
    SupportedNetwork
} from '../../../utils/LdkNodeUtils';

interface RapidGossipSyncProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface RapidGossipSyncState {
    rgsServer: string;
    savedRgsServer: string;
}

@inject('SettingsStore')
@observer
export default class RapidGossipSync extends React.Component<
    RapidGossipSyncProps,
    RapidGossipSyncState
> {
    state = {
        rgsServer: this.props.SettingsStore.ldkRgsServer || '',
        savedRgsServer: this.props.SettingsStore.ldkRgsServer || ''
    };

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

    render() {
        const { navigation, SettingsStore } = this.props;
        const { rgsServer, savedRgsServer } = this.state;
        const { ldkNetwork } = SettingsStore;

        const defaultServer = getDefaultRgsServer(
            (ldkNetwork?.toLowerCase() as SupportedNetwork) || 'mainnet'
        );

        const showReset = rgsServer !== '' && rgsServer !== defaultServer;

        const hasUnsavedChanges = rgsServer !== savedRgsServer;

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

                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {localeString(
                                'views.Settings.EmbeddedNode.RapidGossipSync.serverUrl'
                            )}
                        </Text>
                        <TextInput
                            value={rgsServer}
                            placeholder={defaultServer || ''}
                            onChangeText={(text: string) => {
                                this.setState({
                                    rgsServer: text
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
                                    onPress={() => this.saveSettings(rgsServer)}
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
                                            rgsServer: defaultServer || ''
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
