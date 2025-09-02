import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import Text from '../../components/Text';

import { themeColor } from '../../utils/ThemeUtils';

import { Body } from '../text/Body';
import { Row } from '../layout/Row';
import { Spacer } from '../layout/Spacer';
import Amount from '../Amount';
import { localeString } from '../../utils/LocaleUtils';

interface ChannelsHeaderProps {
    totalInbound: number;
    totalOutbound: number;
    totalOffline: number;
}

function Indicator({ color }: { color: string }) {
    return (
        <View
            style={{
                width: 8,
                height: 8,
                borderRadius: 8,
                backgroundColor: color
            }}
        />
    );
}

function TotalRow({
    kind,
    amount,
    color
}: {
    kind: string;
    amount: number | string;
    color: string;
}) {
    return (
        <Row justify="space-between">
            <Row>
                <Indicator color={color} />
                <Spacer width={8} />
                <Body secondary>
                    {localeString('views.Channel.Total.' + kind)}
                </Body>
            </Row>
            <Amount sats={amount} sensitive toggleable />
        </Row>
    );
}

function TotalRowCollapsed({
    label,
    amount,
    color
}: {
    label: string;
    amount: number | string;
    color: string;
}) {
    return (
        <View>
            <Row>
                <Indicator color={color} />
                <Spacer width={8} />
                <Text style={{ color: themeColor('secondaryText') }}>
                    {label}
                </Text>
            </Row>
            <Amount sats={amount} sensitive toggleable />
        </View>
    );
}

export function ChannelsHeader(props: ChannelsHeaderProps) {
    const { totalInbound, totalOutbound, totalOffline } = props;
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? (
                <View
                    style={{
                        ...styles.wrapper
                    }}
                >
                    <TotalRow
                        kind="outbound"
                        amount={totalOutbound.toFixed(3)}
                        color={themeColor('outbound')}
                    />
                    <TotalRow
                        kind="inbound"
                        amount={totalInbound.toFixed(3)}
                        color={themeColor('inbound')}
                    />
                    <TotalRow
                        kind="offline"
                        amount={totalOffline.toFixed(3)}
                        color={themeColor('secondaryText')}
                    />
                </View>
            ) : (
                <View
                    style={{
                        ...styles.wrapper,
                        flexDirection: 'row'
                    }}
                >
                    <TotalRowCollapsed
                        label={localeString('views.Channel.outboundCapacity')}
                        color={themeColor('outbound')}
                        amount={totalOutbound.toFixed(3)}
                    />
                    <TotalRowCollapsed
                        label={localeString('views.Channel.inboundCapacity')}
                        color={themeColor('inbound')}
                        amount={totalInbound.toFixed(3)}
                    />
                    <TotalRowCollapsed
                        label={localeString('channel.status.offline')}
                        color={themeColor('secondaryText')}
                        amount={totalOffline.toFixed(3)}
                    />
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20
    }
});
