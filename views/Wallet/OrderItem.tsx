import * as React from 'react';
import { Text, View } from 'react-native';

import { Body } from '../../components/text/Body';
import { Row } from '../../components/layout/Row';
// import { Status } from '../../views/Channels/ChannelsPane';
// import Amount from '../../components/Amount';
import { themeColor } from './../../utils/ThemeUtils';

export default function OrderItem({
    title,
    date,
    money
}: {
    title: string;
    date: string;
    money: string;
}) {
    return (
        <View
            style={{
                padding: 16,
                minHeight: 80,
                justifyContent: 'space-around',
                borderBottomColor: themeColor('secondary'),
                borderBottomWidth: 1
            }}
        >
            <Row justify="space-between">
                <Text style={{ color: themeColor('text') }}>{date}</Text>
                <Text style={{ color: themeColor('text') }}>{money}</Text>
            </Row>
            <Row justify="space-between">
                <View style={{ flex: 1, paddingRight: 10 }}>
                    <Body>{title}</Body>
                </View>
            </Row>
        </View>
    );
}
