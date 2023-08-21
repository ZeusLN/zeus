import React from 'react';
import { Pressable, TouchableOpacity } from 'react-native';

interface TouchableProps {
    touch: () => void;
    highlight: boolean;
    children: JSX.Element;
    style?: any;
}

export default function Touchable({
    touch,
    highlight,
    children,
    style
}: TouchableProps) {
    return (
        <>
            {highlight && (
                <TouchableOpacity style={style} onPress={touch}>
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
