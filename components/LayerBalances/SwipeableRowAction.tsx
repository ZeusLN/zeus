import * as React from 'react';
import { Animated, Text, View } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';

import { themeColor } from './../../utils/ThemeUtils';
import styles from './swipeableRowStyles';

interface SwipeableRowActionProps {
    text: string;
    // Width of the whole action strip: the action slides in from there
    x: number;
    progress: Animated.AnimatedInterpolation<number>;
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
    const transTranslateX = progress.interpolate({
        inputRange: [0.25, 1],
        outputRange: [x, 0]
    });
    const transOpacity = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
    });

    return (
        <Animated.View
            style={{
                flex: 1,
                transform: [{ translateX: transTranslateX }],
                opacity: transOpacity
            }}
        >
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

export default SwipeableRowAction;
