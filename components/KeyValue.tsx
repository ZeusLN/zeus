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

import ModalStore from '../stores/ModalStore';
import SettingsStore from '../stores/SettingsStore';

interface KeyValueProps {
    keyValue: string;
    value?: any;
    color?: string;
    sensitive?: boolean;
    infoText?: string | Array<string>;
    infoLink?: string;
    infoNav?: string;
    mempoolLink?: () => void;
    disableCopy?: boolean;
    ModalStore?: ModalStore;
    SettingsStore?: SettingsStore;
}

@inject('ModalStore', 'SettingsStore')
@observer
export default class KeyValue extends React.Component<KeyValueProps, {}> {
    render() {
        const {
            keyValue,
            value,
            color,
            sensitive,
            infoText,
            infoLink,
            infoNav,
            mempoolLink,
            disableCopy,
            ModalStore,
            SettingsStore
        } = this.props;
        const { toggleInfoModal } = ModalStore!;

        const lurkerMode: boolean =
            SettingsStore?.settings?.privacy?.lurkerMode || false;

        {
            /* TODO: rig up RTL */
        }
        const isCopyable = disableCopy
            ? false
            : typeof value === 'string' || typeof value === 'number';
        const rtl = false;
        const KeyBase = (
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
                {infoText && (
                    <Text
                        style={{
                            color:
                                value !== undefined
                                    ? themeColor('secondaryText')
                                    : themeColor('text'),
                            fontWeight: 'bold'
                        }}
                    >
                        {'  ⓘ'}
                    </Text>
                )}
            </Body>
        );

        let Key: any;
        if (infoText) {
            Key = (
                <TouchableOpacity
                    onPress={() => toggleInfoModal(infoText, infoLink, infoNav)}
                >
                    {KeyBase}
                </TouchableOpacity>
            );
        } else {
            Key = KeyBase;
        }

        const ValueBase = (
            <Text
                style={{
                    color: color || themeColor('text'),
                    fontFamily: 'PPNeueMontreal-Book'
                }}
            >
                {sensitive ? PrivacyUtils.sensitiveValue(value) : value}
            </Text>
        );

        let Value: any;
        if (!lurkerMode && isCopyable) {
            Value = (
                <TouchableOpacity
                    onLongPress={() => copyText()}
                    onPress={mempoolLink}
                >
                    {ValueBase}
                </TouchableOpacity>
            );
        } else {
            Value = typeof value === 'object' ? value : ValueBase;
        }

        const copyText = () => {
            Clipboard.setString(value.toString());
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

        return (
            <View style={{ paddingTop: 10, paddingBottom: 10 }}>
                <KeyValueRow />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    key: {
        paddingRight: 35,
        maxWidth: '70%'
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
        paddingRight: 10
    }
});
