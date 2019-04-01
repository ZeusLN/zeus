import * as React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, ListItem } from 'react-native-elements';
import Channel from './../../models/Channel';
import Identicon from 'identicon.js';
import { inject, observer } from 'mobx-react';
const hash = require('object-hash');

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
            <View style={theme === 'dark' ? styles.darkSeparator : styles.lightSeparator} />
        )
    }

    render() {
        const { channels, navigation, refresh, ChannelsStore, NodeInfoStore, UnitsStore, SettingsStore } = this.props;
        const { getAmount, units } = UnitsStore;
        const { loading } = ChannelsStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

        return (
            <View style={theme === 'dark' ? styles.darkThemeStyle : styles.lightThemeStyle}>
                {!NodeInfoStore.error && <View style={styles.button}>
                    <Button
                        title="Open Channel"
                        icon={{
                            name: "swap-horiz",
                            size: 25,
                            color: "white"
                        }}
                        backgroundColor={theme === "dark" ? "#261339" : "rgba(92, 99,216, 1)"}
                        onPress={() => navigation.navigate('OpenChannel')}
                        style={{ paddingTop: 10, width: 250, alignSelf: 'center' }}
                        borderRadius={30}
                    />
                </View>}
                {(!!channels && channels.length > 0) || loading  ? <FlatList
                    data={channels}
                    renderItem={({ item }) => {
                        const data = new Identicon(hash.sha1(item.remote_pubkey), 420).toString();
                        return (
                            <ListItem
                                key={item.remote_pubkey}
                                title={item.remote_pubkey}
                                avatar={`data:image/png;base64,${data}`}
                                subtitle={`Local: ${units && getAmount(item.local_balance || 0)} | Remote: ${units && getAmount(item.remote_balance || 0)}`}
                                containerStyle={{ borderBottomWidth: 0 }}
                                onPress={() => navigation.navigate('Channel', { channel: item })}
                                titleStyle={{ color: theme === 'dark' ? 'white' : 'black' }}
                                subtitleStyle={{ color: theme === 'dark' ? 'gray' : '#8a8999' }}
                            />
                        );
                    }}
                    keyExtractor={item => item.chan_id}
                    ItemSeparatorComponent={this.renderSeparator}
                    onEndReachedThreshold={50}
                    refreshing={loading}
                    onRefresh={() => refresh()}
                /> : <Button
                    title="No Channels"
                    icon={{
                        name: "error-outline",
                        size: 25,
                        color: theme === 'dark' ? 'white' : 'black'
                    }}
                    backgroundColor="transparent"
                    color={theme === 'dark' ? 'white' : 'black'}
                    onPress={() => refresh()}
                    borderRadius={30}
                />}
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
        width: "86%",
        backgroundColor: "#CED0CE",
        marginLeft: "14%"
    },
    darkSeparator: {
        height: 1,
        width: "86%",
        backgroundColor: "darkgray",
        marginLeft: "14%"
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    }
});