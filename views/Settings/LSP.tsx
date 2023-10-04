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

interface LSPProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface LSPState {
    enableLSP: boolean | undefined;
    lsp: string;
    accessKey: string;
    requestSimpleTaproot: boolean;
}

@inject('SettingsStore')
@observer
export default class LSP extends React.Component<LSPProps, LSPState> {
    state = {
        enableLSP: true,
        lsp: '',
        accessKey: '',
        requestSimpleTaproot: false
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
            accessKey: settings.lspAccessKey,
            requestSimpleTaproot: settings.requestSimpleTaproot
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { enableLSP, lsp, accessKey, requestSimpleTaproot } = this.state;
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
                            autoCapitalize="none"
                            autoCorrect={false}
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
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>
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
                                'views.Settings.LSP.requestSimpleTaproot'
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
                                value={requestSimpleTaproot}
                                onValueChange={async () => {
                                    this.setState({
                                        requestSimpleTaproot:
                                            !requestSimpleTaproot
                                    });
                                    await updateSettings({
                                        requestSimpleTaproot:
                                            !requestSimpleTaproot
                                    });
                                }}
                            />
                        </View>
                    </ListItem>
                </View>
            </Screen>
        );
    }
}
