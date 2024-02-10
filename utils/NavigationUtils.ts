import stores from '../stores/Stores';

const protectedNavigation = async (
    navigation: any,
    route: string,
    disactivatePOS?: boolean
) => {
    const { posStatus, settings, setPosStatus } = stores.settingsStore;
    const loginRequired = settings && (settings.passphrase || settings.pin);
    const posEnabled = posStatus === 'active';

    if (posEnabled && loginRequired) {
        navigation.navigate('Lockscreen', {
            attemptAdminLogin: true
        });
    } else {
        if (disactivatePOS) setPosStatus('inactive');
        navigation.navigate(route);
    }
};

export { protectedNavigation };
