import * as React from 'react';
import { FlatList, Text, View, RefreshControl } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../../../components/Screen';
import Header from '../../../../components/Header';
import BackendUtils from '../../../../utils/BackendUtils';

import SettingsStore from '../../../../stores/SettingsStore';

import { localeString } from '../../../../utils/LocaleUtils';
import { themeColor } from '../../../../utils/ThemeUtils';

interface PeersListProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface Peer {
    pub_key: string;
    address: string;
    bytes_sent: string;
    bytes_recv: string;
    ping_time: string;
    sync_type: string;
    features: any;
    flap_count: number;
    last_flap_ns: string;
    last_ping_payload: string;
}

interface PeersListState {
    peers: Peer[];
    loading: boolean;
    refreshing: boolean;
}

@inject('SettingsStore')
@observer
export default class PeersList extends React.Component<
    PeersListProps,
    PeersListState
> {
    state = {
        peers: [],
        loading: true,
        refreshing: false
    };

    async componentDidMount() {
        await this.loadPeers();
    }

    loadPeers = async () => {
        this.setState({ loading: true });
        try {
            const response = await BackendUtils.listPeers();
            console.log('Peers response:', JSON.stringify(response, null, 2));
            this.setState({ peers: response.peers || [] });
        } catch (error) {
            console.error('Error loading peers:', error);
        }
        this.setState({ loading: false });
    };

    onRefresh = async () => {
        this.setState({ refreshing: true });
        await this.loadPeers();
        this.setState({ refreshing: false });
    };

    disconnectPeer = async (pubKey: string) => {
        try {
            const response = await BackendUtils.disconnectPeer(pubKey);
            console.log('Disconnected peer:', response);
            console.log('Disconnected peer:', pubKey);
            await this.loadPeers(); // Reload the peers list
        } catch (error) {
            console.error('Error disconnecting peer:', error);
        }
    };

    render() {
        const { navigation } = this.props;
        const { peers, loading, refreshing } = this.state;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('general.connectedPeers'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    {loading ? (
                        <View
                            style={{
                                flex: 1,
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                        >
                            <Text style={{ color: themeColor('text') }}>
                                {localeString('general.loading')}
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={peers}
                            keyExtractor={(item: Peer) => item.pub_key}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={this.onRefresh}
                                    colors={[themeColor('highlight')]}
                                    tintColor={themeColor('highlight')}
                                />
                            }
                            renderItem={({ item }: { item: Peer }) => (
                                <ListItem
                                    containerStyle={{
                                        backgroundColor: 'transparent'
                                    }}
                                >
                                    <ListItem.Content>
                                        <ListItem.Title
                                            style={{
                                                color: themeColor('text'),
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            {item.pub_key}
                                        </ListItem.Title>
                                        <ListItem.Subtitle
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            {item.address}
                                        </ListItem.Subtitle>
                                    </ListItem.Content>
                                    <Icon
                                        name="close"
                                        color={themeColor('text')}
                                        onPress={() =>
                                            this.disconnectPeer(item.pub_key)
                                        }
                                    />
                                </ListItem>
                            )}
                            ListEmptyComponent={
                                <View
                                    style={{
                                        flex: 1,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginTop: 20
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString('general.noPeers')}
                                    </Text>
                                </View>
                            }
                        />
                    )}
                </View>
            </Screen>
        );
    }
}
