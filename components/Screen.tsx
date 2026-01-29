import React, { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import LinearGradient from './LinearGradient';

import { themeColor } from '../utils/ThemeUtils';

interface ScreenProps {
    children?: ReactNode;
    style?: ViewStyle;
}

const Screen: React.FC<ScreenProps> = ({ children }) => {
    return (
        <LinearGradient
            colors={
                themeColor('gradientBackground')
                    ? themeColor('gradientBackground')
                    : [themeColor('background'), themeColor('background')]
            }
            style={{
                flex: 1
            }}
        >
            <View style={{ flex: 1 }}>{children}</View>
        </LinearGradient>
    );
};

export default Screen;
