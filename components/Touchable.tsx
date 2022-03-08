import React from 'react';
import { Pressable, TouchableOpacity, View } from 'react-native';

interface TouchableProps {
    touch: () => void;
    highlight: boolean;
    children: JSX.Element;
}

export default function Touchable({
    touch,
    highlight,
    children
}: TouchableProps) {
    return (
        <>
            {highlight && (
                <TouchableOpacity onPress={touch}>{children}</TouchableOpacity>
            )}
            {!highlight && <Pressable onPress={touch}>{children}</Pressable>}
        </>
    );
}
