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
import { LNURLWithdrawParams } from 'js-lnurl';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { inject, observer } from 'mobx-react';

import { RectButton, Swipeable } from 'react-native-gesture-handler';

import BackendUtils from './../../utils/BackendUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import {
    navigateForSelectedPaymentRow,
    PaymentMethodLayer
} from '../../utils/ChoosePaymentMethodUtils';

import { modalStore, nodeInfoStore } from './../../stores/Stores';
import SyncStore from '../../stores/SyncStore';

import Receive from './../../assets/images/SVG/Receive.svg';
import Routing from './../../assets/images/SVG/Routing.svg';
import Send from './../../assets/images/SVG/Send.svg';

interface LightningSwipeableRowProps {
    navigation: NativeStackNavigationProp<any, any>;
    lightning?: string;
    lnurlParams?: LNURLWithdrawParams | undefined;
    lightningAddress?: string;
    offer?: string;
    clinkNoffer?: string;
    locked?: boolean;
    children: React.ReactNode;
    disabled?: boolean;
    SyncStore?: SyncStore;
}

@inject('SyncStore')
@observer
export default class LightningSwipeableRow extends Component<
    LightningSwipeableRowProps,
    {}
> {
    private renderAction = (
        text: string,
        x: number,
        progress: Animated.AnimatedInterpolation<number>
    ) => {
        const { navigation } = this.props;
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
                navigation.navigate('Receive', { forceLn: true });
            } else if (text === localeString('general.paycodes')) {
                navigation.navigate(
                    nodeInfoStore.supportsListingOffers
                        ? 'PayCodes'
                        : 'CreatePayCode'
                );
            } else if (text === localeString('general.routing')) {
                navigation.navigate('Routing');
            } else if (text === localeString('general.send')) {
                navigation.navigate('Send');
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

    private renderActions = (
        progress: Animated.AnimatedInterpolation<number>
    ) => {
        let actionCount = 1; // Receive is always shown
        if (nodeInfoStore.supportsOffers) actionCount++;
        if (BackendUtils.supportsRouting()) actionCount++;
        if (BackendUtils.supportsLightningSends()) actionCount++;
        const width = actionCount * 70;
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
                {nodeInfoStore.supportsOffers &&
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
        if (this.swipeableRow) {
            this.swipeableRow.close();
        }
    };

    private open = () => {
        if (this.swipeableRow) {
            this.swipeableRow.openLeft();
        }
    };

    private fetchLnInvoice = async () => {
        const {
            lightning,
            lightningAddress,
            offer,
            clinkNoffer,
            navigation,
            lnurlParams
        } = this.props;

        const row = clinkNoffer
            ? { layer: PaymentMethodLayer.Clink }
            : offer
            ? { layer: PaymentMethodLayer.Offer }
            : lightningAddress
            ? { layer: PaymentMethodLayer.LightningAddress }
            : { layer: PaymentMethodLayer.Lightning };

        await navigateForSelectedPaymentRow(
            navigation,
            row,
            { lightning, lightningAddress, offer, clinkNoffer, lnurlParams },
            { replace: false }
        ).catch((error) => {
            Alert.alert(localeString('general.error'), error.message);
        });
    };

    render() {
        const {
            children,
            lightning,
            lightningAddress,
            offer,
            clinkNoffer,
            locked,
            disabled,
            lnurlParams,
            SyncStore
        } = this.props;
        const { isSyncing } = SyncStore!;
        if (isSyncing) {
            return (
                <TouchableOpacity
                    onPress={() =>
                        modalStore.toggleInfoModal({
                            text: localeString('views.Wallet.waitForSync')
                        })
                    }
                >
                    <View style={{ opacity: 0.25 }}>{children}</View>
                </TouchableOpacity>
            );
        }
        if (
            locked &&
            (lightning ||
                lightningAddress ||
                offer ||
                clinkNoffer ||
                lnurlParams)
        ) {
            return (
                <TouchableOpacity
                    onPress={() => (disabled ? null : this.fetchLnInvoice())}
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
                        lightning || offer || clinkNoffer || lnurlParams
                            ? this.fetchLnInvoice()
                            : this.open()
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
