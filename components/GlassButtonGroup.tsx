import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { ButtonGroup, ButtonGroupProps } from '@rneui/themed';

import {
    LiquidGlassView,
    isLiquidGlassSupported
} from '@callstack/liquid-glass';

import { isLightTheme, themeColor } from '../utils/ThemeUtils';

// Drop-in replacement for @rneui/themed's ButtonGroup that renders the
// group on a Liquid Glass track with a capsule selection on iOS 26+,
// matching the app's tab bars. Elsewhere it passes through unchanged.
export const getGlassSelectedButtonStyle = (
    selectedButtonStyle: StyleProp<ViewStyle>,
    borderRadius: number
): ViewStyle => {
    const flattened = StyleSheet.flatten(selectedButtonStyle) || {};
    return {
        ...flattened,
        // default to the highlight fill: many call sites render custom
        // button elements whose selected text color assumes it
        backgroundColor: flattened.backgroundColor ?? themeColor('highlight'),
        borderRadius
    };
};

const GlassButtonGroup: React.FC<ButtonGroupProps> = (props) => {
    if (!isLiquidGlassSupported) {
        return <ButtonGroup {...props} />;
    }

    const {
        containerStyle,
        selectedButtonStyle,
        selectedTextStyle,
        innerBorderStyle,
        ...rest
    } = props;

    const flattened = StyleSheet.flatten(containerStyle) || {};
    const height = typeof flattened.height === 'number' ? flattened.height : 40;
    const borderRadius = height / 2;

    return (
        <LiquidGlassView
            effect="regular"
            colorScheme={isLightTheme() ? 'light' : 'dark'}
            style={[
                flattened,
                {
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    borderRadius,
                    overflow: 'hidden'
                }
            ]}
        >
            <ButtonGroup
                {...rest}
                containerStyle={{
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    margin: 0,
                    marginHorizontal: 0,
                    marginVertical: 0,
                    borderRadius,
                    height
                }}
                selectedButtonStyle={getGlassSelectedButtonStyle(
                    selectedButtonStyle,
                    borderRadius
                )}
                selectedTextStyle={
                    selectedTextStyle || { color: themeColor('background') }
                }
                innerBorderStyle={{ width: 0, ...innerBorderStyle }}
            />
        </LiquidGlassView>
    );
};

export default GlassButtonGroup;
