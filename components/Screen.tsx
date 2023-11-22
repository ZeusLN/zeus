import { observer } from 'mobx-react';
import { PureComponent, ReactNode } from 'react';
import { SafeAreaView, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { themeColor } from '../utils/ThemeUtils';

interface ScreenProps {
    children?: ReactNode;
    style?: ViewStyle;
}

@observer
export default class Screen extends PureComponent<ScreenProps> {
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
                <SafeAreaView style={{ flex: 1 }}>
                    {this.props.children}
                </SafeAreaView>
            </LinearGradient>
        );
    }
}
