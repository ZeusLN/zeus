import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, TextStyle } from 'react-native';

const TRANSITION_OPACITY_MS = 140;
const TRANSITION_TRANSLATE_MS = 180;
const TRANSLATE_OFFSET_RATIO = 0.125;

interface AnimatedDigitProps {
    value: string;
    style?: StyleProp<TextStyle>;
    color: Animated.AnimatedInterpolation<string> | string;
    lineHeight: number;
    variant?: 'enter' | 'exit';
    onExitComplete?: () => void;
}

function translateOffset(lineHeight: number): number {
    return lineHeight * TRANSLATE_OFFSET_RATIO;
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
        new Animated.Value(variant === 'exit' ? 0 : translateOffset(lineHeight))
    ).current;
    const animationRef = useRef<Animated.CompositeAnimation | null>(null);
    const hasAnimatedEnterRef = useRef(false);
    const prevLineHeightRef = useRef(lineHeight);
    const onExitCompleteRef = useRef(onExitComplete);
    onExitCompleteRef.current = onExitComplete;

    useEffect(() => {
        return () => {
            animationRef.current?.stop();
        };
    }, []);

    useEffect(() => {
        if (prevLineHeightRef.current === lineHeight) {
            return;
        }
        prevLineHeightRef.current = lineHeight;
        animationRef.current?.stop();
        animationRef.current = null;

        if (variant === 'enter') {
            opacity.setValue(1);
            translateY.setValue(0);
            return;
        }

        opacity.setValue(0);
        translateY.setValue(translateOffset(lineHeight));
        onExitCompleteRef.current?.();
    }, [lineHeight, variant, opacity, translateY]);

    useEffect(() => {
        if (variant !== 'enter') {
            return;
        }

        animationRef.current?.stop();
        animationRef.current = null;

        if (hasAnimatedEnterRef.current) {
            opacity.setValue(1);
            translateY.setValue(0);
            return;
        }

        hasAnimatedEnterRef.current = true;
        const offset = translateOffset(lineHeight);
        opacity.setValue(0);
        translateY.setValue(offset);
        animationRef.current = Animated.parallel([
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
        ]);
        animationRef.current.start(({ finished }) => {
            animationRef.current = null;
            if (finished) {
                opacity.setValue(1);
                translateY.setValue(0);
            }
        });
    }, [variant, value, lineHeight, opacity, translateY]);

    useEffect(() => {
        if (variant !== 'exit') {
            return;
        }

        animationRef.current?.stop();
        animationRef.current = null;

        const offset = translateOffset(lineHeight);
        opacity.setValue(1);
        translateY.setValue(0);
        animationRef.current = Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: TRANSITION_OPACITY_MS,
                useNativeDriver: true
            }),
            Animated.timing(translateY, {
                toValue: offset,
                duration: TRANSITION_TRANSLATE_MS,
                useNativeDriver: true
            })
        ]);
        animationRef.current.start(({ finished }) => {
            animationRef.current = null;
            if (finished) {
                opacity.setValue(0);
                translateY.setValue(offset);
                onExitCompleteRef.current?.();
            }
        });
    }, [variant, lineHeight, opacity, translateY]);

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
