import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import TextInput from '../../../components/TextInput';

import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { restartNeeded } from '../../../utils/RestartUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import { getDefaultEsploraServer } from '../../../utils/EmbeddedLdkNodeUtils';

interface EsploraServerProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface EsploraServerState {
    esploraServer: string;
}

@inject('SettingsStore')
@observer
export default class EsploraServer extends React.Component<
    EsploraServerProps,
    EsploraServerState
> {
    state = {
        esploraServer: this.props.SettingsStore.ldkEsploraServer || ''
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { esploraServer } = this.state;
        const { embeddedLdkNetwork, updateSettings }: any = SettingsStore;

        const defaultServer = getDefaultEsploraServer(
            (embeddedLdkNetwork?.toLowerCase() as
                | 'mainnet'
                | 'testnet'
                | 'signet'
                | 'regtest') || 'mainnet'
        );

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
                            onChangeText={async (text: string) => {
                                this.setState({
                                    esploraServer: text
                                });

                                await updateSettings({
                                    ldkEsploraServer: text
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
                                    'views.Settings.EmbeddedNode.EsploraServer.defaultServer'
                                )}
                                : {defaultServer || 'None'}
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
