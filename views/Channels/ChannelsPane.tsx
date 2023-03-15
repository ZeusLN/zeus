import * as React from 'react';
import { FlatList, View, TouchableHighlight } from 'react-native';

import { inject, observer } from 'mobx-react';

import { ChannelsHeader } from '../../components/Channels/ChannelsHeader';
import { ChannelItem } from '../../components/Channels/ChannelItem';
import LoadingIndicator from '../../components/LoadingIndicator';
import WalletHeader from '../../components/WalletHeader';

import { localeString } from '../../utils/LocaleUtils';
import { Spacer } from '../../components/layout/Spacer';

import ChannelsStore, { ChannelsType } from '../../stores/ChannelsStore';
import SettingsStore from '../../stores/SettingsStore';

import { duration } from 'moment';
import BackendUtils from '../../utils/BackendUtils';

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
    SettingsStore: SettingsStore;
}

@inject('ChannelsStore', 'SettingsStore')
@observer
export default class ChannelsPane extends React.PureComponent<ChannelsProps> {
    renderItem = ({ item }) => {
        const { ChannelsStore, navigation } = this.props;
        const { nodes, largestChannelSats, channelsType } = ChannelsStore;
        const displayName =
            item.alias ||
            (nodes[item.remotePubkey] && nodes[item.remotePubkey].alias) ||
            item.remotePubkey ||
            item.channelId;

        const getStatus = () => {
            if (item.isActive) {
                return Status.Good;
            } else if (item.pendingOpen) {
                return Status.Opening;
            } else if (item.pendingClose || item.forceClose || item.closing) {
                return Status.Closing;
            } else {
                return Status.Offline;
            }
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
        const { ChannelsStore } = this.props;
        const { channelsType } = ChannelsStore;

        let newType = ChannelsType.Open;
        switch (channelsType) {
            case ChannelsType.Open:
                newType = ChannelsType.Pending;
                break;
            case ChannelsType.Pending:
                newType = ChannelsType.Closed;
                break;

            default:
                newType = ChannelsType.Open;
        }
        ChannelsStore.setChannelsType(newType);
    };

    render() {
        const { ChannelsStore, SettingsStore, navigation } = this.props;
        const { channelsType } = ChannelsStore;
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
            case ChannelsType.Open:
                headerString = `${localeString(
                    'views.Wallet.Wallet.channels'
                )} (${channels.length})`;
                channelsData = channels;
                break;
            case ChannelsType.Pending:
                headerString = `${localeString(
                    'views.Wallet.Wallet.pendingChannels'
                )} (${pendingChannels.length})`;
                channelsData = pendingChannels;
                break;
            case ChannelsType.Closed:
                headerString = `${localeString(
                    'views.Wallet.Wallet.closedChannels'
                )} (${closedChannels.length})`;
                channelsData = closedChannels;
                break;
        }

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader
                    navigation={navigation}
                    title={headerString}
                    SettingsStore={SettingsStore}
                    channels
                    toggle={
                        BackendUtils.supportsPendingChannels()
                            ? this.toggleChannelsType
                            : null
                    }
                />
                <ChannelsHeader
                    totalInbound={totalInbound}
                    totalOutbound={totalOutbound}
                    totalOffline={totalOffline}
                />
                {loading ? (
                    <View style={{ top: 40 }}>
                        <LoadingIndicator />
                    </View>
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
