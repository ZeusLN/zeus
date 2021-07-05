import React, { Component } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    View,
    I18nManager,
    Alert,
    Image
} from 'react-native';

import { RectButton } from 'react-native-gesture-handler';

import Swipeable from 'react-native-gesture-handler/Swipeable';

import Receive from './../../images/SVG/Receive.svg';
import Routing from './../../images/SVG/Routing.svg';

export default class LightningSwipeableRow extends Component {
    private renderAction = (
        text: string,
        color: string,
        x: number,
        progress: Animated.AnimatedInterpolation
    ) => {
        const trans = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [x, 0]
        });
        const pressHandler = () => {
            this.close();
            Alert.alert(text);
        };

        return (
            <Animated.View
                style={{ flex: 1, transform: [{ translateX: trans }] }}
            >
                <RectButton style={[styles.action]} onPress={pressHandler}>
                    {text === 'Routing' && <Routing fill="#ffd24b" />}
                    {text === 'Receive' && <Receive fill="#ffd24b" />}
                    <Text style={styles.actionText}>{text}</Text>
                </RectButton>
            </Animated.View>
        );
    };

    private renderActions = (
        progress: Animated.AnimatedInterpolation,
        _dragAnimatedValue: Animated.AnimatedInterpolation
    ) => (
        <View
            style={{
                marginLeft: 15,
                width: 150,
                flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row'
            }}
        >
            {this.renderAction('Receive', '#C8C7CD', 150, progress)}
            {this.renderAction('Routing', '#ffab00', 100, progress)}
        </View>
    );

    private swipeableRow?: Swipeable;

    private updateRef = (ref: Swipeable) => {
        this.swipeableRow = ref;
    };
    private close = () => {
        this.swipeableRow.close();
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
                {children}
            </Swipeable>
        );
    }
}

const styles = StyleSheet.create({
    actionText: {
        color: 'gray',
        fontSize: 12,
        backgroundColor: 'transparent',
        padding: 10
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
