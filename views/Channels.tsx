import * as React from 'react';
import {
    FlatList,
    ScrollView,
    StyleSheet,
    View,
    SafeAreaView
} from 'react-native';
import { Avatar, Button, Header, Icon, ListItem } from 'react-native-elements';
import Channel from './../models/Channel';
import BalanceSlider from './../components/BalanceSlider';
import Identicon from 'identicon.js';
import { inject, observer } from 'mobx-react';
const hash = require('object-hash');
import PrivacyUtils from './../utils/PrivacyUtils';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import ChannelsStore from './../stores/ChannelsStore';
import NodeInfoStore from './../stores/NodeInfoStore';
import UnitsStore from './../stores/UnitsStore';
import SettingsStore from './../stores/SettingsStore';

interface ChannelsProps {
    channels: Array<Channel>;
    navigation: any;
    refresh: any;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

@inject('ChannelsStore', 'NodeInfoStore', 'UnitsStore', 'SettingsStore')
@observer
export default class Channels extends React.Component<ChannelsProps, {}> {
    renderSeparator = () => <View style={styles.separator} />;

    refresh = () => this.props.ChannelsStore.getChannels();

    render() {
        const {
            channels,
            navigation,
            ChannelsStore,
            NodeInfoStore,
            UnitsStore,
            SettingsStore
        } = this.props;
        const { getAmount, units } = UnitsStore;
        const { nodes, loading } = ChannelsStore;
        const { settings } = SettingsStore;
        const { lurkerMode } = settings;

        const ChannelIcon = (balanceImage: string) => (
            <Avatar
                source={{
                    uri: balanceImage
                }}
            />
        );

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return <ScrollView style={styles.scrollView}></ScrollView>;
    }
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
        backgroundColor: themeColor('background'),
        color: themeColor('text')
    },
    separator: {
        height: 1,
        width: '86%',
        backgroundColor: themeColor('separator'),
        marginLeft: '14%'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    }
});
