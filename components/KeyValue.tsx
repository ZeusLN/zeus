import * as React from 'react';
import {
    Animated,
    Pressable,
    StyleProp,
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View,
    ViewStyle
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';

import { Body } from './text/Body';
import { showCopiedToast } from './CopiedToast';
import { Row } from './layout/Row';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';
import PrivacyUtils from '../utils/PrivacyUtils';

import Copy from '../assets/images/SVG/Copy.svg';

import ModalStore from '../stores/ModalStore';
import SettingsStore from '../stores/SettingsStore';

interface KeyValueProps {
    keyValue: string;
    value?: any;
    color?: string;
    indicatorColor?: string;
    valueIndicatorColor?: string;
    sensitive?: boolean;
    infoModalText?: string | Array<string>;
    infoModalLink?: string;
    infoModalAdditionalButtons?: Array<{
        title: string;
        callback?: () => void;
    }>;
    mempoolLink?: () => void;
    disableCopy?: boolean;
    showCopyIcon?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
    ModalStore?: ModalStore;
    SettingsStore?: SettingsStore;
}

@inject('ModalStore', 'SettingsStore')
@observer
export default class KeyValue extends React.Component<KeyValueProps> {
    valueOpacity = new Animated.Value(1);

    copyText = () => {
        const { value } = this.props;
        Clipboard.setString(value.toString());
        Vibration.vibrate(50);
        showCopiedToast();
    };

    setValueOpacity = (toValue: number) => {
        Animated.timing(this.valueOpacity, {
            toValue,
            duration: toValue === 1 ? 150 : 50,
            useNativeDriver: true
        }).start();
    };

    render() {
        const {
            keyValue,
            value,
            color,
            indicatorColor,
            valueIndicatorColor,
            sensitive,
            infoModalText,
            infoModalLink,
            infoModalAdditionalButtons,
            mempoolLink,
            disableCopy,
            showCopyIcon,
            containerStyle,
            ModalStore,
            SettingsStore
        } = this.props;
        const { toggleInfoModal } = ModalStore!;

        const lurkerMode: boolean =
            SettingsStore?.settings?.privacy?.lurkerMode || false;

        {
            /* TODO: rig up RTL */
        }
        const isCopyable =
            !disableCopy &&
            !!showCopyIcon &&
            (typeof value === 'string' || typeof value === 'number');
        const rtl = false;
        const KeyBase = (
            <Body>
                {indicatorColor && (
                    <View
                        style={{
                            width: 12,
                            height: 12,
                            borderRadius: 12 / 2,
                            backgroundColor: indicatorColor
                        }}
                    ></View>
                )}
                <Text
                    style={{
                        color:
                            value !== undefined
                                ? themeColor('secondaryText')
                                : themeColor('text')
                    }}
                >
                    {indicatorColor ? `  ${keyValue}` : keyValue}
                </Text>
                {infoModalText && (
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
        if (infoModalText) {
            Key = (
                <TouchableOpacity
                    onPress={() =>
                        toggleInfoModal({
                            text: infoModalText,
                            link: infoModalLink,
                            buttons: infoModalAdditionalButtons
                        })
                    }
                >
                    {KeyBase}
                </TouchableOpacity>
            );
        } else {
            Key = KeyBase;
        }

        const ValueBase = (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {valueIndicatorColor && (
                    <View
                        style={{
                            width: 12,
                            height: 12,
                            borderRadius: 12 / 2,
                            backgroundColor: valueIndicatorColor,
                            marginRight: 8
                        }}
                    />
                )}
                <Text
                    style={{
                        color: color || themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book',
                        flexShrink: 1
                    }}
                >
                    {sensitive
                        ? PrivacyUtils.sensitiveValue({ input: value })
                        : value}
                </Text>
                {isCopyable && !lurkerMode && (
                    <Pressable
                        onPress={() => this.copyText()}
                        onPressIn={() => this.setValueOpacity(0.2)}
                        onPressOut={() => this.setValueOpacity(1)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={localeString(
                            'components.CopyButton.copy'
                        )}
                        style={{ marginLeft: 6 }}
                    >
                        {/* viewBox crops the whitespace baked into
                            Copy.svg so the icon's layout box matches
                            its visible artwork */}
                        <Copy
                            viewBox="6 4 12 16"
                            height={15}
                            width={11.25}
                            stroke={themeColor('secondaryText')}
                        />
                    </Pressable>
                )}
            </View>
        );

        let Value: any;
        if (!lurkerMode && (isCopyable || mempoolLink)) {
            Value = (
                <Pressable
                    onPress={mempoolLink ? mempoolLink : () => this.copyText()}
                    onLongPress={
                        mempoolLink && isCopyable
                            ? () => this.copyText()
                            : undefined
                    }
                    onPressIn={() => this.setValueOpacity(0.2)}
                    onPressOut={() => this.setValueOpacity(1)}
                >
                    <Animated.View style={{ opacity: this.valueOpacity }}>
                        {ValueBase}
                    </Animated.View>
                </Pressable>
            );
        } else {
            Value = typeof value === 'object' ? value : ValueBase;
        }

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
            <View
                style={[{ paddingTop: 10, paddingBottom: 10 }, containerStyle]}
            >
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
