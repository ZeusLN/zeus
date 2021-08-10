import * as React from 'react';
import { StyleSheet, View } from 'react-native';

import { themeColor } from '../../utils/ThemeUtils';

import Svg, { G, Circle } from 'react-native-svg';
import { Body } from '../text/Body';
import { Row } from '../layout/Row';
import { Spacer } from '../layout/Spacer';
import { Sats } from '../Sats';

const outboundYellow = themeColor('outbound');
const inboundYellow = themeColor('inbound');
const offlineGray = themeColor('secondaryText');

function Donut(props) {
    const radius = 42,
        strokeWidth = 6;
    const { totalInbound, totalOutbound, totalOffline } = props;
    const halfCircle = radius + strokeWidth;
    const circumference = 2 * Math.PI * radius;
    const color = 'black';

    const total = totalInbound + totalOutbound + totalOffline;
    const outboundLength = (totalOutbound / total) * circumference;
    const inboundLength = (totalInbound / total) * circumference;
    const offlineLength = (totalOffline / total) * circumference;

    return (
        <View style={{ width: radius * 2, height: radius * 2 }}>
            <Svg
                height={radius * 2}
                width={radius * 2}
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
                        strokeDasharray={`${outboundLength}, ${circumference -
                            outboundLength}`}
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
                        strokeDasharray={`${inboundLength}, ${circumference -
                            inboundLength}`}
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
                        strokeDasharray={`${offlineLength}, ${circumference -
                            offlineLength}`}
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
            <Sats sats={amount} />
        </Row>
    );
}

export function ChannelsHeader(props) {
    const { totalInbound, totalOutbound, totalOffline } = props;
    return (
        <View style={styles.wrapper}>
            <View style={styles.donut}>
                <Donut
                    totalInbound={totalInbound}
                    totalOutbound={totalOutbound}
                    totalOffline={totalOffline}
                />
            </View>
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
    donut: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 8
    },
    wrapper: {
        display: 'flex',
        justifyContent: 'space-between',
        height: 200,
        paddingBottom: 16,
        paddingLeft: 16,
        paddingRight: 16,
        backgroundColor: themeColor('background'),
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        color: themeColor('text'),
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
