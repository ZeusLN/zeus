import React, { Component } from 'react';
import {
    Alert,
    Animated,
    StyleSheet,
    Text,
    View,
    I18nManager,
    TouchableOpacity
} from 'react-native';
import { getParams as getlnurlParams } from 'js-lnurl';
import { StackNavigationProp } from '@react-navigation/stack';

import { RectButton } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import BackendUtils from './../../utils/BackendUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import stores from './../../stores/Stores';
const { invoicesStore } = stores;

import Receive from './../../assets/images/SVG/Receive.svg';
import Routing from './../../assets/images/SVG/Routing.svg';
import Send from './../../assets/images/SVG/Send.svg';

interface LightningSwipeableRowProps {
    navigation: StackNavigationProp<any, any>;
    lightning?: string;
    offer?: string;
    locked?: boolean;
}

export default class LightningSwipeableRow extends Component<
    LightningSwipeableRowProps,
    {}
> {
    private renderAction = (
        text: string,
        x: number,
        progress: Animated.AnimatedInterpolation
    ) => {
        const transTranslateX = progress.interpolate({
            inputRange: [0.25, 1],
            outputRange: [x, 0]
        });
        const transOpacity = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1]
        });
        const pressHandler = () => {
            this.close();

            if (text === localeString('general.receive')) {
                this.props.navigation.navigate('Receive');
            } else if (text === localeString('general.paycodes')) {
                this.props.navigation.navigate('PayCodes');
            } else if (text === localeString('general.routing')) {
                this.props.navigation.navigate('Routing');
            } else if (text === localeString('general.send')) {
                this.props.navigation.navigate('Send');
            }
        };

        return (
            <Animated.View
                style={{
                    flex: 1,
                    transform: [{ translateX: transTranslateX }],
                    opacity: transOpacity
                }}
            >
                <RectButton style={[styles.action]} onPress={pressHandler}>
                    <View
                        style={[styles.view]}
                        accessible
                        accessibilityRole="button"
                    >
                        {text === localeString('general.routing') && (
                            <Routing
                                fill={
                                    themeColor('action') ||
                                    themeColor('highlight')
                                }
                                width={30}
                                height={30}
                            />
                        )}
                        {text === localeString('general.paycodes') && (
                            <Receive
                                fill={
                                    themeColor('action') ||
                                    themeColor('highlight')
                                }
                                width={30}
                                height={30}
                            />
                        )}
                        {text === localeString('general.receive') && (
                            <Receive
                                fill={
                                    themeColor('action') ||
                                    themeColor('highlight')
                                }
                                width={30}
                                height={30}
                            />
                        )}
                        {text === localeString('general.send') && (
                            <Send
                                fill={
                                    themeColor('action') ||
                                    themeColor('highlight')
                                }
                                width={30}
                                height={30}
                            />
                        )}
                        <Text
                            style={{
                                ...styles.actionText,
                                color: themeColor('text')
                            }}
                        >
                            {text}
                        </Text>
                    </View>
                </RectButton>
            </Animated.View>
        );
    };

    private renderActions = (progress: Animated.AnimatedInterpolation) => {
        const width =
            BackendUtils.supportsRouting() &&
            BackendUtils.supportsLightningSends() &&
            BackendUtils.supportsOffers()
                ? 280
                : BackendUtils.supportsRouting() &&
                  BackendUtils.supportsLightningSends()
                ? 210
                : BackendUtils.supportsRouting() ||
                  BackendUtils.supportsLightningSends()
                ? 140
                : 70;
        return (
            <View
                style={{
                    marginLeft: 15,
                    width,
                    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row'
                }}
            >
                {this.renderAction(
                    localeString('general.receive'),
                    width,
                    progress
                )}
                {BackendUtils.supportsOffers() &&
                    this.renderAction(
                        localeString('general.paycodes'),
                        width,
                        progress
                    )}
                {BackendUtils.supportsRouting() &&
                    this.renderAction(
                        localeString('general.routing'),
                        width,
                        progress
                    )}
                {BackendUtils.supportsLightningSends() &&
                    this.renderAction(
                        localeString('general.send'),
                        width,
                        progress
                    )}
            </View>
        );
    };

    private swipeableRow?: Swipeable;

    private updateRef = (ref: Swipeable) => {
        this.swipeableRow = ref;
    };

    private close = () => {
        this.swipeableRow.close();
    };

    private open = () => {
        this.swipeableRow.openLeft();
    };

    private fetchLnInvoice = () => {
        const { lightning, offer } = this.props;
        if (offer) {
            this.props.navigation.navigate('Send', {
                destination: offer,
                bolt12: offer,
                transactionType: 'BOLT 12',
                isValid: true
            });
        } else if (lightning?.toLowerCase().startsWith('lnurl')) {
            return getlnurlParams(lightning)
                .then((params: any) => {
                    if (
                        params.status === 'ERROR' &&
                        params.domain.endsWith('.onion')
                    ) {
                        // TODO handle fetching of params with internal Tor
                        throw new Error(
                            `${params.domain} says: ${params.reason}`
                        );
                    }

                    switch (params.tag) {
                        case 'payRequest':
                            params.lnurlText = lightning;
                            this.props.navigation.navigate('LnurlPay', {
                                lnurlParams: params
                            });
                            return;
                        default:
                            Alert.alert(
                                localeString('general.error'),
                                params.status === 'ERROR'
                                    ? `${params.domain} says: ${params.reason}`
                                    : `${localeString(
                                          'utils.handleAnything.unsupportedLnurlType'
                                      )}: ${params.tag}`,
                                [
                                    {
                                        text: localeString('general.ok'),
                                        onPress: () => void 0
                                    }
                                ],
                                { cancelable: false }
                            );
                    }
                })
                .catch(() => {
                    throw new Error(
                        localeString('utils.handleAnything.invalidLnurlParams')
                    );
                });
        } else {
            invoicesStore.getPayReq(this.props.lightning);
            this.props.navigation.navigate('PaymentRequest', {});
        }
    };

    render() {
        const { children, lightning, offer, locked } = this.props;
        if (locked && (lightning || offer)) {
            return (
                <TouchableOpacity
                    onPress={() => this.fetchLnInvoice()}
                    activeOpacity={1}
                >
                    {children}
                </TouchableOpacity>
            );
        }
        if (locked) return children;
        return (
            <Swipeable
                ref={this.updateRef}
                friction={2}
                enableTrackpadTwoFingerGesture
                leftThreshold={30}
                rightThreshold={40}
                renderLeftActions={this.renderActions}
            >
                <TouchableOpacity
                    onPress={() =>
                        lightning || offer ? this.fetchLnInvoice() : this.open()
                    }
                    activeOpacity={1}
                >
                    {children}
                </TouchableOpacity>
            </Swipeable>
        );
    }
}

const styles = StyleSheet.create({
    actionText: {
        fontSize: 12,
        backgroundColor: 'transparent',
        paddingTop: 10,
        paddingHorizontal: 4,
        fontFamily: 'PPNeueMontreal-Book'
    },
    action: {
        flex: 1,
        justifyContent: 'center'
    },
    view: {
        alignItems: 'center'
    }
});
