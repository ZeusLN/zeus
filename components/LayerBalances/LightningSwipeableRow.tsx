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
import BackendUtils from './../../utils/BackendUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import stores from './../../stores/Stores';
const { invoicesStore } = stores;

import Receive from './../../assets/images/SVG/Receive.svg';
import Routing from './../../assets/images/SVG/Routing.svg';
import Send from './../../assets/images/SVG/Send.svg';

interface LightningSwipeableRowProps {
    navigation: any;
    lightning?: string;
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
                    <View accessible accessibilityRole="button">
                        {text === localeString('general.routing') && (
                            <Routing
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

    private renderActions = (progress: Animated.AnimatedInterpolation) => (
        <View
            style={{
                marginLeft: 15,
                width: BackendUtils.supportsRouting() ? 200 : 135,
                flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row'
            }}
        >
            {this.renderAction(
                localeString('general.receive'),
                BackendUtils.supportsRouting() ? 200 : 135,
                progress
            )}
            {BackendUtils.supportsRouting() &&
                this.renderAction(
                    localeString('general.routing'),
                    200,
                    progress
                )}
            {this.renderAction(
                localeString('general.send'),
                BackendUtils.supportsRouting() ? 200 : 135,
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

    private fetchLnInvoice = () => {
        invoicesStore.getPayReq(this.props.lightning);
        this.props.navigation.navigate('PaymentRequest', {});
    };

    render() {
        const { children, lightning, locked } = this.props;
        if (locked && lightning) {
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
                        lightning ? this.fetchLnInvoice() : this.open()
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
