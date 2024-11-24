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
import Screen from '../../components/Screen';

// nav
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
    DefaultTheme,
    NavigationContainer,
    NavigationContainerRef,
    NavigationIndependentTree
} from '@react-navigation/native';

import ChannelsStore, { ChannelsType } from '../../stores/ChannelsStore';
import SettingsStore from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

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
    private tabNavigationRef = React.createRef<NavigationContainerRef<any>>();

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
                        item.forceClose
                            ? forceCloseTimeLabel(item.blocks_til_maturity)
                            : undefined
                    }
                    isBelowReserve={item.isBelowReserve}
                />
            </TouchableHighlight>
        );
    };

    updateSearch = (value: string) => {
        this.props.ChannelsStore!.setSearch(value);
    };

    render() {
        const Tab = createBottomTabNavigator();

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
            showSearch
        } = ChannelsStore!;

        const { settings } = SettingsStore!;

        const Theme = {
            ...DefaultTheme,
            colors: {
                ...DefaultTheme.colors,
                background: themeColor('background'),
                card: themeColor('background'),
                border: themeColor('background')
            }
        };

        const OpenChannelsScreen = () => {
            return (
                <Screen>
                    <FlatList
                        data={filteredChannels}
                        renderItem={this.renderItem}
                        ListFooterComponent={<Spacer height={100} />}
                        onRefresh={() => getChannels()}
                        refreshing={loading}
                        keyExtractor={(item, index) =>
                            `${item.remote_pubkey}-${index}`
                        }
                    />
                </Screen>
            );
        };

        const PendingChannelsScreen = () => {
            return (
                <Screen>
                    <FlatList
                        data={filteredPendingChannels}
                        renderItem={this.renderItem}
                        ListFooterComponent={<Spacer height={100} />}
                        onRefresh={() => getChannels()}
                        refreshing={loading}
                        keyExtractor={(item, index) =>
                            `${item.remote_pubkey}-${index}`
                        }
                    />
                </Screen>
            );
        };

        const ClosedChannelsScreen = () => {
            return (
                <Screen>
                    <FlatList
                        data={filteredClosedChannels}
                        renderItem={this.renderItem}
                        ListFooterComponent={<Spacer height={100} />}
                        onRefresh={() => getChannels()}
                        refreshing={loading}
                        keyExtractor={(item, index) =>
                            `${item.remote_pubkey}-${index}`
                        }
                    />
                </Screen>
            );
        };

        const openChannelsTabName = `${localeString(
            'views.Wallet.Wallet.open'
        )} (${filteredChannels?.length || 0})`;

        const pendingChannelsTabName = `${localeString(
            'views.Wallet.Wallet.pending'
        )} (${filteredPendingChannels?.length || 0})`;

        const closedChannelsTabName = `${localeString(
            'views.Wallet.Wallet.closed'
        )} (${filteredClosedChannels?.length || 0})`;

        return (
            <View style={{ flex: 1 }}>
                <WalletHeader
                    navigation={navigation}
                    title={
                        BackendUtils.supportsPendingChannels()
                            ? localeString('views.Wallet.Wallet.channels')
                            : `${localeString(
                                  'views.Wallet.Wallet.channels'
                              )} (${filteredChannels?.length || 0})`
                    }
                    channels
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
                ) : BackendUtils.supportsPendingChannels() ? (
                    <NavigationIndependentTree>
                        <NavigationContainer
                            theme={Theme}
                            ref={this.tabNavigationRef}
                        >
                            <Tab.Navigator
                                initialRouteName={openChannelsTabName}
                                backBehavior="none"
                                screenOptions={() => ({
                                    tabBarIcon: () => {
                                        return null;
                                    },
                                    headerShown: false,
                                    tabBarActiveTintColor: themeColor('text'),
                                    tabBarInactiveTintColor: 'gray',
                                    tabBarShowLabel: true,
                                    tabBarStyle: {
                                        borderTopWidth: 0.2,
                                        borderTopColor:
                                            themeColor('secondaryText'),
                                        marginBottom: 20
                                    },
                                    tabBarLabelStyle: {
                                        fontSize: 18,
                                        fontFamily: 'PPNeueMontreal-Medium'
                                    },
                                    animation: 'shift'
                                })}
                            >
                                <Tab.Screen
                                    name={openChannelsTabName}
                                    component={OpenChannelsScreen}
                                />
                                <Tab.Screen
                                    name={pendingChannelsTabName}
                                    component={PendingChannelsScreen}
                                />
                                <Tab.Screen
                                    name={closedChannelsTabName}
                                    component={ClosedChannelsScreen}
                                />
                            </Tab.Navigator>
                        </NavigationContainer>
                    </NavigationIndependentTree>
                ) : (
                    <FlatList
                        data={filteredChannels}
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
