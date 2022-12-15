import { SafeAreaView } from 'react-native';
import { Observer } from 'mobx-react';
import { themeColor } from '../../utils/ThemeUtils';

export function AppContainer({
    style = {},
    children
}: {
    style?: any;
    children?: React.ReactNode;
}) {
    return (
        <Observer>
            {() => {
                return (
                    <SafeAreaView
                        style={{
                            flex: 1,
                            backgroundColor: themeColor('background'),
                            ...style
                        }}
                    >
                        {children}
                    </SafeAreaView>
                );
            }}
        </Observer>
    );
}
