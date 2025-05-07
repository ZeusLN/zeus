import * as React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    View,
    TouchableOpacity,
    FlatList
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';
import NfcManager, { NfcEvents, TagEvent } from 'react-native-nfc-manager';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Tab } from 'react-native-elements';

import AmountInput from '../components/AmountInput';
import Text from '../components/Text';
import Button from '../components/Button';
import DropdownSetting from '../components/DropdownSetting';
import Header from '../components/Header';
import OnchainFeeInput from '../components/OnchainFeeInput';
import KeyValue from '../components/KeyValue';
import LightningIndicator from '../components/LightningIndicator';
import { Row } from '../components/layout/Row';
import Screen from '../components/Screen';
import {
    SuccessMessage,
    ErrorMessage
} from '../components/SuccessErrorMessage';
import Switch from '../components/Switch';
import TextInput from '../components/TextInput';
import UTXOPicker from '../components/UTXOPicker';
import ModalBox from '../components/ModalBox';

import handleAnything from '../utils/handleAnything';
import NFCUtils from '../utils/NFCUtils';
import NodeUriUtils from '../utils/NodeUriUtils';
import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import BalanceStore from '../stores/BalanceStore';
import ChannelsStore from '../stores/ChannelsStore';
import ModalStore from '../stores/ModalStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore from '../stores/SettingsStore';
import UTXOsStore from '../stores/UTXOsStore';

import { AdditionalChannel } from '../models/OpenChannelRequest';

import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';
import Scan from '../assets/images/SVG/Scan.svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import Peer from '../models/Peer';

interface OpenChannelProps {
    exitSetup: any;
    navigation: StackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    ChannelsStore: ChannelsStore;
    ModalStore: ModalStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    UTXOsStore: UTXOsStore;
    route: Route<'OpenChannel', { node_pubkey_string: string; host: string }>;
}

interface OpenChannelState {
    channelDestination: string;
    node_pubkey_string: string;
    local_funding_amount: string;
    fundMax: boolean;
    satAmount: string | number;
    min_confs: number;
    spend_unconfirmed: boolean;
    sat_per_vbyte: string;
    privateChannel: boolean;
    scidAlias: boolean;
    close_address: string;
    simpleTaprootChannel: boolean;
    host: string;
    suggestImport: string;
    utxos: Array<string>;
    utxoBalance: number;
    connectPeerOnly: boolean;
    advancedSettingsToggle: boolean;
    // external account funding
    account: string;
    additionalChannels: Array<AdditionalChannel>;
    activeTab: number;
    managePeerOnly: boolean;
    // Modal state
    disconnectModalVisible: boolean;
    selectedPeer: any;
}

@inject(
    'BalanceStore',
    'ChannelsStore',
    'ModalStore',
    'NodeInfoStore',
    'SettingsStore',
    'UTXOsStore'
)
@observer
export default class OpenChannel extends React.Component<
    OpenChannelProps,
    OpenChannelState
> {
    listener: any;
    constructor(props: any) {
        super(props);
        this.state = {
            channelDestination: 'Olympus by ZEUS',
            node_pubkey_string: '',
            host: '',
            local_funding_amount: '',
            fundMax: false,
            satAmount: '',
            min_confs: 1,
            spend_unconfirmed: false,
            sat_per_vbyte: '',
            close_address: '',
            privateChannel: true,
            scidAlias: true,
            simpleTaprootChannel: false,
            suggestImport: '',
            utxos: [],
            utxoBalance: 0,
            connectPeerOnly: false,
            advancedSettingsToggle: false,
            account: 'default',
            additionalChannels: [],
            activeTab: 0,
            managePeerOnly: false,
            disconnectModalVisible: false,
            selectedPeer: null
        };

        this.openDisconnectModal = this.openDisconnectModal.bind(this);
        this.closeDisconnectModal = this.closeDisconnectModal.bind(this);
        this.disconnectPeer = this.disconnectPeer.bind(this);
    }

    async UNSAFE_componentWillMount() {
        const { ChannelsStore, SettingsStore } = this.props;
        const { settings } = SettingsStore;

        ChannelsStore.resetOpenChannel();
        ChannelsStore.getPeers();

        if (settings.privacy && settings.privacy.clipboard) {
            const clipboard = await Clipboard.getString();

            if (NodeUriUtils.isValidNodeUri(clipboard)) {
                this.setState({
                    suggestImport: clipboard
                });
            }
        }

        this.setState({
            min_confs: settings?.channels?.min_confs || 1,
            privateChannel:
                settings?.channels?.privateChannel !== null
                    ? settings.channels.privateChannel
                    : true,
            scidAlias:
                settings?.channels?.scidAlias !== null
                    ? settings.channels.scidAlias
                    : true,
            simpleTaprootChannel:
                settings?.channels?.simpleTaprootChannel !== null
                    ? settings.channels.simpleTaprootChannel
                    : false
        });
    }

    async componentDidMount() {
        const { ChannelsStore } = this.props;
        ChannelsStore.getPeers();
        this.initFromProps(this.props);
    }

    disableNfc = () => {
        NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
        NfcManager.setEventListener(NfcEvents.SessionClosed, null);
    };

    enableNfc = async () => {
        const { ModalStore } = this.props;
        this.disableNfc();
        await NfcManager.start();

        return new Promise((resolve: any) => {
            let tagFound: TagEvent | null = null;

            // enable NFC
            if (Platform.OS === 'android')
                ModalStore.toggleAndroidNfcModal(true);

            NfcManager.setEventListener(
                NfcEvents.DiscoverTag,
                (tag: TagEvent) => {
                    tagFound = tag;
                    const bytes = new Uint8Array(
                        tagFound.ndefMessage[0].payload
                    );
                    const str = NFCUtils.nfcUtf8ArrayToStr(bytes) || '';

                    // close NFC
                    if (Platform.OS === 'android')
                        ModalStore.toggleAndroidNfcModal(false);

                    resolve(this.validateNodeUri(str));
                    NfcManager.unregisterTagEvent().catch(() => 0);
                }
            );

            NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
                // close NFC
                if (Platform.OS === 'android')
                    ModalStore.toggleAndroidNfcModal(false);

                if (!tagFound) {
                    resolve();
                }
            });

            NfcManager.registerTagEvent();
        });
    };

    UNSAFE_componentWillReceiveProps(nextProps: any) {
        this.initFromProps(nextProps);
    }

    initFromProps(props: OpenChannelProps) {
        const { route, NodeInfoStore } = props;

        const node_pubkey_string = route.params?.node_pubkey_string ?? '';
        const host = route.params?.host ?? '';

        let olympusPubkey, olympusHost;
        if (NodeInfoStore.nodeInfo.isTestNet) {
            olympusPubkey =
                '03e84a109cd70e57864274932fc87c5e6434c59ebb8e6e7d28532219ba38f7f6df';
            olympusHost = '139.144.22.237:9735';
        } else {
            olympusPubkey =
                '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581';
            olympusHost = '45.79.192.236:9735';
        }

        this.setState({
            channelDestination: node_pubkey_string
                ? 'Custom'
                : 'Olympus by ZEUS',
            node_pubkey_string: node_pubkey_string
                ? node_pubkey_string
                : olympusPubkey,
            host: node_pubkey_string ? host : olympusHost
        });
    }

    validateNodeUri = (text: string) => {
        const { navigation } = this.props;
        handleAnything(text).then(([route, props]) => {
            navigation.navigate(route, props);
        });
    };

    selectUTXOs = (
        utxos: Array<string>,
        utxoBalance: number,
        account: string
    ) => {
        const newState: any = {};
        newState.utxos = utxos;
        newState.utxoBalance = utxoBalance;
        newState.account = account;
        this.setState(newState);
    };

    importClipboard = () => {
        const { pubkey, host } = NodeUriUtils.processNodeUri(
            this.state.suggestImport
        );

        this.setState({
            node_pubkey_string: pubkey,
            host,
            suggestImport: ''
        });

        Clipboard.setString('');
    };

    clearImportSuggestion = () => {
        this.setState({
            suggestImport: ''
        });
    };

    setFee = (text: string) => {
        this.setState({ sat_per_vbyte: text });
    };

    handleOnNavigateBack = (sat_per_vbyte: string) => {
        this.setState({
            sat_per_vbyte
        });
    };

    private scrollViewRef = React.createRef<ScrollView>();

    openDisconnectModal(peer: any) {
        this.setState({
            disconnectModalVisible: true,
            selectedPeer: peer
        });
    }

    closeDisconnectModal() {
        this.setState({
            disconnectModalVisible: false,
            selectedPeer: null
        });
    }

    async disconnectPeer() {
        const { selectedPeer } = this.state;
        const { ModalStore } = this.props;
        if (!selectedPeer) return;

        try {
            await this.props.ChannelsStore.disconnectPeer(selectedPeer.pubkey);
            this.closeDisconnectModal();
            // todo alert modal rendering
            ModalStore.alertModalText = 'Peer disconnected successfully';
            ModalStore.toggleAlertModal(true);
        } catch (e: any) {
            this.closeDisconnectModal();
        }
    }

    render() {
        const {
            ChannelsStore,
            BalanceStore,
            NodeInfoStore,
            UTXOsStore,
            SettingsStore,
            navigation
        } = this.props;
        const {
            channelDestination,
            node_pubkey_string,
            local_funding_amount,
            fundMax,
            satAmount,
            min_confs,
            host,
            sat_per_vbyte,
            close_address,
            suggestImport,
            utxoBalance,
            privateChannel,
            scidAlias,
            simpleTaprootChannel,
            connectPeerOnly,
            advancedSettingsToggle,
            additionalChannels,
            managePeerOnly,
            disconnectModalVisible
        } = this.state;
        const { implementation } = SettingsStore;

        const {
            connectingToPeer,
            openingChannel,
            connectPeer,
            errorMsgChannel,
            errorMsgPeer,
            errorDisconnectPeer,
            errorListPeers,
            peerSuccess,
            channelSuccess,
            funded_psbt
        } = ChannelsStore;
        const { confirmedBlockchainBalance } = BalanceStore;

        const loading = connectingToPeer || openingChannel;

        if (funded_psbt)
            navigation.navigate('PSBT', {
                psbt: funded_psbt
            });

        const ScanButton = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('NodeQRCodeScanner')}
            >
                <Scan fill={themeColor('text')} width={30} height={30} />
            </TouchableOpacity>
        );

        return (
            <>
                <Screen>
                    <Header
                        leftComponent="Back"
                        rightComponent={<ScanButton />}
                        navigation={navigation}
                    />
                    <Tab
                        value={this.state.activeTab}
                        onChange={(e) => {
                            // Clear error messages when switching tabs to prevent them from persisting
                            ChannelsStore.errorMsgPeer = null;
                            ChannelsStore.errorMsgChannel = null;

                            this.setState({
                                activeTab: e,
                                connectPeerOnly: e === 1,
                                managePeerOnly: e === 2
                            });
                        }}
                        indicatorStyle={{
                            backgroundColor: themeColor('text'),
                            height: 3
                        }}
                        variant="primary"
                    >
                        <Tab.Item
                            title={
                                additionalChannels.length > 0
                                    ? localeString(
                                          'views.OpenChannel.openChannels'
                                      )
                                    : localeString(
                                          'views.OpenChannel.openChannel'
                                      )
                            }
                            titleStyle={{
                                ...styles.tabTitleStyle,
                                color: themeColor('text')
                            }}
                            containerStyle={{
                                backgroundColor: themeColor('secondary')
                            }}
                            disabled={loading}
                        />
                        <Tab.Item
                            title={localeString(
                                'views.OpenChannel.connectPeer'
                            )}
                            titleStyle={{
                                ...styles.tabTitleStyle,
                                color: themeColor('text')
                            }}
                            containerStyle={{
                                backgroundColor: themeColor('secondary')
                            }}
                            disabled={loading}
                        />
                        {BackendUtils.supportsPeers() && (
                            <Tab.Item
                                title={localeString(
                                    'views.OpenChannel.managePeers'
                                )}
                                titleStyle={{
                                    ...styles.tabTitleStyle,
                                    color: themeColor('text')
                                }}
                                containerStyle={{
                                    backgroundColor: themeColor('secondary')
                                }}
                            />
                        )}
                    </Tab>

                    {!!suggestImport && (
                        <View style={styles.clipboardImport}>
                            <Text style={styles.textWhite}>
                                {localeString('views.OpenChannel.importText')}
                            </Text>
                            <Text style={{ ...styles.textWhite, padding: 15 }}>
                                {suggestImport}
                            </Text>
                            <Text style={styles.textWhite}>
                                {localeString('views.OpenChannel.importPrompt')}
                            </Text>
                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.OpenChannel.import'
                                    )}
                                    onPress={() => this.importClipboard()}
                                    tertiary
                                />
                            </View>
                            <View style={styles.button}>
                                <Button
                                    title={localeString('general.cancel')}
                                    onPress={() => this.clearImportSuggestion()}
                                    tertiary
                                />
                            </View>
                        </View>
                    )}

                    <View style={styles.content}>
                        {loading && <LightningIndicator />}
                        {peerSuccess && (
                            <SuccessMessage
                                message={localeString(
                                    'views.OpenChannel.peerSuccess'
                                )}
                            />
                        )}
                        {channelSuccess && (
                            <SuccessMessage
                                message={
                                    additionalChannels.length > 0
                                        ? localeString(
                                              'views.OpenChannel.channelsSuccess'
                                          )
                                        : localeString(
                                              'views.OpenChannel.channelSuccess'
                                          )
                                }
                            />
                        )}
                        {(errorMsgPeer ||
                            errorMsgChannel ||
                            errorDisconnectPeer) && (
                            <ErrorMessage
                                message={
                                    errorMsgChannel ||
                                    errorMsgPeer ||
                                    errorDisconnectPeer ||
                                    localeString('general.error')
                                }
                            />
                        )}
                    </View>
                    {managePeerOnly ? (
                        <SafeAreaView style={{ flex: 1, paddingBottom: 20 }}>
                            <FlatList
                                style={{ padding: 20 }}
                                data={ChannelsStore.peers}
                                renderItem={({ item }) => {
                                    const peer = new Peer(item);

                                    return (
                                        <TouchableOpacity
                                            onPress={() => {
                                                this.openDisconnectModal(peer);
                                                this.scrollViewRef.current?.scrollTo(
                                                    {
                                                        y: 0,
                                                        animated: true
                                                    }
                                                );
                                            }}
                                            style={[
                                                styles.peerItem,
                                                {
                                                    backgroundColor:
                                                        themeColor('secondary')
                                                }
                                            ]}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text
                                                    style={
                                                        {
                                                            ...styles.text,
                                                            color: themeColor(
                                                                'text'
                                                            ),
                                                            fontSize: 20
                                                        }
                                                    }
                                                >
                                                    {peer.pubkey}
                                                </Text>

                                                {peer.alias && (
                                                    <Text
                                                        style={
                                                            {
                                                                ...styles.text,
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                ),
                                                                fontSize: 16,
                                                                marginTop: 4
                                                            }
                                                        }
                                                    >
                                                        {peer.alias}
                                                    </Text>
                                                )}

                                                <Text
                                                    style={
                                                        {
                                                            color: themeColor(
                                                                'secondaryText'
                                                            ),
                                                            fontSize: 16,
                                                            marginTop: 4
                                                        }
                                                    }
                                                >
                                                    {peer.address}
                                                </Text>

                                                <View style={{ marginTop: 8 }}>
                                                    {peer.ping_time && (
                                                        <Text
                                                            style={
                                                                {
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    )
                                                                }
                                                            }
                                                        >
                                                            {`${localeString(
                                                                'views.OpenChannel.pingTime'
                                                            )}: ${
                                                                peer.ping_time
                                                            }ms`}
                                                        </Text>
                                                    )}
                                                    {peer.sats_sent && (
                                                        <Text
                                                            style={
                                                                {
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    )
                                                                }
                                                            }
                                                        >
                                                            {`${localeString(
                                                                'views.OpenChannel.satsSent'
                                                            )}: ${
                                                                peer.sats_sent
                                                            }`}
                                                        </Text>
                                                    )}
                                                    {peer.sats_recv && (
                                                        <Text
                                                            style={
                                                                {
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    )
                                                                }
                                                            }
                                                        >
                                                            {`${localeString(
                                                                'views.OpenChannel.satsRecv'
                                                            )}: ${
                                                                peer.sats_recv
                                                            }`}
                                                        </Text>
                                                    )}
                                                    {peer.connected && (
                                                        <Text
                                                            style={
                                                                {
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    )
                                                                }
                                                            }
                                                        >
                                                            {`${localeString(
                                                                'views.OpenChannel.connected'
                                                            )}: ${
                                                                peer.connected
                                                            }`}
                                                        </Text>
                                                    )}
                                                    {peer.num_channels !=
                                                        null && (
                                                        <Text
                                                            style={
                                                                {
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    )
                                                                }
                                                            }
                                                        >
                                                            {`${localeString(
                                                                'views.OpenChannel.numChannels'
                                                            )}: ${
                                                                peer.num_channels
                                                            }`}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>

                                            <View
                                                style={styles.peerIconContainer}
                                            >
                                                <Icon
                                                    name="minus-circle"
                                                    size={20}
                                                    color={themeColor('error')}
                                                />
                                            </View>
                                        </TouchableOpacity>
                                    );
                                }}
                                keyExtractor={(item, index) =>
                                    `peer-${item.pubkey}-${index}`
                                }
                                ListEmptyComponent={
                                    <Text
                                        style={
                                            {
                                                ...styles.text,
                                                fontSize: 20,
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                textAlign: 'center',
                                                padding: 20
                                            }
                                        }
                                    >
                                        {localeString(
                                            'views.OpenChannel.noPeers'
                                        )}
                                    </Text>
                                }
                                ItemSeparatorComponent={() => (
                                    <View style={styles.separator} />
                                )}
                            />
                        </SafeAreaView>
                    ) : (
                        <ScrollView
                            style={{
                                flex: 1
                            }}
                            keyboardShouldPersistTaps="handled"
                            ref={this.scrollViewRef}
                        >
                            <View style={styles.content}>
                                {(connectingToPeer || openingChannel) && (
                                    <LightningIndicator />
                                )}
                                {peerSuccess && (
                                    <SuccessMessage
                                        message={localeString(
                                            'views.OpenChannel.peerSuccess'
                                        )}
                                    />
                                )}
                                {channelSuccess && (
                                    <SuccessMessage
                                        message={
                                            additionalChannels.length > 0
                                                ? localeString(
                                                      'views.OpenChannel.channelsSuccess'
                                                  )
                                                : localeString(
                                                      'views.OpenChannel.channelSuccess'
                                                  )
                                        }
                                    />
                                )}
                                {(errorMsgPeer ||
                                    errorMsgChannel ||
                                    errorDisconnectPeer ||
                                    errorListPeers) && (
                                    <ErrorMessage
                                        message={
                                            errorMsgChannel ||
                                            errorMsgPeer ||
                                            localeString('general.error')
                                        }
                                    />
                                )}

                                <DropdownSetting
                                    title={
                                        connectPeerOnly
                                            ? localeString('general.peer')
                                            : localeString(
                                                  'general.channelPartner'
                                              )
                                    }
                                    selectedValue={channelDestination}
                                    values={[
                                        {
                                            key: 'Olympus by ZEUS',
                                            value: 'Olympus by ZEUS'
                                        },
                                        {
                                            key: 'Custom',
                                            translateKey: 'general.custom',
                                            value: 'Custom'
                                        }
                                    ]}
                                    onValueChange={(value: string) => {
                                        if (value === 'Olympus by ZEUS') {
                                            if (
                                                NodeInfoStore.nodeInfo.isTestNet
                                            ) {
                                                this.setState({
                                                    channelDestination:
                                                        'Olympus by ZEUS',
                                                    node_pubkey_string:
                                                        '03e84a109cd70e57864274932fc87c5e6434c59ebb8e6e7d28532219ba38f7f6df',
                                                    host: '139.144.22.237:9735'
                                                });
                                            } else {
                                                this.setState({
                                                    channelDestination:
                                                        'Olympus by ZEUS',
                                                    node_pubkey_string:
                                                        '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581',
                                                    host: '45.79.192.236:9735'
                                                });
                                            }
                                        } else {
                                            this.setState({
                                                channelDestination: 'Custom',
                                                node_pubkey_string: '',
                                                host: ''
                                            });
                                        }
                                    }}
                                />

                                {channelDestination === 'Custom' && (
                                    <>
                                        <>
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'views.OpenChannel.nodePubkey'
                                                )}
                                            </Text>
                                            <TextInput
                                                placeholder={'0A...'}
                                                value={node_pubkey_string}
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        node_pubkey_string: text
                                                    })
                                                }
                                                locked={openingChannel}
                                            />
                                        </>

                                        <>
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'views.OpenChannel.host'
                                                )}
                                            </Text>
                                            <TextInput
                                                placeholder={localeString(
                                                    'views.OpenChannel.hostPort'
                                                )}
                                                value={host}
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        host: text
                                                    })
                                                }
                                                locked={openingChannel}
                                            />
                                        </>
                                    </>
                                )}

                                {!connectPeerOnly && (
                                    <>
                                        <AmountInput
                                            amount={
                                                fundMax
                                                    ? utxoBalance > 0
                                                        ? utxoBalance.toString()
                                                        : confirmedBlockchainBalance.toString()
                                                    : local_funding_amount
                                            }
                                            title={localeString(
                                                'views.OpenChannel.localAmt'
                                            )}
                                            onAmountChange={(
                                                amount: string,
                                                satAmount: string | number
                                            ) => {
                                                this.setState({
                                                    local_funding_amount:
                                                        amount,
                                                    satAmount
                                                });
                                            }}
                                            hideConversion={
                                                local_funding_amount === 'all'
                                            }
                                            locked={fundMax}
                                            forceUnit={
                                                fundMax ? 'sats' : undefined
                                            }
                                        />

                                        {BackendUtils.supportsChannelFundMax() &&
                                            additionalChannels.length === 0 && (
                                                <>
                                                    <Text
                                                        style={{
                                                            marginTop: -20,
                                                            top: 20,
                                                            color: themeColor(
                                                                'secondaryText'
                                                            )
                                                        }}
                                                    >
                                                        {localeString(
                                                            'views.OpenChannel.fundMax'
                                                        )}
                                                    </Text>
                                                    <Switch
                                                        value={fundMax}
                                                        onValueChange={() => {
                                                            const newValue: boolean =
                                                                !fundMax;
                                                            this.setState({
                                                                fundMax:
                                                                    newValue,
                                                                local_funding_amount:
                                                                    newValue &&
                                                                    implementation ===
                                                                        'cln-rest'
                                                                        ? 'all'
                                                                        : ''
                                                            });
                                                        }}
                                                    />
                                                </>
                                            )}

                                        {additionalChannels.map(
                                            (channel, index) => {
                                                return (
                                                    <View
                                                        key={`additionalChannel-${index}`}
                                                    >
                                                        <Text
                                                            style={{
                                                                ...styles.text,
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                )
                                                            }}
                                                        >
                                                            {localeString(
                                                                'views.OpenChannel.nodePubkey'
                                                            )}
                                                        </Text>
                                                        <TextInput
                                                            placeholder={
                                                                '0A...'
                                                            }
                                                            value={
                                                                channel?.node_pubkey_string
                                                            }
                                                            onChangeText={(
                                                                text: string
                                                            ) => {
                                                                let newChannels =
                                                                    additionalChannels;

                                                                newChannels[
                                                                    index
                                                                ].node_pubkey_string =
                                                                    text;

                                                                this.setState({
                                                                    additionalChannels:
                                                                        newChannels
                                                                });
                                                            }}
                                                        />
                                                        <Text
                                                            style={{
                                                                ...styles.text,
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                )
                                                            }}
                                                        >
                                                            {localeString(
                                                                'views.OpenChannel.host'
                                                            )}
                                                        </Text>
                                                        <TextInput
                                                            value={
                                                                channel?.host
                                                            }
                                                            placeholder={localeString(
                                                                'views.OpenChannel.hostPort'
                                                            )}
                                                            onChangeText={(
                                                                text: string
                                                            ) => {
                                                                let newChannels =
                                                                    additionalChannels;

                                                                newChannels[
                                                                    index
                                                                ].host = text;

                                                                this.setState({
                                                                    additionalChannels:
                                                                        newChannels
                                                                });
                                                            }}
                                                        />
                                                        <AmountInput
                                                            amount={
                                                                channel?.local_funding_amount
                                                            }
                                                            title={localeString(
                                                                'views.OpenChannel.localAmt'
                                                            )}
                                                            onAmountChange={(
                                                                amount: string,
                                                                satAmount:
                                                                    | string
                                                                    | number
                                                            ) => {
                                                                let newChannels =
                                                                    additionalChannels;

                                                                newChannels[
                                                                    index
                                                                ].local_funding_amount =
                                                                    amount;
                                                                newChannels[
                                                                    index
                                                                ].satAmount = satAmount;

                                                                this.setState({
                                                                    additionalChannels:
                                                                        newChannels
                                                                });
                                                            }}
                                                        />
                                                        <View
                                                            style={{
                                                                marginTop: 10,
                                                                marginBottom: 20
                                                            }}
                                                        >
                                                            <Button
                                                                title={localeString(
                                                                    'views.OpenChannel.removeAdditionalChannel'
                                                                )}
                                                                icon={{
                                                                    name: 'remove',
                                                                    size: 25,
                                                                    color: themeColor(
                                                                        'background'
                                                                    )
                                                                }}
                                                                onPress={() => {
                                                                    let newChannels =
                                                                        additionalChannels;

                                                                    newChannels =
                                                                        newChannels.filter(
                                                                            (
                                                                                item
                                                                            ) =>
                                                                                item !==
                                                                                channel
                                                                        );

                                                                    this.setState(
                                                                        {
                                                                            additionalChannels:
                                                                                newChannels
                                                                        }
                                                                    );
                                                                }}
                                                                tertiary
                                                            />
                                                        </View>
                                                    </View>
                                                );
                                            }
                                        )}

                                        {BackendUtils.supportsChannelBatching() &&
                                            node_pubkey_string &&
                                            host &&
                                            !fundMax && (
                                                <View
                                                    style={{
                                                        ...styles.button,
                                                        marginTop:
                                                            additionalChannels.length ===
                                                            0
                                                                ? 10
                                                                : 0
                                                    }}
                                                >
                                                    <Button
                                                        title={localeString(
                                                            'views.OpenChannel.openAdditionalChannel'
                                                        )}
                                                        icon={{
                                                            name: 'add',
                                                            size: 25,
                                                            color: themeColor(
                                                                'background'
                                                            )
                                                        }}
                                                        onPress={() => {
                                                            const additionalChannels =
                                                                this.state
                                                                    .additionalChannels;

                                                            additionalChannels.push(
                                                                {
                                                                    node_pubkey_string:
                                                                        '',
                                                                    host: '',
                                                                    local_funding_amount:
                                                                        '',
                                                                    satAmount:
                                                                        ''
                                                                }
                                                            );

                                                            this.setState({
                                                                additionalChannels,
                                                                fundMax: false
                                                            });
                                                        }}
                                                    />
                                                </View>
                                            )}

                                        <View style={{ marginTop: 10 }}>
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'views.OpenChannel.satsPerVbyte'
                                                )}
                                            </Text>
                                            <OnchainFeeInput
                                                fee={sat_per_vbyte}
                                                onChangeFee={(text: string) => {
                                                    this.setState({
                                                        sat_per_vbyte: text
                                                    });
                                                }}
                                                navigation={navigation}
                                            />
                                        </View>

                                        {BackendUtils.isLNDBased() && (
                                            <View style={{ marginTop: 10 }}>
                                                <Text
                                                    style={{
                                                        ...styles.text,
                                                        color: themeColor(
                                                            'secondaryText'
                                                        )
                                                    }}
                                                    infoModalText={localeString(
                                                        'views.OpenChannel.closeAddressExplainer'
                                                    )}
                                                >
                                                    {localeString(
                                                        'views.OpenChannel.closeAddress'
                                                    )}
                                                </Text>
                                                <TextInput
                                                    placeholder={'bc1...'}
                                                    value={close_address}
                                                    onChangeText={(
                                                        text: string
                                                    ) =>
                                                        this.setState({
                                                            close_address: text
                                                        })
                                                    }
                                                    locked={openingChannel}
                                                />
                                            </View>
                                        )}

                                        <TouchableOpacity
                                            onPress={() => {
                                                this.setState({
                                                    advancedSettingsToggle:
                                                        !advancedSettingsToggle
                                                });
                                            }}
                                        >
                                            <View
                                                style={{
                                                    marginBottom: 10
                                                }}
                                            >
                                                <Row justify="space-between">
                                                    <View
                                                        style={{ width: '95%' }}
                                                    >
                                                        <KeyValue
                                                            keyValue={localeString(
                                                                'general.advancedSettings'
                                                            )}
                                                        />
                                                    </View>
                                                    {advancedSettingsToggle ? (
                                                        <CaretDown
                                                            fill={themeColor(
                                                                'text'
                                                            )}
                                                            width="20"
                                                            height="20"
                                                        />
                                                    ) : (
                                                        <CaretRight
                                                            fill={themeColor(
                                                                'text'
                                                            )}
                                                            width="20"
                                                            height="20"
                                                        />
                                                    )}
                                                </Row>
                                            </View>
                                        </TouchableOpacity>

                                        {advancedSettingsToggle && (
                                            <>
                                                {BackendUtils.supportsChannelCoinControl() && (
                                                    <View
                                                        style={{
                                                            marginTop: 10,
                                                            marginBottom: 20
                                                        }}
                                                    >
                                                        <UTXOPicker
                                                            onValueChange={
                                                                this.selectUTXOs
                                                            }
                                                            UTXOsStore={
                                                                UTXOsStore
                                                            }
                                                        />
                                                    </View>
                                                )}

                                                <>
                                                    <Text
                                                        style={{
                                                            ...styles.text,
                                                            color: themeColor(
                                                                'secondaryText'
                                                            )
                                                        }}
                                                    >
                                                        {localeString(
                                                            'views.OpenChannel.numConf'
                                                        )}
                                                    </Text>
                                                    <TextInput
                                                        keyboardType="numeric"
                                                        placeholder={'1'}
                                                        value={min_confs.toString()}
                                                        onChangeText={(
                                                            text: string
                                                        ) => {
                                                            const newMinConfs =
                                                                Number(text);
                                                            this.setState({
                                                                min_confs:
                                                                    newMinConfs,
                                                                spend_unconfirmed:
                                                                    newMinConfs ===
                                                                    0
                                                            });
                                                        }}
                                                        locked={openingChannel}
                                                    />
                                                </>

                                                <>
                                                    <Text
                                                        style={{
                                                            top: 20,
                                                            color: themeColor(
                                                                'secondaryText'
                                                            )
                                                        }}
                                                    >
                                                        {localeString(
                                                            'views.OpenChannel.announceChannel'
                                                        )}
                                                    </Text>
                                                    <Switch
                                                        value={!privateChannel}
                                                        onValueChange={() =>
                                                            this.setState({
                                                                privateChannel:
                                                                    !privateChannel
                                                            })
                                                        }
                                                        disabled={
                                                            simpleTaprootChannel
                                                        }
                                                    />
                                                </>

                                                {BackendUtils.isLNDBased() && (
                                                    <>
                                                        <Text
                                                            style={{
                                                                top: 20,
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                )
                                                            }}
                                                        >
                                                            {localeString(
                                                                'views.OpenChannel.scidAlias'
                                                            )}
                                                        </Text>
                                                        <Switch
                                                            value={scidAlias}
                                                            onValueChange={() =>
                                                                this.setState({
                                                                    scidAlias:
                                                                        !scidAlias
                                                                })
                                                            }
                                                        />
                                                    </>
                                                )}

                                                {BackendUtils.supportsSimpleTaprootChannels() && (
                                                    <>
                                                        <Text
                                                            style={{
                                                                top: 20,
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                )
                                                            }}
                                                        >
                                                            {localeString(
                                                                'views.OpenChannel.simpleTaprootChannel'
                                                            )}
                                                        </Text>
                                                        <Switch
                                                            value={
                                                                simpleTaprootChannel
                                                            }
                                                            onValueChange={() => {
                                                                this.setState({
                                                                    simpleTaprootChannel:
                                                                        !simpleTaprootChannel
                                                                });

                                                                if (
                                                                    !simpleTaprootChannel
                                                                ) {
                                                                    this.setState(
                                                                        {
                                                                            privateChannel:
                                                                                true
                                                                        }
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}

                                <View
                                    style={{ ...styles.button, paddingTop: 20 }}
                                >
                                    <Button
                                        title={
                                            connectPeerOnly
                                                ? localeString(
                                                      'views.OpenChannel.connectPeer'
                                                  )
                                                : additionalChannels.length > 0
                                                ? localeString(
                                                      'views.OpenChannel.openChannels'
                                                  )
                                                : localeString(
                                                      'views.OpenChannel.openChannel'
                                                  )
                                        }
                                        icon={{
                                            name: 'swap-horiz',
                                            size: 25,
                                            color:
                                                sat_per_vbyte === '0' ||
                                                !sat_per_vbyte
                                                    ? themeColor(
                                                          'secondaryText'
                                                      )
                                                    : themeColor('background')
                                        }}
                                        onPress={() => {
                                            this.scrollViewRef.current?.scrollTo(
                                                {
                                                    y: 0,
                                                    animated: true
                                                }
                                            );
                                            connectPeer(
                                                {
                                                    ...this.state,
                                                    local_funding_amount:
                                                        satAmount.toString()
                                                },
                                                false,
                                                connectPeerOnly
                                            );
                                        }}
                                        disabled={
                                            !connectPeerOnly &&
                                            (sat_per_vbyte === '0' ||
                                                !sat_per_vbyte)
                                        }
                                    />
                                </View>

                                <View style={styles.button}>
                                    <Button
                                        title={localeString(
                                            'general.enableNfc'
                                        )}
                                        icon={{
                                            name: 'nfc',
                                            size: 25
                                        }}
                                        onPress={() => this.enableNfc()}
                                        secondary
                                    />
                                </View>
                            </View>
                        </ScrollView>
                    )}
                </Screen>

                <ModalBox
                    isOpen={disconnectModalVisible}
                    onClosed={this.closeDisconnectModal}
                    style={{
                        backgroundColor: themeColor('background'),
                        borderRadius: 20,
                        width: '100%',
                        maxWidth: 400,
                        maxHeight: 180
                    }}
                    position="center"
                    backdropPressToClose={true}
                    swipeToClose={false}
                    backdrop={true}
                    backdropOpacity={0.8}
                    backdropColor={themeColor('backdrop')}
                    coverScreen={false}
                >
                    <View style={{ padding: 20 }}>
                        <Text
                            style={{
                                color: themeColor('white'),
                                fontSize: 20,
                                fontWeight: 'bold',
                                marginBottom: 12,
                                textAlign: 'center',
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {localeString(
                                'views.OpenChannel.disconnectPeerModalTitle'
                            )}
                        </Text>

                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontSize: 16,
                                textAlign: 'center',
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {localeString(
                                'views.OpenChannel.disconnectPeerModalText'
                            )}
                        </Text>

                        <View
                            style={{
                                flexDirection: 'row',
                                justifyContent: 'space-around',
                                marginTop: 34
                            }}
                        >
                            <TouchableOpacity
                                onPress={this.closeDisconnectModal}
                                style={{
                                    padding: 8,
                                    paddingHorizontal: 16,
                                    alignItems: 'center'
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontSize: 16,
                                        textTransform: 'uppercase',
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString('general.cancel')}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={this.disconnectPeer}
                                style={{
                                    padding: 8,
                                    paddingHorizontal: 16,
                                    alignItems: 'center'
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('highlight'),
                                        fontSize: 16,
                                        textTransform: 'uppercase',
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString('general.confirm')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ModalBox>
            </>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    textWhite: {
        color: 'white',
        fontFamily: 'PPNeueMontreal-Book'
    },
    tabTitleStyle: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12
    },
    content: {
        paddingBottom: 20,
        paddingHorizontal: 10
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10
    },
    clipboardImport: {
        padding: 10,
        backgroundColor: 'rgba(92, 99,216, 1)',
        color: 'white'
    },
    peerStatsText: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14
    },
    peersContainer: {
        margin: 0,
        padding: 0,
        backgroundColor: 'transparent'
    },
    peerItem: {
        flexDirection: 'row',
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 10
    },
    peerDetailsContainer: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    statusIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginHorizontal: 8
    },
    separator: {
        height: 0,
        backgroundColor: 'transparent'
    },
    selectPeerButton: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 5,
        backgroundColor: 'transparent'
    },
    peerIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 10,
        alignSelf: 'center'
    }
});
