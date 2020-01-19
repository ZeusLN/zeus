import * as React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Avatar, Button, ListItem } from 'react-native-elements';
import Channel from './../../models/Channel';
import BalanceSlider from './../../components/BalanceSlider';
import Identicon from 'identicon.js';
import { inject, observer } from 'mobx-react';
const hash = require('object-hash');
import PrivacyUtils from './../../utils/PrivacyUtils';

import ChannelsStore from './../../stores/ChannelsStore';
import NodeInfoStore from './../../stores/NodeInfoStore';
import UnitsStore from './../../stores/UnitsStore';
import SettingsStore from './../../stores/SettingsStore';

interface ChannelsProps {
    channels: Array<Channel>;
    navigation: any;
    refresh: any;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

@inject('NodeInfoStore', 'UnitsStore', 'SettingsStore')
@observer
export default class Channels extends React.Component<ChannelsProps, {}> {
    renderSeparator = () => {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { theme } = settings;

        return (
            <View
                style={
                    theme === 'dark'
                        ? styles.darkSeparator
                        : styles.lightSeparator
                }
            />
        );
    };

    render() {
        const {
            channels,
            navigation,
            refresh,
            ChannelsStore,
            NodeInfoStore,
            UnitsStore,
            SettingsStore
        } = this.props;
        const { getAmount, units } = UnitsStore;
        const { nodes, loading } = ChannelsStore;
        const { settings } = SettingsStore;
        const { theme, lurkerMode } = settings;

        const ChannelIcon = (balanceImage: string) => (
            <Avatar
                source={{
                    uri: balanceImage
                }}
            />
        );

        return (
            <View
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                {!NodeInfoStore.error && (
                    <View style={styles.button}>
                        <Button
                            title="Open Channel"
                            icon={{
                                name: 'swap-horiz',
                                size: 25,
                                color: 'white'
                            }}
                            buttonStyle={{
                                backgroundColor:
                                    theme === 'dark'
                                        ? '#261339'
                                        : 'rgba(92, 99,216, 1)',
                                borderRadius: 30,
                                width: 350,
                                alignSelf: 'center'
                            }}
                            onPress={() => navigation.navigate('OpenChannel')}
                            style={{
                                paddingTop: 10,
                                width: 250,
                                alignSelf: 'center'
                            }}
                        />
                    </View>
                )}
                {(!!channels && channels.length > 0) || loading ? (
                    <FlatList
                        data={channels}
                        renderItem={({ item }) => {
                            const displayName =
                                item.alias ||
                                (nodes[item.remote_pubkey] &&
                                    nodes[item.remote_pubkey].alias) ||
                                item.remote_pubkey ||
                                item.channelId;

                            const channelTitle = lurkerMode
                                ? PrivacyUtils.hideValue(displayName, 8)
                                : displayName;

                            const data = new Identicon(
                                hash.sha1(channelTitle),
                                420
                            ).toString();

                            const localBalanceDisplay = lurkerMode
                                ? PrivacyUtils.hideValue(
                                      getAmount(item.localBalance || 0),
                                      7,
                                      true
                                  )
                                : getAmount(item.localBalance || 0);
                            const remoteBalanceDisplay = lurkerMode
                                ? PrivacyUtils.hideValue(
                                      getAmount(item.remoteBalance || 0),
                                      7,
                                      true
                                  )
                                : getAmount(item.remoteBalance || 0);

                            return (
                                <React.Fragment>
                                    <ListItem
                                        title={channelTitle}
                                        leftElement={ChannelIcon(
                                            `data:image/png;base64,${data}`
                                        )}
                                        subtitle={`${
                                            !item.isActive ? 'INACTIVE | ' : ''
                                        }${
                                            item.private ? 'Private | ' : ''
                                        }Local: ${units &&
                                            localBalanceDisplay} | Remote: ${units &&
                                            remoteBalanceDisplay}`}
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor:
                                                theme === 'dark'
                                                    ? 'black'
                                                    : 'white'
                                        }}
                                        onPress={() =>
                                            navigation.navigate('Channel', {
                                                channel: item
                                            })
                                        }
                                        titleStyle={{
                                            color:
                                                theme === 'dark'
                                                    ? 'white'
                                                    : 'black'
                                        }}
                                        subtitleStyle={{
                                            color:
                                                theme === 'dark'
                                                    ? 'gray'
                                                    : '#8a8999'
                                        }}
                                    />
                                    <BalanceSlider
                                        localBalance={
                                            lurkerMode ? 50 : item.localBalance
                                        }
                                        remoteBalance={
                                            lurkerMode ? 50 : item.remoteBalance
                                        }
                                        theme={theme}
                                        list
                                    />
                                </React.Fragment>
                            );
                        }}
                        keyExtractor={(item, index) =>
                            `${item.remote_pubkey}-${index}`
                        }
                        ItemSeparatorComponent={this.renderSeparator}
                        onEndReachedThreshold={50}
                        refreshing={loading}
                        onRefresh={() => refresh()}
                    />
                ) : (
                    <Button
                        title="No Channels"
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
                        onPress={() => refresh()}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
                    />
                )}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
    },
    lightSeparator: {
        height: 1,
        width: '86%',
        backgroundColor: '#CED0CE',
        marginLeft: '14%'
    },
    darkSeparator: {
        height: 1,
        width: '86%',
        backgroundColor: 'darkgray',
        marginLeft: '14%'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    }
});
