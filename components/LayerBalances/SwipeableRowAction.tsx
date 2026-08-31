import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import Animated, {
    interpolate,
    SharedValue,
    useAnimatedStyle
} from 'react-native-reanimated';

import { themeColor } from './../../utils/ThemeUtils';

interface SwipeableRowActionProps {
    text: string;
    // translateX offset the action slides in from
    x: number;
    progress: SharedValue<number>;
    icon: React.ReactNode;
    onPress: () => void;
}

/**
 * One action revealed behind a swipeable wallet row. The row supplies the
 * icon and what the press does, so navigation stays with the row it
 * belongs to.
 */
const SwipeableRowAction: React.FC<SwipeableRowActionProps> = ({
    text,
    x,
    progress,
    icon,
    onPress
}) => {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: interpolate(progress.value, [0.25, 1], [x, 0]) }
        ],
        opacity: interpolate(progress.value, [0, 1], [0, 1])
    }));

    return (
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
            <RectButton style={[styles.action]} onPress={onPress}>
                <View
                    style={[styles.view]}
                    accessible
                    accessibilityRole="button"
                >
                    {icon}
                    <Text
                        style={{
                            ...styles.actionText,
                            color: themeColor('text')
                        }}
                    >
                        {text}
                    </Text>
                </View>
            </RectButton>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    actionText: {
        fontSize: 12,
        backgroundColor: 'transparent',
        paddingTop: 10,
        paddingHorizontal: 4,
        fontFamily: 'PPNeueMontreal-Book'
    },
    action: {
        flex: 1,
        justifyContent: 'center'
    },
    view: {
        alignItems: 'center'
    }
});

export default SwipeableRowAction;
