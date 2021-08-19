import * as React from 'react';
import { Text, View } from 'react-native';
import { themeColor } from './../../utils/ThemeUtils';

import { Body } from '../../components/text/Body';
import { Row } from '../../components/layout/Row';
import { Sats } from '../../components/Sats';

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
                    {/* TODO replace with different component and style properly */}
                    <Text
                        style={{
                            color: 'lightgreen',
                            alignSelf: 'flex-end',
                            bottom: 20,
                            marginBottom: -40
                        }}
                    >{`${fee} sat`}</Text>
                </View>
            </Row>
            <Row justify="space-between">
                <Text style={{ color: themeColor('text') }}>{date}</Text>
                <Sats sats={amountOut} />
            </Row>
        </View>
    );
}
