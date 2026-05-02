import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, TextStyle } from 'react-native';

const TRANSITION_OPACITY_MS = 140;
const TRANSITION_TRANSLATE_MS = 180;

interface AnimatedDigitProps {
    value: string;
    style?: StyleProp<TextStyle>;
    color: Animated.AnimatedInterpolation<string> | string;
    lineHeight: number;
    variant?: 'enter' | 'exit';
    onExitComplete?: () => void;
}

export default function AnimatedDigit({
    value,
    style,
    color,
    lineHeight,
    variant = 'enter',
    onExitComplete
}: AnimatedDigitProps) {
    const opacity = useRef(
        new Animated.Value(variant === 'exit' ? 1 : 0)
    ).current;
    const translateY = useRef(
        new Animated.Value(variant === 'exit' ? 0 : 10)
    ).current;
    const onExitCompleteRef = useRef(onExitComplete);
    onExitCompleteRef.current = onExitComplete;

    useEffect(() => {
        if (variant !== 'enter') {
            return;
        }
        opacity.setValue(0);
        translateY.setValue(10);
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: TRANSITION_OPACITY_MS,
                useNativeDriver: true
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: TRANSITION_TRANSLATE_MS,
                useNativeDriver: true
            })
        ]).start();
    }, [variant, value, opacity, translateY]);

    useEffect(() => {
        if (variant !== 'exit') {
            return;
        }
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: TRANSITION_OPACITY_MS,
                useNativeDriver: true
            }),
            Animated.timing(translateY, {
                toValue: 10,
                duration: TRANSITION_TRANSLATE_MS,
                useNativeDriver: true
            })
        ]).start(({ finished }) => {
            if (finished) {
                onExitCompleteRef.current?.();
            }
        });
    }, [variant, opacity, translateY]);

    return (
        <Animated.View
            style={{
                height: lineHeight,
                overflow: 'hidden',
                justifyContent: 'flex-end',
                opacity,
                transform: [{ translateY }]
            }}
        >
            <Animated.Text style={[style, { color }]}>{value}</Animated.Text>
        </Animated.View>
    );
}
