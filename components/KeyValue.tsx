import * as React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';

import { Body } from './text/Body';
import { Row } from './layout/Row';

import { themeColor } from '../utils/ThemeUtils';
import PrivacyUtils from '../utils/PrivacyUtils';
import SettingsStore from '../stores/SettingsStore';

interface KeyValueProps {
    keyValue: string;
    value?: any;
    color?: string;
    sensitive?: boolean;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class KeyValue extends React.Component<KeyValueProps, {}> {
    render() {
        const { keyValue, value, color, sensitive, SettingsStore } = this.props;

        const { lurkerMode } = SettingsStore?.settings?.privacy;

        {
            /* TODO: rig up RTL */
        }
        const isCopyable =
            typeof value === 'string' || typeof value === 'number';
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
            !!lurkerMode && isCopyable ? (
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
}

const styles = StyleSheet.create({
    key: {
        paddingRight: 35,
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
