import React from 'react';
import LinearGradient from 'react-native-linear-gradient';

import { themeColor } from '../utils/ThemeUtils';

export default class Screen extends React.PureComponent {
    render() {
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
                {this.props.children}
            </LinearGradient>
        );
    }
}
