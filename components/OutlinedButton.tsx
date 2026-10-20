import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Icon } from '@rneui/themed';

import { themeColor } from '../utils/ThemeUtils';

interface OutlinedButtonProps {
    title: string;
    onPress: () => void;
    // Material icon shown after the title
    icon?: string;
    disabled?: boolean;
    accessibilityLabel?: string;
    style?: ViewStyle;
}

export default function OutlinedButton({
    title,
    onPress,
    icon,
    disabled,
    accessibilityLabel,
    style
}: OutlinedButtonProps) {
    const color = disabled ? themeColor('secondaryText') : themeColor('text');

    return (
        <TouchableOpacity
            style={{ ...styles.button, borderColor: color, ...style }}
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || title}
            accessibilityState={{ disabled: !!disabled }}
        >
            <Text style={{ ...styles.title, color }}>{title}</Text>
            {icon && (
                <Icon
                    name={icon}
                    color={color}
                    size={20}
                    style={styles.icon}
                    accessible={false}
                />
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 5,
        paddingVertical: 10,
        paddingHorizontal: 16
    },
    title: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book'
    },
    icon: {
        marginLeft: 8
    }
});
