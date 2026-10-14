import type { AppIconVariant } from './AppIconUtils';

interface NativeStub {
    setAlternateIcon: jest.Mock;
    getAlternateIcon: jest.Mock;
    setVariant: jest.Mock;
    getVariant: jest.Mock;
}

const makeNative = (): NativeStub => ({
    setAlternateIcon: jest.fn().mockResolvedValue(true),
    getAlternateIcon: jest.fn().mockResolvedValue(null),
    setVariant: jest.fn().mockResolvedValue(true),
    getVariant: jest.fn().mockResolvedValue('default')
});

/**
 * AppIconUtils captures NativeModules.AppIcon at module scope and exports a
 * singleton, so each scenario loads it fresh against its own react-native
 * stub.
 */
type AppIconModule = typeof import('./AppIconUtils');

const load = (os: string, native: NativeStub | null) => {
    let mod!: AppIconModule;
    jest.isolateModules(() => {
        jest.doMock('react-native', () => ({
            Platform: { OS: os },
            NativeModules: native ? { AppIcon: native } : {}
        }));
        mod = require('./AppIconUtils');
    });
    return mod;
};

const settingsStore = (appIcon?: AppIconVariant) => ({
    getSettings: jest
        .fn()
        .mockResolvedValue(appIcon ? { display: { appIcon } } : {})
});

describe('AppIconUtils', () => {
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

    describe('platformDefaultAppIcon', () => {
        it('is maxGradient on iOS (the primary icon)', () => {
            expect(load('ios', makeNative()).platformDefaultAppIcon()).toBe(
                'maxGradient'
            );
        });

        it('is flat on Android (plain MainActivity)', () => {
            expect(load('android', makeNative()).platformDefaultAppIcon()).toBe(
                'flat'
            );
        });
    });

    describe('isSupported', () => {
        it('needs the native module on iOS or Android', () => {
            expect(load('ios', makeNative()).default.isSupported()).toBe(true);
            expect(load('android', makeNative()).default.isSupported()).toBe(
                true
            );
            expect(load('android', null).default.isSupported()).toBe(false);
            expect(load('web', makeNative()).default.isSupported()).toBe(false);
        });
    });

    describe('availableVariants', () => {
        it('lists every variant on iOS', () => {
            const { default: utils, APP_ICON_VARIANTS } = load(
                'ios',
                makeNative()
            );
            expect(utils.availableVariants()).toHaveLength(
                APP_ICON_VARIANTS.length
            );
        });

        it('leaves out the max* variants on Android', () => {
            const keys = load('android', makeNative())
                .default.availableVariants()
                .map((v) => v.key);
            expect(keys).toHaveLength(7);
            expect(keys).toContain('flat');
            expect(keys.some((k) => k.startsWith('max'))).toBe(false);
        });

        it('is empty on other platforms', () => {
            expect(
                load('web', makeNative()).default.availableVariants()
            ).toEqual([]);
        });
    });

    describe('isLockedByStealthMode', () => {
        it('locks on Android when the stealth setting is on', () => {
            const utils = load('android', makeNative()).default;
            expect(
                utils.isLockedByStealthMode({
                    privacy: { stealthMode: true }
                })
            ).toBe(true);
        });

        it('unlocks on Android once the stealth setting is off, before the native launcher catches up', () => {
            const native = makeNative();
            const utils = load('android', native).default;
            expect(
                utils.isLockedByStealthMode({
                    privacy: { stealthMode: false }
                })
            ).toBe(false);
            expect(utils.isLockedByStealthMode({})).toBe(false);
            expect(utils.isLockedByStealthMode(undefined)).toBe(false);
        });

        it('never locks on iOS', () => {
            expect(
                load('ios', makeNative()).default.isLockedByStealthMode({
                    privacy: { stealthMode: true }
                })
            ).toBe(false);
        });
    });

    describe('setAppIcon', () => {
        it('passes the iOS alternate icon name, or null for the primary icon', async () => {
            const native = makeNative();
            const utils = load('ios', native).default;

            await expect(utils.setAppIcon('red')).resolves.toBe(true);
            expect(native.setAlternateIcon).toHaveBeenLastCalledWith(
                'AppIconRed'
            );

            await expect(utils.setAppIcon('maxGradient')).resolves.toBe(true);
            expect(native.setAlternateIcon).toHaveBeenLastCalledWith(null);
            expect(native.setVariant).not.toHaveBeenCalled();
        });

        it("passes the Android alias, or 'default' for MainActivity", async () => {
            const native = makeNative();
            const utils = load('android', native).default;

            await expect(utils.setAppIcon('yellow')).resolves.toBe(true);
            expect(native.setVariant).toHaveBeenLastCalledWith(
                'AppIconYellowActivity'
            );

            await expect(utils.setAppIcon('flat')).resolves.toBe(true);
            expect(native.setVariant).toHaveBeenLastCalledWith('default');
            expect(native.setAlternateIcon).not.toHaveBeenCalled();
        });

        it('rejects a max* variant on Android without calling native', async () => {
            const native = makeNative();
            const utils = load('android', native).default;

            await expect(utils.setAppIcon('maxRed')).resolves.toBe(false);
            expect(native.setVariant).not.toHaveBeenCalled();
        });

        it('rejects an unknown variant', async () => {
            const native = makeNative();
            const utils = load('ios', native).default;

            await expect(
                utils.setAppIcon('purple' as AppIconVariant)
            ).resolves.toBe(false);
            expect(native.setAlternateIcon).not.toHaveBeenCalled();
        });

        it('returns false when the native call rejects', async () => {
            const native = makeNative();
            native.setAlternateIcon.mockRejectedValue(new Error('denied'));
            const utils = load('ios', native).default;

            await expect(utils.setAppIcon('red')).resolves.toBe(false);
        });

        it('returns false without the native module', async () => {
            await expect(
                load('android', null).default.setAppIcon('red')
            ).resolves.toBe(false);
        });
    });

    describe('getAppIcon', () => {
        it('maps the iOS alternate icon name back to a variant', async () => {
            const native = makeNative();
            native.getAlternateIcon.mockResolvedValue('AppIconGradientRed');
            await expect(
                load('ios', native).default.getAppIcon()
            ).resolves.toBe('gradientRed');
        });

        it('maps a null iOS icon name to the primary icon', async () => {
            await expect(
                load('ios', makeNative()).default.getAppIcon()
            ).resolves.toBe('maxGradient');
        });

        it('maps the Android alias back to a variant', async () => {
            const native = makeNative();
            native.getVariant.mockResolvedValue('AppIconBlackAndWhiteActivity');
            await expect(
                load('android', native).default.getAppIcon()
            ).resolves.toBe('blackAndWhite');
        });

        it("maps Android 'default' and unknown values to flat", async () => {
            const native = makeNative();
            const utils = load('android', native).default;
            await expect(utils.getAppIcon()).resolves.toBe('flat');

            native.getVariant.mockResolvedValue('SomethingElse');
            await expect(utils.getAppIcon()).resolves.toBe('flat');
        });

        it('falls back to the platform default when the native call rejects', async () => {
            const native = makeNative();
            native.getAlternateIcon.mockRejectedValue(new Error('boom'));
            await expect(
                load('ios', native).default.getAppIcon()
            ).resolves.toBe('maxGradient');
        });
    });

    describe('applyStoredIcon', () => {
        it('applies the stored variant', async () => {
            const native = makeNative();
            const utils = load('android', native).default;

            await expect(
                utils.applyStoredIcon(settingsStore('red'))
            ).resolves.toBe(true);
            expect(native.setVariant).toHaveBeenCalledWith(
                'AppIconRedActivity'
            );
        });

        it('applies the platform default when nothing is stored', async () => {
            const native = makeNative();
            const utils = load('android', native).default;

            await expect(utils.applyStoredIcon(settingsStore())).resolves.toBe(
                true
            );
            expect(native.setVariant).toHaveBeenCalledWith('default');
        });

        it('returns false when reading settings fails', async () => {
            const native = makeNative();
            const utils = load('android', native).default;

            await expect(
                utils.applyStoredIcon({
                    getSettings: jest.fn().mockRejectedValue(new Error('io'))
                })
            ).resolves.toBe(false);
            expect(native.setVariant).not.toHaveBeenCalled();
        });
    });
});
