import React from 'react';
import { TextStyle, StyleProp, TextProps } from 'react-native';

export interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
}

export interface IconButtonProps extends IconProps {
    onPress?: () => void;
    underlayColor?: string;
    backgroundColor?: string;
    borderRadius?: number;
}

export default class Icon extends React.Component<IconProps> {
    static getImageSource(
        name: string,
        size?: number,
        color?: string
    ): Promise<any>;
    static getImageSourceSync(name: string, size?: number, color?: string): any;
}
