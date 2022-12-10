import * as React from 'react';
import { Text, View } from 'react-native';

import { Body } from '../../components/text/Body';
import { Row } from '../../components/layout/Row';
import Amount from '../../components/Amount';
import { themeColor } from './../../utils/ThemeUtils';

export function RoutingListItem({
    title,
    fee,
    amountOut,
    date
}: {
    title: string;
    fee: number;
    amountOut: number;
    date: string;
}) {
    return (
        <View
            style={{
                padding: 10,
                height: 90,
                justifyContent: 'space-around',
                borderBottomColor: themeColor('secondary'),
                borderBottomWidth: 1
            }}
        >
            <Row justify="space-between">
                <View style={{ flex: 1, paddingRight: 10 }}>
                    <Body>{title}</Body>
                </View>
                <Amount sats={fee} credit sensitive />
            </Row>
            <Row justify="space-between">
                <Text style={{ color: themeColor('text') }}>{date}</Text>
                <Amount sats={amountOut} sensitive />
            </Row>
        </View>
    );
}
