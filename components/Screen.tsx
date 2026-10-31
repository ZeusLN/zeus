import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
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

    // The gradient is a background sibling, so the children keep the same
    // place in the tree when a theme switches between a linear and a radial
    // gradient. Wrapping them in the gradient instead would remount the whole
    // app below Screen on every such switch.
    return (
        <View style={styles.container}>
            {gradient && radial ? (
                <RadialGradient
                    colors={gradient}
                    locations={locations}
                    shape={radial}
                    style={StyleSheet.absoluteFill}
                />
            ) : (
                <LinearGradient
                    colors={
                        gradient
                            ? gradient
                            : [
                                  themeColor('background'),
                                  themeColor('background')
                              ]
                    }
                    locations={locations}
                    style={StyleSheet.absoluteFill}
                />
            )}
            <View style={styles.container}>{children}</View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
});

export default Screen;
