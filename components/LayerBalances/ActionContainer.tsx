import React from 'react';
import Animated, {
    interpolate,
    SharedValue,
    useAnimatedStyle
} from 'react-native-reanimated';

const ActionContainer = ({
    x,
    progress,
    children
}: {
    x: number;
    progress: SharedValue<number>;
    children: React.ReactNode;
}) => {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: interpolate(progress.value, [0.25, 1], [x, 0]) }
        ],
        opacity: interpolate(progress.value, [0, 1], [0, 1])
    }));
    return (
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
            {children}
        </Animated.View>
    );
};

export default ActionContainer;
