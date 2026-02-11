import * as React from 'react';
import {
    Animated,
    Image,
    Modal,
    PanResponder,
    PanResponderInstance,
    ScrollView,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';

import Amount from './Amount';
import KeyValue from './KeyValue';
import { Row } from './layout/Row';

import { getFeePercentage } from '../utils/AmountUtils';

import Contact from '../models/Contact';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import { getPhoto } from '../utils/PhotoUtils';

import CaretRight from '../assets/images/SVG/Caret Right.svg';
import CaretUp from '../assets/images/SVG/Caret Up.svg';
import CloseSvg from '../assets/images/SVG/Close.svg';

interface PaymentDetailsSheetProps {
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    paymentAmount?: string | number;
    feeAmount?: string | number;
    paymentDuration?: number | null;
    contact?: Contact | null;
    lightningAddress?: string;
    paymentHash?: string;
    paymentPreimage?: string;
    enhancedPath?: any;
    navigation: any;
}

export default class PaymentDetailsSheet extends React.Component<PaymentDetailsSheetProps> {
    private pan: Animated.ValueXY;
    private panResponder: PanResponderInstance;

    constructor(props: PaymentDetailsSheetProps) {
        super(props);
        this.pan = new Animated.ValueXY();
        this.panResponder = PanResponder.create({
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: Animated.event(
                [null, { dx: this.pan.x, dy: this.pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: () => {
                Animated.spring(this.pan, {
                    toValue: { x: 0, y: 0 },
                    useNativeDriver: false
                }).start();
                props.onOpen();
            }
        });
    }

    renderContactRow = () => {
        const { contact, lightningAddress } = this.props;

        if (!contact && !lightningAddress) return null;

        const contactPhoto = contact?.photo ? getPhoto(contact.photo) : null;
        const displayName = contact?.name || lightningAddress;

        return (
            <KeyValue
                keyValue={localeString('views.Payment.recipient')}
                value={
                    <Row>
                        {contactPhoto ? (
                            <Image
                                source={{ uri: contactPhoto }}
                                style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 15,
                                    marginRight: 8
                                }}
                            />
                        ) : null}
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                color: themeColor('text')
                            }}
                        >
                            {displayName}
                        </Text>
                    </Row>
                }
            />
        );
    };

    renderPathRow = () => {
        const { enhancedPath, navigation, onClose } = this.props;

        const pathExists = enhancedPath?.length > 0 && enhancedPath[0][0];
        if (!pathExists) return null;

        return (
            <TouchableOpacity
                onPress={() => {
                    onClose();
                    navigation.navigate('PaymentPaths', {
                        enhancedPath
                    });
                }}
            >
                <View style={{ marginTop: 10, marginBottom: 10 }}>
                    <Row justify="space-between">
                        <View style={{ flex: 1 }}>
                            <KeyValue
                                keyValue={
                                    enhancedPath.length > 1
                                        ? `${localeString(
                                              'views.Payment.paths'
                                          )} (${enhancedPath.length})`
                                        : localeString('views.Payment.path')
                                }
                                disableCopy
                            />
                        </View>
                        <CaretRight
                            fill={themeColor('text')}
                            width="20"
                            height="20"
                        />
                    </Row>
                </View>
            </TouchableOpacity>
        );
    };

    renderTrigger = () => {
        return (
            <Animated.View
                style={{
                    width: '100%',
                    transform: [{ translateY: this.pan.y }],
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingVertical: 5
                }}
                {...this.panResponder.panHandlers}
            >
                <TouchableOpacity
                    onPress={this.props.onOpen}
                    accessibilityLabel={localeString('views.Payment.details')}
                    style={{
                        alignItems: 'center',
                        padding: 10
                    }}
                >
                    <CaretUp fill={themeColor('text')} />
                    <Text
                        style={{
                            marginTop: 7,
                            textAlign: 'center',
                            fontFamily: 'PPNeueMontreal-Book',
                            color: themeColor('text')
                        }}
                    >
                        {localeString('views.Payment.details')}
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    render() {
        const {
            isOpen,
            onClose,
            paymentAmount,
            feeAmount,
            paymentDuration,
            paymentHash,
            paymentPreimage
        } = this.props;

        const feePercentage = getFeePercentage(feeAmount, paymentAmount);

        return (
            <>
                <Modal
                    visible={isOpen}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={onClose}
                >
                    <TouchableWithoutFeedback onPress={onClose}>
                        <View
                            style={{
                                flex: 1,
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                        >
                            <TouchableWithoutFeedback>
                                <View
                                    style={{
                                        backgroundColor:
                                            themeColor('secondary'),
                                        borderRadius: 24,
                                        padding: 20,
                                        width: '90%',
                                        maxHeight: '80%'
                                    }}
                                >
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            marginBottom: 16
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontFamily:
                                                    'PPNeueMontreal-Medium',
                                                color: themeColor('text'),
                                                fontSize: 20,
                                                textAlign: 'center',
                                                flex: 1
                                            }}
                                        >
                                            {localeString(
                                                'views.Payment.details'
                                            )}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={onClose}
                                            hitSlop={{
                                                top: 8,
                                                bottom: 8,
                                                left: 8,
                                                right: 8
                                            }}
                                            style={{ padding: 4 }}
                                        >
                                            <CloseSvg
                                                fill={themeColor('text')}
                                                width={16}
                                                height={16}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView>
                                        {paymentAmount != null && (
                                            <KeyValue
                                                keyValue={localeString(
                                                    'views.Receive.amount'
                                                )}
                                                value={
                                                    <Amount
                                                        sats={paymentAmount}
                                                        debit
                                                        sensitive
                                                        toggleable
                                                    />
                                                }
                                            />
                                        )}

                                        {feeAmount != null && (
                                            <KeyValue
                                                keyValue={localeString(
                                                    'views.Payment.fee'
                                                )}
                                                value={
                                                    <Row>
                                                        <Amount
                                                            sats={feeAmount}
                                                            debit
                                                            sensitive
                                                            toggleable
                                                        />
                                                        {feePercentage ? (
                                                            <Text
                                                                style={{
                                                                    fontFamily:
                                                                        'PPNeueMontreal-Book',
                                                                    color: themeColor(
                                                                        'text'
                                                                    )
                                                                }}
                                                            >
                                                                {` (${feePercentage})`}
                                                            </Text>
                                                        ) : null}
                                                    </Row>
                                                }
                                            />
                                        )}

                                        {paymentDuration != null && (
                                            <KeyValue
                                                keyValue={localeString(
                                                    'views.Payment.settlementTime'
                                                )}
                                                value={`${paymentDuration.toFixed(
                                                    2
                                                )}s`}
                                                disableCopy
                                            />
                                        )}

                                        {this.renderContactRow()}

                                        {paymentHash ? (
                                            <KeyValue
                                                keyValue={localeString(
                                                    'views.Payment.paymentHash'
                                                )}
                                                value={paymentHash}
                                                sensitive
                                            />
                                        ) : null}

                                        {paymentPreimage ? (
                                            <KeyValue
                                                keyValue={localeString(
                                                    'views.Payment.paymentPreimage'
                                                )}
                                                value={paymentPreimage}
                                                sensitive
                                            />
                                        ) : null}

                                        {this.renderPathRow()}
                                    </ScrollView>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>
                {this.renderTrigger()}
            </>
        );
    }
}
