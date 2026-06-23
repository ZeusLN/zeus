import React, { Component } from 'react';
import {
    StyleSheet,
    Text,
    View,
    I18nManager,
    TouchableOpacity
} from 'react-native';
import Animated, {
    interpolate,
    SharedValue,
    useAnimatedStyle
} from 'react-native-reanimated';
import { RectButton } from 'react-native-gesture-handler';
import ReanimatedSwipeable, {
    SwipeableMethods
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { inject, observer } from 'mobx-react';

import BackendUtils from './../../utils/BackendUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import { modalStore } from './../../stores/Stores';
import SyncStore from '../../stores/SyncStore';

import Coins from './../../assets/images/SVG/Coins.svg';
import Receive from './../../assets/images/SVG/Receive.svg';
import Send from './../../assets/images/SVG/Send.svg';

const ActionContainer = ({
    x,
    progress,
    children
}: {
    x: number;
    progress: SharedValue<number>;
    children: React.ReactNode;
}) => {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: interpolate(progress.value, [0.25, 1], [x, 0]) }
        ],
        opacity: interpolate(progress.value, [0, 1], [0, 1])
    }));
    return (
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
            {children}
        </Animated.View>
    );
};

interface OnchainSwipeableRowProps {
    navigation: NativeStackNavigationProp<any, any>;
    value?: string;
    satAmount?: number;
    feeRate?: string;
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
        progress: SharedValue<number>
    ) => {
        const { account, navigation } = this.props;
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
            <ActionContainer x={x} progress={progress}>
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
            </ActionContainer>
        );
    };

    private renderActions = (progress: SharedValue<number>) => (
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

    private swipeableRow?: SwipeableMethods;

    private updateRef = (ref: SwipeableMethods | null) => {
        this.swipeableRow = ref ?? undefined;
    };

    private close = () => {
        if (this.swipeableRow) this.swipeableRow.close();
    };

    private open = () => {
        if (this.swipeableRow) this.swipeableRow.openLeft();
    };

    private sendToAddress = () => {
        const { navigation, value, satAmount, feeRate } = this.props;
        navigation.navigate('Send', {
            destination: value,
            satAmount,
            fee: feeRate,
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
            <ReanimatedSwipeable
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
            </ReanimatedSwipeable>
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
