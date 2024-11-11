import React from 'react';
import { View } from 'react-native';
import { Row } from '../layout/Row';
import { themeColor } from '../../utils/ThemeUtils';

export function BalanceBar({
    outbound,
    inbound,
    outboundReserve = 0,
    inboundReserve = 0,
    offline,
    percentOfLargest,
    showProportionally = true
}: {
    outbound: number;
    inbound: number;
    outboundReserve: number;
    inboundReserve: number;
    offline: boolean;
    // How big is this channel relative to the largest channel
    // A float from 0.0 -> 1.0, 1 being the largest channel
    percentOfLargest: number;
    showProportionally: boolean;
}) {
    const total = outboundReserve + outbound + inbound + inboundReserve;

    // If we're supposed to show proportionally set the miniumum to 20% of the width
    // Otherwise take the full width
    const width = showProportionally ? Math.max(0.03, percentOfLargest) : 1.0;
    return (
        <Row flex={width}>
            <View
                style={{
                    height: 8,
                    flex: outboundReserve / total,
                    backgroundColor: themeColor('outboundReserve'),
                    marginRight: 1
                }}
            />
            <View
                style={{
                    height: 8,
                    flex: outbound / total,
                    backgroundColor: offline
                        ? '#E5E5E5'
                        : themeColor('outbound'),
                    marginRight: 1
                }}
            />
            <View
                style={{
                    height: 8,
                    flex: inbound / total,
                    backgroundColor: offline
                        ? '#A7A9AC'
                        : themeColor('inbound'),
                    marginRight: 1
                }}
            />
            <View
                style={{
                    height: 8,
                    flex: inboundReserve / total,
                    backgroundColor: themeColor('inboundReserve'),
                    marginRight: 1
                }}
            />
        </Row>
    );
}
