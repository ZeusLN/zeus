import React from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    Alert
} from 'react-native';
import { Icon, Button } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import LinearGradient from 'react-native-linear-gradient';

interface InjectedProps {
    PeersStore: any;
    SettingsStore: any;
    navigation: any;
}

@inject('SettingsStore', 'PeersStore')
@observer
class PeersView extends React.Component<InjectedProps> {
    componentDidMount() {
        const { PeersStore } = this.props;
        if (PeersStore) {
            console.log('Fetching peers...');
            PeersStore.fetchPeers();
            console.log('Peers fetched:', PeersStore.peers);
        } else {
            console.error('PeersStore is not defined');
        }
    }

    handleDisconnect = (pubKey: string) => {
        const { PeersStore } = this.props;
        if (!PeersStore) return;

        Alert.alert(
            localeString('views.Peers.disconnectTitle'),
            localeString('views.Peers.disconnectConfirm'),
            [
                {
                    text: localeString('general.cancel'),
                    style: 'cancel'
                },
                {
                    text: localeString('general.confirm'),
                    onPress: async () => {
                        const success = await PeersStore.disconnectPeer(pubKey);
                        if (!success) {
                            Alert.alert(
                                localeString('general.error'),
                                PeersStore.error ||
                                    localeString('views.Peers.disconnectError')
                            );
                        }
                    }
                }
            ]
        );
    };

    navigateToConnectPeer = () => {
        const { navigation } = this.props;
        navigation.navigate('OpenChannel', { connectPeerOnly: true });
    };

    renderPeerItem = ({ item }: { item: any }) => {
        return (
            <View
                style={[
                    styles.peerItem,
                    { backgroundColor: themeColor('secondary') }
                ]}
            >
                <View style={styles.peerInfo}>
                    <Text
                        style={[styles.pubKey, { color: themeColor('text') }]}
                    >
                        {item.pub_key}
                    </Text>
                    <Text
                        style={[
                            styles.address,
                            { color: themeColor('secondaryText') }
                        ]}
                    >
                        {item.address}
                    </Text>
                    <View style={styles.statsRow}>
                        <Text
                            style={[
                                styles.statText,
                                { color: themeColor('secondaryText') }
                            ]}
                        >
                            {localeString('views.Peers.pingTime')}:{' '}
                            {item.ping_time}ms
                        </Text>
                        <Text
                            style={[
                                styles.statText,
                                { color: themeColor('secondaryText') }
                            ]}
                        >
                            {localeString('views.Peers.satsSent')}:{' '}
                            {item.sat_sent}
                        </Text>
                        <Text
                            style={[
                                styles.statText,
                                { color: themeColor('secondaryText') }
                            ]}
                        >
                            {localeString('views.Peers.satsReceived')}:{' '}
                            {item.sat_recv}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.disconnectButton}
                    onPress={() => this.handleDisconnect(item.pub_key)}
                >
                    <Icon
                        name="disconnect"
                        type="material-community"
                        size={24}
                        color={themeColor('error')}
                    />
                </TouchableOpacity>
            </View>
        );
    };

    refreshPeers = () => {
        const { PeersStore } = this.props;
        if (PeersStore) {
            PeersStore.fetchPeers();
        }
    };

    render() {
        const { PeersStore, navigation } = this.props;

        if (!PeersStore) {
            return (
                <Screen>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('views.Peers.title'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View style={styles.emptyContainer}>
                        <Text
                            style={[
                                styles.emptyText,
                                { color: themeColor('secondaryText') }
                            ]}
                        >
                            Store initialization error
                        </Text>
                    </View>
                </Screen>
            );
        }

        const { peers = [], loading = false, error = null } = PeersStore;

        if (loading && peers.length === 0) {
            return (
                <Screen>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('views.Peers.title'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator
                            size="large"
                            color={themeColor('highlight')}
                        />
                    </View>
                </Screen>
            );
        }

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Peers.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                <View style={styles.connectButtonContainer}>
                    <Button
                        title={
                            localeString('views.Peers.connectPeer') ||
                            'Connect Peer'
                        }
                        onPress={this.navigateToConnectPeer}
                        ViewComponent={LinearGradient}
                        linearGradientProps={{
                            colors: ['rgb(180, 26, 20)', 'rgb(255, 169, 0)'],
                            start: { x: 0, y: 0.5 },
                            end: { x: 1, y: 0.5 }
                        }}
                        buttonStyle={styles.connectButton}
                        icon={{
                            name: 'plus',
                            type: 'material-community',
                            color: 'white',
                            size: 18
                        }}
                    />
                </View>

                {peers.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text
                            style={[
                                styles.emptyText,
                                { color: themeColor('secondaryText') }
                            ]}
                        >
                            {error
                                ? localeString('views.Peers.errorLoading')
                                : localeString('views.Peers.noPeers')}
                        </Text>
                        {error && (
                            <TouchableOpacity
                                style={styles.retryButton}
                                onPress={this.refreshPeers}
                            >
                                <Text
                                    style={[
                                        styles.retryText,
                                        { color: themeColor('highlight') }
                                    ]}
                                >
                                    {localeString('general.retry')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <FlatList
                        data={peers}
                        renderItem={this.renderPeerItem}
                        keyExtractor={(item) => item.pub_key}
                        contentContainerStyle={styles.listContainer}
                        refreshControl={
                            <RefreshControl
                                refreshing={loading}
                                onRefresh={this.refreshPeers}
                                tintColor={themeColor('highlight')}
                            />
                        }
                    />
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    connectButtonContainer: {
        padding: 16,
        paddingBottom: 8
    },
    connectButton: {
        borderRadius: 8,
        paddingVertical: 10
    },
    listContainer: {
        padding: 16,
        flexGrow: 1
    },
    peerItem: {
        flexDirection: 'row',
        padding: 16,
        marginBottom: 12,
        borderRadius: 8,
        elevation: 2,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2
    },
    peerInfo: {
        flex: 1
    },
    pubKey: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4
    },
    address: {
        fontSize: 14,
        marginBottom: 8
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap'
    },
    statText: {
        fontSize: 12,
        marginRight: 12,
        marginBottom: 4
    },
    disconnectButton: {
        justifyContent: 'center',
        paddingLeft: 16
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 16
    },
    retryButton: {
        padding: 12
    },
    retryText: {
        fontSize: 16,
        fontWeight: 'bold'
    }
});

export default PeersView;
