import * as React from 'react';
import { FlatList, View, StyleSheet, TouchableHighlight } from 'react-native';

import { inject, observer } from 'mobx-react';
import {
    ChannelsDonut,
    ChannelsHeader
} from '../../components/Channels/ChannelsHeader';
import { WalletHeader } from '../../components/WalletHeader';
import { ChannelItem } from '../../components/Channels/ChannelItem';
import { localeString } from '../../utils/LocaleUtils';
import { Spacer } from '../../components/layout/Spacer';

import ChannelsStore from '../../stores/ChannelsStore';

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
}

interface ChannelsState {
    listPositionY: number;
}

@inject('ChannelsStore', 'SettingsStore')
@observer
export default class ChannelsPane extends React.PureComponent<
    ChannelsProps,
    ChannelsState
> {
    state = {
        listPositionY: 0
    };

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

    handleScroll = (event: any) => {
        this.setState({
            listPositionY: event.nativeEvent.contentOffset.y
        });
    };

    render() {
        const { ChannelsStore, SettingsStore, navigation } = this.props;
        const { listPositionY } = this.state;
        const {
            loading,
            getChannels,
            totalInbound,
            totalOutbound,
            totalOffline,
            channels
        } = ChannelsStore;
        const defaultHeight = 106;
        const donutHeight =
            listPositionY > defaultHeight ? 0 : defaultHeight - listPositionY;

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader
                    navigation={navigation}
                    title={this.headerString}
                    SettingsStore={SettingsStore}
                    channels
                />
                <View style={{ ...styles.donut, height: donutHeight }}>
                    <ChannelsDonut
                        totalInbound={totalInbound}
                        totalOutbound={totalOutbound}
                        totalOffline={totalOffline}
                        radius={donutHeight / 2}
                    />
                </View>
                <ChannelsHeader
                    totalInbound={totalInbound}
                    totalOutbound={totalOutbound}
                    totalOffline={totalOffline}
                />
                <FlatList
                    data={channels}
                    renderItem={this.renderItem}
                    ListFooterComponent={<Spacer height={100} />}
                    onRefresh={() => getChannels()}
                    refreshing={loading}
                    keyExtractor={(item, index) =>
                        `${item.remote_pubkey}-${index}`
                    }
                    onScroll={this.handleScroll}
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    donut: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
    }
});
