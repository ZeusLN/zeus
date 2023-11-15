import * as React from 'react';
import { Dimensions, Platform, StyleSheet, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import HCESession, { NFCContentType, NFCTagType4 } from 'react-native-hce';

import Button from './../components/Button';
import CopyButton from './CopyButton';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';
import Touchable from './Touchable';
import { TouchableOpacity } from 'react-native-gesture-handler';

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
            <Text style={styles.value} numberOfLines={state.numberOfValueLines}>
                {value}
            </Text>
        </Touchable>
    ) : (
        <Text style={styles.value}>{value}</Text>
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
    displayWhiteBackground: boolean;
}

export default class CollapsedQR extends React.Component<
    CollapsedQRProps,
    CollapsedQRState
> {
    state = {
        collapsed: this.props.expanded ? false : true,
        nfcBroadcast: false,
        displayWhiteBackground: false
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

    render() {
        const { collapsed, nfcBroadcast, displayWhiteBackground } = this.state;
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
                            backgroundColor: displayWhiteBackground
                                ? 'white'
                                : themeColor('qr') || 'white'
                        }}
                        onPress={() =>
                            this.setState({
                                displayWhiteBackground: true
                            })
                        }
                    >
                        <QRCode
                            value={value}
                            size={height > width ? width * 0.8 : height * 0.6}
                            logo={logo || defaultLogo}
                            backgroundColor={
                                displayWhiteBackground
                                    ? 'white'
                                    : themeColor('qr') || 'white'
                            }
                            logoBackgroundColor={
                                displayWhiteBackground
                                    ? 'white'
                                    : themeColor('qr') || 'white'
                            }
                            logoMargin={10}
                            quietZone={4}
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
        color: themeColor('secondaryText'),
        fontFamily: 'PPNeueMontreal-Book'
    },
    qrPadding: {
        alignItems: 'center',
        alignSelf: 'center',
        padding: 5,
        margin: 10
    }
});
