import * as React from 'react';
import { StyleSheet, View } from 'react-native';

import Svg, { G, Circle } from 'react-native-svg';
import { themeColor } from '../../utils/ThemeUtils';

import { Body } from '../text/Body';
import { Row } from '../layout/Row';
import { Spacer } from '../layout/Spacer';
import { Amount } from '../Amount';

const outboundYellow = themeColor('outbound');
const inboundYellow = themeColor('inbound');
const offlineGray = themeColor('secondaryText');

export function ChannelsDonut(props) {
    const { totalInbound, totalOutbound, totalOffline, radius } = props;

    const strokeWidth = 6;

    const halfCircle = radius + strokeWidth;
    const circumference = 2 * Math.PI * radius;
    const color = 'black';

    const total = totalInbound + totalOutbound + totalOffline;
    const outboundLength = (totalOutbound / total) * circumference;
    const inboundLength = (totalInbound / total) * circumference;
    const offlineLength = (totalOffline / total) * circumference;

    const height = radius * 2;

    return (
        <View style={{ width: height }}>
            <Svg
                height={height}
                width={height}
                viewBox={`0 0 ${halfCircle * 2} ${halfCircle * 2}`}
            >
                <G rotation="-90" origin={`${halfCircle}, ${halfCircle}`}>
                    {/* Outbound */}
                    <Circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        fill="transparent"
                        stroke={outboundYellow}
                        strokeWidth={strokeWidth}
                        strokeDashoffset={0}
                        strokeDasharray={`${outboundLength}, ${
                            circumference - outboundLength
                        }`}
                    />
                    {/* Inbound */}
                    <Circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        fill="transparent"
                        stroke={inboundYellow}
                        strokeWidth={strokeWidth}
                        strokeDashoffset={-outboundLength}
                        strokeDasharray={`${inboundLength}, ${
                            circumference - inboundLength
                        }`}
                    />
                    {/* Offline */}
                    <Circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        fill="transparent"
                        stroke={offlineGray}
                        strokeWidth={strokeWidth}
                        strokeDashoffset={-(outboundLength + inboundLength)}
                        strokeDasharray={`${offlineLength}, ${
                            circumference - offlineLength
                        }`}
                    />
                    {/* Hidden circle behind in case we're bad at math */}
                    <Circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinejoin="round"
                        strokeOpacity=".1"
                    />
                </G>
            </Svg>
        </View>
    );
}

function TotalRow({
    kind,
    amount,
    color
}: {
    kind: string;
    amount: number;
    color: string;
}) {
    return (
        <Row justify="space-between">
            <Row>
                <View
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 8,
                        backgroundColor: color
                    }}
                />
                <Spacer width={8} />
                {/* TODO: localize */}
                <Body secondary>Total {kind}</Body>
            </Row>
            <Amount sats={amount} sensitive />
        </Row>
    );
}

export function ChannelsHeader(props) {
    const { totalInbound, totalOutbound, totalOffline } = props;

    return (
        <View
            style={{
                ...styles.wrapper,
                backgroundColor: themeColor('background'),
                color: themeColor('text')
            }}
        >
            <TotalRow
                kind="outbound"
                amount={totalOutbound}
                color={outboundYellow}
            />
            <TotalRow
                kind="inbound"
                amount={totalInbound}
                color={inboundYellow}
            />
            <TotalRow
                kind="offline"
                amount={totalOffline}
                color={offlineGray}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16
    },
    wrapper: {
        display: 'flex',
        justifyContent: 'space-between',
        height: 100,
        padding: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        // TODO: this shadow stuff probably needs tweaking on iOS
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 0
        },
        shadowOpacity: 0.5,
        shadowRadius: 40,
        elevation: 15
    }
});
