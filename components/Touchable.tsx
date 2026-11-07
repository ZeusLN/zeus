import React from 'react';
import { Pressable, TouchableOpacity } from 'react-native';

interface TouchableProps {
    touch: () => void;
    onLongPress?: () => void;
    highlight: boolean;
    children: React.ReactNode;
    style?: any;
    testID?: string;
}

export default function Touchable({
    touch,
    onLongPress,
    highlight,
    children,
    style,
    testID
}: TouchableProps) {
    return (
        <>
            {highlight && (
                <TouchableOpacity
                    style={style}
                    onPress={touch}
                    onLongPress={onLongPress}
                    testID={testID}
                >
                    {children}
                </TouchableOpacity>
            )}
            {!highlight && (
                <Pressable
                    style={style}
                    onPress={touch}
                    onLongPress={onLongPress}
                    testID={testID}
                >
                    {children}
                </Pressable>
            )}
        </>
    );
}
