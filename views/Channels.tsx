import * as React from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
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

        return (
            <ScrollView style={styles.scrollView}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Wallet.Wallet.channels'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor={themeColor('secondary')}
                />
                {!NodeInfoStore.error && (
                    <View style={styles.button}>
                        <Button
                            title={localeString('views.Wallet.Channels.open')}
                            icon={{
                                name: 'swap-horiz',
                                size: 25,
                                color: 'white'
                            }}
                            buttonStyle={{
                                backgroundColor: '#261339',
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

                            const channelTitle = PrivacyUtils.sensitiveValue(
                                displayName,
                                8
                            );

                            const data = new Identicon(
                                hash.sha1(channelTitle),
                                255
                            ).toString();

                            const localBalanceDisplay = PrivacyUtils.sensitiveValue(
                                getAmount(item.localBalance || 0),
                                7,
                                true
                            );
                            const remoteBalanceDisplay = PrivacyUtils.sensitiveValue(
                                getAmount(item.remoteBalance || 0),
                                7,
                                true
                            );

                            return (
                                <React.Fragment>
                                    <ListItem
                                        title={channelTitle}
                                        leftElement={ChannelIcon(
                                            `data:image/png;base64,${data}`
                                        )}
                                        subtitle={`${
                                            !item.isActive
                                                ? `${localeString(
                                                      'views.Wallet.Channels.inactive'
                                                  )} | `
                                                : ''
                                        }${
                                            item.private
                                                ? `${localeString(
                                                      'views.Wallet.Channels.private'
                                                  )} | `
                                                : ''
                                        }${localeString(
                                            'views.Wallet.Channels.local'
                                        )}: ${units &&
                                            localBalanceDisplay} | ${localeString(
                                            'views.Wallet.Channels.remote'
                                        )}: ${units && remoteBalanceDisplay}`}
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: themeColor(
                                                'background'
                                            )
                                        }}
                                        onPress={() =>
                                            navigation.navigate('Channel', {
                                                channel: item
                                            })
                                        }
                                        titleStyle={{
                                            color: themeColor('text')
                                        }}
                                        subtitleStyle={{
                                            color: themeColor('secondaryText')
                                        }}
                                    />
                                    <BalanceSlider
                                        localBalance={
                                            lurkerMode ? 50 : item.localBalance
                                        }
                                        remoteBalance={
                                            lurkerMode ? 50 : item.remoteBalance
                                        }
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
                        onRefresh={() => this.refresh()}
                    />
                ) : (
                    <Button
                        title={localeString('views.Wallet.Channels.noChannels')}
                        icon={{
                            name: 'error-outline',
                            size: 25,
                            color: themeColor('text')
                        }}
                        onPress={() => this.refresh()}
                        buttonStyle={{
                            backgroundColor: 'transparent',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: themeColor('text')
                        }}
                    />
                )}
            </ScrollView>
        );
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
