import React, { Component } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    View,
    I18nManager,
    TouchableOpacity
} from 'react-native';

import { RectButton } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import RESTUtils from './../../utils/RESTUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import Coins from './../../assets/images/SVG/Coins.svg';
import Receive from './../../assets/images/SVG/Receive.svg';
import Send from './../../assets/images/SVG/Send.svg';

interface OnchainSwipeableRowProps {
    navigation: any;
}

export default class OnchainSwipeableRow extends Component<
    OnchainSwipeableRowProps,
    Record<string, never>
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
                this.props.navigation.navigate('Receive', { selectedIndex: 1 });
            } else if (text === localeString('general.coins')) {
                this.props.navigation.navigate('CoinControl');
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
                    {text === localeString('general.coins') && (
                        <Coins
                            fill={themeColor('highlight')}
                            width={30}
                            height={30}
                        />
                    )}
                    {text === localeString('general.receive') && (
                        <Receive
                            fill={themeColor('highlight')}
                            width={30}
                            height={30}
                        />
                    )}
                    {text === localeString('general.send') && (
                        <Send
                            fill={themeColor('highlight')}
                            width={30}
                            height={30}
                        />
                    )}
                    <Text style={styles.actionText}>{text}</Text>
                </RectButton>
            </Animated.View>
        );
    };

    private renderActions = (progress: Animated.AnimatedInterpolation) => (
        <View
            style={{
                marginLeft: 15,
                width: RESTUtils.supportsRouting() ? 200 : 135,
                flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row'
            }}
        >
            {this.renderAction(
                localeString('general.receive'),
                RESTUtils.supportsCoinControl() ? 200 : 135,
                progress
            )}
            {RESTUtils.supportsCoinControl() &&
                this.renderAction(localeString('general.coins'), 200, progress)}
            {this.renderAction(
                localeString('general.send'),
                RESTUtils.supportsCoinControl() ? 200 : 135,
                progress
            )}
        </View>
    );

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

    render() {
        const { children } = this.props;
        return (
            <Swipeable
                ref={this.updateRef}
                friction={2}
                enableTrackpadTwoFingerGesture
                leftThreshold={30}
                rightThreshold={40}
                renderLeftActions={this.renderActions}
            >
                <TouchableOpacity onPress={() => this.open()} activeOpacity={1}>
                    {children}
                </TouchableOpacity>
            </Swipeable>
        );
    }
}

const styles = StyleSheet.create({
    actionText: {
        color: 'gray',
        fontSize: 12,
        backgroundColor: 'transparent',
        padding: 10,
        fontFamily: 'Lato-Regular'
    },
    action: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center'
    },
    swipe: {
        padding: 20
    }
});
