import * as React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Feather from '@react-native-vector-icons/feather';

import { Row } from '../layout/Row';
import KeyValue from '../KeyValue';
import Text from '../Text';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { getFormattedAmount } from '../../utils/AmountUtils';

import Peer from '../../models/Peer';

interface PeerItemProps {
    peer: Peer;
    displayName: string;
    onPress: () => void;
    showDisconnect: boolean;
}

export function PeerItem({
    peer,
    displayName,
    onPress,
    showDisconnect
}: PeerItemProps) {
    const title = displayName === peer.pubkey ? peer.pubkey : displayName;
    const pingDisplay =
        peer.ping_time != null && peer.ping_time >= 0
            ? `${(peer.ping_time / 1000).toFixed(2)} ms`
            : 'N/A';

    const stats: Array<{ label: string; value: string | number }> = [];
    if (pingDisplay !== 'N/A') {
        stats.push({
            label: localeString('views.ChannelsPane.pingTime'),
            value: pingDisplay
        });
    }
    if (peer.sats_sent != null) {
        stats.push({
            label: localeString('views.ChannelsPane.satsSent'),
            value: getFormattedAmount(peer.sats_sent, 'sats') ?? ''
        });
    }
    if (peer.sats_recv != null) {
        stats.push({
            label: localeString('views.ChannelsPane.satsRecv'),
            value: getFormattedAmount(peer.sats_recv, 'sats') ?? ''
        });
    }
    if (peer.num_channels != null) {
        stats.push({
            label: localeString('views.NetworkInfo.numChannels'),
            value: peer.num_channels
        });
    }
    if (peer.bytesSent) {
        stats.push({
            label: localeString('views.ChannelsPane.bytesSent'),
            value: `${peer.bytesSent} B`
        });
    }
    if (peer.bytesRecv) {
        stats.push({
            label: localeString('views.ChannelsPane.bytesRecv'),
            value: `${peer.bytesRecv} B`
        });
    }
    if (peer.inbound !== undefined) {
        stats.push({
            label: localeString('views.Channel.inbound'),
            value: peer.inbound
                ? localeString('general.true')
                : localeString('general.false')
        });
    }
    if (peer.connected !== undefined) {
        stats.push({
            label: localeString('views.ChannelsPane.connected'),
            value: peer.connected
                ? localeString('general.true')
                : localeString('general.false')
        });
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={[
                styles.container,
                { backgroundColor: themeColor('secondary') }
            ]}
        >
            <View style={styles.content}>
                <Row justify="space-between" style={styles.header}>
                    <View style={styles.titleWrap}>
                        <Text
                            style={{
                                fontSize: 16,
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Medium'
                            }}
                        >
                            {title}
                        </Text>
                        {displayName !== peer.pubkey && (
                            <View style={styles.pubkey}>
                                <Text
                                    ellipsizeMode="middle"
                                    numberOfLines={1}
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {peer.pubkey}
                                </Text>
                            </View>
                        )}
                    </View>
                    {showDisconnect && (
                        <View style={styles.disconnectButton}>
                            <Feather
                                name="minus-circle"
                                size={22}
                                color={themeColor('error')}
                            />
                        </View>
                    )}
                </Row>

                {!!peer.address && (
                    <View style={styles.address}>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {peer.address}
                        </Text>
                    </View>
                )}

                <View style={styles.stats}>
                    {stats.map((stat) => (
                        <KeyValue
                            key={stat.label}
                            keyValue={stat.label}
                            value={stat.value}
                            disableCopy
                            containerStyle={styles.keyValue}
                        />
                    ))}
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        padding: 14,
        marginBottom: 8
    },
    content: {
        flex: 1
    },
    header: {
        alignItems: 'flex-start',
        marginBottom: 2
    },
    titleWrap: {
        flex: 1,
        marginRight: 12,
        minWidth: 0
    },
    pubkey: {
        marginTop: 1
    },
    address: {
        marginTop: 2,
        marginBottom: 6
    },
    stats: {
        marginTop: 6
    },
    keyValue: {
        paddingTop: 1,
        paddingBottom: 1
    },
    disconnectButton: {
        padding: 4,
        alignSelf: 'flex-start'
    }
});
