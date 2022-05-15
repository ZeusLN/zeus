import * as React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { themeColor } from './../utils/ThemeUtils';

interface PillProps {
    title: string;
    textColor?: string;
    borderColor?: string;
    backgroundColor?: string;
    onPress?: Function;
}

function Pill(props: PillProps) {
    const { title, textColor, borderColor, backgroundColor, onPress } = props;

    return (
        <TouchableOpacity
            style={{
                borderWidth: borderColor ? 3 : 0,
                borderColor: borderColor,
                alignItems: 'center',
                justifyContent: 'center',
                width: 90,
                height: 40,
                backgroundColor: backgroundColor || themeColor('background'),
                borderRadius: 50
            }}
            onPress={onPress}
        >
            <Text
                style={{
                    color: textColor || themeColor('highlight'),
                    fontFamily: 'Lato-Regular'
                }}
            >
                {title}
            </Text>
        </TouchableOpacity>
    );
}

export default Pill;
