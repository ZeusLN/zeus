import { NativeModules, Platform } from 'react-native';

import { keychainSurvivedReinstall } from './KeychainReinstallUtils';

describe('keychainSurvivedReinstall', () => {
    const originalOS = Platform.OS;
    let read: jest.Mock;

    beforeEach(() => {
        Platform.OS = 'ios';
        read = jest.fn();
        NativeModules.KeychainAudit = { keychainSurvivedReinstall: read };
    });

    afterEach(() => {
        Platform.OS = originalOS;
        delete NativeModules.KeychainAudit;
    });

    it('reads the flag AppDelegate sets', async () => {
        read.mockResolvedValue(true);

        await expect(keychainSurvivedReinstall()).resolves.toBe(true);
        expect(read).toHaveBeenCalledTimes(1);
    });

    it('is false when the flag is unset', async () => {
        read.mockResolvedValue(false);

        await expect(keychainSurvivedReinstall()).resolves.toBe(false);
    });

    it('reads native defaults on every call, so a deferred first-run check is seen', async () => {
        // Launch before protected data was available: JS starts before the
        // first-run check sets the flag, which must not be cached
        read.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

        await expect(keychainSurvivedReinstall()).resolves.toBe(false);
        await expect(keychainSurvivedReinstall()).resolves.toBe(true);
        expect(read).toHaveBeenCalledTimes(2);
    });

    it('is false off iOS without reading defaults', async () => {
        Platform.OS = 'android';
        read.mockResolvedValue(true);

        await expect(keychainSurvivedReinstall()).resolves.toBe(false);
        expect(read).not.toHaveBeenCalled();
    });

    it('is false when the native module is missing', async () => {
        delete NativeModules.KeychainAudit;

        await expect(keychainSurvivedReinstall()).resolves.toBe(false);
    });

    it('is false when the native read rejects', async () => {
        read.mockRejectedValue(new Error('native failure'));

        await expect(keychainSurvivedReinstall()).resolves.toBe(false);
    });
});
