import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    FlatList,
    View,
    StyleSheet,
    Text,
    TouchableHighlight,
    TouchableOpacity,
    ScrollView,
    Platform
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

const ColorChangingButton = ({ onPress }: { onPress: () => void }) => {
    const [forward, setForward] = useState(true);
    const animation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const interval = setInterval(() => {
            // Toggle animation direction
            setForward((prev) => !prev);
        }, 5000); // Change color gradient every 6 seconds

        return () => clearInterval(interval); // Cleanup interval on component unmount
    }, []);

    useEffect(() => {
        // Animate from 0 to 1 or from 1 to 0 based on 'forward' value
        Animated.timing(animation, {
            toValue: forward ? 1 : 0,
            duration: 4500,
            useNativeDriver: true
        }).start();
    }, [forward]);

    const backgroundColor: any = animation.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgb(180, 26, 20)', 'rgb(255, 169, 0)'] // Red to Gold gradient
    });

    return (
        <TouchableOpacity
            onPress={onPress}
            style={[styles.button, { backgroundColor }]}
        >
            <Text style={styles.buttonText}>
                {localeString('views.LSPS1.purchaseInbound')}
            </Text>
        </TouchableOpacity>
    );
};

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
        const { NodeInfoStore } = props;

        let olympusPubkey, olympusHost;
        if (NodeInfoStore?.nodeInfo.isTestNet) {
            olympusPubkey =
                '03e84a109cd70e57864274932fc87c5e6434c59ebb8e6e7d28532219ba38f7f6df';
            olympusHost = '139.144.22.237:9735';
        } else {
            olympusPubkey =
                '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581';
            olympusHost = '45.79.192.236:9735';
        }

        this.setState({
            channelDestination: 'Olympus by ZEUS',
            node_pubkey_string: olympusPubkey,
            host: olympusHost
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
        const { selectedPeer } = this.state;
        const { ChannelsStore } = this.props;
        if (!selectedPeer) return;

        try {
            await ChannelsStore?.disconnectPeer(selectedPeer.pubkey);
            this.closeDisconnectModal();
        } catch (e: any) {
            this.closeDisconnectModal();
        }
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

        const { ChannelsStore, SettingsStore, navigation, UnitsStore } =
            this.props;
        const {
            loading,
            getChannels,
            totalInbound,
            totalOutbound,
            totalOffline,
            filteredChannels,
            filteredPendingChannels,
            filteredClosedChannels,
            showSearch,
            setChannelsType,
            channelsType
        } = ChannelsStore!;

        const { settings } = SettingsStore!;

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
                <WalletHeader
                    navigation={navigation}
                    title={
                        ChannelsStore?.channelsView === ChannelsView.Channels
                            ? BackendUtils.supportsPendingChannels()
                                ? localeString('views.Wallet.Wallet.channels')
                                : `${localeString(
                                      'views.Wallet.Wallet.channels'
                                  )} (${filteredChannels?.length || 0})`
                            : `${localeString('general.peers')} (${
                                  ChannelsStore?.peers?.length || 0
                              })`
                    }
                    peers={true}
                    channels
                />
                {ChannelsStore?.channelsView === ChannelsView.Channels &&
                this.state.activeTab === 0 ? (
                    <>
                        <ChannelsHeader
                            totalInbound={totalInbound}
                            totalOutbound={totalOutbound}
                            totalOffline={totalOffline}
                        />
                        {settings?.lsps1ShowPurchaseButton &&
                            (BackendUtils.supportsLSPScustomMessage() ||
                                BackendUtils.supportsLSPS1rest()) && (
                                <ColorChangingButton
                                    onPress={() => {
                                        navigation.navigate('LSPS1');
                                    }}
                                />
                            )}
                        {showSearch && <ChannelsFilter />}
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
                                    data={ChannelsStore?.peers?.filter(
                                        (peer) => {
                                            return (
                                                peer.connected &&
                                                peer.connected === true
                                            );
                                        }
                                    )}
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
                                                        style={{ marginTop: 8 }}
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
                                                                    'views.OpenChannel.pingTime'
                                                                )}: ${
                                                                    peer.ping_time
                                                                }ms`}
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
                                                                    'views.OpenChannel.satsSent'
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
                                                                    'views.OpenChannel.satsRecv'
                                                                )}: ${UnitsStore?.getFormattedAmount(
                                                                    peer.sats_recv,
                                                                    'sats'
                                                                )}`}
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
                                                                    'views.OpenChannel.connected'
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
                                                                    'views.OpenChannel.numChannels'
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
                                                'views.OpenChannel.noPeers'
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
