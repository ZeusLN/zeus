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

                <Row style={styles.stats}>
                    <View style={styles.statText}>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {`${localeString(
                                'views.ChannelsPane.pingTime'
                            )}: ${pingDisplay}`}
                        </Text>
                    </View>
                    {peer.sats_sent != null && (
                        <View style={styles.statText}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {`${localeString(
                                    'views.ChannelsPane.satsSent'
                                )}: ${getFormattedAmount(
                                    peer.sats_sent,
                                    'sats'
                                )}`}
                            </Text>
                        </View>
                    )}
                    {peer.sats_recv != null && (
                        <View style={styles.statText}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {`${localeString(
                                    'views.ChannelsPane.satsRecv'
                                )}: ${getFormattedAmount(
                                    peer.sats_recv,
                                    'sats'
                                )}`}
                            </Text>
                        </View>
                    )}
                </Row>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12
    },
    content: {
        flex: 1
    },
    header: {
        alignItems: 'flex-start',
        marginBottom: 4
    },
    titleWrap: {
        flex: 1,
        marginRight: 12,
        minWidth: 0
    },
    pubkey: {
        marginTop: 2
    },
    address: {
        marginTop: 4,
        marginBottom: 12
    },
    stats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8
    },
    statText: {
        marginRight: 20
    },
    disconnectButton: {
        padding: 4,
        alignSelf: 'flex-start'
    }
});
