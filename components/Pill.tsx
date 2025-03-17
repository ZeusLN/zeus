import * as React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { themeColor } from './../utils/ThemeUtils';

interface PillProps {
    title: string;
    textColor?: string;
    borderColor?: string;
    borderWidth?: number;
    backgroundColor?: string;
    width?: number | string;
    height?: number;
    onPress?: () => void;
}

function Pill(props: PillProps) {
    const {
        title,
        textColor,
        borderColor,
        borderWidth,
        backgroundColor,
        width,
        height,
        onPress
    } = props;

    if (!onPress) {
        return (
            <View
                style={{
                    ...styles.wrapper,
                    borderWidth: borderWidth
                        ? borderWidth
                        : borderColor
                        ? 3
                        : 0,
                    borderColor: borderColor || themeColor('highlight'),
                    width: width || 90,
                    height: height || 40,
                    backgroundColor: backgroundColor || themeColor('background')
                }}
            >
                <Text
                    style={{
                        ...styles.text,
                        color: textColor || themeColor('highlight')
                    }}
                >
                    {title}
                </Text>
            </View>
        );
    }

    return (
        <TouchableOpacity
            style={{
                ...styles.wrapper,
                borderWidth: borderWidth ? borderWidth : borderColor ? 3 : 0,
                borderColor: borderColor || themeColor('highlight'),
                width: width || 90,
                height: height || 40,
                backgroundColor: backgroundColor || themeColor('background')
            }}
            onPress={onPress}
        >
            <Text
                style={{
                    ...styles.text,
                    color: textColor || themeColor('highlight')
                }}
            >
                {title}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 50
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    }
});

export default Pill;
