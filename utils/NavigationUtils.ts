import { StackNavigationProp } from '@react-navigation/stack';

import stores from '../stores/Stores';

const protectedNavigation = async (
    navigation: StackNavigationProp<any, any>,
    route: string,
    disactivatePOS?: boolean,
    routeParams?: any
) => {
    const { posStatus, settings, setPosStatus } = stores.settingsStore;
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

export { protectedNavigation };
