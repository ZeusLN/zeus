import * as React from 'react';
import { Dimensions, FlatList, View, TouchableHighlight } from 'react-native';
import { SearchBar } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { duration } from 'moment';

import { ChannelsHeader } from '../../components/Channels/ChannelsHeader';
import { ChannelItem } from '../../components/Channels/ChannelItem';
import SortButton from '../../components/Channels/SortButton';

import LoadingIndicator from '../../components/LoadingIndicator';
import WalletHeader from '../../components/WalletHeader';
import { Row } from '../../components/layout/Row';
import { Spacer } from '../../components/layout/Spacer';

import ChannelsStore, { ChannelsType } from '../../stores/ChannelsStore';
import SettingsStore from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

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
    private getChannelsSortKeys = () => [
        {
            key: `${localeString('views.Channel.capacity')} (${localeString(
                'views.Channel.SortButton.largestFirst'
            )})`,
            value: {
                param: 'channelCapacity',
                dir: 'DESC',
                type: 'numeric'
            }
        },
        {
            key: `${localeString('views.Channel.capacity')} (${localeString(
                'views.Channel.SortButton.smallestFirst'
            )})`,
            value: { param: 'channelCapacity', dir: 'ASC', type: 'numeric' }
        },
        {
            key: `${localeString(
                'views.Channel.inboundCapacity'
            )} (${localeString('views.Channel.SortButton.largestFirst')})`,
            value: { param: 'remoteBalance', dir: 'DESC', type: 'numeric' }
        },
        {
            key: `${localeString(
                'views.Channel.inboundCapacity'
            )} (${localeString('views.Channel.SortButton.smallestFirst')})`,
            value: { param: 'remoteBalance', dir: 'ASC', type: 'numeric' }
        },
        {
            key: `${localeString(
                'views.Channel.outboundCapacity'
            )} (${localeString('views.Channel.SortButton.largestFirst')})`,
            value: { param: 'localBalance', dir: 'DESC', type: 'numeric' }
        },
        {
            key: `${localeString(
                'views.Channel.outboundCapacity'
            )} (${localeString('views.Channel.SortButton.smallestFirst')})`,
            value: { param: 'localBalance', dir: 'ASC', type: 'numeric' }
        },
        {
            key: `${localeString('views.Channel.displayName')} (${localeString(
                'views.Channel.SortButton.ascending'
            )})`,
            value: { param: 'displayName', dir: 'ASC', type: 'alphanumeric' }
        },
        {
            key: `${localeString('views.Channel.displayName')} (${localeString(
                'views.Channel.SortButton.descending'
            )})`,
            value: { param: 'displayName', dir: 'DESC', type: 'alphanumeric' }
        }
        // {
        //     key: `${localeString('views.Channel.channelId')} (${localeString(
        //         'views.Channel.SortButton.ascending'
        //     )})`,
        //     value: { param: 'channelId', dir: 'ASC', type: 'alphanumeric' }
        // },
        // {
        //     key: `${localeString('views.Channel.channelId')} (${localeString(
        //         'views.Channel.SortButton.descending'
        //     )})`,
        //     value: { param: 'channelId', dir: 'DESC', type: 'alphanumeric' }
        // }
    ];

    renderItem = ({ item }) => {
        const { ChannelsStore, navigation } = this.props;
        const { largestChannelSats, channelsType } = ChannelsStore;
        const displayName = item.alias || item.remotePubkey || item.channelId;

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

    updateSearch = (value: string) => {
        this.props.ChannelsStore.setSearch(value);
    };

    render() {
        const { ChannelsStore, SettingsStore, navigation } = this.props;
        const { channelsType, search } = ChannelsStore;
        const {
            loading,
            getChannels,
            totalInbound,
            totalOutbound,
            totalOffline,
            filteredChannels,
            filteredPendingChannels,
            filteredClosedChannels,
            setSort,
            showSearch
        } = ChannelsStore;

        const lurkerMode: boolean =
            SettingsStore?.settings?.privacy?.lurkerMode || false;

        let headerString;
        let channelsData;
        switch (channelsType) {
            case ChannelsType.Open:
                headerString = `${localeString(
                    'views.Wallet.Wallet.channels'
                )} (${filteredChannels.length})`;
                channelsData = filteredChannels;
                break;
            case ChannelsType.Pending:
                headerString = `${localeString(
                    'views.Wallet.Wallet.pendingChannels'
                )} (${filteredPendingChannels.length})`;
                channelsData = filteredPendingChannels;
                break;
            case ChannelsType.Closed:
                headerString = `${localeString(
                    'views.Wallet.Wallet.closedChannels'
                )} (${filteredClosedChannels.length})`;
                channelsData = filteredClosedChannels;
                break;
        }

        const windowWidth = Dimensions.get('window').width;

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
                    lurkerMode={lurkerMode}
                />
                {showSearch && (
                    <Row>
                        <SearchBar
                            placeholder={localeString('general.search')}
                            onChangeText={this.updateSearch}
                            value={search}
                            inputStyle={{
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }}
                            placeholderTextColor={themeColor('secondaryText')}
                            containerStyle={{
                                backgroundColor: null,
                                borderTopWidth: 0,
                                borderBottomWidth: 0,
                                width: windowWidth - 55
                            }}
                            inputContainerStyle={{
                                borderRadius: 15,
                                backgroundColor: themeColor('secondary')
                            }}
                            autoCapitalize="none"
                        />
                        <SortButton
                            onValueChange={(value: any) => {
                                setSort(value);
                            }}
                            values={this.getChannelsSortKeys()}
                        />
                    </Row>
                )}
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
