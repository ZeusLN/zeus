import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    FlatList,
    View,
    StyleSheet,
    Text,
    TouchableHighlight,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { duration } from 'moment';
import { StackNavigationProp } from '@react-navigation/stack';

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
    navigation: StackNavigationProp<any, any>;
    ChannelsStore?: ChannelsStore;
    SettingsStore?: SettingsStore;
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
                        pendingHTLCs={item?.pending_htlcs?.length > 0}
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
                    pendingHTLCs={item?.pending_htlcs?.length > 0}
                    pendingTimelock={
                        item.forceClose
                            ? forceCloseTimeLabel(item.blocks_til_maturity)
                            : undefined
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

        const { settings } = SettingsStore!;

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
                />
                {settings?.lsps1ShowPurchaseButton &&
                    (BackendUtils.supportsLSPS1customMessage() ||
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
    }
});
