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
    enableLSP: boolean | undefined;
    lsp: string;
    accessKey: string;
}

@inject('SettingsStore')
@observer
export default class EmbeddedNode extends React.Component<
    EmbeddedNodeProps,
    EmbeddedNodeState
> {
    state = {
        enableLSP: true,
        lsp: '',
        accessKey: ''
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings, embeddedLndNetwork } = SettingsStore;

        this.setState({
            enableLSP: settings.enableLSP,
            lsp:
                embeddedLndNetwork === 'Mainnet'
                    ? settings.lspMainnet
                    : settings.lspTestnet,
            accessKey: settings.lspAccessKey
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { enableLSP, lsp, accessKey } = this.state;
        const { updateSettings, embeddedLndNetwork }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('general.lsp'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        navigation={navigation}
                    />
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
                            {localeString('views.Settings.LSP.enableLSP')}
                        </ListItem.Title>
                        <View
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                justifyContent: 'flex-end'
                            }}
                        >
                            <Switch
                                value={enableLSP}
                                onValueChange={async () => {
                                    this.setState({
                                        enableLSP: !enableLSP
                                    });
                                    await updateSettings({
                                        enableLSP: !enableLSP
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
                                'views.Settings.LSP.enableLSP.subtitle'
                            )}
                        </Text>
                    </View>
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
                            locked={!enableLSP}
                        />
                    </View>
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
                            {`${localeString(
                                'views.Settings.LSP.lspAccessKey'
                            )}`}
                        </Text>
                        <TextInput
                            value={accessKey}
                            onChangeText={async (text: string) => {
                                this.setState({ accessKey: text });
                                await updateSettings({
                                    lspAccessKey: text
                                });
                            }}
                            locked={!enableLSP}
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}
