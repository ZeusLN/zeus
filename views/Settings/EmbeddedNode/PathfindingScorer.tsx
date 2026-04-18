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
import { DEFAULT_SCORER_URL } from '../../../utils/LdkNodeUtils';

interface PathfindingScorerProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface PathfindingScorerState {
    scorerUrl: string;
    savedScorerUrl: string;
}

@inject('SettingsStore')
@observer
export default class PathfindingScorer extends React.Component<
    PathfindingScorerProps,
    PathfindingScorerState
> {
    state = {
        scorerUrl: this.props.SettingsStore.ldkScorerUrl || '',
        savedScorerUrl: this.props.SettingsStore.ldkScorerUrl || ''
    };

    saveSettings = async (server: string) => {
        const { SettingsStore } = this.props;
        const { settings, updateSettings } = SettingsStore;
        const selectedNode = settings.selectedNode || 0;
        const nodes = [...(settings.nodes || [])];
        if (nodes[selectedNode]) {
            nodes[selectedNode] = {
                ...nodes[selectedNode],
                ldkScorerUrl: server
            };
            await updateSettings({ nodes });
            this.setState({ savedScorerUrl: server });
            restartNeeded();
        }
    };

    render() {
        const { navigation } = this.props;
        const { scorerUrl, savedScorerUrl } = this.state;

        const showReset = scorerUrl !== '' && scorerUrl !== DEFAULT_SCORER_URL;

        const hasUnsavedChanges = scorerUrl !== savedScorerUrl;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.PathfindingScorer.title'
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
                                    'views.Settings.EmbeddedNode.PathfindingScorer.subtitle'
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
                                'views.Settings.EmbeddedNode.PathfindingScorer.serverUrl'
                            )}
                        </Text>
                        <TextInput
                            value={scorerUrl}
                            placeholder={DEFAULT_SCORER_URL}
                            onChangeText={(text: string) => {
                                this.setState({
                                    scorerUrl: text
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
                                : {DEFAULT_SCORER_URL}
                            </Text>
                        </View>

                        {hasUnsavedChanges && (
                            <View style={{ marginTop: 20 }}>
                                <Button
                                    title={localeString('general.save')}
                                    accessibilityLabel={localeString(
                                        'general.save'
                                    )}
                                    onPress={() => this.saveSettings(scorerUrl)}
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
                                            scorerUrl: DEFAULT_SCORER_URL
                                        });
                                        await this.saveSettings(
                                            DEFAULT_SCORER_URL
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
