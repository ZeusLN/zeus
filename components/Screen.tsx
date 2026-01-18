import { observer } from 'mobx-react';
import { PureComponent, ReactNode } from 'react';
import { ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from './LinearGradient';

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
