// Jest applies this mock to every test that loads react-native-keychain,
// because since 11.0.0 the real module calls
// TurboModuleRegistry.getEnforcing('RNKeychainManager') at import time and
// throws when the native module is missing. Tests that need stored values or
// failures can still pass their own jest.mock factory.
export enum ACCESSIBLE {
    WHEN_UNLOCKED = 'AccessibleWhenUnlocked',
    AFTER_FIRST_UNLOCK = 'AccessibleAfterFirstUnlock',
    ALWAYS = 'AccessibleAlways',
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 'AccessibleWhenPasscodeSetThisDeviceOnly',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'AccessibleWhenUnlockedThisDeviceOnly',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'AccessibleAfterFirstUnlockThisDeviceOnly'
}

// Nothing is stored: reads resolve false like the real module on a miss
export const getInternetCredentials = jest.fn().mockResolvedValue(false);
export const setInternetCredentials = jest
    .fn()
    .mockResolvedValue({ storage: 'keychain' });
export const resetInternetCredentials = jest.fn().mockResolvedValue(true);
export const hasInternetCredentials = jest.fn().mockResolvedValue(false);
export const getGenericPassword = jest.fn().mockResolvedValue(false);
export const setGenericPassword = jest
    .fn()
    .mockResolvedValue({ storage: 'keychain' });
export const resetGenericPassword = jest.fn().mockResolvedValue(true);
export const hasGenericPassword = jest.fn().mockResolvedValue(false);

export default {
    ACCESSIBLE,
    getInternetCredentials,
    setInternetCredentials,
    resetInternetCredentials,
    hasInternetCredentials,
    getGenericPassword,
    setGenericPassword,
    resetGenericPassword,
    hasGenericPassword
};
