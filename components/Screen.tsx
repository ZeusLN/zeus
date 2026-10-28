import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { observer } from 'mobx-react';
import LinearGradient from './LinearGradient';
import RadialGradient from './RadialGradient';

import { themeColor } from '../utils/ThemeUtils';

interface ScreenProps {
    children?: ReactNode;
}

const Screen: React.FC<ScreenProps> = observer(({ children }) => {
    const gradient = themeColor('gradientBackground');
    const locations = themeColor('gradientLocations');
    const radial = themeColor('gradientRadial');

    if (gradient && radial) {
        return (
            <RadialGradient
                colors={gradient}
                locations={locations}
                shape={radial}
                style={{ flex: 1 }}
            >
                <View style={{ flex: 1 }}>{children}</View>
            </RadialGradient>
        );
    }

    return (
        <LinearGradient
            colors={
                gradient
                    ? gradient
                    : [themeColor('background'), themeColor('background')]
            }
            locations={locations}
            style={{
                flex: 1
            }}
        >
            <View style={{ flex: 1 }}>{children}</View>
        </LinearGradient>
    );
});

export default Screen;
