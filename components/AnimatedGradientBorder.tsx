import React, { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

import LinearGradient from './LinearGradient';

interface AnimatedGradientBorderProps {
    // when false, renders a plain hairline-bordered card instead
    active: boolean;
    colors: string[];
    backgroundColor: string;
    borderRadius?: number;
    borderWidth?: number;
    inactiveBorderWidth?: number;
    duration?: number;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
}

export default function AnimatedGradientBorder({
    active,
    colors,
    backgroundColor,
    borderRadius = 10,
    borderWidth = 2,
    inactiveBorderWidth = 0.5,
    duration = 3000,
    style,
    contentStyle,
    children
}: AnimatedGradientBorderProps) {
    const reducedMotion = useReducedMotion();
    const [layout, setLayout] = useState<{
        width: number;
        height: number;
    } | null>(null);
    const rotation = useSharedValue(0);

    const animate = active && !reducedMotion;

    useEffect(() => {
        if (animate) {
            rotation.value = 0;
            rotation.value = withRepeat(
                withTiming(360, { duration, easing: Easing.linear }),
                -1
            );
        } else {
            cancelAnimation(rotation);
            rotation.value = 0;
        }
        return () => cancelAnimation(rotation);
    }, [animate, duration]);

    const spinStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }]
    }));

    if (!active) {
        return (
            <View
                style={[
                    {
                        backgroundColor,
                        borderRadius,
                        borderWidth: inactiveBorderWidth
                    },
                    style,
                    contentStyle
                ]}
            >
                {children}
            </View>
        );
    }

    // the spinning gradient square must cover the card at every angle,
    // so it is sized to the card's diagonal
    const diagonal = layout
        ? Math.ceil(Math.hypot(layout.width, layout.height))
        : 0;

    return (
        <View
            style={[
                style,
                {
                    borderRadius,
                    overflow: 'hidden',
                    padding: borderWidth
                }
            ]}
            onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setLayout({ width, height });
            }}
        >
            {layout && animate ? (
                <Animated.View
                    style={[
                        {
                            position: 'absolute',
                            width: diagonal,
                            height: diagonal,
                            top: (layout.height - diagonal) / 2,
                            left: (layout.width - diagonal) / 2
                        },
                        spinStyle
                    ]}
                >
                    <LinearGradient
                        colors={colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flex: 1 }}
                    />
                </Animated.View>
            ) : (
                <View
                    style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: colors[0] }
                    ]}
                />
            )}
            <View
                style={[
                    {
                        backgroundColor,
                        borderRadius: Math.max(borderRadius - borderWidth, 0)
                    },
                    contentStyle
                ]}
            >
                {children}
            </View>
        </View>
    );
}
