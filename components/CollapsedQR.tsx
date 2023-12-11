import * as React from 'react';
import {
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    Modal,
    View,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import HCESession, { NFCContentType, NFCTagType4 } from 'react-native-hce';

import Button from './../components/Button';
import CopyButton from './CopyButton';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';
import Touchable from './Touchable';

const defaultLogo = require('../assets/images/icon-black.png');

let simulation: any;

interface ValueTextProps {
    value: string;
    truncateLongValue?: boolean;
}

function ValueText({ value, truncateLongValue }: ValueTextProps) {
    const [state, setState] = React.useState<{
        numberOfValueLines: number | undefined;
    }>({ numberOfValueLines: truncateLongValue ? 3 : undefined });
    return truncateLongValue ? (
        <Touchable
            touch={() =>
                setState({
                    numberOfValueLines: state.numberOfValueLines ? undefined : 3
                })
            }
            highlight={false}
        >
            <Text
                style={{ ...styles.value, color: themeColor('secondaryText') }}
                numberOfLines={state.numberOfValueLines}
            >
                {value}
            </Text>
        </Touchable>
    ) : (
        <Text style={{ ...styles.value, color: themeColor('secondaryText') }}>
            {value}
        </Text>
    );
}

interface CollapsedQRProps {
    value: string;
    showText?: string;
    collapseText?: string;
    copyText?: string;
    copyValue?: string;
    hideText?: boolean;
    expanded?: boolean;
    textBottom?: boolean;
    truncateLongValue?: boolean;
    logo?: any;
}

interface CollapsedQRState {
    collapsed: boolean;
    nfcBroadcast: boolean;
    enlargeQR: boolean;
}

export default class CollapsedQR extends React.Component<
    CollapsedQRProps,
    CollapsedQRState
> {
    state = {
        collapsed: this.props.expanded ? false : true,
        nfcBroadcast: false,
        enlargeQR: false
    };

    componentWillUnmount() {
        if (this.state.nfcBroadcast) {
            this.stopSimulation();
        }
    }

    UNSAFE_componentWillUpdate = () => {
        if (this.state.nfcBroadcast) {
            this.stopSimulation();
        }
    };

    toggleCollapse = () => {
        this.setState({
            collapsed: !this.state.collapsed
        });
    };

    toggleNfc = () => {
        if (this.state.nfcBroadcast) {
            this.stopSimulation();
        } else {
            this.startSimulation();
        }

        this.setState({
            nfcBroadcast: !this.state.nfcBroadcast
        });
    };

    startSimulation = async () => {
        const tag = new NFCTagType4(NFCContentType.Text, this.props.value);
        simulation = await new HCESession(tag).start();
    };

    stopSimulation = async () => {
        await simulation.terminate();
    };

    handleQRCodeTap = () => {
        this.setState({ enlargeQR: !this.state.enlargeQR });
    };

    render() {
        const { collapsed, nfcBroadcast, enlargeQR } = this.state;
        const {
            value,
            showText,
            copyText,
            copyValue,
            collapseText,
            hideText,
            expanded,
            textBottom,
            truncateLongValue,
            logo
        } = this.props;

        const { width, height } = Dimensions.get('window');

        return (
            <React.Fragment>
                {!hideText && !textBottom && (
                    <ValueText
                        value={value}
                        truncateLongValue={truncateLongValue}
                    />
                )}
                {!collapsed && value && (
                    <TouchableOpacity
                        style={{
                            ...styles.qrPadding,
                            backgroundColor: themeColor('qr') || 'white'
                        }}
                        onPress={() => this.handleQRCodeTap()}
                    >
                        {enlargeQR && (
                            <Modal
                                transparent={true}
                                animationType="fade"
                                visible={enlargeQR}
                            >
                                <TouchableWithoutFeedback
                                    onPress={() => this.handleQRCodeTap()}
                                >
                                    <View
                                        style={{
                                            flex: 1,
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <View
                                            style={{
                                                ...StyleSheet.absoluteFillObject,
                                                backgroundColor: 'black',
                                                opacity: 0.6
                                            }}
                                        />
                                        <View>
                                            <QRCode
                                                value={value}
                                                size={width}
                                                logo={logo || defaultLogo}
                                                backgroundColor={'white'}
                                                logoBackgroundColor={'white'}
                                                logoMargin={10}
                                                quietZone={width / 20}
                                            />
                                        </View>
                                    </View>
                                </TouchableWithoutFeedback>
                            </Modal>
                        )}
                        <QRCode
                            value={value}
                            size={height > width ? width * 0.75 : height * 0.6}
                            logo={logo || defaultLogo}
                            backgroundColor={themeColor('qr') || 'white'}
                            logoBackgroundColor={themeColor('qr') || 'white'}
                            logoMargin={10}
                            quietZone={width / 40}
                        />
                    </TouchableOpacity>
                )}
                {!hideText && textBottom && (
                    <ValueText
                        value={value}
                        truncateLongValue={truncateLongValue}
                    />
                )}
                {!expanded && (
                    <Button
                        title={
                            collapsed
                                ? showText ||
                                  localeString('components.CollapsedQr.show')
                                : collapseText ||
                                  localeString('components.CollapsedQr.hide')
                        }
                        icon={{
                            name: 'qrcode',
                            type: 'font-awesome',
                            size: 25
                        }}
                        containerStyle={{
                            margin: 10
                        }}
                        onPress={() => this.toggleCollapse()}
                    />
                )}
                <CopyButton copyValue={copyValue || value} title={copyText} />
                {Platform.OS === 'android' && (
                    <Button
                        title={
                            nfcBroadcast
                                ? localeString('components.CollapsedQr.stopNfc')
                                : localeString(
                                      'components.CollapsedQr.startNfc'
                                  )
                        }
                        containerStyle={{
                            margin: 20
                        }}
                        icon={{
                            name: 'nfc',
                            size: 25
                        }}
                        onPress={() => this.toggleNfc()}
                        tertiary
                    />
                )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    value: {
        marginBottom: 15,
        paddingLeft: 20,
        fontFamily: 'PPNeueMontreal-Book'
    },
    qrPadding: {
        alignItems: 'center',
        alignSelf: 'center',
        padding: 0,
        margin: 10
    }
});
