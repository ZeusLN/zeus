import React from 'react';
import {
    FlatList,
    View,
    StyleSheet,
    Text,
    TouchableHighlight,
    TouchableOpacity,
    ScrollView
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { duration } from 'moment';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import BigNumber from 'bignumber.js';

import { ChannelsHeader } from '../../components/Channels/ChannelsHeader';
import { ChannelItem } from '../../components/Channels/ChannelItem';
import { PeerItem } from '../../components/Channels/PeerItem';
import ChannelsFilter from '../../components/Channels/ChannelsFilter';
import LoadingIndicator from '../../components/LoadingIndicator';
import WalletHeader from '../../components/WalletHeader';
import { Spacer } from '../../components/layout/Spacer';
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
import SettingsStore, {
    getLspConfigForNetwork
} from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Channel from '../../models/Channel';
import { Status, ExpirationStatus } from '../../models/Status';
import ClosedChannel from '../../models/ClosedChannel';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import handleAnything from '../../utils/handleAnything';
import { SafeAreaView } from 'react-native-safe-area-context';
import Peer from '../../models/Peer';
import ModalBox from '../../components/ModalBox';
import { reaction } from 'mobx';

const Tab = createBottomTabNavigator();

const OPEN_TAB_ROUTE = 'open';
const PENDING_TAB_ROUTE = 'pending';
const CLOSED_TAB_ROUTE = 'closed';

interface ChannelsProps {
    navigation: NativeStackNavigationProp<any, any>;
    ChannelsStore?: ChannelsStore;
    LSPStore?: LSPStore;
    NodeInfoStore?: NodeInfoStore;
    SettingsStore?: SettingsStore;
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
    'ModalStore'
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
        const { ChannelsStore } = this.props;

        if (!ChannelsStore?.channelSuccess) {
            ChannelsStore?.resetOpenChannel();
        }

        this.disposeReaction = reaction(
            () => ChannelsStore?.channelsView,
            () => {
                ChannelsStore?.resetOpenChannel();
            }
        );

        ChannelsStore?.getPeers();
        this.initFromProps(this.props);
    }

    componentDidUpdate(prevProps: any) {
        if (prevProps !== this.props) {
            this.initFromProps(this.props);
        }
    }

    componentWillUnmount() {
        if (this.disposeReaction) {
            this.disposeReaction();
        }
    }

    initFromProps(props: ChannelsProps) {
        const { NodeInfoStore, SettingsStore } = props;

        const lspConfig = getLspConfigForNetwork(
            SettingsStore!.settings,
            NodeInfoStore!.nodeInfo
        );
        const olympusPubkey = lspConfig.lsps1Pubkey;
        const olympusHost = lspConfig.lsps1Host;

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
            } else if (item.pendingClose || item.closing) {
                return Status.Closing;
            } else if (
                item.forceClose &&
                channelsType !== ChannelsType.Closed
            ) {
                return Status.Closing;
            } else {
                return Status.Offline;
            }
        };

        const getLSPExpirationStatus = () => {
            const { LSPStore, NodeInfoStore } = this.props;
            const currentBlockHeight =
                NodeInfoStore?.nodeInfo?.currentBlockHeight;

            const renewalInfo = LSPStore?.getExtendableChannelsData?.filter(
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
                            closedItem.forceClose &&
                            closedItem.blocks_til_maturity > 0
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
                        item.forceClose && item.blocks_til_maturity > 0
                            ? forceCloseTimeLabel(item.blocks_til_maturity)
                            : undefined
                    }
                    isBelowReserve={item.isBelowReserve}
                    statusSuffix={(() => {
                        const { NodeInfoStore } = this.props;
                        const confs = item.getConfirmations(
                            NodeInfoStore?.nodeInfo?.currentBlockHeight
                        );
                        return confs
                            ? `(${confs.current}/${confs.total})`
                            : undefined;
                    })()}
                />
            </TouchableHighlight>
        );
    };

    updateSearch = (value: string) => {
        this.props.ChannelsStore!.setSearch(value);
    };

    render() {
        const { ChannelsStore, navigation } = this.props;
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
            channelsType,
            nodes,
            aliasesByPubkey
        } = ChannelsStore!;

        const Theme = {
            ...DefaultTheme,
            colors: {
                ...DefaultTheme.colors,
                background: 'transparent',
                card: 'transparent',
                border: 'transparent'
            }
        };

        const createChannelScreen = (data: Channel[]) => () =>
            (
                <FlatList
                    data={data}
                    renderItem={this.renderItem}
                    ListFooterComponent={<Spacer height={100} />}
                    onRefresh={() => {
                        this.props.NodeInfoStore?.getNodeInfo();
                        getChannels();
                    }}
                    refreshing={loading}
                    keyExtractor={(item, index) =>
                        `${item.remote_pubkey}-${index}`
                    }
                />
            );

        const OpenChannelsScreen = createChannelScreen(filteredChannels);
        const PendingChannelsScreen = createChannelScreen(
            filteredPendingChannels
        );
        const ClosedChannelsScreen = createChannelScreen(
            filteredClosedChannels
        );

        const openChannelsTabLabel = `${localeString(
            'views.Wallet.Wallet.open'
        )} (${filteredChannels?.length || 0})`;

        const pendingChannelsTabLabel = `${localeString(
            'views.Wallet.Wallet.pending'
        )} (${filteredPendingChannels?.length || 0})`;

        const closedChannelsTabLabel = `${localeString(
            'views.Wallet.Wallet.closed'
        )} (${filteredClosedChannels?.length || 0})`;

        let initialRoute: string = OPEN_TAB_ROUTE;
        if (channelsType === ChannelsType.Pending) {
            initialRoute = PENDING_TAB_ROUTE;
        } else if (channelsType === ChannelsType.Closed) {
            initialRoute = CLOSED_TAB_ROUTE;
        }

        const getTabScreenOptions = ({ route }: { route: any }) => {
            let label: string;
            if (route.name === PENDING_TAB_ROUTE) {
                label = pendingChannelsTabLabel;
            } else if (route.name === CLOSED_TAB_ROUTE) {
                label = closedChannelsTabLabel;
            } else {
                label = openChannelsTabLabel;
            }
            return {
                headerShown: false,
                tabBarActiveTintColor: themeColor('text'),
                tabBarInactiveTintColor: 'gray',
                tabBarShowLabel: true,
                tabBarStyle: {
                    backgroundColor: 'transparent',
                    elevation: 0,
                    borderTopWidth: 0.2,
                    borderTopColor: themeColor('secondaryText'),
                    paddingTop: 10,
                    paddingBottom: 10,
                    height: 70
                },
                tabBarItemStyle: {
                    justifyContent: 'center' as const
                },
                tabBarIconStyle: {
                    display: 'none' as const
                },
                tabBarLabel: ({
                    focused,
                    color
                }: {
                    focused: boolean;
                    color: string;
                }) => (
                    <Text
                        style={{
                            fontSize: 16,
                            fontFamily: focused
                                ? 'PPNeueMontreal-Medium'
                                : 'PPNeueMontreal-Book',
                            color
                        }}
                    >
                        {label}
                    </Text>
                ),
                animation: 'shift' as const
            };
        };

        const isChannelsView =
            ChannelsStore?.channelsView === ChannelsView.Channels;

        const viewContainerStyle = (visible: boolean) =>
            visible ? { flex: 1 } : HIDDEN_VIEW_STYLE;

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader navigation={navigation} peers={true} channels />
                <View
                    style={viewContainerStyle(isChannelsView)}
                    collapsable={false}
                >
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
                        ) : BackendUtils.supportsPendingChannels() &&
                          BackendUtils.supportsClosedChannels() ? (
                            <NavigationIndependentTree>
                                <NavigationContainer
                                    theme={Theme}
                                    ref={this.tabNavigationRef}
                                >
                                    <Tab.Navigator
                                        initialRouteName={initialRoute}
                                        backBehavior="none"
                                        screenOptions={getTabScreenOptions}
                                    >
                                        <Tab.Screen
                                            name={OPEN_TAB_ROUTE}
                                            component={OpenChannelsScreen}
                                            listeners={{
                                                focus: () =>
                                                    setChannelsType(
                                                        ChannelsType.Open
                                                    )
                                            }}
                                        />
                                        <Tab.Screen
                                            name={PENDING_TAB_ROUTE}
                                            component={PendingChannelsScreen}
                                            listeners={{
                                                focus: () =>
                                                    setChannelsType(
                                                        ChannelsType.Pending
                                                    )
                                            }}
                                        />
                                        <Tab.Screen
                                            name={CLOSED_TAB_ROUTE}
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
                        ) : BackendUtils.supportsPendingChannels() ? (
                            <NavigationIndependentTree>
                                <NavigationContainer
                                    theme={Theme}
                                    ref={this.tabNavigationRef}
                                >
                                    <Tab.Navigator
                                        initialRouteName={initialRoute}
                                        backBehavior="none"
                                        screenOptions={getTabScreenOptions}
                                    >
                                        <Tab.Screen
                                            name={OPEN_TAB_ROUTE}
                                            component={OpenChannelsScreen}
                                            listeners={{
                                                focus: () =>
                                                    setChannelsType(
                                                        ChannelsType.Open
                                                    )
                                            }}
                                        />
                                        <Tab.Screen
                                            name={PENDING_TAB_ROUTE}
                                            component={PendingChannelsScreen}
                                            listeners={{
                                                focus: () =>
                                                    setChannelsType(
                                                        ChannelsType.Pending
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
                                        screenOptions={getTabScreenOptions}
                                    >
                                        <Tab.Screen
                                            name={OPEN_TAB_ROUTE}
                                            component={OpenChannelsScreen}
                                            listeners={{
                                                focus: () =>
                                                    setChannelsType(
                                                        ChannelsType.Open
                                                    )
                                            }}
                                        />
                                        <Tab.Screen
                                            name={CLOSED_TAB_ROUTE}
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
                                onRefresh={() => {
                                    this.props.NodeInfoStore?.getNodeInfo();
                                    getChannels();
                                }}
                                refreshing={loading}
                                keyExtractor={(item, index) =>
                                    `${item.remote_pubkey}-${index}`
                                }
                            />
                        )}
                    </>
                </View>
                <View
                    style={viewContainerStyle(!isChannelsView)}
                    collapsable={false}
                >
                    <View style={{ flex: 1 }}>
                        <SafeAreaView
                            style={{ flex: 1 }}
                            edges={['left', 'right', 'bottom']}
                        >
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
                            {showPeersSearch && <ChannelsFilter />}
                            {loading ? (
                                <View style={{ marginTop: 40 }}>
                                    <LoadingIndicator />
                                </View>
                            ) : (
                                <FlatList
                                    style={{
                                        flex: 1,
                                        paddingHorizontal: 15,
                                        paddingTop: ChannelsStore?.error
                                            ? 0
                                            : 16
                                    }}
                                    onRefresh={() => ChannelsStore?.getPeers()}
                                    refreshing={ChannelsStore?.loading}
                                    data={ChannelsStore?.filteredPeers}
                                    ListFooterComponent={
                                        <View style={{ height: 20 }} />
                                    }
                                    renderItem={({ item }) => {
                                        const peer = new Peer(item);
                                        const peerDisplayName =
                                            aliasesByPubkey[peer.pubkey] ||
                                            nodes[peer.pubkey]?.alias ||
                                            peer.alias ||
                                            peer.pubkey;
                                        const showDisconnect =
                                            BackendUtils.isLNDBased() ||
                                            peer.connected;

                                        return (
                                            <PeerItem
                                                peer={peer}
                                                displayName={peerDisplayName}
                                                onPress={() => {
                                                    if (
                                                        !BackendUtils.isLNDBased() &&
                                                        peer.connected === false
                                                    )
                                                        return;
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
                                                showDisconnect={showDisconnect}
                                            />
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
                            coverScreen={true}
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
                </View>
            </View>
        );
    }
}

// Keeps view mounted but invisible/non-interactive. Prevents freeze when
// switching to Peers (unmounting NavigationContainer causes native view issues).
const HIDDEN_VIEW_STYLE = {
    position: 'absolute' as const,
    opacity: 0,
    pointerEvents: 'none' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: -1
};

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
    peersContainer: {
        margin: 0,
        padding: 0,
        backgroundColor: 'transparent'
    },
    separator: {
        height: 0,
        backgroundColor: 'transparent'
    }
});
