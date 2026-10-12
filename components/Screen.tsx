import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { observer } from 'mobx-react';
import LinearGradient from './LinearGradient';

import { MAX_CONTENT_WIDTH } from '../utils/LayoutUtils';
import { themeColor } from '../utils/ThemeUtils';

interface ScreenProps {
    children?: ReactNode;
    // Center the content in a column no wider than MAX_CONTENT_WIDTH, so it
    // does not stretch across tablets and unfolded foldables. The background
    // still fills the window.
    limitWidth?: boolean;
}

const Screen: React.FC<ScreenProps> = observer(({ children, limitWidth }) => {
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
            <View
                style={
                    limitWidth
                        ? {
                              flex: 1,
                              width: '100%',
                              maxWidth: MAX_CONTENT_WIDTH,
                              alignSelf: 'center'
                          }
                        : { flex: 1 }
                }
            >
                {children}
            </View>
        </LinearGradient>
    );
});

export default Screen;
