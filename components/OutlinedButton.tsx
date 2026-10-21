import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Icon } from '@rneui/themed';

import { themeColor } from '../utils/ThemeUtils';

interface OutlinedButtonProps {
    title: string;
    // Shown after the title in a heavier weight, e.g. a fee rate
    value?: string;
    onPress: () => void;
    // Material icon shown after the title
    icon?: string;
    disabled?: boolean;
    // Marks the chosen option in a group of buttons
    selected?: boolean;
    accessibilityLabel?: string;
    style?: ViewStyle;
}

export default function OutlinedButton({
    title,
    value,
    onPress,
    icon,
    disabled,
    selected,
    accessibilityLabel,
    style
}: OutlinedButtonProps) {
    const color = disabled
        ? themeColor('secondaryText')
        : selected
        ? themeColor('highlight')
        : themeColor('text');

    return (
        <TouchableOpacity
            style={{ ...styles.button, borderColor: color, ...style }}
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={
                accessibilityLabel || (value ? `${title} ${value}` : title)
            }
            accessibilityState={{ disabled: !!disabled, selected: !!selected }}
        >
            <Text style={{ ...styles.title, color }}>{title}</Text>
            {value !== undefined && (
                <Text style={{ ...styles.value, color }}>{value}</Text>
            )}
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
    value: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Medium',
        marginLeft: 8
    },
    icon: {
        marginLeft: 8
    }
});
