import * as React from 'react';
import { FlatList, View, TouchableHighlight } from 'react-native';

import { ChannelsHeader } from '../../components/Channels/ChannelsHeader';
import { WalletHeader } from '../../components/WalletHeader';
import { ChannelItem } from '../../components/Channels/ChannelItem';
import { localeString } from '../../utils/LocaleUtils';
import { Spacer } from '../../components/layout/Spacer';

import { inject, observer } from 'mobx-react';
import ChannelsStore from '../../stores/ChannelsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import UnitsStore from '../../stores/UnitsStore';
import SettingsStore from '../../stores/SettingsStore';

// TODO: does this belong in the model? Or can it be computed from the model?
export enum Status {
    Good = 'Good',
    Stable = 'Stable',
    Unstable = 'Unstable',
    Offline = 'Offline'
}

interface ChannelsProps {
    navigation: any;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

@inject('ChannelsStore', 'NodeInfoStore', 'UnitsStore', 'SettingsStore')
@observer
export default class ChannelsPane extends React.PureComponent<
    ChannelsProps,
    {}
> {
    headerString = `${localeString('views.Wallet.Wallet.channels')} (${
        this.props.ChannelsStore.channels.length
    })`;

    renderItem = ({ item }) => {
        const { ChannelsStore, navigation } = this.props;
        const { nodes, largestChannelSats } = ChannelsStore;
        const displayName =
            item.alias ||
            (nodes[item.remote_pubkey] && nodes[item.remote_pubkey].alias) ||
            item.remote_pubkey ||
            item.channelId;
        return (
            <TouchableHighlight
                onPress={() =>
                    navigation.navigate('Channel', {
                        channel: item
                    })
                }
            >
                <ChannelItem
                    title={displayName}
                    status={item.isActive ? Status.Good : Status.Offline}
                    inbound={item.remoteBalance}
                    outbound={item.localBalance}
                    largestTotal={largestChannelSats}
                />
            </TouchableHighlight>
        );
    };

    render() {
        const { ChannelsStore, navigation } = this.props;
        const {
            loading,
            getChannels,
            totalInbound,
            totalOutbound,
            totalOffline
        } = ChannelsStore;
        return (
            <View style={{ flex: 1 }}>
                <WalletHeader
                    navigation={this.props.navigation}
                    title={this.headerString}
                    channels
                />
                <ChannelsHeader
                    totalInbound={totalInbound}
                    totalOutbound={totalOutbound}
                    totalOffline={totalOffline}
                />
                <FlatList
                    data={this.props.ChannelsStore.channels}
                    renderItem={this.renderItem}
                    ListFooterComponent={<Spacer height={100} />}
                    onRefresh={() => getChannels()}
                    refreshing={loading}
                    keyExtractor={(item, index) =>
                        `${item.remote_pubkey}-${index}`
                    }
                />
            </View>
        );
    }
}
