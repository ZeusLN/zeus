import {
    Canvas,
    useImage,
    ImageShader,
    vec,
    LinearGradient,
    RadialGradient
} from '@shopify/react-native-skia';
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue
} from 'react-native-reanimated';

import { BlurGradient } from '../components/BlurGradient';

const { width, height } = Dimensions.get('window');

export default function BlurGradientDemo(props: any) {
    const image = useImage(require('../assets/images/hyper.jpg'));
    const scrollY = useSharedValue(0);

    const onScroll = useAnimatedScrollHandler({
        onScroll: ({ contentOffset: { y } }) => {
            scrollY.value = -y;
        }
    });

    return (
        <View style={{ flex: 1 }}>
            <Canvas style={{ flex: 1 }}>
                <BlurGradient
                    mask={
                        <>
                            {false && (
                                <LinearGradient
                                    start={vec(0, height * 0.61)}
                                    end={vec(0, height)}
                                    colors={['transparent', 'black']}
                                />
                            )}
                            <RadialGradient
                                c={vec(width / 2, height / 2)}
                                r={width * 1.2}
                                colors={['transparent', 'transparent', 'black']}
                            />
                        </>
                    }
                >
                    <ImageShader
                        image={image}
                        x={0}
                        y={scrollY}
                        width={width}
                        height={height}
                        fit="cover"
                        fm="linear"
                        tx="clamp"
                        ty="clamp"
                    />
                </BlurGradient>
            </Canvas>
            <View style={StyleSheet.absoluteFill}>
                <Animated.View scrollEventThrottle={16} onScroll={onScroll} />
                {props.children}
            </View>
        </View>
    );
}
