import * as React from 'react';
import { StyleSheet, View } from 'react-native';

import { themeColor } from '../../utils/ThemeUtils';

import Svg, { G, Circle } from 'react-native-svg';
import { Body } from '../../components/text/Body';
import { Row } from '../../components/layout/Row';
import { Spacer } from '../../components/layout/Spacer';

const outboundYellow = themeColor('outbound');
const inboundYellow = themeColor('inbound');
const offlineGray = themeColor('secondaryText');

function Donut({ radius = 42, strokeWidth = 6 }) {
    const halfCircle = radius + strokeWidth;
    const circumference = 2 * Math.PI * radius;
    const color = 'black';

    const outbound = 75;
    const inbound = 79;
    const offline = 18;
    const total = outbound + inbound + offline;
    const outboundLength = (outbound / total) * circumference;
    const inboundLength = (inbound / total) * circumference;
    const offlineLength = (offline / total) * circumference;

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

function Dot({ radius = 4, color = 'pink' }) {
    return (
        <View style={{ width: radius * 2, height: radius * 2 }}>
            <Svg
                height={radius * 2}
                width={radius * 2}
                viewBox={`0 0 ${radius * 2} ${radius * 2}`}
            >
                <G origin={`${radius}, ${radius}`}>
                    <Circle cx="50%" cy="50%" r={radius} fill={color} />
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
    amount: string;
    color: string;
}) {
    return (
        <Row justify="space-between" style={{ paddingTop: 4 }}>
            <Row>
                <Dot color={color} />
                <Spacer width={8} />
                <Body secondary>Total {kind}</Body>
            </Row>
            <Row align="flex-end">
                <Body>{amount}</Body>
                <Spacer width={2} />
                <View style={{ paddingBottom: 1.5 }}>
                    <Body secondary small>
                        sats
                    </Body>
                </View>
            </Row>
        </Row>
    );
}

export function ChannelsHeader() {
    return (
        <View style={styles.wrapper}>
            <View style={styles.donut}>
                <Donut />
            </View>
            <View>
                <TotalRow
                    kind="outbound"
                    amount={'74,000'}
                    color={outboundYellow}
                />
                <TotalRow
                    kind="inbound"
                    amount={'79,000'}
                    color={inboundYellow}
                />
                <TotalRow
                    kind="offline"
                    amount={'18,000'}
                    color={offlineGray}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
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
        paddingBottom: 16,
        paddingLeft: 16,
        paddingRight: 16,
        backgroundColor: themeColor('background'),
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        color: themeColor('text'),
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
