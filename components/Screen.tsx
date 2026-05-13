import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { observer } from 'mobx-react';
import LinearGradient from './LinearGradient';

import { themeColor } from '../utils/ThemeUtils';

interface ScreenProps {
    children?: ReactNode;
}

const Screen: React.FC<ScreenProps> = observer(({ children }) => {
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
});

export default Screen;
