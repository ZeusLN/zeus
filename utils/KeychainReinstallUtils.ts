import { Platform, Settings } from 'react-native';

// Set in NSUserDefaults by the first-run check in AppDelegate.mm when a
// fresh install finds device-local keychain items left by an earlier install
// on this device
export const KEYCHAIN_SURVIVED_REINSTALL_KEY = 'KEYCHAIN_SURVIVED_REINSTALL';

/**
 * True on an iOS install that replaced an earlier install on this device.
 * The first-run check emptied the device-local keychain on purpose, so
 * nothing may copy the iCloud Keychain partition back into it. A first
 * install on a new device returns false and keeps the copy.
 */
export const keychainSurvivedReinstall = (): boolean => {
    if (Platform.OS !== 'ios') return false;
    try {
        return Boolean(Settings.get(KEYCHAIN_SURVIVED_REINSTALL_KEY));
    } catch (e) {
        return false;
    }
};
