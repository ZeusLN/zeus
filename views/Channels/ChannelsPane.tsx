import * as React from 'react';
import { FlatList, View, TouchableHighlight } from 'react-native';
import { inject, observer } from 'mobx-react';
import { duration } from 'moment';

import { ChannelsHeader } from '../../components/Channels/ChannelsHeader';
import { ChannelItem } from '../../components/Channels/ChannelItem';
import ChannelsFilter from '../../components/Channels/ChannelsFilter';

import LoadingIndicator from '../../components/LoadingIndicator';
import WalletHeader from '../../components/WalletHeader';
import { Spacer } from '../../components/layout/Spacer';

import ChannelsStore, { ChannelsType } from '../../stores/ChannelsStore';
import SettingsStore from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';

import Channel from '../../models/Channel';

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
    ChannelsStore?: ChannelsStore;
    SettingsStore?: SettingsStore;
}

@inject('ChannelsStore', 'SettingsStore')
@observer
export default class ChannelsPane extends React.PureComponent<ChannelsProps> {
    renderItem = ({ item }: { item: Channel }) => {
        const { ChannelsStore, navigation } = this.props;
        const { largestChannelSats, channelsType } = ChannelsStore!;

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
                        title={item.displayName}
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
                    title={item.displayName}
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
        const { channelsType } = ChannelsStore!;

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
        ChannelsStore!.setChannelsType(newType);
    };

    updateSearch = (value: string) => {
        this.props.ChannelsStore!.setSearch(value);
    };

    render() {
        const { ChannelsStore, SettingsStore, navigation } = this.props;
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
            channelsType
        } = ChannelsStore!;

        const lurkerMode: boolean =
            SettingsStore!.settings?.privacy?.lurkerMode || false;

        let headerString;
        let channelsData: Channel[];
        switch (channelsType) {
            case ChannelsType.Open:
                headerString = `${localeString(
                    'views.Wallet.Wallet.channels'
                )} (${filteredChannels?.length || 0})`;
                channelsData = filteredChannels;
                break;
            case ChannelsType.Pending:
                headerString = `${localeString(
                    'views.Wallet.Wallet.pendingChannels'
                )} (${filteredPendingChannels?.length || 0})`;
                channelsData = filteredPendingChannels;
                break;
            case ChannelsType.Closed:
                headerString = `${localeString(
                    'views.Wallet.Wallet.closedChannels'
                )} (${filteredClosedChannels?.length || 0})`;
                channelsData = filteredClosedChannels;
                break;
        }

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader
                    navigation={navigation}
                    title={headerString}
                    channels
                    toggle={
                        BackendUtils.supportsPendingChannels()
                            ? this.toggleChannelsType
                            : undefined
                    }
                />
                <ChannelsHeader
                    totalInbound={totalInbound}
                    totalOutbound={totalOutbound}
                    totalOffline={totalOffline}
                    lurkerMode={lurkerMode}
                />
                {showSearch && <ChannelsFilter />}
                {loading ? (
                    <View style={{ marginTop: 40 }}>
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
