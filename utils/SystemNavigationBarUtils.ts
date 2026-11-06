import SystemNavigationBar from 'react-native-system-navigation-bar';

import { isLightTheme, themeColor } from './ThemeUtils';

// Styles the Android system bars for the current theme: the navigation bar
// takes the background color, the icons in both bars are dark on light themes
// and light on dark ones, and the navigation bar divider takes the secondary
// color. On Android 15+ with targetSdk 35+ the OS ignores the bar and divider
// colors (edge-to-edge) and only the icon style applies. No-op on iOS.
export const applySystemNavigationBarTheme = async (): Promise<void> => {
    try {
        await SystemNavigationBar.setBarColor(themeColor('background'), {
            bar: 'navigation'
        });
        await SystemNavigationBar.setBarStyle(
            isLightTheme() ? 'dark' : 'light',
            'both'
        );
        await SystemNavigationBar.setDividerColor(themeColor('secondary'));
    } catch (e) {
        console.log('Error styling the system navigation bar', e);
    }
};
