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
    const isCopyable = typeof value === 'string' || typeof value === 'number';
    const rtl = false;
    const Key = (
        <Body>
            <Text
                style={{
                    color:
                        value !== undefined
                            ? themeColor('secondaryText')
                            : themeColor('text')
                }}
            >
                {keyValue}
            </Text>
        </Body>
    );
    const Value = isCopyable ? (
        <Text
            style={{
                color: color || themeColor('text'),
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

    const KeyValueRow = () => (
        <Row justify="space-between">
            <View style={rtl ? styles.rtlValue : styles.key}>
                <Text style={{ color: themeColor('secondaryText') }}>
                    {rtl ? Value : Key}
                </Text>
            </View>
            <View style={rtl ? styles.rtlKey : styles.value}>
                {rtl ? Key : Value}
            </View>
        </Row>
    );

    const InteractiveKeyValueRow = () =>
        isCopyable ? (
            <TouchableOpacity onLongPress={() => copyText()}>
                <KeyValueRow />
            </TouchableOpacity>
        ) : (
            <KeyValueRow />
        );

    return (
        <View style={{ paddingTop: 10, paddingBottom: 10 }}>
            <InteractiveKeyValueRow />
        </View>
    );
}

const styles = StyleSheet.create({
    key: {
        paddingRight: 40,
        maxWidth: '52%'
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
