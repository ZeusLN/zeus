import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    PanResponder,
    PanResponderGestureState,
    GestureResponderEvent,
    LayoutChangeEvent
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

    // the responder is created once, so its handlers only ever see refs
    const completed = useRef(false);
    const onSwipeSuccessRef = useRef(onSwipeSuccess);
    onSwipeSuccessRef.current = onSwipeSuccess;

    // How far the knob can travel, from the track's measured width. It is
    // null until the first layout, and the knob can't be dragged before
    // then, so the swipe is never judged against a guessed width.
    const [maxTranslation, setMaxTranslation] = useState<number | null>(null);
    const maxTranslationRef = useRef<number | null>(null);
    maxTranslationRef.current = maxTranslation;

    const onLayout = (e: LayoutChangeEvent) => {
        const travel = Math.max(
            e.nativeEvent.layout.width - SWIPE_BUTTON_WIDTH,
            0
        );
        // keep a completed knob at the end of a resized track
        if (completed.current) pan.setValue(travel);
        setMaxTranslation(travel);
    };

    const textOpacity = useMemo(() => {
        // interpolate needs a non-empty range
        const travel = Math.max(maxTranslation ?? 0, 1);
        return pan.interpolate({
            inputRange: [0, travel / 2, travel],
            outputRange: [1, 0, 0],
            extrapolate: 'clamp'
        });
    }, [pan, maxTranslation]);

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
                !completed.current &&
                !disabledRef.current &&
                !!maxTranslationRef.current,
            onMoveShouldSetPanResponder: () =>
                !completed.current &&
                !disabledRef.current &&
                !!maxTranslationRef.current,
            onPanResponderGrant: () => {
                pan.setValue(0);
            },
            onPanResponderMove: (_e, gesture) => {
                const maxTranslation = maxTranslationRef.current ?? 0;
                const newValue = gesture.dx;
                if (newValue >= 0 && newValue <= maxTranslation) {
                    pan.setValue(newValue);
                }
            },
            onPanResponderRelease: (
                _e: GestureResponderEvent,
                gesture: PanResponderGestureState
            ) => {
                const maxTranslation = maxTranslationRef.current;
                if (
                    !!maxTranslation &&
                    gesture.dx > maxTranslation * 0.95 &&
                    !disabledRef.current
                ) {
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
        <View
            style={[
                styles.container,
                containerStyle,
                disabled && styles.disabled
            ]}
            onLayout={onLayout}
            testID="swipe-button-track"
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

const SWIPE_BUTTON_WIDTH = 50;

const styles = StyleSheet.create({
    container: {
        // fill the parent's width even when the parent centers its
        // children, which would otherwise shrink the track to the
        // instruction text
        alignSelf: 'stretch',
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
        width: SWIPE_BUTTON_WIDTH,
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
