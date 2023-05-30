import * as React from 'react';
import { StyleSheet, View } from 'react-native';

import { themeColor } from '../../utils/ThemeUtils';

import { Body } from '../text/Body';
import { Row } from '../layout/Row';
import { Spacer } from '../layout/Spacer';
import Amount from '../Amount';
import { localeString } from '../../utils/LocaleUtils';

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
                <Body secondary>
                    {localeString('views.Channel.Total.' + kind)}
                </Body>
            </Row>
            <Amount sats={amount} sensitive toggleable />
        </Row>
    );
}

export function ChannelsHeader(props) {
    const { totalInbound, totalOutbound, totalOffline } = props;

    return (
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
    );
}

const styles = StyleSheet.create({
    wrapper: {
        display: 'flex',
        justifyContent: 'space-between',
        height: 100,
        padding: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20
    }
});
