import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Tag } from '../Channels/Tag';
import { Status } from '../../models/Status';

import { localeString } from '../../utils/LocaleUtils';

import AddIcon from '../../assets/images/SVG/Add.svg';
import SearchIcon from '../../assets/images/SVG/Search.svg';

import {
    PreviewTabBar,
    PreviewWalletHeader,
    SatAmount,
    ThemeColor
} from './parts';

const CHANNELS = [
    { alias: 'alice', outbound: 3_900_000, inbound: 5_896_530 },
    { alias: 'bob', outbound: 6_416_530, inbound: 1_420_000 },
    { alias: 'carol', outbound: 3_140_000, inbound: 2_736_530 },
    { alias: 'dave', outbound: 4_946_530, inbound: 0 }
];

const LARGEST = Math.max(...CHANNELS.map((c) => c.outbound + c.inbound));

const formatSats = (sats: number) =>
    sats.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// Mirrors views/Channels/ChannelsPane.tsx, components/Channels and the
// Channels / Peers toggle in components/WalletHeader.tsx
export default function ChannelsPreview({ color }: { color: ThemeColor }) {
    const totals = [
        { key: 'outbound', dot: color('outbound'), sats: '18,403,060' },
        { key: 'inbound', dot: color('inbound'), sats: '10,053,060' },
        { key: 'offline', dot: color('secondaryText'), sats: '0' }
    ];

    return (
        <View style={styles.container}>
            <PreviewWalletHeader
                color={color}
                right={
                    <View style={styles.headerIcons}>
                        <SearchIcon
                            fill={color('text')}
                            width="30"
                            height="30"
                            style={styles.searchIcon}
                        />
                        <AddIcon fill={color('text')} width="30" height="30" />
                    </View>
                }
            />
            <View
                style={[styles.toggle, { backgroundColor: color('secondary') }]}
            >
                <View
                    style={[
                        styles.toggleThumb,
                        { backgroundColor: color('text') }
                    ]}
                >
                    <Text
                        style={[
                            styles.toggleActiveText,
                            { color: color('background') }
                        ]}
                    >
                        {`${localeString('views.Wallet.Wallet.channels')} (${
                            CHANNELS.length
                        })`}
                    </Text>
                </View>
                <View style={styles.toggleOption}>
                    <Text
                        style={[
                            styles.toggleText,
                            { color: color('secondaryText') }
                        ]}
                    >
                        {`${localeString('general.peers')} (3)`}
                    </Text>
                </View>
            </View>
            <View style={styles.totals}>
                {totals.map((total) => (
                    <View key={total.key} style={styles.totalRow}>
                        <View style={styles.totalLabel}>
                            <View
                                style={[
                                    styles.dot,
                                    { backgroundColor: total.dot }
                                ]}
                            />
                            <Text
                                style={[
                                    styles.body,
                                    { color: color('secondaryText') }
                                ]}
                                numberOfLines={1}
                            >
                                {localeString(
                                    `views.Channel.Total.${total.key}`
                                )}
                            </Text>
                        </View>
                        <SatAmount
                            sats={total.sats}
                            color={color('text')}
                            unitColor={color('secondaryText')}
                        />
                    </View>
                ))}
            </View>
            {CHANNELS.map((channel) => {
                const capacity = channel.outbound + channel.inbound;
                return (
                    <View
                        key={channel.alias}
                        style={[
                            styles.channel,
                            { borderBottomColor: color('secondary') }
                        ]}
                    >
                        <View style={styles.channelTitle}>
                            <Text
                                style={[styles.body, { color: color('text') }]}
                            >
                                {channel.alias}
                            </Text>
                            <Tag status={Status.Online} />
                        </View>
                        <View style={styles.barRow}>
                            <View
                                style={[
                                    styles.bar,
                                    { flex: capacity / LARGEST }
                                ]}
                            >
                                <View
                                    style={[
                                        styles.barSegment,
                                        {
                                            flex: channel.outbound,
                                            backgroundColor: color('outbound')
                                        }
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.barSegment,
                                        {
                                            flex: channel.inbound,
                                            backgroundColor: color('inbound')
                                        }
                                    ]}
                                />
                            </View>
                            <View style={{ flex: 1 - capacity / LARGEST }} />
                        </View>
                        <View style={styles.channelAmounts}>
                            <SatAmount
                                sats={formatSats(channel.outbound)}
                                color={color('text')}
                                unitColor={color('secondaryText')}
                            />
                            <SatAmount
                                sats={formatSats(channel.inbound)}
                                color={color('text')}
                                unitColor={color('secondaryText')}
                            />
                        </View>
                    </View>
                );
            })}
            <View
                style={[
                    styles.channelTabs,
                    {
                        backgroundColor: color('background'),
                        borderTopColor: color('secondaryText')
                    }
                ]}
            >
                {[
                    `${localeString('views.Wallet.Wallet.open')} (${
                        CHANNELS.length
                    })`,
                    `${localeString('views.Wallet.Wallet.pending')} (0)`,
                    `${localeString('views.Wallet.Wallet.closed')} (0)`
                ].map((label, index) => (
                    <Text
                        key={label}
                        style={[
                            styles.channelTab,
                            { color: index === 0 ? color('text') : 'gray' }
                        ]}
                    >
                        {label}
                    </Text>
                ))}
            </View>
            <PreviewTabBar color={color} active="channels" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    headerIcons: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    searchIcon: {
        marginRight: 15
    },
    toggle: {
        flexDirection: 'row',
        marginHorizontal: 15,
        marginTop: 10,
        height: 40,
        borderRadius: 8,
        padding: 2
    },
    toggleThumb: {
        flex: 1,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    toggleOption: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    toggleText: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book'
    },
    toggleActiveText: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Medium'
    },
    totals: {
        height: 100,
        padding: 16,
        justifyContent: 'space-between'
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    totalLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 8,
        marginRight: 8
    },
    body: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book'
    },
    channel: {
        padding: 16,
        borderBottomWidth: 1
    },
    channelTitle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    barRow: {
        flexDirection: 'row',
        marginVertical: 15
    },
    bar: {
        flexDirection: 'row'
    },
    barSegment: {
        height: 8,
        marginRight: 1
    },
    channelAmounts: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    channelTabs: {
        position: 'absolute',
        bottom: 55,
        left: 0,
        right: 0,
        height: 60,
        borderTopWidth: 0.2,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center'
    },
    channelTab: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book'
    }
});
