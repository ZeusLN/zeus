import React, { useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    PanResponder,
    PanResponderGestureState,
    GestureResponderEvent,
    Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import CaretRight from '../assets/images/SVG/Caret Right alt.svg';
import { themeColor } from '../utils/ThemeUtils';

interface SwipeButtonProps {
    onSwipeSuccess: () => void;
    swipeButtonStyle?: object;
    instructionText?: string;
    instructionsStyle?: object;
    containerStyle?: object;
}

const SwipeButton: React.FC<SwipeButtonProps> = ({
    onSwipeSuccess,
    swipeButtonStyle,
    instructionText = '',
    instructionsStyle,
    containerStyle
}) => {
    const pan = useRef(new Animated.Value(0)).current;
    const screenWidth = Dimensions.get('window').width;

    const containerWidth = screenWidth - 40;
    const swipeButtonWidth = 50;
    const maxTranslation = containerWidth - swipeButtonWidth;

    const textOpacity = pan.interpolate({
        inputRange: [0, maxTranslation / 2, maxTranslation],
        outputRange: [1, 0, 0],
        extrapolate: 'clamp'
    });

    // the responder is created once, so its handlers only ever see refs
    const completed = useRef(false);
    const onSwipeSuccessRef = useRef(onSwipeSuccess);
    onSwipeSuccessRef.current = onSwipeSuccess;

    const springBack = () =>
        Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false
        }).start();

    // every screen using this button navigates away in onSwipeSuccess; if
    // the user comes back (e.g. the send failed), unlock the knob so they
    // can retry
    useFocusEffect(
        useCallback(() => {
            if (completed.current) {
                completed.current = false;
                pan.setValue(0);
            }
        }, [])
    );

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !completed.current,
            onMoveShouldSetPanResponder: () => !completed.current,
            onPanResponderGrant: () => {
                pan.setValue(0);
            },
            onPanResponderMove: (_e, gesture) => {
                const newValue = gesture.dx;
                if (newValue >= 0 && newValue <= maxTranslation) {
                    pan.setValue(newValue);
                }
            },
            onPanResponderRelease: (
                _e: GestureResponderEvent,
                gesture: PanResponderGestureState
            ) => {
                if (gesture.dx > maxTranslation * 0.95) {
                    // lock the button in the completed position before
                    // kicking off any work, so it can't be dragged again or
                    // left hanging mid-track while navigation is pending
                    completed.current = true;
                    pan.setValue(maxTranslation);
                    onSwipeSuccessRef.current();
                } else {
                    springBack();
                }
            },
            onPanResponderTerminate: () => {
                if (!completed.current) springBack();
            }
        })
    ).current;

    return (
        <View style={[styles.container, containerStyle]}>
            <Animated.View
                style={[
                    styles.instructionsContainer,
                    instructionsStyle,
                    { opacity: textOpacity }
                ]}
            >
                <Text style={[styles.instructions]}>{instructionText}</Text>
            </Animated.View>
            <Animated.View
                style={[
                    styles.swipeButton,
                    swipeButtonStyle,
                    { transform: [{ translateX: pan }] }
                ]}
                {...panResponder.panHandlers}
            >
                <CaretRight
                    fill={themeColor('background')}
                    width={24}
                    height={24}
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 50,
        backgroundColor: '#ccc',
        borderRadius: 5,
        marginHorizontal: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20
    },
    instructionsContainer: {
        alignItems: 'center'
    },
    instructions: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book',
        color: 'black'
    },
    swipeButton: {
        position: 'absolute',
        left: 0,
        width: 50,
        height: 50,
        color: 'black',
        backgroundColor: 'white',
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center'
    },
    textStyle: {
        fontSize: 18
    }
});

export default SwipeButton;
