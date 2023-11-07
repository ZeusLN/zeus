import * as React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { themeColor } from './../utils/ThemeUtils';

interface PillProps {
    title: string;
    textColor?: string;
    borderColor?: string;
    backgroundColor?: string;
}

function Pill(props: PillProps) {
    const { title, textColor, borderColor, backgroundColor } = props;

    return (
        <TouchableOpacity
            style={{
                borderWidth: 3,
                borderColor: borderColor || themeColor('highlight'),
                alignItems: 'center',
                justifyContent: 'center',
                width: 90,
                height: 40,
                backgroundColor: backgroundColor || themeColor('background'),
                borderRadius: 50
            }}
        >
            <Text
                style={{
                    color: textColor || themeColor('highlight'),
                    fontFamily: 'PPNeueMontreal-Book'
                }}
            >
                {title}
            </Text>
        </TouchableOpacity>
    );
}

export default Pill;
