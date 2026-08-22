import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { settingsStore } from '../stores/Stores';

const protectedNavigation = async (
    navigation: NativeStackNavigationProp<any, any>,
    route: string,
    disactivatePOS?: boolean,
    routeParams?: any
) => {
    const { posStatus, settings, setPosStatus } = settingsStore;
    const loginRequired = settings && (settings.passphrase || settings.pin);
    const posEnabled = posStatus === 'active';

    if (posEnabled && loginRequired) {
        navigation.navigate('Lockscreen', {
            pendingNavigation: { screen: route, params: routeParams }
        });
    } else {
        if (disactivatePOS) setPosStatus('inactive');
        navigation.navigate(route, routeParams);
    }
};

// Requires re-authentication (PIN, passphrase, or biometrics) before
// navigating to a screen that reveals sensitive material (e.g. the seed),
// regardless of POS status or current session login state
const reAuthNavigation = (
    navigation: NativeStackNavigationProp<any, any>,
    route: string,
    routeParams?: any
) => {
    if (settingsStore.loginMethodConfigured()) {
        navigation.navigate('Lockscreen', {
            pendingNavigation: { screen: route, params: routeParams }
        });
    } else {
        navigation.navigate(route, routeParams);
    }
};

export { protectedNavigation, reAuthNavigation };
