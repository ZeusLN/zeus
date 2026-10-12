import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Animated,
    Easing,
    Dimensions,
    LayoutChangeEvent
} from 'react-native';

import { themeColor } from '../utils/ThemeUtils';

interface ToggleOption {
    key: string;
    label: string;
}

interface ToggleButtonProps {
    options: ToggleOption[];
    value: string;
    onToggle: (key: string) => void;
}

interface ToggleButtonState {
    containerWidth: number;
}

export default class ToggleButton extends React.Component<
    ToggleButtonProps,
    ToggleButtonState
> {
    // Until the container is measured, assume it spans the window.
    // onLayout corrects this on wide or resized windows.
    state = {
        containerWidth: Dimensions.get('window').width
    };

    animation = new Animated.Value(
        this.props.options.findIndex((opt) => opt.key === this.props.value)
    );

    componentDidUpdate(prevProps: ToggleButtonProps) {
        if (prevProps.value !== this.props.value) {
            const idx = this.props.options.findIndex(
                (opt) => opt.key === this.props.value
            );
            Animated.timing(this.animation, {
                toValue: idx,
                duration: 200,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true
            }).start();
        }
    }

    render() {
        const { options, value, onToggle } = this.props;
        const horizontalPadding = 32;
        const toggleWidth = this.state.containerWidth - horizontalPadding;
        const thumbWidth = toggleWidth / options.length;
        const styles = getStyles(toggleWidth, thumbWidth);

        const translateX = this.animation.interpolate({
            inputRange: options.map((_, i) => i),
            outputRange: options.map((_, i) => i * thumbWidth + 2)
        });

        return (
            <View
                style={styles.container}
                onLayout={(event: LayoutChangeEvent) =>
                    this.setState({
                        containerWidth: event.nativeEvent.layout.width
                    })
                }
            >
                <View style={styles.toggleButton}>
                    <Animated.View
                        style={[
                            styles.thumb,
                            { width: thumbWidth, transform: [{ translateX }] }
                        ]}
                    />
                    <View style={styles.labelContainer}>
                        {options.map((opt, _idx) => (
                            <TouchableOpacity
                                key={opt.key}
                                style={styles.label}
                                activeOpacity={0.8}
                                onPress={() => onToggle(opt.key)}
                            >
                                <Text
                                    style={[
                                        styles.toggleText,
                                        value === opt.key && styles.activeText
                                    ]}
                                >
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        );
    }
}

const getStyles = (toggleWidth: number, thumbWidth: number) =>
    StyleSheet.create({
        container: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16
        },
        toggleButton: {
            width: toggleWidth,
            height: 40,
            borderRadius: 8,
            backgroundColor: themeColor('secondary'),
            position: 'relative',
            justifyContent: 'center',
            overflow: 'hidden'
        },
        thumb: {
            position: 'absolute',
            height: 36,
            borderRadius: 8,
            backgroundColor: themeColor('text'),
            top: 2,
            left: 0,
            elevation: 2,
            shadowColor: themeColor('background'),
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 1
        },
        labelContainer: {
            flexDirection: 'row',
            zIndex: 2
        },
        label: {
            width: thumbWidth,
            justifyContent: 'center',
            alignItems: 'center'
        },
        toggleText: {
            fontSize: 16,
            fontFamily: 'PPNeueMontreal-Book',
            color: themeColor('secondaryText'),
            textAlign: 'center'
        },
        activeText: {
            color: themeColor('background'),
            fontFamily: 'PPNeueMontreal-Medium'
        }
    });
