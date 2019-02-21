import * as React from 'react';
import { ScrollView, StyleSheet, View, FlatList } from 'react-native';
import { Button, List, ListItem } from 'react-native-elements';
import Channel from './../../models/Channel';
import Identicon from 'identicon.js';
import { inject, observer } from 'mobx-react';
const hash = require('object-hash');

import ChannelsStore from './../../stores/ChannelsStore';
import NodeInfoStore from './../../stores/NodeInfoStore';
import UnitsStore from './../../stores/UnitsStore';

interface ChannelsProps {
    channels: Array<Channel>;
    navigation: any;
    refresh: any;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
    UnitsStore: UnitsStore;
}

@inject('NodeInfoStore', 'UnitsStore')
@observer
export default class Channels extends React.Component<ChannelsProps, {}> {
    renderSeparator = () => <View style={styles.separator} />;

    render() {
        const { channels, navigation, refresh, ChannelsStore, NodeInfoStore, UnitsStore } = this.props;
        const { getAmount, units } = UnitsStore;
        const { loading } = ChannelsStore;
        return (
            <ScrollView>
                {!NodeInfoStore.error && <View style={styles.button}>
                    <Button
                        title="Open Channel"
                        icon={{
                            name: "swap-horiz",
                            size: 25,
                            color: "white"
                        }}
                        backgroundColor="rgba(92, 99,216, 1)"
                        onPress={() => navigation.navigate('OpenChannel')}
                        style={{ paddingTop: 10, width: 250, alignSelf: 'center' }}
                        borderRadius={30}
                    />
                </View>}
                {(!!channels && channels.length > 0) || loading  ? <List>
                        <FlatList
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
                                    />
                                );
                            }}
                            keyExtractor={item => item.chan_id}
                            ItemSeparatorComponent={this.renderSeparator}
                            onEndReachedThreshold={50}
                            refreshing={loading}
                            onRefresh={() => refresh()}
                        />
                </List> : <Button
                    title="No Channels"
                    icon={{
                        name: "error-outline",
                        size: 25,
                        color: "black"
                    }}
                    backgroundColor="transparent"
                    color="black"
                    onPress={() => refresh()}
                    borderRadius={30}
                />}
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    separator: {
        height: 1,
        width: "86%",
        backgroundColor: "#CED0CE",
        marginLeft: "14%"
    },
    button: {
        paddingTop: 20,
        paddingBottom: 5
    }
});