import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import TextInput from '../../../components/TextInput';

import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { restartNeeded } from '../../../utils/RestartUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import { DEFAULT_VSS_SERVER } from '../../../utils/EmbeddedLdkNodeUtils';

interface VssServerProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface VssServerState {
    vssServer: string;
}

@inject('SettingsStore')
@observer
export default class VssServer extends React.Component<
    VssServerProps,
    VssServerState
> {
    state = {
        vssServer: this.props.SettingsStore.ldkVssServer || ''
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { vssServer } = this.state;
        const { updateSettings }: any = SettingsStore;

        const showReset = vssServer !== '' && vssServer !== DEFAULT_VSS_SERVER;

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
                            onBlur={async () => {
                                await updateSettings({
                                    ldkVssServer: vssServer
                                });
                                restartNeeded();
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
                                    'views.Settings.EmbeddedNode.VssServer.defaultServer'
                                )}
                                : {DEFAULT_VSS_SERVER}
                            </Text>
                        </View>

                        {showReset && (
                            <View style={{ marginTop: 20 }}>
                                <Button
                                    title={localeString('general.reset')}
                                    accessibilityLabel={localeString(
                                        'general.reset'
                                    )}
                                    onPress={async () => {
                                        this.setState({
                                            vssServer: DEFAULT_VSS_SERVER
                                        });
                                        await updateSettings({
                                            ldkVssServer: DEFAULT_VSS_SERVER
                                        });
                                        restartNeeded();
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
