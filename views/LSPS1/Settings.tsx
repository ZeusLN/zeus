import * as React from 'react';
import { inject, observer } from 'mobx-react';
import { FlatList, View, Text } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import LSPStore from '../../stores/LSPStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore, {
    DEFAULT_LSPS1_PUBKEY_MAINNET,
    DEFAULT_LSPS1_PUBKEY_TESTNET,
    DEFAULT_LSPS1_HOST_MAINNET,
    DEFAULT_LSPS1_HOST_TESTNET,
    DEFAULT_LSPS1_REST_MAINNET,
    DEFAULT_LSPS1_REST_TESTNET
} from '../../stores/SettingsStore';

import Olympus from '../../assets/images/SVG/Olympus.svg';

interface LSPS1SettingsProps {
    navigation: StackNavigationProp<any, any>;
    LSPStore: LSPStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

interface LSPS1SettingsState {
    pubkey: string;
    host: string;
    restHost: string;
    lsps1Token: string;
}

@inject('LSPStore', 'NodeInfoStore', 'SettingsStore')
@observer
export default class LSPS1Settings extends React.Component<
    LSPS1SettingsProps,
    LSPS1SettingsState
> {
    constructor(props: LSPS1SettingsProps) {
        super(props);
        this.state = {
            pubkey: '',
            host: '',
            restHost: '',
            lsps1Token: ''
        };
    }

    async UNSAFE_componentWillMount() {
        const { LSPStore, SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            pubkey: LSPStore.getLSPSPubkey(),
            host: LSPStore.getLSPSHost(),
            restHost: LSPStore.getLSPS1Rest(),
            lsps1Token: settings?.lsps1Token || ''
        });
    }

    handleReset = async () => {
        const isTestNet = this.props.NodeInfoStore?.nodeInfo?.isTestNet;
        this.setState({
            pubkey: isTestNet
                ? DEFAULT_LSPS1_PUBKEY_TESTNET
                : DEFAULT_LSPS1_PUBKEY_MAINNET,
            host: isTestNet
                ? DEFAULT_LSPS1_HOST_TESTNET
                : DEFAULT_LSPS1_HOST_MAINNET,
            restHost: isTestNet
                ? DEFAULT_LSPS1_REST_TESTNET
                : DEFAULT_LSPS1_REST_MAINNET,
            lsps1Token: ''
        });
        await this.props.SettingsStore.updateSettings({
            lsps1RestMainnet: DEFAULT_LSPS1_REST_MAINNET,
            lsps1RestTestnet: DEFAULT_LSPS1_REST_TESTNET,
            lsps1PubkeyMainnet: DEFAULT_LSPS1_PUBKEY_MAINNET,
            lsps1PubkeyTestnet: DEFAULT_LSPS1_PUBKEY_TESTNET,
            lsps1HostMainnet: DEFAULT_LSPS1_HOST_MAINNET,
            lsps1HostTestnet: DEFAULT_LSPS1_HOST_TESTNET,
            lsps1Token: ''
        });
    };

    render() {
        const { pubkey, host, restHost, lsps1Token } = this.state;
        const { navigation, SettingsStore, NodeInfoStore } = this.props;
        const { updateSettings } = SettingsStore;
        const { nodeInfo } = NodeInfoStore;

        const isOlympusMainnetCustom =
            !nodeInfo.isTestNet &&
            pubkey === DEFAULT_LSPS1_PUBKEY_MAINNET &&
            host === DEFAULT_LSPS1_HOST_MAINNET;
        const isOlympusTestnetCustom =
            nodeInfo?.isTestNet &&
            pubkey === DEFAULT_LSPS1_PUBKEY_TESTNET &&
            host === DEFAULT_LSPS1_HOST_TESTNET;

        const isOlympusMainnetRest =
            !nodeInfo.isTestNet && restHost === DEFAULT_LSPS1_REST_MAINNET;
        const isOlympusTestnetRest =
            nodeInfo.isTestNet && restHost === DEFAULT_LSPS1_REST_TESTNET;

        const isOlympusCustomMessage =
            BackendUtils.supportsLSPScustomMessage() &&
            (isOlympusMainnetCustom || isOlympusTestnetCustom);
        const isOlympusRest =
            BackendUtils.supportsLSPS1rest() &&
            (isOlympusMainnetRest || isOlympusTestnetRest);

        const isOlympus = isOlympusCustomMessage || isOlympusRest;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: `${localeString(
                            'view.Settings.LSPServicesList.lsps1'
                        )}`,
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ flex: 1, padding: 12 }}>
                    {BackendUtils.supportsLSPScustomMessage() && (
                        <>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 16
                                }}
                            >
                                {localeString('views.OpenChannel.nodePubkey')}
                            </Text>
                            <TextInput
                                value={pubkey}
                                placeholder={'0A...'}
                                onChangeText={async (text: string) => {
                                    this.setState({ pubkey: text });
                                    await updateSettings(
                                        nodeInfo?.isTestNet
                                            ? {
                                                  lsps1PubkeyTestnet: text
                                              }
                                            : {
                                                  lsps1PubkeyMainnet: text
                                              }
                                    );
                                }}
                            />

                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 16,
                                    marginTop: 12
                                }}
                            >
                                {localeString('views.OpenChannel.host')}
                            </Text>
                            <TextInput
                                value={host}
                                placeholder={localeString(
                                    'views.OpenChannel.hostPort'
                                )}
                                onChangeText={async (text: string) => {
                                    this.setState({ host: text });
                                    await updateSettings(
                                        nodeInfo?.isTestNet
                                            ? {
                                                  lsps1HostTestnet: text
                                              }
                                            : {
                                                  lsps1HostMainnet: text
                                              }
                                    );
                                }}
                            />
                        </>
                    )}
                    {BackendUtils.supportsLSPS1rest() && (
                        <>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 16,
                                    marginTop: 12
                                }}
                            >
                                {localeString('general.lsp')}
                            </Text>
                            <TextInput
                                value={restHost}
                                placeholder={
                                    nodeInfo.isTestNet
                                        ? DEFAULT_LSPS1_REST_TESTNET
                                        : DEFAULT_LSPS1_REST_MAINNET
                                }
                                onChangeText={async (text: string) => {
                                    this.setState({ restHost: text });
                                    await updateSettings(
                                        nodeInfo?.isTestNet
                                            ? {
                                                  lsps1RestTestnet: text
                                              }
                                            : {
                                                  lsps1RestMainnet: text
                                              }
                                    );
                                }}
                            />
                        </>
                    )}
                    <>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontSize: 16,
                                marginTop: 12
                            }}
                        >
                            {localeString('general.discountCode')}
                        </Text>
                        <TextInput
                            value={lsps1Token}
                            onChangeText={async (text: string) => {
                                this.setState({ lsps1Token: text });
                                await updateSettings({
                                    lsps1Token: text
                                });
                            }}
                            autoCapitalize="none"
                        />
                    </>

                    {!isOlympus && (
                        <Button
                            containerStyle={{ paddingTop: 30 }}
                            title={localeString('general.reset')}
                            onPress={() => this.handleReset()}
                        />
                    )}
                </View>
                <View style={{ marginBottom: 15 }}>
                    <View style={{ marginBottom: 10 }}>
                        {isOlympus && (
                            <View style={{ alignSelf: 'center' }}>
                                <Olympus fill={themeColor('text')} />
                            </View>
                        )}
                    </View>
                    <FlatList
                        data={[
                            {
                                label: localeString(
                                    'views.LSPS1.purchaseInbound'
                                ),
                                nav: 'LSPS1'
                            },
                            {
                                label: localeString('views.LSPS1.lsps1Spec'),
                                url: 'https://github.com/BitcoinAndLightningLayerSpecs/lsp/blob/main/LSPS1/README.md'
                            }
                        ]}
                        renderItem={({ item }) => (
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent'
                                }}
                                onPress={() => {
                                    if (item.nav) navigation.navigate(item.nav);
                                    if (item.url) UrlUtils.goToUrl(item.url);
                                }}
                            >
                                <ListItem.Content>
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book'
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
                        keyExtractor={(item, index) => `${item.label}-${index}`}
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
            </Screen>
        );
    }
}
