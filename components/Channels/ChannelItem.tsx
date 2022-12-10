import * as React from 'react';
import { View } from 'react-native';

import { Body } from '../../components/text/Body';
import { BalanceBar } from '../../components/Channels/BalanceBar';
import { Row } from '../../components/layout/Row';
import { Status } from '../../views/Channels/ChannelsPane';
import Amount from '../Amount';
import { Tag } from './Tag';
import { themeColor } from './../../utils/ThemeUtils';

export function ChannelItem({
    title,
    inbound,
    outbound,
    largestTotal,
    status
}: {
    title: string;
    inbound: number;
    outbound: number;
    largestTotal?: number;
    status: Status;
}) {
    const percentOfLargest = largestTotal
        ? (Number(inbound) + Number(outbound)) / largestTotal
        : 1.0;
    return (
        <View
            style={{
                padding: 16,
                height: 110,
                justifyContent: 'space-around',
                borderBottomColor: themeColor('secondary'),
                borderBottomWidth: 1
            }}
        >
            <Row justify="space-between">
                <View style={{ flex: 1, paddingRight: 10 }}>
                    <Body>{title}</Body>
                </View>
                <Tag status={status} />
            </Row>
            <Row>
                <BalanceBar
                    left={Number(outbound)}
                    right={Number(inbound)}
                    offline={status === Status.Offline}
                    percentOfLargest={percentOfLargest}
                    showProportionally={true}
                />
            </Row>
            <Row justify="space-between">
                <Amount sats={outbound} sensitive />
                <Amount sats={inbound} sensitive />
            </Row>
        </View>
    );
}
