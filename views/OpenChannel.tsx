import * as React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    View,
    TouchableOpacity
} from 'react-native';
import { Divider } from '@rneui/themed';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';
import NfcManager, { NfcEvents, TagEvent } from 'react-native-nfc-manager';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Amount from '../components/Amount';
import AmountInput from '../components/AmountInput';
import Text from '../components/Text';
import Button from '../components/Button';
import DropdownSetting from '../components/DropdownSetting';
import Accordion from '../components/Accordion';
import Header from '../components/Header';
import OnchainFeeInput from '../components/OnchainFeeInput';
import KeyValue from '../components/KeyValue';
import LightningIndicator from '../components/LightningIndicator';
import Screen from '../components/Screen';
import { ErrorMessage } from '../components/SuccessErrorMessage';
import Switch from '../components/Switch';
import TextInput from '../components/TextInput';
import UTXOPicker from '../components/UTXOPicker';

import handleAnything from '../utils/handleAnything';
import NFCUtils, { checkNfcEnabled } from '../utils/NFCUtils';
import NodeUriUtils from '../utils/NodeUriUtils';
import BackendUtils from '../utils/BackendUtils';
import ValidationUtils from '../utils/ValidationUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import BalanceStore from '../stores/BalanceStore';
import ChannelsStore, {
    ChannelsType,
    ChannelsView
} from '../stores/ChannelsStore';
import ModalStore from '../stores/ModalStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore, { getLspConfigForNetwork } from '../stores/SettingsStore';
import UTXOsStore from '../stores/UTXOsStore';

import { AdditionalChannel } from '../models/OpenChannelRequest';

import Scan from '../assets/images/SVG/Scan.svg';
import NfcIcon from '../assets/images/SVG/NFC-alt.svg';
import ToggleButton from '../components/ToggleButton';

interface OpenChannelProps {
    exitSetup: any;
    navigation: NativeStackNavigationProp<any, any>;
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
    // external account funding
    account: string;
    additionalChannels: Array<AdditionalChannel>;
    isNodePubkeyValid: boolean;
    isNodeHostValid: boolean;
    nfcSupported: boolean;
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
            connectPeerOnly:
                props.ChannelsStore.channelsView === ChannelsView.Peers,
            account: 'default',
            additionalChannels: [],
            isNodePubkeyValid: true,
            isNodeHostValid: true,
            nfcSupported: false
        };
    }

    async componentDidMount() {
        const { ChannelsStore, SettingsStore } = this.props;
        const { settings } = SettingsStore;

        ChannelsStore.resetOpenChannel();

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

        this.initFromProps(this.props);

        if (this.props.ChannelsStore.channelsView === ChannelsView.Peers) {
            this.setState({ connectPeerOnly: true });
        }

        const nfcSupported = await NfcManager.isSupported();
        this.setState({ nfcSupported });
    }

    disableNfc = () => {
        NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
        NfcManager.setEventListener(NfcEvents.SessionClosed, null);
    };

    enableNfc = async () => {
        const { ModalStore } = this.props;

        if (!(await checkNfcEnabled(ModalStore))) return;

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

    componentDidUpdate(prevProps: OpenChannelProps) {
        if (
            this.props.route.params !== prevProps.route.params ||
            this.props.NodeInfoStore !== prevProps.NodeInfoStore
        ) {
            this.initFromProps(this.props);
        }
    }

    initFromProps(props: OpenChannelProps) {
        const { route, NodeInfoStore, SettingsStore } = props;

        const node_pubkey_string = route.params?.node_pubkey_string ?? '';
        const host = route.params?.host ?? '';

        const lspConfig = getLspConfigForNetwork(
            SettingsStore.settings,
            NodeInfoStore.nodeInfo
        );
        const olympusPubkey = lspConfig.lsps1Pubkey;
        const olympusHost = lspConfig.lsps1Host;

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
            additionalChannels,
            isNodePubkeyValid,
            isNodeHostValid,
            nfcSupported
        } = this.state;
        const { implementation } = SettingsStore;

        const {
            connectingToPeer,
            openingChannel,
            connectPeer,
            errorMsgChannel,
            errorMsgPeer,
            peerSuccess,
            channelSuccess,
            funded_psbt
        } = ChannelsStore;
        const { confirmedBlockchainBalance } = BalanceStore;

        const loading = connectingToPeer || openingChannel;

        const isInvalidPeer = !isNodePubkeyValid || !isNodeHostValid;
        const isInvalidFeeRate = sat_per_vbyte === '0' || !sat_per_vbyte;

        const peerAlias =
            ChannelsStore.aliasesByPubkey[node_pubkey_string] ||
            ChannelsStore.nodes[node_pubkey_string]?.alias;

        // When fundMax is on, AmountInput is locked so onAmountChange never fires and
        // satAmount stays ''. Use the same value the locked AmountInput displays instead.
        const displaySatAmount = fundMax
            ? utxoBalance > 0
                ? utxoBalance
                : Number(confirmedBlockchainBalance)
            : satAmount;

        const allChannels = [
            { node_pubkey_string, satAmount: displaySatAmount },
            ...additionalChannels
        ];

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
            <Screen>
                {!channelSuccess && !peerSuccess && (
                    <Header
                        leftComponent="Back"
                        rightComponent={<ScanButton />}
                        navigation={navigation}
                    />
                )}
                {channelSuccess ? (
                    <View style={{ flex: 1 }}>
                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={styles.successContent}
                        >
                            <Text
                                style={{
                                    ...styles.successCheckmark,
                                    color: themeColor('success')
                                }}
                            >
                                ✓
                            </Text>
                            <Text
                                style={{
                                    ...styles.successTitle,
                                    color: themeColor('success')
                                }}
                            >
                                {additionalChannels.length > 0
                                    ? localeString(
                                          'views.OpenChannel.channelsSuccess'
                                      )
                                    : localeString(
                                          'views.OpenChannel.channelSuccess'
                                      )}
                            </Text>
                            {allChannels.map((channel, index) => {
                                const channelAlias =
                                    ChannelsStore.aliasesByPubkey[
                                        channel.node_pubkey_string
                                    ] ||
                                    ChannelsStore.nodes[
                                        channel.node_pubkey_string
                                    ]?.alias;
                                return (
                                    <View
                                        key={`${channel.node_pubkey_string}-${index}`}
                                    >
                                        {allChannels.length > 1 && (
                                            <>
                                                {index > 0 && (
                                                    <Divider
                                                        orientation="horizontal"
                                                        style={{ margin: 20 }}
                                                    />
                                                )}
                                                <Text
                                                    style={{
                                                        ...styles.channelIndex,
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }}
                                                >
                                                    {`${localeString(
                                                        'views.Channel.title'
                                                    )} ${index + 1}`}
                                                </Text>
                                            </>
                                        )}
                                        {!!channelAlias && (
                                            <KeyValue
                                                keyValue={localeString(
                                                    'general.channelPartner'
                                                )}
                                                value={channelAlias}
                                            />
                                        )}
                                        <KeyValue
                                            keyValue={localeString(
                                                'views.OpenChannel.nodePubkey'
                                            )}
                                            value={channel.node_pubkey_string}
                                        />
                                        {/* Host is intentionally not shown: Lightning backends treat the entered
                                            address as a hint only and may connect via a gossip-discovered address
                                            instead. Displaying the user-entered host would be potentially misleading. */}
                                        {!!channel.satAmount && (
                                            <KeyValue
                                                keyValue={localeString(
                                                    'views.Channel.capacity'
                                                )}
                                                value={
                                                    <Amount
                                                        sats={Number(
                                                            channel.satAmount
                                                        )}
                                                        sensitive
                                                        toggleable
                                                    />
                                                }
                                            />
                                        )}
                                    </View>
                                );
                            })}
                            <Text
                                style={{
                                    ...styles.successNote,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    additionalChannels.length > 0
                                        ? 'views.OpenChannel.channelsPendingNote'
                                        : 'views.OpenChannel.channelPendingNote'
                                )}
                            </Text>
                        </ScrollView>
                        <View style={styles.successButtons}>
                            {BackendUtils.supportsPendingChannels() && (
                                <Button
                                    title={localeString(
                                        'views.OpenChannel.viewStatus'
                                    )}
                                    onPress={() => {
                                        ChannelsStore.setChannelsType(
                                            ChannelsType.Pending
                                        );
                                        NodeInfoStore.getNodeInfo();
                                        ChannelsStore.getChannels();
                                        navigation.navigate('Wallet', {
                                            switchToChannels: true
                                        });
                                    }}
                                    secondary
                                />
                            )}
                            <Button
                                title={localeString('general.ok')}
                                onPress={() => {
                                    NodeInfoStore.getNodeInfo();
                                    ChannelsStore.getChannels();
                                    navigation.goBack();
                                }}
                            />
                        </View>
                    </View>
                ) : peerSuccess ? (
                    <View style={{ flex: 1 }}>
                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={styles.successContent}
                        >
                            <Text
                                style={{
                                    ...styles.successCheckmark,
                                    color: themeColor('success')
                                }}
                            >
                                ✓
                            </Text>
                            <Text
                                style={{
                                    ...styles.successTitle,
                                    color: themeColor('success')
                                }}
                            >
                                {localeString('views.OpenChannel.peerSuccess')}
                            </Text>
                            {!!peerAlias && (
                                <KeyValue
                                    keyValue={localeString('general.peer')}
                                    value={peerAlias}
                                />
                            )}
                            <KeyValue
                                keyValue={localeString(
                                    'views.OpenChannel.nodePubkey'
                                )}
                                value={node_pubkey_string}
                            />
                            {/* Host is intentionally not shown: Lightning backends treat the entered
                                address as a hint only and may connect via a gossip-discovered address
                                instead. Displaying the user-entered host would be potentially misleading. */}
                        </ScrollView>
                        <View style={styles.successButtons}>
                            <Button
                                title={localeString(
                                    'views.OpenChannel.openChannelToPeer'
                                )}
                                onPress={() => {
                                    ChannelsStore.resetOpenChannel();
                                    this.setState({ connectPeerOnly: false });
                                }}
                                secondary
                            />
                            <Button
                                title={localeString('general.ok')}
                                onPress={() => {
                                    ChannelsStore.getPeers();
                                    navigation.goBack();
                                }}
                            />
                        </View>
                    </View>
                ) : (
                    <ScrollView
                        style={{
                            flex: 1
                        }}
                        keyboardShouldPersistTaps="handled"
                        ref={this.scrollViewRef}
                    >
                        <View style={{ paddingTop: 15 }}>
                            <ToggleButton
                                options={[
                                    {
                                        key: 'channels',
                                        label:
                                            this.state.additionalChannels
                                                .length > 0
                                                ? localeString(
                                                      'views.OpenChannel.openChannels'
                                                  )
                                                : localeString(
                                                      'views.OpenChannel.openChannel'
                                                  )
                                    },
                                    {
                                        key: 'peers',
                                        label: localeString(
                                            'views.OpenChannel.connectPeer'
                                        )
                                    }
                                ]}
                                value={
                                    this.state.connectPeerOnly
                                        ? 'peers'
                                        : 'channels'
                                }
                                onToggle={(key) => {
                                    this.props.ChannelsStore.errorMsgPeer =
                                        null;
                                    this.props.ChannelsStore.errorMsgChannel =
                                        null;
                                    this.setState({
                                        connectPeerOnly: key === 'peers'
                                    });
                                }}
                            />
                        </View>
                        {!!suggestImport && (
                            <View style={styles.clipboardImport}>
                                <Text style={styles.textWhite}>
                                    {localeString(
                                        'views.OpenChannel.importText'
                                    )}
                                </Text>
                                <Text
                                    style={{ ...styles.textWhite, padding: 15 }}
                                >
                                    {suggestImport}
                                </Text>
                                <Text style={styles.textWhite}>
                                    {localeString(
                                        'views.OpenChannel.importPrompt'
                                    )}
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
                                        onPress={() =>
                                            this.clearImportSuggestion()
                                        }
                                        tertiary
                                    />
                                </View>
                            </View>
                        )}

                        <View style={styles.content}>
                            {loading && <LightningIndicator />}
                            {(errorMsgPeer || errorMsgChannel) && (
                                <ErrorMessage
                                    message={
                                        errorMsgChannel ||
                                        errorMsgPeer ||
                                        localeString('general.error')
                                    }
                                    dismissable
                                />
                            )}

                            <DropdownSetting
                                title={
                                    connectPeerOnly
                                        ? localeString('general.peer')
                                        : localeString('general.channelPartner')
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
                                        const config = getLspConfigForNetwork(
                                            SettingsStore.settings,
                                            NodeInfoStore.nodeInfo
                                        );
                                        this.setState({
                                            channelDestination:
                                                'Olympus by ZEUS',
                                            node_pubkey_string:
                                                config.lsps1Pubkey,
                                            host: config.lsps1Host
                                        });
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
                                            textColor={
                                                isNodePubkeyValid
                                                    ? themeColor('text')
                                                    : themeColor('error')
                                            }
                                            placeholder={'0A...'}
                                            value={node_pubkey_string}
                                            onChangeText={(text: string) =>
                                                this.setState({
                                                    node_pubkey_string: text,
                                                    isNodePubkeyValid:
                                                        ValidationUtils.validateNodePubkey(
                                                            text
                                                        )
                                                })
                                            }
                                            autoCapitalize="none"
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
                                            textColor={
                                                isNodeHostValid
                                                    ? themeColor('text')
                                                    : themeColor('error')
                                            }
                                            placeholder={localeString(
                                                'views.OpenChannel.hostPort'
                                            )}
                                            value={host}
                                            onChangeText={(text: string) =>
                                                this.setState({
                                                    host: text,
                                                    isNodeHostValid:
                                                        ValidationUtils.validateNodeHost(
                                                            text
                                                        )
                                                })
                                            }
                                            autoCapitalize="none"
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
                                                local_funding_amount: amount,
                                                satAmount
                                            });
                                        }}
                                        hideConversion={
                                            local_funding_amount === 'all'
                                        }
                                        locked={fundMax}
                                        forceUnit={fundMax ? 'sats' : undefined}
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
                                                            fundMax: newValue,
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
                                                        placeholder={'0A...'}
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
                                                        value={channel?.host}
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

                                                                this.setState({
                                                                    additionalChannels:
                                                                        newChannels
                                                                });
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
                                                                satAmount: ''
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

                                    <Accordion
                                        headerLayout="form"
                                        id="open-channel-advanced"
                                        title={localeString(
                                            'general.advancedSettings'
                                        )}
                                    >
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
                                                        UTXOsStore={UTXOsStore}
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
                                                                close_address:
                                                                    text
                                                            })
                                                        }
                                                        locked={openingChannel}
                                                    />
                                                </View>
                                            )}
                                            {implementation !== 'ldk-node' && (
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
                                            )}

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
                                                                this.setState({
                                                                    privateChannel:
                                                                        true
                                                                });
                                                            }
                                                        }}
                                                    />
                                                </>
                                            )}
                                        </>
                                    </Accordion>
                                </>
                            )}

                            <View style={{ ...styles.button, paddingTop: 20 }}>
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
                                            isInvalidFeeRate || isInvalidPeer
                                                ? themeColor('secondaryText')
                                                : themeColor('background')
                                    }}
                                    onPress={() => {
                                        this.scrollViewRef.current?.scrollTo({
                                            y: 0,
                                            animated: true
                                        });
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
                                        loading ||
                                        (!connectPeerOnly &&
                                            isInvalidFeeRate) ||
                                        isInvalidPeer
                                    }
                                />
                            </View>

                            {nfcSupported && (
                                <View style={styles.button}>
                                    <Button
                                        title={localeString(
                                            'general.enableNfc'
                                        )}
                                        icon={
                                            <NfcIcon
                                                stroke={themeColor('highlight')}
                                                width={25}
                                                height={25}
                                                style={{ marginRight: 10 }}
                                            />
                                        }
                                        onPress={() => this.enableNfc()}
                                        secondary
                                    />
                                </View>
                            )}
                        </View>
                    </ScrollView>
                )}
            </Screen>
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
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 10,
        paddingRight: 10
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
    successContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 30
    },
    successCheckmark: {
        fontSize: 60,
        textAlign: 'center',
        marginBottom: 10,
        fontFamily: 'PPNeueMontreal-Book'
    },
    successTitle: {
        fontSize: 22,
        textAlign: 'center',
        fontFamily: 'PPNeueMontreal-Book',
        marginBottom: 30
    },
    channelIndex: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        marginTop: 10,
        marginBottom: 2
    },
    successNote: {
        fontSize: 16,
        textAlign: 'center',
        fontFamily: 'PPNeueMontreal-Book',
        marginTop: 30,
        paddingHorizontal: 10
    },
    successButtons: {
        width: '100%',
        gap: 15,
        paddingBottom: 15,
        paddingHorizontal: 10
    }
});
