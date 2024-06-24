import React, { useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    PanResponder,
    PanResponderGestureState,
    GestureResponderEvent,
    Dimensions
} from 'react-native';

import CaretRight from '../assets/images/SVG/Caret Right.svg';
import { themeColor } from '../utils/ThemeUtils';

interface SwipeButtonProps {
    onSwipeSuccess: () => void;
    swipeButtonStyle?: object;
    instructionText?: string;
    instructionsStyle?: object;
    containerStyle?: object;
}

const SwipeButton: React.FC<SwipeButtonProps> = ({
    onSwipeSuccess,
    swipeButtonStyle,
    instructionText = '',
    instructionsStyle,
    containerStyle
}) => {
    const pan = useRef(new Animated.Value(0)).current;
    const screenWidth = Dimensions.get('window').width;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                pan.setOffset(pan._value);
            },
            onPanResponderMove: Animated.event([null, { dx: pan }], {
                useNativeDriver: false
            }),
            onPanResponderRelease: (
                e: GestureResponderEvent,
                gesture: PanResponderGestureState
            ) => {
                if (gesture.dx > screenWidth * 0.6) {
                    onSwipeSuccess();
                    Animated.spring(pan, {
                        toValue: screenWidth - 80,
                        useNativeDriver: false
                    }).start();
                } else {
                    Animated.spring(pan, {
                        toValue: 0,
                        useNativeDriver: false
                    }).start();
                }
            }
        })
    ).current;

    return (
        <View style={[styles.container, containerStyle]}>
            <View style={[styles.instructionsContainer, instructionsStyle]}>
                <Text style={[styles.instructions]}>{instructionText}</Text>
            </View>
            <Animated.View
                style={[
                    styles.swipeButton,
                    swipeButtonStyle,
                    { transform: [{ translateX: pan }] }
                ]}
                {...panResponder.panHandlers}
            >
                <CaretRight
                    fill={themeColor('background')}
                    width={24}
                    height={24}
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 50,
        backgroundColor: '#ccc',
        borderRadius: 5,
        marginHorizontal: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },
    instructionsContainer: {
        alignItems: 'center'
    },
    instructions: {
        fontSize: 16,
        color: 'black'
    },
    swipeButton: {
        position: 'absolute',
        left: 0,
        width: 50,
        height: 50,
        color: 'black',
        backgroundColor: 'white',
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center'
    },
    textStyle: {
        fontSize: 18
    }
});

export default SwipeButton;
