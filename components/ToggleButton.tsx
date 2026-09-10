import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Animated,
    Easing,
    Dimensions
} from 'react-native';

import {
    LiquidGlassView,
    isLiquidGlassSupported
} from '@callstack/liquid-glass';

import { isLightTheme, themeColor } from '../utils/ThemeUtils';

interface ToggleOption {
    key: string;
    label: string;
}

interface ToggleButtonProps {
    options: ToggleOption[];
    value: string;
    onToggle: (key: string) => void;
}

export default class ToggleButton extends React.Component<ToggleButtonProps> {
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
        const screenWidth = Dimensions.get('window').width;
        // glass toggles match the native tab bar platter's 21pt margins
        const horizontalPadding = isLiquidGlassSupported ? 42 : 32;
        const toggleWidth = screenWidth - horizontalPadding;
        const thumbWidth = toggleWidth / options.length;
        const styles = getStyles(toggleWidth, thumbWidth);

        const translateX = this.animation.interpolate({
            inputRange: options.map((_, i) => i),
            outputRange: options.map((_, i) => i * thumbWidth + 2)
        });

        const Track: React.ElementType = isLiquidGlassSupported
            ? LiquidGlassView
            : View;
        const trackProps = isLiquidGlassSupported
            ? {
                  effect: 'regular' as const,
                  colorScheme: (isLightTheme() ? 'light' : 'dark') as
                      | 'light'
                      | 'dark'
              }
            : {};

        return (
            <View style={styles.container}>
                <Track style={styles.toggleButton} {...trackProps}>
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
                </Track>
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
            borderRadius: isLiquidGlassSupported ? 20 : 8,
            backgroundColor: isLiquidGlassSupported
                ? 'transparent'
                : themeColor('secondary'),
            position: 'relative',
            justifyContent: 'center',
            overflow: 'hidden'
        },
        thumb: {
            position: 'absolute',
            height: 36,
            borderRadius: isLiquidGlassSupported ? 18 : 8,
            backgroundColor: isLiquidGlassSupported
                ? themeColor('secondary')
                : themeColor('text'),
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
            color: isLiquidGlassSupported
                ? themeColor('text')
                : themeColor('background'),
            fontFamily: 'PPNeueMontreal-Medium'
        }
    });
