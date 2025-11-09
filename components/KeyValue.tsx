import * as React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View,
    Dimensions,
    Modal
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';
import { Icon } from 'react-native-elements';

import { Body } from './text/Body';
import { Row } from './layout/Row';

import { themeColor } from '../utils/ThemeUtils';
import PrivacyUtils from '../utils/PrivacyUtils';
import { localeString } from '../utils/LocaleUtils';

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
    ModalStore?: ModalStore;
    SettingsStore?: SettingsStore;
}

interface KeyValueState {
    showCopiedToast: boolean;
}

@inject('ModalStore', 'SettingsStore')
@observer
export default class KeyValue extends React.Component<
    KeyValueProps,
    KeyValueState
> {
    private toastTimeout: ReturnType<typeof setTimeout> | null = null;

    state = {
        showCopiedToast: false
    };

    copyText = () => {
        const { value } = this.props;
        Clipboard.setString(value.toString());
        Vibration.vibrate(50);
        this.setState({ showCopiedToast: true });
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(
            () => this.setState({ showCopiedToast: false }),
            2000
        );
    };

    componentWillUnmount() {
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
    }

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
                    {indicatorColor ? ` ${keyValue}` : keyValue}
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
                        fontFamily: 'PPNeueMontreal-Book'
                    }}
                >
                    {sensitive ? PrivacyUtils.sensitiveValue(value) : value}
                </Text>
            </View>
        );

        let Value: any;
        if (!lurkerMode && isCopyable) {
            Value = (
                <TouchableOpacity
                    onLongPress={() => this.copyText()}
                    onPress={mempoolLink}
                >
                    {ValueBase}
                </TouchableOpacity>
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
            <>
                <View style={{ paddingTop: 10, paddingBottom: 10 }}>
                    <KeyValueRow />
                </View>
                <Modal
                    transparent
                    visible={this.state.showCopiedToast}
                    animationType="fade"
                    onRequestClose={() => {}}
                >
                    <View style={styles.modalContainer}>
                        <View
                            style={[
                                styles.toast,
                                {
                                    backgroundColor: themeColor('text')
                                }
                            ]}
                        >
                            <Icon
                                name="check"
                                size={18}
                                color={themeColor('background')}
                                style={{ marginRight: 6 }}
                            />
                            <Text
                                style={[
                                    styles.toastText,
                                    {
                                        color: themeColor('background')
                                    }
                                ]}
                            >
                                {localeString('components.CopyButton.copied')}
                            </Text>
                        </View>
                    </View>
                </Modal>
            </>
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
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: Math.max(Dimensions.get('window').height * 0.15, 160)
    },
    toast: {
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 5
    },
    toastText: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14
    }
});
