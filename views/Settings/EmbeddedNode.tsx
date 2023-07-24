import * as React from 'react';
import { Text, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import TextInput from '../../components/TextInput';

import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import Switch from '../../components/Switch';

interface EmbeddedNodeProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface EmbeddedNodeState {
    expressGraphSync: boolean | undefined;
    expressGraphSyncMobile: boolean | undefined;
    resetExpressGraphSyncOnStartup: boolean | undefined;
    lsp: string;
}

@inject('SettingsStore')
@observer
export default class EmbeddedNode extends React.Component<
    EmbeddedNodeProps,
    EmbeddedNodeState
> {
    state = {
        expressGraphSync: false,
        expressGraphSyncMobile: false,
        resetExpressGraphSyncOnStartup: false,
        lsp: ''
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings, embeddedLndNetwork } = SettingsStore;

        this.setState({
            expressGraphSync: settings.expressGraphSync,
            expressGraphSyncMobile: settings.expressGraphSyncMobile,
            resetExpressGraphSyncOnStartup:
                settings.resetExpressGraphSyncOnStartup,
            lsp:
                embeddedLndNetwork === 'Mainnet'
                    ? settings.lspMainnet
                    : settings.lspTestnet
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            expressGraphSync,
            expressGraphSyncMobile,
            resetExpressGraphSyncOnStartup,
            lsp
        } = this.state;
        const { updateSettings, embeddedLndNetwork }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View
                        style={{
                            paddingTop: 5,
                            paddingBottom: 5,
                            paddingLeft: 15,
                            paddingRight: 15
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: 'Lato-Regular',
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('general.lsp')}
                        </Text>
                        <TextInput
                            value={lsp}
                            onChangeText={async (text: string) => {
                                this.setState({ lsp: text });
                                await updateSettings(
                                    embeddedLndNetwork === 'Mainnet'
                                        ? {
                                              lspMainnet: text
                                          }
                                        : {
                                              lspTestnet: text
                                          }
                                );
                            }}
                        />
                    </View>
                    {embeddedLndNetwork === 'Mainnet' && (
                        <>
                            <>
                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'transparent'
                                    }}
                                >
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'Lato-Regular'
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.EmbeddedNode.expressGraphSync'
                                        )}
                                    </ListItem.Title>
                                    <View
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            justifyContent: 'flex-end'
                                        }}
                                    >
                                        <Switch
                                            value={expressGraphSync}
                                            onValueChange={async () => {
                                                this.setState({
                                                    expressGraphSync:
                                                        !expressGraphSync
                                                });
                                                await updateSettings({
                                                    expressGraphSync:
                                                        !expressGraphSync
                                                });
                                            }}
                                        />
                                    </View>
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
                                            'views.Settings.EmbeddedNode.expressGraphSync.subtitle'
                                        )}
                                    </Text>
                                </View>
                            </>
                            <>
                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'transparent'
                                    }}
                                >
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'Lato-Regular'
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.EmbeddedNode.expressGraphSyncMobile'
                                        )}
                                    </ListItem.Title>
                                    <View
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            justifyContent: 'flex-end'
                                        }}
                                    >
                                        <Switch
                                            value={expressGraphSyncMobile}
                                            onValueChange={async () => {
                                                this.setState({
                                                    expressGraphSyncMobile:
                                                        !expressGraphSyncMobile
                                                });
                                                await updateSettings({
                                                    expressGraphSyncMobile:
                                                        !expressGraphSyncMobile
                                                });
                                            }}
                                            disabled={!expressGraphSync}
                                        />
                                    </View>
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
                                            'views.Settings.EmbeddedNode.expressGraphSyncMobile.subtitle'
                                        )}
                                    </Text>
                                </View>
                            </>
                            <>
                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'transparent'
                                    }}
                                >
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'Lato-Regular'
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.EmbeddedNode.resetExpressGraphSyncOnStartup'
                                        )}
                                    </ListItem.Title>
                                    <View
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            justifyContent: 'flex-end'
                                        }}
                                    >
                                        <Switch
                                            value={
                                                resetExpressGraphSyncOnStartup
                                            }
                                            onValueChange={async () => {
                                                this.setState({
                                                    resetExpressGraphSyncOnStartup:
                                                        !resetExpressGraphSyncOnStartup
                                                });
                                                await updateSettings({
                                                    resetExpressGraphSyncOnStartup:
                                                        !resetExpressGraphSyncOnStartup
                                                });
                                            }}
                                            disabled={!expressGraphSync}
                                        />
                                    </View>
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
                                            'views.Settings.EmbeddedNode.resetExpressGraphSyncOnStartup.subtitle'
                                        )}
                                    </Text>
                                </View>
                            </>
                        </>
                    )}
                </View>
            </Screen>
        );
    }
}
