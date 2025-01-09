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

import QRCode, { QRCodeProps } from 'react-native-qrcode-svg';
import HCESession, { NFCContentType, NFCTagType4 } from 'react-native-hce';

import Amount from './Amount';
import Button from './Button';
import CopyButton from './CopyButton';
import ShareButton from './ShareButton';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';
import Touchable from './Touchable';
import Conversion from './Conversion';

const defaultLogo = require('../assets/images/icon-black.png');
const defaultLogoWhite = require('../assets/images/icon-white.png');

let simulation: any;

type QRCodeElement = React.ElementRef<typeof QRCode>;

interface ExtendedQRCodeProps
    extends QRCodeProps,
        React.RefAttributes<QRCodeElement> {
    onLoad?: () => void;
    parent?: CollapsedQR;
}

interface ValueTextProps {
    value: string;
    truncateLongValue?: boolean;
}

// Custom QR code component that forwards refs and handles component readiness
// Sets qrReady state on first valid component mount to prevent remounting cycles
const ForwardedQRCode = React.forwardRef<QRCodeElement, ExtendedQRCodeProps>(
    (props, ref) => (
        <QRCode
            {...props}
            getRef={(c) => {
                if (c && c.toDataURL && !(ref as any).current) {
                    (ref as any).current = c;
                    props.parent?.setState({ qrReady: true });
                }
            }}
        />
    )
) as React.FC<ExtendedQRCodeProps>;

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
    copyIconContainerStyle?: any;
    showShare?: boolean;
    iconOnly?: boolean;
    hideText?: boolean;
    expanded?: boolean;
    textBottom?: boolean;
    truncateLongValue?: boolean;
    logo?: any;
    nfcSupported?: boolean;
    satAmount?: string | number;
    displayAmount?: boolean;
}

interface CollapsedQRState {
    collapsed: boolean;
    nfcBroadcast: boolean;
    enlargeQR: boolean;
    tempQRRef: React.RefObject<QRCodeElement> | null;
    qrReady: boolean;
}

export default class CollapsedQR extends React.Component<
    CollapsedQRProps,
    CollapsedQRState
> {
    qrRef = React.createRef<QRCodeElement>();

    state = {
        collapsed: this.props.expanded ? false : true,
        nfcBroadcast: false,
        enlargeQR: false,
        tempQRRef: null,
        qrReady: false
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
        const { collapsed, nfcBroadcast, enlargeQR, tempQRRef } = this.state;
        const {
            value,
            showText,
            copyText,
            copyValue,
            collapseText,
            copyIconContainerStyle,
            showShare,
            iconOnly,
            hideText,
            expanded,
            textBottom,
            truncateLongValue,
            logo,
            satAmount
        } = this.props;

        const { width, height } = Dimensions.get('window');

        // Creates a temporary QR code for sharing and waits for component to be ready
        // Returns a promise that resolves when QR is fully rendered and ready to be captured
        const handleShare = () =>
            new Promise<void>((resolve) => {
                const tempRef = React.createRef<QRCodeElement>();
                this.setState({ tempQRRef: tempRef, qrReady: false }, () => {
                    const checkReady = () => {
                        if (this.state.qrReady) {
                            resolve();
                        } else {
                            requestAnimationFrame(checkReady);
                        }
                    };
                    checkReady();
                });
            });

        return (
            <React.Fragment>
                {/* Temporary QR for sharing */}
                {tempQRRef && (
                    <View style={{ height: 0, width: 0, overflow: 'hidden' }}>
                        <ForwardedQRCode
                            ref={tempQRRef}
                            value={value}
                            size={800}
                            logo={defaultLogo}
                            backgroundColor={'white'}
                            logoBackgroundColor={'white'}
                            logoMargin={10}
                            quietZone={40}
                            parent={this}
                        />
                    </View>
                )}

                {satAmount != null && this.props.displayAmount && (
                    <View
                        style={{
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}
                    >
                        <Amount sats={satAmount} toggleable></Amount>
                        <View>
                            <Conversion sats={satAmount} sensitive />
                        </View>
                    </View>
                )}
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
                                                logo={
                                                    logo
                                                        ? logo
                                                        : themeColor(
                                                              'invertQrIcons'
                                                          )
                                                        ? defaultLogoWhite
                                                        : defaultLogo
                                                }
                                                backgroundColor={'white'}
                                                logoBackgroundColor={
                                                    themeColor('invertQrIcons')
                                                        ? 'black'
                                                        : 'white'
                                                }
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
                            logo={
                                logo
                                    ? logo
                                    : themeColor('invertQrIcons')
                                    ? defaultLogoWhite
                                    : defaultLogo
                            }
                            color={themeColor('qr') || 'black'}
                            backgroundColor={
                                themeColor('qrBackground') || 'white'
                            }
                            logoBackgroundColor={
                                themeColor('qrLogoBackground') || 'white'
                            }
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
                {showShare ? (
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'center'
                        }}
                    >
                        <CopyButton
                            copyIconContainerStyle={copyIconContainerStyle}
                            copyValue={copyValue || value}
                            title={copyText}
                            iconOnly={iconOnly}
                        />
                        <ShareButton
                            value={copyValue || value}
                            qrRef={tempQRRef}
                            iconOnly={iconOnly}
                            onPress={handleShare}
                            onShareComplete={() =>
                                this.setState({ tempQRRef: null })
                            }
                        />
                    </View>
                ) : (
                    <CopyButton
                        copyValue={copyValue || value}
                        title={copyText}
                        iconOnly={iconOnly}
                    />
                )}
                {Platform.OS === 'android' && this.props.nfcSupported && (
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
