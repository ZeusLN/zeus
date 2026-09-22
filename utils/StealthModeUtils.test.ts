import type { StealthApp } from './StealthModeUtils';

const ALL_APPS: StealthApp[] = [
    'zeus',
    'calculator',
    'vpn',
    'qrscanner',
    'notepad'
];

interface NativeStub {
    enableStealthMode: jest.Mock;
    disableStealthMode: jest.Mock;
    isStealthModeActive: jest.Mock;
    fixStealthModeIfNeeded: jest.Mock;
}

const makeNative = (): NativeStub => ({
    enableStealthMode: jest.fn().mockResolvedValue(undefined),
    disableStealthMode: jest.fn().mockResolvedValue(undefined),
    isStealthModeActive: jest.fn().mockResolvedValue(true),
    fixStealthModeIfNeeded: jest.fn().mockResolvedValue(undefined)
});

/**
 * StealthModeUtils captures NativeModules.StealthMode and reads Platform.OS at
 * module scope, and exports a singleton, so each scenario needs the module
 * loaded fresh against its own react-native stub.
 */
type StealthUtils = typeof import('./StealthModeUtils')['default'];

const load = (os: string, native: NativeStub | null) => {
    let utils!: StealthUtils;
    jest.isolateModules(() => {
        jest.doMock('react-native', () => ({
            Platform: { OS: os },
            NativeModules: native ? { StealthMode: native } : {}
        }));
        utils = require('./StealthModeUtils').default;
    });
    return utils;
};

describe('StealthModeUtils', () => {
    let warn: jest.SpyInstance;
    let error: jest.SpyInstance;

    beforeEach(() => {
        warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        error = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        warn.mockRestore();
        error.mockRestore();
    });

    describe('isSupported', () => {
        it('is true only on Android with the native module present', () => {
            expect(load('android', makeNative()).isSupported()).toBe(true);
        });

        it('is false on iOS even when the native module is present', () => {
            expect(load('ios', makeNative()).isSupported()).toBe(false);
        });

        it('is false on Android when the native module is missing', () => {
            expect(load('android', null).isSupported()).toBe(false);
        });
    });

    // The point of the guards: a caller that cannot hide must be told so.
    // Reporting success while the launcher icon still says ZEUS would be
    // worse than reporting failure.
    describe('on an unsupported platform', () => {
        it('every call resolves false and nothing reaches the native module', async () => {
            const native = makeNative();
            const utils = load('ios', native);

            await expect(utils.enableStealthMode('calculator')).resolves.toBe(
                false
            );
            await expect(utils.disableStealthMode()).resolves.toBe(false);
            await expect(utils.isStealthModeActive()).resolves.toBe(false);
            await expect(utils.fixStealthModeIfNeeded()).resolves.toBe(false);

            expect(native.enableStealthMode).not.toHaveBeenCalled();
            expect(native.disableStealthMode).not.toHaveBeenCalled();
            expect(native.isStealthModeActive).not.toHaveBeenCalled();
            expect(native.fixStealthModeIfNeeded).not.toHaveBeenCalled();
        });
    });

    describe('when supported', () => {
        it.each(ALL_APPS)(
            'passes %s through to the native module',
            async (app) => {
                const native = makeNative();
                const utils = load('android', native);

                await expect(utils.enableStealthMode(app)).resolves.toBe(true);
                expect(native.enableStealthMode).toHaveBeenCalledWith(app);
            }
        );

        it('disable and fix report success when the native call resolves', async () => {
            const native = makeNative();
            const utils = load('android', native);

            await expect(utils.disableStealthMode()).resolves.toBe(true);
            await expect(utils.fixStealthModeIfNeeded()).resolves.toBe(true);
            expect(native.disableStealthMode).toHaveBeenCalledTimes(1);
            expect(native.fixStealthModeIfNeeded).toHaveBeenCalledTimes(1);
        });

        it.each([true, false])(
            'isStealthModeActive reports %s back from the native module',
            async (active) => {
                const native = makeNative();
                native.isStealthModeActive.mockResolvedValue(active);
                const utils = load('android', native);

                // The false case is distinct from the unsupported case, which
                // is also false: here the native module was consulted and
                // answered. The true case is the load-bearing one --
                // checkStealthStatus only shows the decoy, and App.tsx only
                // calls disableStealthMode, when this returns true, so a
                // hardcoded false would drop the user into the real UI while
                // the launcher still reads Calculator.
                await expect(utils.isStealthModeActive()).resolves.toBe(active);
                expect(native.isStealthModeActive).toHaveBeenCalledTimes(1);
            }
        );
    });

    describe('when the native module rejects', () => {
        it('every method fails closed rather than throwing', async () => {
            const native = makeNative();
            const boom = new Error('native failure');
            native.enableStealthMode.mockRejectedValue(boom);
            native.disableStealthMode.mockRejectedValue(boom);
            native.isStealthModeActive.mockRejectedValue(boom);
            native.fixStealthModeIfNeeded.mockRejectedValue(boom);
            const utils = load('android', native);

            await expect(utils.enableStealthMode('vpn')).resolves.toBe(false);
            await expect(utils.disableStealthMode()).resolves.toBe(false);
            await expect(utils.isStealthModeActive()).resolves.toBe(false);
            await expect(utils.fixStealthModeIfNeeded()).resolves.toBe(false);
        });

        it('a failed enable does not leave the caller believing it is hidden', async () => {
            const native = makeNative();
            native.enableStealthMode.mockRejectedValue(new Error('denied'));
            const utils = load('android', native);

            const enabled = await utils.enableStealthMode('notepad');
            expect(enabled).toBe(false);
            expect(native.enableStealthMode).toHaveBeenCalledWith('notepad');
        });
    });
});
