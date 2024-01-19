import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import TextInput from '../../components/TextInput';

import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore, {
    DEFAULT_LSP_MAINNET,
    DEFAULT_LSP_TESTNET
} from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

interface LSPProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

interface LSPState {
    enableLSP: boolean | undefined;
    lsp: string;
    accessKey: string;
    requestSimpleTaproot: boolean;
}

@inject('NodeInfoStore', 'SettingsStore')
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
        const { navigation, NodeInfoStore, SettingsStore } = this.props;
        const { enableLSP, lsp, accessKey, requestSimpleTaproot } = this.state;
        const { updateSettings, embeddedLndNetwork, certVerification }: any =
            SettingsStore;

        const { lspNotConfigured, zeroConfConfig, scidAlias, zeroConf } =
            NodeInfoStore.lspNotConfigured();

        const showReset: boolean =
            !enableLSP ||
            accessKey !== '' ||
            requestSimpleTaproot ||
            (embeddedLndNetwork === 'Mainnet' && lsp !== DEFAULT_LSP_MAINNET) ||
            (embeddedLndNetwork === 'Testnet' && lsp !== DEFAULT_LSP_TESTNET);

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('general.lsp'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    {lspNotConfigured ? (
                        <>
                            <ListItem containerStyle={styles.listItem}>
                                <Text style={{ color: themeColor('text') }}>
                                    {localeString(
                                        'views.Settings.LSP.toProceed'
                                    )}
                                </Text>
                            </ListItem>
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent'
                                }}
                            >
                                <Text>{zeroConf ? '✅' : '❌'}</Text>
                                <Text style={{ color: themeColor('text') }}>
                                    {localeString(
                                        'views.Settings.LSP.zeroConfChans'
                                    )}
                                </Text>
                            </ListItem>
                            <ListItem containerStyle={styles.listItem}>
                                <Text>{scidAlias ? '✅' : '❌'}</Text>
                                <Text style={{ color: themeColor('text') }}>
                                    {localeString('views.Channel.aliasScids')}
                                </Text>
                            </ListItem>
                            <ListItem containerStyle={styles.listItem}>
                                <Text>{certVerification ? '✅' : '❌'}</Text>
                                <Text style={{ color: themeColor('text') }}>
                                    {localeString(
                                        'views.Settings.AddEditNode.certificateVerification'
                                    )}
                                </Text>
                            </ListItem>
                            <View style={styles.buttons}>
                                {!zeroConfConfig && (
                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'views.Settings.LSP.learn0confConfig'
                                            )}
                                            onPress={() =>
                                                UrlUtils.goToUrl(
                                                    'https://github.com/lightningnetwork/lnd/blob/master/docs/zero_conf_channels.md'
                                                )
                                            }
                                        />
                                    </View>
                                )}
                                {!certVerification && (
                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'views.Settings.LSP.enableCertificateVerification'
                                            )}
                                            onPress={() =>
                                                navigation.navigate('Nodes')
                                            }
                                        />
                                    </View>
                                )}
                            </View>
                        </>
                    ) : (
                        <>
                            <ListItem containerStyle={styles.listItem}>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.LSP.enableLSP'
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
                                        fontFamily: 'PPNeueMontreal-Book',
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
                                        fontFamily: 'PPNeueMontreal-Book',
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
                            <ListItem containerStyle={styles.listItem}>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
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

                            {showReset && (
                                <View style={{ marginTop: 20 }}>
                                    <Button
                                        title={localeString('general.reset')}
                                        accessibilityLabel={localeString(
                                            'general.reset'
                                        )}
                                        onPress={async () => {
                                            this.setState({
                                                enableLSP: true,
                                                lsp:
                                                    embeddedLndNetwork ===
                                                    'Mainnet'
                                                        ? DEFAULT_LSP_MAINNET
                                                        : DEFAULT_LSP_TESTNET,
                                                accessKey: '',
                                                requestSimpleTaproot: false
                                            });
                                            await updateSettings({
                                                enableLSP: true,
                                                lspMainnet: DEFAULT_LSP_MAINNET,
                                                lspTestnet: DEFAULT_LSP_TESTNET,
                                                lspAccessKey: '',
                                                requestSimpleTaproot: false
                                            });
                                        }}
                                    />
                                </View>
                            )}
                        </>
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    listItem: {
        borderBottomWidth: 0,
        backgroundColor: 'transparent'
    },
    buttons: {
        marginTop: 20
    },
    button: {
        margin: 10
    }
});
