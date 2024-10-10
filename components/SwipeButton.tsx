import React, { useRef, useState } from 'react';
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

import CaretRight from '../assets/images/SVG/Caret Right alt.svg';
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

    const containerWidth = screenWidth - 40;
    const swipeButtonWidth = 50;
    const maxTranslation = containerWidth - swipeButtonWidth;

    const textOpacity = pan.interpolate({
        inputRange: [0, maxTranslation / 2, maxTranslation],
        outputRange: [1, 0, 0],
        extrapolate: 'clamp'
    });

    const [offset, setOffset] = useState(0);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                pan.setOffset(offset);
                pan.setValue(0);
            },
            onPanResponderMove: (_e, gesture) => {
                const newValue = gesture.dx;
                if (newValue >= 0 && newValue <= maxTranslation) {
                    pan.setValue(newValue);
                }
            },
            onPanResponderRelease: (
                _e: GestureResponderEvent,
                gesture: PanResponderGestureState
            ) => {
                const finalValue =
                    gesture.dx > maxTranslation * 0.95 ? maxTranslation : 0;
                if (finalValue === maxTranslation) {
                    onSwipeSuccess();
                }

                Animated.spring(pan, {
                    toValue: finalValue,
                    useNativeDriver: false
                }).start(() => {
                    setOffset(finalValue);
                });
            }
        })
    ).current;

    return (
        <View style={[styles.container, containerStyle]}>
            <Animated.View
                style={[
                    styles.instructionsContainer,
                    instructionsStyle,
                    { opacity: textOpacity }
                ]}
            >
                <Text style={[styles.instructions]}>{instructionText}</Text>
            </Animated.View>
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
        alignItems: 'center',
        marginTop: 20
    },
    instructionsContainer: {
        alignItems: 'center'
    },
    instructions: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book',
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
