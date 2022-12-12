import * as React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import { Body } from './text/Body';
import { Row } from './layout/Row';

import { themeColor } from './../utils/ThemeUtils';
import PrivacyUtils from './../utils/PrivacyUtils';

export default function KeyValue({
    keyValue,
    value,
    color,
    sensitive
}: {
    keyValue: string;
    value?: any;
    color?: string;
    sensitive?: boolean;
}) {
    {
        /* TODO: rig up RTL */
    }
    const rtl = false;
    const Key = <Body>{keyValue}</Body>;
    const Value =
        typeof value === 'string' || typeof value === 'number' ? (
            <Text
                style={{
                    color: color || themeColor('secondaryText'),
                    fontFamily: 'Lato-Regular'
                }}
            >
                {sensitive ? PrivacyUtils.sensitiveValue(value) : value}
            </Text>
        ) : (
            value
        );

    const copyText = () => {
        Clipboard.setString(value);
        Vibration.vibrate(50);
    };

    return (
        <View style={{ paddingTop: 10, paddingBottom: 10 }}>
            <TouchableOpacity onLongPress={() => copyText()}>
                <Row justify="space-between">
                    <View style={rtl ? styles.rtlValue : styles.key}>
                        {rtl ? Value : Key}
                    </View>
                    <View style={rtl ? styles.rtlKey : styles.value}>
                        {rtl ? Key : Value}
                    </View>
                </Row>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    key: {
        paddingRight: 40,
        maxWidth: '50%'
    },
    value: {
        flex: 1,
        flexWrap: 'wrap',
        flexDirection: 'row',
        justifyContent: 'flex-end'
    },
    rtlKey: {
        alignSelf: 'flex-end',
        flex: 1,
        flexWrap: 'wrap',
        flexDirection: 'row',
        justifyContent: 'flex-end'
    },
    rtlValue: {
        paddingRight: 10,
        maxWidth: '50%'
    }
});
