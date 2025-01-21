import * as React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

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
    navigation: StackNavigationProp<any, any>;
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
        requestSimpleTaproot: true
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore, NodeInfoStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            enableLSP: settings.enableLSP,
            lsp: NodeInfoStore!.nodeInfo.isTestNet
                ? settings.lspTestnet
                : settings.lspMainnet,
            accessKey: settings.lspAccessKey,
            requestSimpleTaproot:
                settings?.requestSimpleTaproot !== null
                    ? settings.requestSimpleTaproot
                    : true
        });
    }

    render() {
        const { navigation, NodeInfoStore, SettingsStore } = this.props;
        const { enableLSP, lsp, accessKey, requestSimpleTaproot } = this.state;
        const { updateSettings, certVerification, settings }: any =
            SettingsStore;
        const { nodes, selectedNode } = settings;
        const { nodeInfo } = NodeInfoStore;

        const isTestNet = nodeInfo?.isTestNet;

        const { flowLspNotConfigured, zeroConfConfig, scidAlias, zeroConf } =
            NodeInfoStore.flowLspNotConfigured();

        const showReset: boolean =
            !enableLSP ||
            accessKey !== '' ||
            requestSimpleTaproot ||
            (!isTestNet && lsp !== DEFAULT_LSP_MAINNET) ||
            (isTestNet && lsp !== DEFAULT_LSP_TESTNET);

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'view.Settings.LSPServicesList.flow2'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ flex: 1 }}>
                    {flowLspNotConfigured ? (
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
                                                navigation.navigate(
                                                    'WalletConfiguration',
                                                    {
                                                        node: nodes[
                                                            selectedNode || 0
                                                        ],
                                                        index:
                                                            selectedNode || 0,
                                                        active: true,
                                                        saved: true
                                                    }
                                                )
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
                                            isTestNet
                                                ? {
                                                      lspTestnet: text
                                                  }
                                                : {
                                                      lspMainnet: text
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
                                    {`${localeString('general.discountCode')}`}
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
                                                lsp: isTestNet
                                                    ? DEFAULT_LSP_TESTNET
                                                    : DEFAULT_LSP_MAINNET,
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
                {!flowLspNotConfigured && (
                    <View style={{ marginBottom: 15 }}>
                        <FlatList
                            data={[
                                {
                                    label: localeString(
                                        'views.Settings.LSP.createWrappedInvoice'
                                    ),
                                    nav: 'Receive'
                                },
                                {
                                    label: localeString(
                                        'views.LspExplanationOverview.title'
                                    ),
                                    nav: 'LspExplanationOverview'
                                },
                                {
                                    label: localeString(
                                        'views.Settings.LSP.flow2'
                                    ),
                                    url: 'https://docs.zeusln.app/lsp/api'
                                }
                            ]}
                            renderItem={({ item }) => (
                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'transparent'
                                    }}
                                    onPress={() => {
                                        if (item.nav)
                                            navigation.navigate(item.nav);
                                        if (item.url)
                                            UrlUtils.goToUrl(item.url);
                                    }}
                                >
                                    <ListItem.Content>
                                        <ListItem.Title
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            {item.label}
                                        </ListItem.Title>
                                    </ListItem.Content>
                                    <Icon
                                        name="keyboard-arrow-right"
                                        color={themeColor('secondaryText')}
                                    />
                                </ListItem>
                            )}
                            keyExtractor={(item, index) =>
                                `${item.label}-${index}`
                            }
                            ItemSeparatorComponent={() => (
                                <View
                                    style={{
                                        height: 1,
                                        backgroundColor: themeColor('separator')
                                    }}
                                />
                            )}
                        />
                    </View>
                )}
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
