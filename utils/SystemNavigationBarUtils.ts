import SystemNavigationBar from 'react-native-system-navigation-bar';

import { isLightTheme, themeColor } from './ThemeUtils';

const attempt = async (step: string, call: () => Promise<void>) => {
    try {
        await call();
    } catch (e) {
        console.log(`Error styling the system bars (${step})`, e);
    }
};

// Styles the Android system bars for the current theme: the navigation bar
// takes the background color, the icons in both bars are dark on light themes
// and light on dark ones ('both' matches 2.x, whose setNavigationColor applied
// the style to both bars when no bar was given), and the navigation bar
// divider takes the secondary color. On Android 15+ with targetSdk 35+ the OS
// ignores the bar and divider colors (edge-to-edge) and only the icon style
// applies. Each call runs on its own, so one rejection does not skip the
// others. No-op on iOS.
export const applySystemNavigationBarTheme = async (): Promise<void> => {
    await attempt('bar color', () =>
        SystemNavigationBar.setBarColor(themeColor('background'), {
            bar: 'navigation'
        })
    );
    await attempt('bar style', () =>
        SystemNavigationBar.setBarStyle(
            isLightTheme() ? 'dark' : 'light',
            'both'
        )
    );
    await attempt('divider color', () =>
        SystemNavigationBar.setDividerColor(themeColor('secondary'))
    );
};
