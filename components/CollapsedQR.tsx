import * as React from 'react';
import type { TextLayoutEvent } from 'react-native';
import {
    Dimensions,
    Image,
    Platform,
    StyleSheet,
    Text,
    Modal,
    View,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import { observer } from 'mobx-react';
import { ButtonGroup } from '@rneui/themed';

import QRCode, { QRCodeProps } from 'react-native-qrcode-svg';

import QRSpeedMeterButton from './QRSpeedButton';
import Amount from './Amount';
import Button from './Button';
import CopyButton from './CopyButton';
import ShareButton from './ShareButton';
import NFCButton from './NFCButton';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';
import Touchable from './Touchable';
import Conversion from './Conversion';
import {
    getUnformattedAmount,
    shouldUseSatsSymbol
} from '../utils/AmountUtils';
import { QRAnimationSpeed } from '../utils/QRAnimationUtils';

import Turtle from '../assets/images/SVG/Turtle.svg';
import Rabbit from '../assets/images/SVG/Rabbit.svg';
import Gazelle from '../assets/images/SVG/Gazelle.svg';

const defaultLogo = require('../assets/images/icon_black.png');
const defaultLogoWhite = require('../assets/images/icon_white.png');

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
    valueStyle?: any;
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
                    Image.getSize(
                        Image.resolveAssetSource(defaultLogo).uri,
                        () => {
                            props.parent?.setState({ qrReady: true });
                        }
                    );
                }
            }}
        />
    )
) as React.FC<ExtendedQRCodeProps>;

const QR_AMOUNT_CARD_PADDING = 15;
const QR_AMOUNT_BASE_FONT_SIZE = 40;
const QR_AMOUNT_MIN_FONT_SIZE = 20;
// Approximate average glyph width (em ratio) for PPNeueMontreal-Medium across
// the digit-heavy strings rendered here. Calibrated to fit the worst case
// (`100,000,000 β`) within a 75%-of-screen-width card on the narrowest phones.
const QR_AMOUNT_CHAR_WIDTH_RATIO = 0.6;
// Locks the card height so toggling between units (which can shrink the
// amount fontSize) doesn't make the card jump vertically.
//   amount lineHeight at base size (~1.25×) + conversion line (~20) + padding
const QR_AMOUNT_CARD_MIN_HEIGHT =
    Math.round(QR_AMOUNT_BASE_FONT_SIZE * 1.25) +
    20 +
    QR_AMOUNT_CARD_PADDING * 2;

const QrAmountCard = observer(function QrAmountCard({
    satAmount,
    qrSize
}: {
    satAmount: string | number;
    qrSize: number;
}) {
    const availableWidth = qrSize - QR_AMOUNT_CARD_PADDING * 2;
    const useSatsSymbol = shouldUseSatsSymbol();
    const unformatted = getUnformattedAmount({ sats: satAmount });
    const numberLen = String(unformatted.amount ?? '').length;

    let suffixLen: number;
    switch (unformatted.unit) {
        case 'sats':
            // " β" or " sats" / " sat"
            suffixLen = useSatsSymbol ? 2 : unformatted.plural ? 5 : 4;
            break;
        case 'BTC':
            suffixLen = 1; // ₿
            break;
        case 'fiat':
        default:
            suffixLen =
                (unformatted.symbol?.length ?? 1) + (unformatted.space ? 1 : 0);
            break;
    }

    const totalLen = Math.max(1, numberLen + suffixLen);
    const naturalWidth =
        totalLen * QR_AMOUNT_BASE_FONT_SIZE * QR_AMOUNT_CHAR_WIDTH_RATIO;
    const fontSize =
        naturalWidth > availableWidth
            ? Math.max(
                  QR_AMOUNT_MIN_FONT_SIZE,
                  Math.floor(
                      availableWidth / (totalLen * QR_AMOUNT_CHAR_WIDTH_RATIO)
                  )
              )
            : QR_AMOUNT_BASE_FONT_SIZE;

    return (
        <View
            style={{
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                backgroundColor:
                    themeColor('buttonBackground') || themeColor('secondary'),
                width: qrSize,
                minHeight: QR_AMOUNT_CARD_MIN_HEIGHT,
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
                marginTop: -10,
                margin: 15,
                padding: QR_AMOUNT_CARD_PADDING
            }}
        >
            <Amount
                sats={satAmount}
                toggleable
                fontSize={fontSize}
                colorOverride={themeColor('buttonText')}
            />
            <View>
                <Conversion
                    sats={satAmount}
                    colorOverride={themeColor('buttonText')}
                />
            </View>
        </View>
    );
});

function ValueText({ value, truncateLongValue, valueStyle }: ValueTextProps) {
    const [state, setState] = React.useState<{
        numberOfValueLines: number | undefined;
    }>({ numberOfValueLines: truncateLongValue ? 3 : undefined });
    const [isSingleLine, setIsSingleLine] = React.useState(false);

    const computedStyle = {
        ...styles.value,
        ...valueStyle,
        color: themeColor('secondaryText'),
        textAlign: isSingleLine ? ('center' as const) : ('left' as const)
    };

    const onTextLayout = (e: TextLayoutEvent) =>
        setIsSingleLine(e.nativeEvent.lines.length === 1);

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
                style={computedStyle}
                numberOfLines={state.numberOfValueLines}
                onTextLayout={onTextLayout}
            >
                {value}
            </Text>
        </Touchable>
    ) : (
        <Text style={computedStyle} onTextLayout={onTextLayout}>
            {value}
        </Text>
    );
}

interface CollapsedQRProps {
    value: string;
    valueStyle?: any;
    showText?: string;
    collapseText?: string;
    copyText?: string;
    copyValue?: string;
    showSpeed?: boolean;
    hideText?: boolean;
    expanded?: boolean;
    textBottom?: boolean;
    truncateLongValue?: boolean;
    logo?: any;
    nfcSupported?: boolean;
    satAmount?: string | number;
    displayAmount?: boolean;
    labelBottom?: string;
    qrAnimationSpeed?: QRAnimationSpeed;
    onQRAnimationSpeedChange?: (speed: QRAnimationSpeed) => void;
    onShareGiftLink?: () => void;
}

interface CollapsedQRState {
    collapsed: boolean;
    enlargeQR: boolean;
    tempQRRef: React.RefObject<QRCodeElement | null> | null;
    qrReady: boolean;
    showSpeedOptions: boolean;
}

export default class CollapsedQR extends React.Component<
    CollapsedQRProps,
    CollapsedQRState
> {
    qrRef = React.createRef<QRCodeElement>();

    state = {
        collapsed: this.props.expanded ? false : true,
        enlargeQR: false,
        tempQRRef: null,
        qrReady: false,
        qrAnimationSpeed: this.props.qrAnimationSpeed,
        showSpeedOptions: false
    };

    toggleCollapse = () => {
        this.setState({
            collapsed: !this.state.collapsed
        });
    };

    handleQRCodeTap = () => {
        this.setState({ enlargeQR: !this.state.enlargeQR });
    };

    render() {
        const { collapsed, enlargeQR, tempQRRef, showSpeedOptions } =
            this.state;
        const {
            value,
            valueStyle,
            showText,
            copyText,
            copyValue,
            collapseText,
            hideText,
            expanded,
            textBottom,
            truncateLongValue,
            logo,
            satAmount,
            labelBottom,
            qrAnimationSpeed,
            onQRAnimationSpeedChange,
            showSpeed,
            onShareGiftLink
        } = this.props;

        const { width, height } = Dimensions.get('window');
        const qrSize = height > width ? width * 0.75 : height * 0.6;

        const QR_ANIMATION_SPEED_OPTIONS = [
            {
                value: 'slow',
                icon: Turtle
            },
            {
                value: 'medium',
                icon: Rabbit
            },
            {
                value: 'fast',
                icon: Gazelle
            }
        ];
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

        const supportsNFC =
            Platform.OS === 'android' && this.props.nfcSupported;

        const qrSpeedSelectedIndex = QR_ANIMATION_SPEED_OPTIONS.findIndex(
            (option) => option.value === qrAnimationSpeed
        );

        return (
            <React.Fragment>
                {/* Temporary QR for sharing — positioned off-screen so Fabric
                    doesn't render the 800px source QR over the visible UI when
                    a zero-sized parent fails to clip its oversized child. */}
                {tempQRRef && (
                    <View
                        style={{
                            position: 'absolute',
                            left: -10000,
                            top: -10000,
                            width: 800,
                            height: 800
                        }}
                        pointerEvents="none"
                    >
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

                {!hideText && !textBottom && (
                    <ValueText
                        value={value}
                        truncateLongValue={truncateLongValue}
                        valueStyle={valueStyle}
                    />
                )}
                {!collapsed && value && (
                    <View>
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
                                                    ...StyleSheet.absoluteFill,
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
                                                        themeColor(
                                                            'invertQrIcons'
                                                        )
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
                                size={qrSize}
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
                        {satAmount != null &&
                            satAmount != 0 &&
                            this.props.displayAmount && (
                                <QrAmountCard
                                    satAmount={satAmount}
                                    qrSize={qrSize}
                                />
                            )}
                        {labelBottom && (
                            <View
                                style={[
                                    styles.labelBottomContainer,
                                    {
                                        backgroundColor:
                                            themeColor('buttonBackground') ||
                                            themeColor('secondary'),
                                        width: qrSize
                                    }
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.labelBottomText,
                                        { color: themeColor('buttonText') }
                                    ]}
                                >
                                    {labelBottom}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
                {!hideText && textBottom && (
                    <ValueText
                        value={value}
                        truncateLongValue={truncateLongValue}
                        valueStyle={valueStyle}
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
                <View style={[styles.actionRow, { gap: showSpeed ? 8 : 40 }]}>
                    {showSpeed && (
                        <QRSpeedMeterButton
                            showOptions={showSpeedOptions}
                            onPress={() =>
                                this.setState({
                                    showSpeedOptions: !showSpeedOptions
                                })
                            }
                            iconOnly
                        />
                    )}
                    <CopyButton
                        copyValue={copyValue || value}
                        title={copyText}
                        iconOnly
                    />
                    <ShareButton
                        value={copyValue || value}
                        qrRef={tempQRRef}
                        iconOnly
                        onPress={handleShare}
                        onShareComplete={() =>
                            this.setState({ tempQRRef: null })
                        }
                        onShareGiftLink={onShareGiftLink}
                    />
                    {supportsNFC && (
                        <NFCButton value={copyValue || value} iconOnly />
                    )}
                </View>
                {showSpeedOptions && onQRAnimationSpeedChange && showSpeed && (
                    <View style={styles.speedOptions}>
                        <ButtonGroup
                            onPress={(index: number) => {
                                const selectedOption =
                                    QR_ANIMATION_SPEED_OPTIONS[index];
                                onQRAnimationSpeedChange(
                                    selectedOption.value as QRAnimationSpeed
                                );
                            }}
                            selectedIndex={qrSpeedSelectedIndex}
                            buttons={QR_ANIMATION_SPEED_OPTIONS.map(
                                (option, index) =>
                                    React.createElement(option.icon, {
                                        width: 36,
                                        height: 36,
                                        fill:
                                            qrSpeedSelectedIndex === index
                                                ? themeColor('secondary')
                                                : themeColor('secondaryText')
                                    })
                            )}
                            selectedButtonStyle={{
                                backgroundColor: themeColor('highlight'),
                                borderRadius: 12,
                                ...(Platform.OS === 'ios' && {
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                })
                            }}
                            buttonStyle={{
                                ...(Platform.OS === 'ios' && {
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 8,
                                    paddingHorizontal: 4
                                })
                            }}
                            containerStyle={{
                                backgroundColor: themeColor('secondary'),
                                borderRadius: 12,
                                borderColor: themeColor('secondary'),
                                minWidth: 240,
                                alignSelf: 'center',
                                ...(Platform.OS === 'ios' && {
                                    height: 48
                                })
                            }}
                            innerBorderStyle={{
                                color: themeColor('secondary')
                            }}
                        />
                    </View>
                )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    actionRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20
    },
    value: {
        marginBottom: 15,
        paddingHorizontal: 20,
        fontFamily: 'PPNeueMontreal-Book'
    },
    qrPadding: {
        alignItems: 'center',
        alignSelf: 'center',
        padding: 0,
        margin: 10
    },
    speedOptions: {
        marginTop: 10
    },
    labelBottomContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        marginTop: -10,
        margin: 15,
        paddingHorizontal: 15,
        paddingVertical: 18
    },
    labelBottomText: {
        fontFamily: 'PPNeueMontreal-Medium',
        fontSize: 20,
        textAlign: 'center'
    }
});
