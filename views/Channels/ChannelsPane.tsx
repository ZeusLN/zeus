import * as React from 'react';
import {
    FlatList,
    View,
    TouchableHighlight,
    TouchableOpacity
} from 'react-native';

import { inject, observer } from 'mobx-react';

import { ChannelsHeader } from '../../components/Channels/ChannelsHeader';
import { ChannelItem } from '../../components/Channels/ChannelItem';
import LoadingIndicator from '../../components/LoadingIndicator';
import WalletHeader from '../../components/WalletHeader';

import { localeString } from '../../utils/LocaleUtils';
import { Spacer } from '../../components/layout/Spacer';

import ChannelsStore from '../../stores/ChannelsStore';

import { duration } from 'moment';

// TODO: does this belong in the model? Or can it be computed from the model?
export enum Status {
    Good = 'Good',
    Stable = 'Stable',
    Unstable = 'Unstable',
    Offline = 'Offline',
    Opening = 'Opening',
    Closing = 'Closing'
}

interface ChannelsProps {
    navigation: any;
    ChannelsStore: ChannelsStore;
}

interface ChannelsState {
    channelsType: number;
}

@inject('ChannelsStore', 'SettingsStore')
@observer
export default class ChannelsPane extends React.PureComponent<
    ChannelsProps,
    ChannelsState
> {
    state = {
        channelsType: 0
    };

    renderItem = ({ item }) => {
        const { ChannelsStore, navigation } = this.props;
        const { nodes, largestChannelSats } = ChannelsStore;
        const displayName =
            item.alias ||
            (nodes[item.remote_pubkey] && nodes[item.remote_pubkey].alias) ||
            item.remote_pubkey ||
            item.channelId;

        const getStatus = () => {
            if (item.isActive) {
                return Status.Good;
            } else if (item.pendingOpen) {
                return Status.Opening;
            } else if (item.pendingClose || item.forceClose) {
                return Status.Closing;
            } else {
                return Status.Offline;
            }
        };

        const forceCloseTimeLabel = (maturity: number) => {
            return duration(maturity * 10, 'minutes').humanize();
        };

        if (this.state.channelsType === 0) {
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
                        status={getStatus()}
                        inbound={item.remoteBalance}
                        outbound={item.localBalance}
                        largestTotal={largestChannelSats}
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
                    title={displayName}
                    inbound={item.remoteBalance}
                    outbound={item.localBalance}
                    status={getStatus()}
                    pendingTimelock={
                        item.forceClose
                            ? forceCloseTimeLabel(item.blocks_til_maturity)
                            : null
                    }
                />
            </TouchableHighlight>
        );
    };

    toggleChannelsType = () => {
        const { channelsType } = this.state;
        if (channelsType === 2) {
            this.setState({
                channelsType: 0
            });
        } else {
            this.setState({
                channelsType: channelsType + 1
            });
        }
    };

    render() {
        const { ChannelsStore, SettingsStore, navigation } = this.props;
        const { channelsType } = this.state;
        const {
            loading,
            getChannels,
            totalInbound,
            totalOutbound,
            totalOffline,
            channels,
            pendingChannels,
            closedChannels
        } = ChannelsStore;

        let headerString;
        let channelsData;
        switch (channelsType) {
            case 0:
                headerString = `${localeString(
                    'views.Wallet.Wallet.channels'
                )} (${channels.length})`;
                channelsData = channels;
                break;
            case 1:
                headerString = `Pending Channels (${pendingChannels.length})`;
                channelsData = pendingChannels;
                break;
            case 2:
                headerString = `Closed Channels (${closedChannels.length})`;
                channelsData = closedChannels;
                break;
        }

        return (
            <View style={{ flex: 1 }}>
                <TouchableOpacity onPress={() => this.toggleChannelsType()}>
                    <WalletHeader
                        navigation={navigation}
                        title={headerString}
                        SettingsStore={SettingsStore}
                        channels
                    />
                </TouchableOpacity>
                <ChannelsHeader
                    totalInbound={totalInbound}
                    totalOutbound={totalOutbound}
                    totalOffline={totalOffline}
                />
                {loading ? (
                    <LoadingIndicator />
                ) : (
                    <FlatList
                        data={channelsData}
                        renderItem={this.renderItem}
                        ListFooterComponent={<Spacer height={100} />}
                        onRefresh={() => getChannels()}
                        refreshing={loading}
                        keyExtractor={(item, index) =>
                            `${item.remote_pubkey}-${index}`
                        }
                    />
                )}
            </View>
        );
    }
}
