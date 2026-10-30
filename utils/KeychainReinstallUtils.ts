import { NativeModules, Platform } from 'react-native';

/**
 * True on an iOS install that replaced an earlier install on this device.
 * The first-run check in AppDelegate.mm sets KEYCHAIN_SURVIVED_REINSTALL in
 * NSUserDefaults when a fresh install finds device-local keychain items left
 * by an earlier install, then empties the device-local keychain on purpose,
 * so nothing may copy the iCloud Keychain partition back into it. A first
 * install on a new device resolves false and keeps the copy.
 *
 * Read through KeychainAudit at call time, not RN's Settings module, whose
 * snapshot can predate a first-run check deferred until protected data is
 * available. Resolves false if the native module cannot be read.
 */
export const keychainSurvivedReinstall = async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') return false;
    try {
        const KeychainAudit = NativeModules.KeychainAudit;
        if (!KeychainAudit) return false;
        return Boolean(await KeychainAudit.keychainSurvivedReinstall());
    } catch (e) {
        return false;
    }
};
