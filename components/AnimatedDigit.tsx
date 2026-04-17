import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, TextStyle } from 'react-native';

interface AnimatedDigitProps {
    value: string;
    style?: StyleProp<TextStyle>;
    color: Animated.AnimatedInterpolation<string> | string;
}

export default function AnimatedDigit({
    value,
    style,
    color
}: AnimatedDigitProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(10)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 140,
                useNativeDriver: true
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true
            })
        ]).start();
    }, []);

    return (
        <Animated.View
            style={{
                overflow: 'hidden',
                opacity,
                transform: [{ translateY }]
            }}
        >
            <Animated.Text style={[style, { color }]}>{value}</Animated.Text>
        </Animated.View>
    );
}
