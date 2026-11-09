import * as React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Icon, ListItem } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import TextInput from '../../components/TextInput';
import ToggleButton from '../../components/ToggleButton';

import LSPS2Fields, { Lsps2Field } from './LSPS2Fields';

import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore, {
    DEFAULT_LSP_MAINNET,
    DEFAULT_LSP_TESTNET,
    DEFAULT_LSP_MUTINYNET,
    JitChannelProvider,
    getJitChannelProvider,
    getLdkNodeLspConfig,
    getLspConfigForNetwork
} from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import {
    getActiveLsps2Config,
    getActiveLsps2NodeId
} from '../../utils/LdkNodeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { restartNeeded } from '../../utils/RestartUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

interface LSPProps {
    navigation: NativeStackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

interface LSPState {
    enableLSP: boolean | undefined;
    lsp: string;
    accessKey: string;
    requestSimpleTaproot: boolean;
    provider: JitChannelProvider;
    lsps2Pubkey: string;
    lsps2Host: string;
    lsps2Token: string;
}

const lsps2NetworkKeys = (nodeInfo: any) =>
    nodeInfo?.isMutinynet
        ? { pubkey: 'lsps2PubkeyMutinynet', host: 'lsps2HostMutinynet' }
        : nodeInfo?.isTestNet
        ? { pubkey: 'lsps2PubkeyTestnet', host: 'lsps2HostTestnet' }
        : { pubkey: 'lsps2PubkeyMainnet', host: 'lsps2HostMainnet' };

const shortNodeId = (nodeId: string) =>
    `${nodeId.slice(0, 8)}…${nodeId.slice(-8)}`;

const flowLinks = () => [
    {
        label: localeString('views.Settings.LSP.createWrappedInvoice'),
        nav: 'Receive',
        params: { forceLsp: true, selectedIndex: 1 }
    },
    {
        label: localeString('views.LspExplanationOverview.title'),
        nav: 'LspExplanationOverview'
    },
    {
        label: localeString('views.Settings.LSP.flow2'),
        url: 'https://docs.zeusln.app/lsp/services/flow#api'
    }
];

const lsps2Links = () => [
    {
        label: localeString('views.Settings.LSP.lsps2Spec'),
        url: 'https://github.com/lightning/blips/blob/master/blip-0052.md'
    }
];

@inject('NodeInfoStore', 'SettingsStore')
@observer
export default class LSP extends React.Component<LSPProps, LSPState> {
    // The LSPS2 LSP the last restart prompt was for, so it isn't asked twice
    private promptedLsps2Config?: string;

    constructor(props: LSPProps) {
        super(props);

        const { SettingsStore, NodeInfoStore } = this.props;
        const { settings } = SettingsStore;
        const lspConfig = getLspConfigForNetwork(
            settings,
            NodeInfoStore!.nodeInfo
        );

        this.state = {
            enableLSP: settings.enableLSP ?? true,
            lsp: lspConfig.flowHost,
            accessKey: settings.lspAccessKey ?? '',
            requestSimpleTaproot: settings?.requestSimpleTaproot ?? true,
            provider: getJitChannelProvider(settings),
            lsps2Pubkey: lspConfig.lsps2Pubkey,
            lsps2Host: lspConfig.lsps2Host,
            lsps2Token: settings.lsps2Token || ''
        };
    }

    // What the next node start registers as the LSPS2 LSP: nothing with Flow
    // or without a valid LSP, so cleared fields resolve to the default
    lsps2Config = (state: LSPState) => {
        const { SettingsStore, NodeInfoStore } = this.props;
        const keys = lsps2NetworkKeys(NodeInfoStore.nodeInfo);
        return getLdkNodeLspConfig(
            {
                ...SettingsStore.settings,
                jitChannelProvider: state.provider,
                [keys.pubkey]: state.lsps2Pubkey,
                [keys.host]: state.lsps2Host,
                lsps2Token: state.lsps2Token
            },
            NodeInfoStore.nodeInfo
        ).lsps2Config;
    };

    // The node reads its LSPS2 LSP only when it starts
    promptRestartIfNeeded = (state: LSPState) => {
        if (!BackendUtils.supportsLSPS2()) return;
        const wanted = JSON.stringify(this.lsps2Config(state) ?? null);
        const running = JSON.stringify(getActiveLsps2Config() ?? null);
        if (wanted === running) {
            this.promptedLsps2Config = undefined;
            return;
        }
        if (wanted === this.promptedLsps2Config) return;
        this.promptedLsps2Config = wanted;
        restartNeeded();
    };

    setProvider = async (provider: JitChannelProvider) => {
        this.setState({ provider });
        await this.props.SettingsStore.updateSettings({
            jitChannelProvider: provider
        });
        this.promptRestartIfNeeded({ ...this.state, provider });
    };

    updateLsps2 = (field: Lsps2Field, value: string) => {
        const { SettingsStore, NodeInfoStore } = this.props;
        if (field === 'token') {
            this.setState({ lsps2Token: value });
            return SettingsStore.updateSettings({ lsps2Token: value });
        }
        const key = lsps2NetworkKeys(NodeInfoStore.nodeInfo)[field];
        if (field === 'pubkey') {
            this.setState({ lsps2Pubkey: value });
        } else {
            this.setState({ lsps2Host: value });
        }
        return SettingsStore.updateSettings({ [key]: value });
    };

    // Empty values follow the defaults, so a later default reaches this user
    resetLsps2 = async () => {
        const { SettingsStore, NodeInfoStore } = this.props;
        const { nodeInfo } = NodeInfoStore;
        const keys = lsps2NetworkKeys(nodeInfo);
        const config = getLspConfigForNetwork(SettingsStore.settings, nodeInfo);
        const defaults = {
            lsps2Pubkey: config.defaultLsps2Pubkey,
            lsps2Host: config.defaultLsps2Host,
            lsps2Token: ''
        };
        this.setState(defaults);
        await SettingsStore.updateSettings({
            [keys.pubkey]: '',
            [keys.host]: '',
            lsps2Token: ''
        });
        this.promptRestartIfNeeded({ ...this.state, ...defaults });
    };

    renderProviderChoice = () => {
        const { enableLSP, provider } = this.state;

        const activeNodeId = getActiveLsps2NodeId();

        return (
            <>
                {enableLSP && (
                    <View style={{ marginHorizontal: 15, marginBottom: 10 }}>
                        <Text style={{ color: themeColor('text') }}>
                            {`${localeString('views.Settings.LSP.inUse')}: ${
                                activeNodeId
                                    ? `LSPS2 · ${shortNodeId(activeNodeId)}`
                                    : 'Flow 2.0'
                            }`}
                        </Text>
                    </View>
                )}
                <ToggleButton
                    options={[
                        { key: 'flow', label: 'Flow 2.0' },
                        { key: 'lsps2', label: 'LSPS2' }
                    ]}
                    value={provider}
                    onToggle={(key: string) =>
                        this.setProvider(key as JitChannelProvider)
                    }
                />
                <View style={{ margin: 10 }}>
                    <Text style={{ color: themeColor('secondaryText') }}>
                        {localeString(
                            provider === 'flow'
                                ? 'views.Settings.LSP.flowInfo'
                                : 'views.Settings.LSP.lsps2Info'
                        )}
                    </Text>
                </View>
            </>
        );
    };

    renderFlowFields = () => {
        const { NodeInfoStore, SettingsStore } = this.props;
        const { enableLSP, lsp, accessKey, requestSimpleTaproot } = this.state;
        const { updateSettings, settings } = SettingsStore;
        const { nodeInfo } = NodeInfoStore;
        const isMutinynet = nodeInfo?.isMutinynet;
        const isTestNet = nodeInfo?.isTestNet;

        const showReset: boolean =
            !enableLSP ||
            accessKey !== '' ||
            (BackendUtils.supportsSimpleTaprootChannels() &&
                !requestSimpleTaproot) ||
            lsp !== getLspConfigForNetwork(settings, nodeInfo).defaultFlowHost;

        return (
            <>
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
                                isMutinynet
                                    ? { lspMutinynet: text }
                                    : isTestNet
                                    ? { lspTestnet: text }
                                    : { lspMainnet: text }
                            );
                        }}
                        locked={!enableLSP}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
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
                {BackendUtils.supportsSimpleTaprootChannels() && (
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
                )}

                {showReset && (
                    <View style={{ marginTop: 20 }}>
                        <Button
                            title={localeString('general.reset')}
                            accessibilityLabel={localeString('general.reset')}
                            onPress={async () => {
                                const defaultLsp = isMutinynet
                                    ? DEFAULT_LSP_MUTINYNET
                                    : isTestNet
                                    ? DEFAULT_LSP_TESTNET
                                    : DEFAULT_LSP_MAINNET;
                                this.setState({
                                    enableLSP: true,
                                    lsp: defaultLsp,
                                    accessKey: '',
                                    requestSimpleTaproot: true
                                });
                                await updateSettings({
                                    enableLSP: true,
                                    lspMainnet: DEFAULT_LSP_MAINNET,
                                    lspTestnet: DEFAULT_LSP_TESTNET,
                                    lspMutinynet: DEFAULT_LSP_MUTINYNET,
                                    lspAccessKey: '',
                                    requestSimpleTaproot: true
                                });
                            }}
                        />
                    </View>
                )}
            </>
        );
    };

    renderLsps2Fields = () => {
        const { NodeInfoStore, SettingsStore } = this.props;
        const { enableLSP, lsps2Pubkey, lsps2Host, lsps2Token } = this.state;
        const { defaultLsps2Pubkey, defaultLsps2Host } = getLspConfigForNetwork(
            SettingsStore.settings,
            NodeInfoStore.nodeInfo
        );

        return (
            <LSPS2Fields
                pubkey={lsps2Pubkey}
                host={lsps2Host}
                token={lsps2Token}
                locked={!enableLSP}
                onChange={this.updateLsps2}
                onBlur={() => this.promptRestartIfNeeded(this.state)}
                showReset={
                    lsps2Pubkey !== defaultLsps2Pubkey ||
                    lsps2Host !== defaultLsps2Host ||
                    lsps2Token !== ''
                }
                onReset={this.resetLsps2}
            />
        );
    };

    render() {
        const { navigation, NodeInfoStore, SettingsStore } = this.props;
        const { enableLSP, provider } = this.state;
        const { updateSettings, certVerification, settings }: any =
            SettingsStore;
        const { nodes, selectedNode } = settings;

        const { flowLspNotConfigured, zeroConfConfig, scidAlias, zeroConf } =
            NodeInfoStore.flowLspNotConfigured();

        const supportsLsps2 = BackendUtils.supportsLSPS2();
        const showFlow = !supportsLsps2 || provider === 'flow';

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
                                        value={enableLSP ?? true}
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
                            {supportsLsps2 && this.renderProviderChoice()}
                            {showFlow
                                ? this.renderFlowFields()
                                : this.renderLsps2Fields()}
                        </>
                    )}
                </View>
                {!flowLspNotConfigured && (
                    <View style={{ marginBottom: 15 }}>
                        <FlatList
                            data={showFlow ? flowLinks() : lsps2Links()}
                            renderItem={({ item }) => (
                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'transparent'
                                    }}
                                    onPress={() => {
                                        if (item.nav)
                                            navigation.navigate(
                                                item.nav,
                                                item.params
                                            );
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
