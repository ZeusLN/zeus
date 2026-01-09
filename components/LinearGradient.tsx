import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, {
    Defs,
    LinearGradient as SvgLinearGradient,
    Stop,
    Rect
} from 'react-native-svg';

interface Point {
    x: number;
    y: number;
}

interface LinearGradientProps {
    colors: string[];
    start?: Point;
    end?: Point;
    locations?: number[];
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
}

const LinearGradient: React.FC<LinearGradientProps> = ({
    colors,
    start = { x: 0.5, y: 0 },
    end = { x: 0.5, y: 1 },
    locations,
    style,
    children
}) => {
    const gradientId = useMemo(
        () => `grad-${Math.random().toString(36).substr(2, 9)}`,
        []
    );

    const stops = useMemo(() => {
        return colors.map((color, index) => {
            const offset = locations
                ? locations[index]
                : index / (colors.length - 1);
            return (
                <Stop
                    key={index}
                    offset={`${offset * 100}%`}
                    stopColor={color}
                    stopOpacity="1"
                />
            );
        });
    }, [colors, locations]);

    const flatStyle = StyleSheet.flatten(style) || {};

    // Extract layout-related styles for the children container
    const {
        flexDirection,
        justifyContent,
        alignItems,
        padding,
        paddingHorizontal,
        paddingVertical,
        paddingTop,
        paddingBottom,
        paddingLeft,
        paddingRight,
        ...outerStyle
    } = flatStyle;

    // Outer container handles size, position, borderRadius, overflow
    const containerStyle: ViewStyle = {
        ...outerStyle,
        overflow: 'hidden'
    };

    // Children container handles flex layout and padding
    const childrenStyle: ViewStyle = {
        flex: 1,
        flexDirection,
        justifyContent,
        alignItems,
        padding,
        paddingHorizontal,
        paddingVertical,
        paddingTop,
        paddingBottom,
        paddingLeft,
        paddingRight
    };

    return (
        <View style={containerStyle}>
            <Svg style={StyleSheet.absoluteFill}>
                <Defs>
                    <SvgLinearGradient
                        id={gradientId}
                        x1={`${start.x * 100}%`}
                        y1={`${start.y * 100}%`}
                        x2={`${end.x * 100}%`}
                        y2={`${end.y * 100}%`}
                    >
                        {stops}
                    </SvgLinearGradient>
                </Defs>
                <Rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill={`url(#${gradientId})`}
                />
            </Svg>
            {children && <View style={childrenStyle}>{children}</View>}
        </View>
    );
};

export default LinearGradient;
