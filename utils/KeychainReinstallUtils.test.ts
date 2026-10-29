// The Settings native module is not registered under Jest
jest.mock('react-native/Libraries/Settings/Settings', () => ({
    __esModule: true,
    default: { get: jest.fn() }
}));

import { Platform, Settings } from 'react-native';

import {
    KEYCHAIN_SURVIVED_REINSTALL_KEY,
    keychainSurvivedReinstall
} from './KeychainReinstallUtils';

describe('keychainSurvivedReinstall', () => {
    const originalOS = Platform.OS;
    let get: jest.SpyInstance;

    beforeEach(() => {
        Platform.OS = 'ios';
        get = jest.spyOn(Settings, 'get');
    });

    afterEach(() => {
        Platform.OS = originalOS;
        get.mockRestore();
    });

    it('reads the flag AppDelegate sets', () => {
        get.mockReturnValue(true);

        expect(keychainSurvivedReinstall()).toBe(true);
        expect(get).toHaveBeenCalledWith(KEYCHAIN_SURVIVED_REINSTALL_KEY);
    });

    it('is false when the flag is unset or false', () => {
        get.mockReturnValue(undefined);
        expect(keychainSurvivedReinstall()).toBe(false);
        get.mockReturnValue(false);
        expect(keychainSurvivedReinstall()).toBe(false);
    });

    it('is false off iOS without reading defaults', () => {
        Platform.OS = 'android';
        get.mockReturnValue(true);

        expect(keychainSurvivedReinstall()).toBe(false);
        expect(get).not.toHaveBeenCalled();
    });

    it('is false when the Settings module throws', () => {
        get.mockImplementation(() => {
            throw new Error('no native module');
        });

        expect(keychainSurvivedReinstall()).toBe(false);
    });
});
