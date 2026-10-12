import React, { useCallback, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    PanResponder,
    PanResponderGestureState,
    GestureResponderEvent,
    LayoutChangeEvent,
    useWindowDimensions
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
    disabled?: boolean;
}

const SwipeButton: React.FC<SwipeButtonProps> = ({
    onSwipeSuccess,
    swipeButtonStyle,
    instructionText = '',
    instructionsStyle,
    containerStyle,
    disabled = false
}) => {
    const pan = useRef(new Animated.Value(0)).current;
    // The PanResponder is created once, so read `disabled` through a ref to
    // always see its latest value (e.g. once a payment goes in flight).
    const disabledRef = useRef(disabled);
    disabledRef.current = disabled;
    const { width: windowWidth } = useWindowDimensions();
    // Until the track is measured, assume it spans the window minus its
    // 20pt side margins. onLayout corrects this on wide or resized windows.
    const [containerWidth, setContainerWidth] = useState(windowWidth - 40);
    const swipeButtonWidth = 50;
    const maxTranslation = containerWidth - swipeButtonWidth;
    // the responder is created once, so it reads the track length via a ref
    const maxTranslationRef = useRef(maxTranslation);
    maxTranslationRef.current = maxTranslation;

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
            onStartShouldSetPanResponder: () =>
                !completed.current && !disabledRef.current,
            onMoveShouldSetPanResponder: () =>
                !completed.current && !disabledRef.current,
            onPanResponderGrant: () => {
                pan.setValue(0);
            },
            onPanResponderMove: (_e, gesture) => {
                const newValue = gesture.dx;
                if (newValue >= 0 && newValue <= maxTranslationRef.current) {
                    pan.setValue(newValue);
                }
            },
            onPanResponderRelease: (
                _e: GestureResponderEvent,
                gesture: PanResponderGestureState
            ) => {
                if (
                    gesture.dx > maxTranslationRef.current * 0.95 &&
                    !disabledRef.current
                ) {
                    // lock the button in the completed position before
                    // kicking off any work, so it can't be dragged again or
                    // left hanging mid-track while navigation is pending
                    completed.current = true;
                    pan.setValue(maxTranslationRef.current);
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
        <View
            onLayout={(event: LayoutChangeEvent) =>
                setContainerWidth(event.nativeEvent.layout.width)
            }
            style={[
                styles.container,
                containerStyle,
                disabled && styles.disabled
            ]}
        >
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
        // Span the parent even when it centers its children (Send does), so
        // the knob always has the full track to travel.
        alignSelf: 'stretch',
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
    },
    disabled: {
        opacity: 0.5
    }
});

export default SwipeButton;
