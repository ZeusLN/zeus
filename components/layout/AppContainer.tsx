import { SafeAreaView } from 'react-native';
import { themeColor } from '../../utils/ThemeUtils';

export function AppContainer({
    style = {},
    children
}: {
    style?: any;
    children?: React.ReactNode;
}) {
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
}
