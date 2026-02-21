import * as React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Feather from '@react-native-vector-icons/feather';

import { Row } from '../layout/Row';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { getFormattedAmount } from '../../utils/AmountUtils';

import Peer from '../../models/Peer';
import Text from '../Text';

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
    const satsSent = peer.sats_sent;
    const satsRecv = peer.sats_recv;
    const pingDisplay =
        peer.ping_time != null && peer.ping_time >= 0
            ? `${(peer.ping_time / 1000).toFixed(2)} ms`
            : 'N/A';

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

                {peer.address && (
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
                    <View style={styles.statRow}>
                        <Text
                            style={{
                                ...styles.statLabel,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('views.ChannelsPane.pingTime')}
                        </Text>
                        <View style={styles.statValueWrap}>
                            <Text
                                style={{
                                    ...styles.statValue,
                                    color: themeColor('text')
                                }}
                            >
                                {pingDisplay}
                            </Text>
                        </View>
                    </View>
                    {satsSent != null && (
                        <View style={styles.statRow}>
                            <Text
                                style={{
                                    ...styles.statLabel,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.ChannelsPane.satsSent')}
                            </Text>
                            <View style={styles.statValueWrap}>
                                <Text
                                    style={{
                                        ...styles.statValue,
                                        color: themeColor('text')
                                    }}
                                >
                                    {getFormattedAmount(satsSent, 'sats')}
                                </Text>
                            </View>
                        </View>
                    )}
                    {satsRecv != null && (
                        <View style={styles.statRow}>
                            <Text
                                style={{
                                    ...styles.statLabel,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.ChannelsPane.satsRecv')}
                            </Text>
                            <View style={styles.statValueWrap}>
                                <Text
                                    style={{
                                        ...styles.statValue,
                                        color: themeColor('text')
                                    }}
                                >
                                    {getFormattedAmount(satsRecv, 'sats')}
                                </Text>
                            </View>
                        </View>
                    )}
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
        marginTop: 6,
        gap: 2
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 20
    },
    statLabel: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        flexShrink: 0,
        marginRight: 12
    },
    statValueWrap: {
        flex: 1,
        alignItems: 'flex-end',
        minWidth: 0
    },
    statValue: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        textAlign: 'right'
    },
    disconnectButton: {
        padding: 4,
        alignSelf: 'flex-start'
    }
});
