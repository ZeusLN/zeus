import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, {
    Defs,
    RadialGradient as SvgRadialGradient,
    Stop,
    Rect
} from 'react-native-svg';

// Center and radii as fractions of the view's width (cx, rx) and height
// (cy, ry). { cx: 0, cy: 0 } anchors the gradient at the top-left corner.
export interface RadialShape {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
}

interface RadialGradientProps {
    colors: string[];
    shape: RadialShape;
    locations?: number[];
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
}

const RadialGradient: React.FC<RadialGradientProps> = ({
    colors,
    shape,
    locations,
    style,
    children
}) => {
    const gradientId = useMemo(
        () => `radial-${Math.random().toString(36).substr(2, 9)}`,
        []
    );

    const stops = useMemo(
        () =>
            colors.map((color, index) => {
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
            }),
        [colors, locations]
    );

    const pct = (n: number) => `${n * 100}%`;

    return (
        <View style={[style, { overflow: 'hidden' }]}>
            <Svg style={StyleSheet.absoluteFill}>
                <Defs>
                    <SvgRadialGradient
                        id={gradientId}
                        cx={pct(shape.cx)}
                        cy={pct(shape.cy)}
                        fx={pct(shape.cx)}
                        fy={pct(shape.cy)}
                        rx={pct(shape.rx)}
                        ry={pct(shape.ry)}
                    >
                        {stops}
                    </SvgRadialGradient>
                </Defs>
                <Rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill={`url(#${gradientId})`}
                />
            </Svg>
            {children}
        </View>
    );
};

export default RadialGradient;
