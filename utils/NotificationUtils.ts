import { Platform, Linking, AppState } from 'react-native';
import {
    checkNotifications,
    requestNotifications
} from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import stores from '../stores/Stores';
import { Settings } from '../stores/SettingsStore';
import { localeString } from './LocaleUtils';

const checkIfNotificationsNeeded = async (
    settings: Settings
): Promise<boolean> => {
    if (
        settings?.lightningAddress?.enabled &&
        settings?.lightningAddress?.notifications === 1
    )
        return true;

    if (
        settings?.nodes?.[settings.selectedNode!]?.implementation ===
        'embedded-lnd'
    ) {
        const persistentMode =
            (await AsyncStorage.getItem('persistentServicesEnabled')) ===
            'true';
        if (persistentMode) return true;
    }

    return false;
};

const handleNotificationPermissionBlocked = (
    permissionCheck: () => Promise<boolean>,
    callback?: (hasPermission: boolean) => void
) => {
    return new Promise<boolean>((resolve) => {
        stores.modalStore.toggleInfoModal({
            text: `${localeString(
                'notifications.permissionNeeded'
            )} ${localeString('notifications.permissionBlocked')}`,
            buttons: [
                {
                    title: localeString('views.Wallet.MainPane.goToSettings'),
                    callback: async () => {
                        Linking.openSettings();
                        // Wait for app to return to foreground and recheck
                        let appStateSubscription: any;
                        const checkPermission = async () => {
                            const hasPermission = await permissionCheck();
                            appStateSubscription?.remove();
                            callback?.(hasPermission);
                            resolve(hasPermission);
                        };
                        appStateSubscription = AppState.addEventListener(
                            'change',
                            (nextAppState) => {
                                if (nextAppState === 'active') {
                                    checkPermission();
                                }
                            }
                        );
                    }
                }
            ],
            onDismiss: () => {
                resolve(false);
            }
        });
    });
};

export const checkAndRequestNotificationPermissions =
    async (): Promise<boolean> => {
        const { status } = await requestNotifications(
            Platform.OS === 'ios' ? ['alert', 'sound'] : undefined
        );
        if (status === 'granted') return true;
        if (status === 'denied') return false;
        if (status === 'blocked') {
            return new Promise((resolve) => {
                handleNotificationPermissionBlocked(
                    async () => {
                        const { status } = await checkNotifications();
                        return status === 'granted';
                    },
                    (hasPermission) => resolve(hasPermission)
                ).then((result) => resolve(result));
            });
        }
        return false;
    };

export const handleNotificationPermissions = async (settings: Settings) => {
    if (await checkIfNotificationsNeeded(settings)) {
        await checkAndRequestNotificationPermissions();
    }
};
