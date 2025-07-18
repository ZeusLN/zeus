import React from 'react';
import {
    FlatList,
    View,
    StyleSheet,
    Text,
    TouchableHighlight,
    TouchableOpacity,
    ScrollView,
    Platform,
    Dimensions
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { duration } from 'moment';
import { StackNavigationProp } from '@react-navigation/stack';
import NfcManager, { NfcEvents, TagEvent } from 'react-native-nfc-manager';
import Icon from 'react-native-vector-icons/Feather';
import BigNumber from 'bignumber.js';

import { ChannelsHeader } from '../../components/Channels/ChannelsHeader';
import { ChannelItem } from '../../components/Channels/ChannelItem';
import ChannelsFilter from '../../components/Channels/ChannelsFilter';
import LoadingIndicator from '../../components/LoadingIndicator';
import WalletHeader from '../../components/WalletHeader';
import { Spacer } from '../../components/layout/Spacer';
import Screen from '../../components/Screen';
// nav
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
    DefaultTheme,
    NavigationContainer,
    NavigationContainerRef,
    NavigationIndependentTree
} from '@react-navigation/native';

import ChannelsStore, {
    ChannelsType,
    ChannelsView
} from '../../stores/ChannelsStore';
import LSPStore from '../../stores/LSPStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';
import UnitsStore from '../../stores/UnitsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Channel from '../../models/Channel';
import ClosedChannel from '../../models/ClosedChannel';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import ModalStore from '../../stores/ModalStore';
import nfcUtils from '../../utils/NFCUtils';
import handleAnything from '../../utils/handleAnything';
import { SafeAreaView } from 'react-native-safe-area-context';
import Peer from '../../models/Peer';
import ModalBox from '../../components/ModalBox';
import { reaction } from 'mobx';

// TODO: does this belong in the model? Or can it be computed from the model?
export enum Status {
    Online = localeString('views.Wallet.Channels.online'),
    Stable = localeString('channel.status.stable'),
    Unstable = localeString('channel.status.unstable'),
    Offline = localeString('channel.status.offline'),
    Opening = localeString('channel.status.opening'),
    Closing = localeString('channel.status.closing')
}

export enum ExpirationStatus {
    Expiring = localeString('channel.expirationStatus.expiring'),
    Expired = localeString('channel.expirationStatus.expired'),
    LSPDiscretion = localeString('general.warning')
}

interface ChannelsProps {
    navigation: StackNavigationProp<any, any>;
    ChannelsStore?: ChannelsStore;
    LSPStore?: LSPStore;
    NodeInfoStore?: NodeInfoStore;
    SettingsStore?: SettingsStore;
    ModalStore?: ModalStore;
    UnitsStore?: UnitsStore;
}

interface ChannelsState {
    activeTab: number;
    channelDestination: string;
    node_pubkey_string: string;
    host: string;
    disconnectModalVisible: boolean;
    selectedPeer: any;
}

@inject(
    'ChannelsStore',
    'LSPStore',
    'NodeInfoStore',
    'SettingsStore',
    'ModalStore',
    'UnitsStore'
)
@observer
export default class ChannelsPane extends React.PureComponent<
    ChannelsProps,
    ChannelsState
> {
    private tabNavigationRef = React.createRef<NavigationContainerRef<any>>();
    private disposeReaction: () => void;
    private scrollViewRef = React.createRef<ScrollView>();

    constructor(props: any) {
        super(props);
        this.state = {
            activeTab: 0,
            channelDestination: 'Olympus by ZEUS',
            node_pubkey_string: '',
            host: '',
            disconnectModalVisible: false,
            selectedPeer: null
        };

        this.openDisconnectModal = this.openDisconnectModal.bind(this);
        this.closeDisconnectModal = this.closeDisconnectModal.bind(this);
        this.disconnectPeer = this.disconnectPeer.bind(this);
    }

    async componentDidMount() {
        this.disposeReaction = reaction(
            () => this.props.ChannelsStore?.channelsView,
            () => {
                this.props.ChannelsStore?.resetOpenChannel();
            }
        );
        const { ChannelsStore } = this.props;
        ChannelsStore?.getPeers();
        this.initFromProps(this.props);
    }

    componentWillUnmount() {
        if (this.disposeReaction) {
            this.disposeReaction();
        }
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
                ModalStore?.toggleAndroidNfcModal(true);

            NfcManager.setEventListener(
                NfcEvents.DiscoverTag,
                (tag: TagEvent) => {
                    tagFound = tag;
                    const bytes = new Uint8Array(
                        tagFound.ndefMessage[0].payload
                    );
                    const str = nfcUtils.nfcUtf8ArrayToStr(bytes) || '';

                    // close NFC
                    if (Platform.OS === 'android')
                        ModalStore?.toggleAndroidNfcModal(false);

                    resolve(this.validateNodeUri(str));
                    NfcManager.unregisterTagEvent().catch(() => 0);
                }
            );

            NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
                // close NFC
                if (Platform.OS === 'android')
                    ModalStore?.toggleAndroidNfcModal(false);

                if (!tagFound) {
                    resolve();
                }
            });

            NfcManager.registerTagEvent();
        });
    };

    UNSAFE_componentWillMount(): void {
        const { ChannelsStore } = this.props;
        ChannelsStore?.resetOpenChannel();
    }

    UNSAFE_componentWillReceiveProps(nextProps: any) {
        this.initFromProps(nextProps);
    }

    initFromProps(props: ChannelsProps) {
        const { NodeInfoStore, SettingsStore } = props;

        let olympusPubkey, olympusHost;
        if (NodeInfoStore?.nodeInfo.isTestNet) {
            olympusPubkey = SettingsStore?.settings.lsps1PubkeyTestnet;
            olympusHost = SettingsStore?.settings.lsps1HostTestnet;
        } else {
            olympusPubkey = SettingsStore?.settings.lsps1PubkeyMainnet;
            olympusHost = SettingsStore?.settings.lsps1HostMainnet;
        }

        this.setState({
            channelDestination: 'Olympus by ZEUS',
            node_pubkey_string: olympusPubkey!,
            host: olympusHost!
        });
    }

    validateNodeUri = (text: string) => {
        const { navigation } = this.props;
        handleAnything(text).then(([route, props]) => {
            navigation.navigate(route, props);
        });
    };

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
        this.closeDisconnectModal();

        const { selectedPeer } = this.state;
        const { ChannelsStore } = this.props;

        if (!selectedPeer) return;

        await ChannelsStore?.disconnectPeer(selectedPeer.pubkey);
    }

    renderItem = ({ item }: { item: Channel }) => {
        const { ChannelsStore, navigation } = this.props;
        const { largestChannelSats, channelsType } = ChannelsStore!;

        const getStatus = () => {
            if (item.isActive) {
                return Status.Online;
            } else if (item.pendingOpen) {
                return Status.Opening;
            } else if (item.pendingClose || item.forceClose || item.closing) {
                return Status.Closing;
            } else {
                return Status.Offline;
            }
        };

        const getLSPExpirationStatus = () => {
            const { LSPStore, NodeInfoStore } = this.props;
            const currentBlockHeight =
                NodeInfoStore?.nodeInfo?.currentBlockHeight;

            const renewalInfo = LSPStore?.getExtendableOrdersData?.filter(
                (extendableChannel: any) => {
                    return (
                        extendableChannel.short_channel_id ===
                            item.shortChannelId ||
                        extendableChannel.short_channel_id ===
                            item.peerScidAlias ||
                        extendableChannel.short_channel_id ===
                            item.zeroConfConfirmedScid
                    );
                }
            )[0];

            let expiresInBlocks;
            if (currentBlockHeight && renewalInfo?.expiration_block) {
                expiresInBlocks = new BigNumber(renewalInfo.expiration_block)
                    .minus(currentBlockHeight)
                    .toNumber();
            }

            if (expiresInBlocks && new BigNumber(expiresInBlocks).lt(0)) {
                return ExpirationStatus.Expired;
            } else if (
                expiresInBlocks &&
                new BigNumber(expiresInBlocks).lt(2016)
            ) {
                // less than 2 weeks
                return ExpirationStatus.Expiring;
            } else if (renewalInfo?.expiration_block === 0) {
                // at LSP's discretion
                return ExpirationStatus.LSPDiscretion;
            }

            return undefined;
        };

        const forceCloseTimeLabel = (maturity: number) => {
            return duration(maturity * 10, 'minutes').humanize();
        };

        if (channelsType === ChannelsType.Open) {
            return (
                <TouchableHighlight
                    onPress={() =>
                        navigation.navigate('Channel', {
                            channel: item
                        })
                    }
                >
                    <ChannelItem
                        title={item.displayName}
                        status={getStatus()}
                        expirationStatus={getLSPExpirationStatus()}
                        pendingHTLCs={item?.pending_htlcs?.length > 0}
                        localBalance={item.localBalance}
                        remoteBalance={item.remoteBalance}
                        receivingCapacity={item.receivingCapacity}
                        sendingCapacity={item.sendingCapacity}
                        largestTotal={largestChannelSats}
                        isBelowReserve={item.isBelowReserve}
                    />
                </TouchableHighlight>
            );
        }

        if (channelsType === ChannelsType.Closed) {
            const closedItem = item as ClosedChannel;

            return (
                <TouchableHighlight
                    onPress={() =>
                        navigation.navigate('Channel', {
                            channel: item
                        })
                    }
                >
                    <ChannelItem
                        title={closedItem.displayName}
                        localBalance={closedItem.localBalance}
                        remoteBalance={closedItem.remoteBalance}
                        receivingCapacity={closedItem.receivingCapacity}
                        sendingCapacity={closedItem.sendingCapacity}
                        status={getStatus()}
                        pendingHTLCs={closedItem?.pending_htlcs?.length > 0}
                        pendingTimelock={
                            closedItem.forceClose
                                ? forceCloseTimeLabel(
                                      closedItem.blocks_til_maturity
                                  )
                                : undefined
                        }
                        isBelowReserve={closedItem.isBelowReserve}
                    />
                </TouchableHighlight>
            );
        }

        return (
            <TouchableHighlight
                onPress={() =>
                    navigation.navigate('Channel', {
                        channel: item
                    })
                }
            >
                <ChannelItem
                    title={item.displayName}
                    localBalance={item.localBalance}
                    remoteBalance={item.remoteBalance}
                    receivingCapacity={item.receivingCapacity}
                    sendingCapacity={item.sendingCapacity}
                    status={getStatus()}
                    pendingHTLCs={item?.pending_htlcs?.length > 0}
                    pendingTimelock={
                        item.forceClose
                            ? forceCloseTimeLabel(item.blocks_til_maturity)
                            : undefined
                    }
                    isBelowReserve={item.isBelowReserve}
                />
            </TouchableHighlight>
        );
    };

    updateSearch = (value: string) => {
        this.props.ChannelsStore!.setSearch(value);
    };

    render() {
        const Tab = createBottomTabNavigator();

        const { ChannelsStore, navigation, UnitsStore } = this.props;
        const {
            loading,
            getChannels,
            totalInbound,
            totalOutbound,
            totalOffline,
            filteredChannels,
            filteredPendingChannels,
            filteredClosedChannels,
            showChannelsSearch,
            showPeersSearch,
            setChannelsType,
            channelsType
        } = ChannelsStore!;

        const Theme = {
            ...DefaultTheme,
            colors: {
                ...DefaultTheme.colors,
                background: themeColor('background'),
                card: themeColor('background'),
                border: themeColor('background')
            }
        };

        const OpenChannelsScreen = () => {
            return (
                <Screen>
                    <FlatList
                        data={filteredChannels}
                        renderItem={this.renderItem}
                        ListFooterComponent={<Spacer height={100} />}
                        onRefresh={() => getChannels()}
                        refreshing={loading}
                        keyExtractor={(item, index) =>
                            `${item.remote_pubkey}-${index}`
                        }
                    />
                </Screen>
            );
        };

        const PendingChannelsScreen = () => {
            return (
                <Screen>
                    <FlatList
                        data={filteredPendingChannels}
                        renderItem={this.renderItem}
                        ListFooterComponent={<Spacer height={100} />}
                        onRefresh={() => getChannels()}
                        refreshing={loading}
                        keyExtractor={(item, index) =>
                            `${item.remote_pubkey}-${index}`
                        }
                    />
                </Screen>
            );
        };

        const ClosedChannelsScreen = () => {
            return (
                <Screen>
                    <FlatList
                        data={filteredClosedChannels}
                        renderItem={this.renderItem}
                        ListFooterComponent={<Spacer height={100} />}
                        onRefresh={() => getChannels()}
                        refreshing={loading}
                        keyExtractor={(item, index) =>
                            `${item.remote_pubkey}-${index}`
                        }
                    />
                </Screen>
            );
        };

        const openChannelsTabName = `${localeString(
            'views.Wallet.Wallet.open'
        )} (${filteredChannels?.length || 0})`;

        const pendingChannelsTabName = `${localeString(
            'views.Wallet.Wallet.pending'
        )} (${filteredPendingChannels?.length || 0})`;

        const closedChannelsTabName = `${localeString(
            'views.Wallet.Wallet.closed'
        )} (${filteredClosedChannels?.length || 0})`;

        let initialRoute;
        if (channelsType === ChannelsType.Open) {
            initialRoute = openChannelsTabName;
        } else if (channelsType === ChannelsType.Pending) {
            initialRoute = pendingChannelsTabName;
        } else if (channelsType === ChannelsType.Closed) {
            initialRoute = closedChannelsTabName;
        }

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader navigation={navigation} peers={true} channels />
                {ChannelsStore?.channelsView === ChannelsView.Channels &&
                this.state.activeTab === 0 ? (
                    <>
                        <ChannelsHeader
                            totalInbound={totalInbound}
                            totalOutbound={totalOutbound}
                            totalOffline={totalOffline}
                        />
                        {showChannelsSearch && <ChannelsFilter />}
                        {loading ? (
                            <View style={{ marginTop: 40 }}>
                                <LoadingIndicator />
                            </View>
                        ) : BackendUtils.supportsPendingChannels() ? (
                            <NavigationIndependentTree>
                                <NavigationContainer
                                    theme={Theme}
                                    ref={this.tabNavigationRef}
                                >
                                    <Tab.Navigator
                                        initialRouteName={initialRoute}
                                        backBehavior="none"
                                        screenOptions={() => ({
                                            headerShown: false,
                                            tabBarActiveTintColor:
                                                themeColor('text'),
                                            tabBarInactiveTintColor: 'gray',
                                            tabBarShowLabel: true,
                                            tabBarStyle: {
                                                borderTopWidth: 0.2,
                                                borderTopColor:
                                                    themeColor('secondaryText')
                                            },
                                            tabBarItemStyle: {
                                                justifyContent: 'center'
                                            },
                                            tabBarIconStyle: {
                                                display: 'none'
                                            },
                                            tabBarLabelStyle: {
                                                fontSize: 16,
                                                fontFamily:
                                                    'PPNeueMontreal-Medium'
                                            },
                                            animation: 'shift'
                                        })}
                                    >
                                        <Tab.Screen
                                            name={openChannelsTabName}
                                            component={OpenChannelsScreen}
                                            listeners={{
                                                focus: () =>
                                                    setChannelsType(
                                                        ChannelsType.Open
                                                    )
                                            }}
                                        />
                                        <Tab.Screen
                                            name={pendingChannelsTabName}
                                            component={PendingChannelsScreen}
                                            listeners={{
                                                focus: () =>
                                                    setChannelsType(
                                                        ChannelsType.Pending
                                                    )
                                            }}
                                        />
                                        <Tab.Screen
                                            name={closedChannelsTabName}
                                            component={ClosedChannelsScreen}
                                            listeners={{
                                                focus: () =>
                                                    setChannelsType(
                                                        ChannelsType.Closed
                                                    )
                                            }}
                                        />
                                    </Tab.Navigator>
                                </NavigationContainer>
                            </NavigationIndependentTree>
                        ) : BackendUtils.supportsClosedChannels() ? (
                            <NavigationIndependentTree>
                                <NavigationContainer
                                    theme={Theme}
                                    ref={this.tabNavigationRef}
                                >
                                    <Tab.Navigator
                                        initialRouteName={initialRoute}
                                        backBehavior="none"
                                        screenOptions={() => ({
                                            headerShown: false,
                                            tabBarActiveTintColor:
                                                themeColor('text'),
                                            tabBarInactiveTintColor: 'gray',
                                            tabBarShowLabel: true,
                                            tabBarStyle: {
                                                borderTopWidth: 0.2,
                                                borderTopColor:
                                                    themeColor('secondaryText')
                                            },
                                            tabBarItemStyle: {
                                                justifyContent: 'center'
                                            },
                                            tabBarIconStyle: {
                                                display: 'none'
                                            },
                                            tabBarLabelStyle: {
                                                fontSize: 16,
                                                fontFamily:
                                                    'PPNeueMontreal-Medium'
                                            },
                                            animation: 'shift'
                                        })}
                                    >
                                        <Tab.Screen
                                            name={openChannelsTabName}
                                            component={OpenChannelsScreen}
                                            listeners={{
                                                focus: () =>
                                                    setChannelsType(
                                                        ChannelsType.Open
                                                    )
                                            }}
                                        />
                                        <Tab.Screen
                                            name={closedChannelsTabName}
                                            component={ClosedChannelsScreen}
                                            listeners={{
                                                focus: () =>
                                                    setChannelsType(
                                                        ChannelsType.Closed
                                                    )
                                            }}
                                        />
                                    </Tab.Navigator>
                                </NavigationContainer>
                            </NavigationIndependentTree>
                        ) : (
                            <FlatList
                                data={filteredChannels}
                                renderItem={this.renderItem}
                                ListFooterComponent={<Spacer height={100} />}
                                onRefresh={() => getChannels()}
                                refreshing={loading}
                                keyExtractor={(item, index) =>
                                    `${item.remote_pubkey}-${index}`
                                }
                            />
                        )}
                    </>
                ) : (
                    <View style={{ flex: 1 }}>
                        <SafeAreaView style={{ flex: 1 }}>
                            {ChannelsStore?.error && (
                                <ErrorMessage
                                    message={
                                        ChannelsStore?.errorDisconnectPeer ||
                                        ChannelsStore?.errorListPeers ||
                                        localeString('general.error')
                                    }
                                    dismissable
                                />
                            )}
                            {showPeersSearch && (
                                <View
                                    style={{ paddingTop: 10, paddingLeft: 10 }}
                                >
                                    <ChannelsFilter
                                        width={
                                            Dimensions.get('window').width - 20
                                        }
                                    />
                                </View>
                            )}
                            {loading ? (
                                <View style={{ marginTop: 40 }}>
                                    <LoadingIndicator />
                                </View>
                            ) : (
                                <FlatList
                                    style={{
                                        flex: 1,
                                        paddingHorizontal: 20,
                                        paddingTop: ChannelsStore?.error
                                            ? 0
                                            : 20
                                    }}
                                    onRefresh={() => ChannelsStore?.getPeers()}
                                    refreshing={ChannelsStore?.loading}
                                    data={
                                        BackendUtils.isLNDBased()
                                            ? ChannelsStore?.filteredPeers
                                            : ChannelsStore?.filteredPeers?.filter(
                                                  (peer) => {
                                                      return (
                                                          peer.connected &&
                                                          peer.connected ===
                                                              true
                                                      );
                                                  }
                                              )
                                    }
                                    ListFooterComponent={
                                        <View style={{ height: 20 }} />
                                    }
                                    renderItem={({ item }) => {
                                        const peer = new Peer(item);

                                        return (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    this.openDisconnectModal(
                                                        peer
                                                    );
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
                                                            themeColor(
                                                                'secondary'
                                                            )
                                                    }
                                                ]}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text
                                                        style={[
                                                            styles.text,
                                                            {
                                                                color: themeColor(
                                                                    'text'
                                                                ),
                                                                fontSize: 20
                                                            }
                                                        ]}
                                                        numberOfLines={3}
                                                    >
                                                        {peer.pubkey}
                                                    </Text>

                                                    {peer.alias && (
                                                        <Text
                                                            style={[
                                                                styles.text,
                                                                {
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    ),
                                                                    fontSize: 16,
                                                                    marginTop: 4
                                                                }
                                                            ]}
                                                        >
                                                            {peer.alias}
                                                        </Text>
                                                    )}

                                                    <Text
                                                        style={[
                                                            styles.text,
                                                            {
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                ),
                                                                fontSize: 16,
                                                                marginTop: 4
                                                            }
                                                        ]}
                                                    >
                                                        {peer.address}
                                                    </Text>

                                                    <View
                                                        style={{
                                                            marginTop: 8
                                                        }}
                                                    >
                                                        {peer.ping_time && (
                                                            <Text
                                                                style={[
                                                                    styles.peerStatsText,
                                                                    {
                                                                        color: themeColor(
                                                                            'secondaryText'
                                                                        )
                                                                    }
                                                                ]}
                                                            >
                                                                {`${localeString(
                                                                    'views.ChannelsPane.pingTime'
                                                                )}: ${
                                                                    BackendUtils.isLNDBased()
                                                                        ? (
                                                                              peer.ping_time /
                                                                              1000
                                                                          ).toFixed(
                                                                              peer.ping_time /
                                                                                  1000 <
                                                                                  0.01
                                                                                  ? 3
                                                                                  : 2
                                                                          )
                                                                        : peer.ping_time
                                                                } ms`}
                                                            </Text>
                                                        )}
                                                        {peer.sats_sent && (
                                                            <Text
                                                                style={[
                                                                    styles.peerStatsText,
                                                                    {
                                                                        color: themeColor(
                                                                            'secondaryText'
                                                                        )
                                                                    }
                                                                ]}
                                                            >
                                                                {`${localeString(
                                                                    'views.ChannelsPane.satsSent'
                                                                )}: ${UnitsStore?.getFormattedAmount(
                                                                    peer.sats_sent,
                                                                    'sats'
                                                                )}`}
                                                            </Text>
                                                        )}
                                                        {peer.sats_recv && (
                                                            <Text
                                                                style={[
                                                                    styles.peerStatsText,
                                                                    {
                                                                        color: themeColor(
                                                                            'secondaryText'
                                                                        )
                                                                    }
                                                                ]}
                                                            >
                                                                {`${localeString(
                                                                    'views.ChannelsPane.satsRecv'
                                                                )}: ${UnitsStore?.getFormattedAmount(
                                                                    peer.sats_recv,
                                                                    'sats'
                                                                )}`}
                                                            </Text>
                                                        )}
                                                        {peer.bytesSent && (
                                                            <Text
                                                                style={[
                                                                    styles.peerStatsText,
                                                                    {
                                                                        color: themeColor(
                                                                            'secondaryText'
                                                                        )
                                                                    }
                                                                ]}
                                                            >
                                                                {`${localeString(
                                                                    'views.ChannelsPane.bytesSent'
                                                                )}: ${
                                                                    peer.bytesSent
                                                                } B`}
                                                            </Text>
                                                        )}
                                                        {peer.bytesRecv && (
                                                            <Text
                                                                style={[
                                                                    styles.peerStatsText,
                                                                    {
                                                                        color: themeColor(
                                                                            'secondaryText'
                                                                        )
                                                                    }
                                                                ]}
                                                            >
                                                                {`${localeString(
                                                                    'views.ChannelsPane.bytesRecv'
                                                                )}: ${
                                                                    peer.bytesRecv
                                                                } B`}
                                                            </Text>
                                                        )}
                                                        {peer.inbound && (
                                                            <Text
                                                                style={[
                                                                    styles.peerStatsText,
                                                                    {
                                                                        color: themeColor(
                                                                            'secondaryText'
                                                                        )
                                                                    }
                                                                ]}
                                                            >
                                                                {`${localeString(
                                                                    'views.Channel.inbound'
                                                                )}: ${
                                                                    peer.inbound
                                                                        ? localeString(
                                                                              'general.true'
                                                                          )
                                                                        : localeString(
                                                                              'general.false'
                                                                          )
                                                                }`}
                                                            </Text>
                                                        )}
                                                        {peer.connected && (
                                                            <Text
                                                                style={[
                                                                    styles.peerStatsText,
                                                                    {
                                                                        color: themeColor(
                                                                            'secondaryText'
                                                                        )
                                                                    }
                                                                ]}
                                                            >
                                                                {`${localeString(
                                                                    'views.ChannelsPane.connected'
                                                                )}: ${
                                                                    peer.connected
                                                                        ? localeString(
                                                                              'general.true'
                                                                          )
                                                                        : localeString(
                                                                              'general.false'
                                                                          )
                                                                }`}
                                                            </Text>
                                                        )}
                                                        {peer.num_channels !=
                                                            null && (
                                                            <Text
                                                                style={[
                                                                    styles.peerStatsText,
                                                                    {
                                                                        color: themeColor(
                                                                            'secondaryText'
                                                                        )
                                                                    }
                                                                ]}
                                                            >
                                                                {`${localeString(
                                                                    'views.NetworkInfo.numChannels'
                                                                )}: ${
                                                                    peer.num_channels
                                                                }`}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>

                                                <View
                                                    style={
                                                        styles.peerIconContainer
                                                    }
                                                >
                                                    <Icon
                                                        name="minus-circle"
                                                        size={20}
                                                        color={themeColor(
                                                            'error'
                                                        )}
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
                                            style={[
                                                styles.text,
                                                {
                                                    fontSize: 20,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    textAlign: 'center',
                                                    padding: 20
                                                }
                                            ]}
                                        >
                                            {localeString(
                                                'views.ChannelsPane.noPeers'
                                            )}
                                        </Text>
                                    }
                                    ItemSeparatorComponent={() => (
                                        <View style={styles.separator} />
                                    )}
                                />
                            )}
                        </SafeAreaView>
                        <ModalBox
                            isOpen={this.state.disconnectModalVisible}
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
                                        color: themeColor('text'),
                                        fontSize: 20,
                                        fontWeight: 'bold',
                                        marginBottom: 12,
                                        textAlign: 'center',
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.ChannelsPane.disconnectPeerModalTitle'
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
                                        'views.ChannelsPane.disconnectPeerModalText'
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
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontSize: 16,
                                                textTransform: 'uppercase',
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
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
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            {localeString('general.confirm')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ModalBox>
                    </View>
                )}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    button: {
        padding: 10,
        borderRadius: 5,
        margin: 10
    },
    buttonText: {
        fontFamily: 'PPNeueMontreal-Book',
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center'
    },
    content: {
        paddingBottom: 20,
        paddingHorizontal: 10
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    peerItem: {
        flexDirection: 'row',
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 10
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
    separator: {
        height: 0,
        backgroundColor: 'transparent'
    },
    peerIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 10,
        alignSelf: 'center'
    }
});
