import React, { Component } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    View,
    I18nManager,
    TouchableOpacity
} from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { StackNavigationProp } from '@react-navigation/stack';
import { inject, observer } from 'mobx-react';

import BackendUtils from './../../utils/BackendUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import { modalStore } from './../../stores/Stores';
import SyncStore from '../../stores/SyncStore';

import Coins from './../../assets/images/SVG/Coins.svg';
import Receive from './../../assets/images/SVG/Receive.svg';
import Send from './../../assets/images/SVG/Send.svg';

interface OnchainSwipeableRowProps {
    navigation: StackNavigationProp<any, any>;
    value?: string;
    satAmount?: number;
    locked?: boolean;
    account?: string;
    hidden?: boolean;
    children?: React.ReactNode;
    disabled?: boolean;
    SyncStore?: SyncStore;
}

@inject('SyncStore')
@observer
export default class OnchainSwipeableRow extends Component<
    OnchainSwipeableRowProps,
    {}
> {
    private renderAction = (
        text: string,
        x: number,
        progress: Animated.AnimatedInterpolation<number>
    ) => {
        const { account, navigation } = this.props;
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
                navigation.navigate('Receive', {
                    account: account === 'On-chain' ? 'default' : account,
                    autoGenerateOnChain: true,
                    forceOnChain: true
                });
            } else if (text === localeString('general.coins')) {
                navigation.navigate('CoinControl', { account });
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
                        {text === localeString('general.coins') && (
                            <Coins
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
    ) => (
        <View
            style={{
                marginLeft: 15,
                width: BackendUtils.supportsCoinControl() ? 210 : 140,
                flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row'
            }}
        >
            {this.renderAction(
                localeString('general.receive'),
                BackendUtils.supportsCoinControl() ? 210 : 140,
                progress
            )}
            {BackendUtils.supportsCoinControl() &&
                this.renderAction(localeString('general.coins'), 200, progress)}
            {this.renderAction(
                localeString('general.send'),
                BackendUtils.supportsCoinControl() ? 210 : 140,
                progress
            )}
        </View>
    );

    private swipeableRow?: Swipeable;

    private updateRef = (ref: Swipeable) => {
        this.swipeableRow = ref;
    };

    private close = () => {
        if (this.swipeableRow) this.swipeableRow.close();
    };

    private open = () => {
        if (this.swipeableRow) this.swipeableRow.openLeft();
    };

    private sendToAddress = () => {
        const { navigation, value, satAmount } = this.props;
        navigation.navigate('Send', {
            destination: value,
            satAmount,
            transactionType: 'On-chain'
        });
    };

    render() {
        const { children, value, locked, hidden, disabled, SyncStore } =
            this.props;
        const { isSyncing } = SyncStore!;
        if (isSyncing) {
            return (
                <TouchableOpacity
                    onPress={() =>
                        modalStore.toggleInfoModal({
                            text: localeString('views.Wallet.waitForSync')
                        })
                    }
                    style={{ width: '100%' }}
                >
                    <View style={{ opacity: 0.25 }}>{children}</View>
                </TouchableOpacity>
            );
        }
        if (locked && value) {
            return (
                <TouchableOpacity
                    onPress={() => (disabled ? null : this.sendToAddress())}
                    activeOpacity={1}
                    style={{ width: '100%' }}
                >
                    {children}
                </TouchableOpacity>
            );
        }
        if (locked)
            return (
                <View style={{ width: '100%', opacity: hidden ? 0.25 : 1 }}>
                    {children}
                </View>
            );
        return (
            <Swipeable
                ref={this.updateRef}
                friction={2}
                enableTrackpadTwoFingerGesture
                leftThreshold={30}
                rightThreshold={40}
                renderLeftActions={this.renderActions}
                containerStyle={{ width: '100%' }}
            >
                <TouchableOpacity
                    onPress={() => (value ? this.sendToAddress() : this.open())}
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
