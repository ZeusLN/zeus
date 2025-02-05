import React from 'react';
import { Pressable, TouchableOpacity } from 'react-native';

interface TouchableProps {
    touch: () => void;
    onLongPress?: () => void;
    highlight: boolean;
    children: JSX.Element;
    style?: any;
}

export default function Touchable({
    touch,
    onLongPress,
    highlight,
    children,
    style
}: TouchableProps) {
    return (
        <>
            {highlight && (
                <TouchableOpacity
                    style={style}
                    onPress={touch}
                    onLongPress={onLongPress}
                >
                    {children}
                </TouchableOpacity>
            )}
            {!highlight && (
                <Pressable style={style} onPress={touch}>
                    {children}
                </Pressable>
            )}
        </>
    );
}
