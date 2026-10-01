import { Platform } from 'react-native';

const mockSettingsStore: { settings: any } = { settings: {} };
const mockLiquidGlass = { isLiquidGlassSupported: true };

jest.mock('react-native', () => ({
    Platform: { OS: 'ios' }
}));

jest.mock('@callstack/liquid-glass', () => ({
    get isLiquidGlassSupported() {
        return mockLiquidGlass.isLiquidGlassSupported;
    }
}));

jest.mock('../stores/Stores', () => ({
    get settingsStore() {
        return mockSettingsStore;
    }
}));

import { isGlassEffectEnabled, isLiquidGlassEnabled } from './LiquidGlassUtils';

describe('LiquidGlassUtils', () => {
    beforeEach(() => {
        (Platform.OS as any) = 'ios';
        mockLiquidGlass.isLiquidGlassSupported = true;
        mockSettingsStore.settings = { display: { liquidGlass: true } };
    });

    describe('isLiquidGlassEnabled', () => {
        it('is on for iOS when the setting is true', () => {
            expect(isLiquidGlassEnabled()).toBe(true);
        });

        it('is off for iOS when the setting is false', () => {
            mockSettingsStore.settings = { display: { liquidGlass: false } };
            expect(isLiquidGlassEnabled()).toBe(false);
        });

        it('is on for iOS when the setting was never saved', () => {
            mockSettingsStore.settings = { display: { theme: 'kyriaki' } };
            expect(isLiquidGlassEnabled()).toBe(true);
        });

        it('is on for iOS when the display group is missing', () => {
            mockSettingsStore.settings = {};
            expect(isLiquidGlassEnabled()).toBe(true);
        });

        it('is on for iOS before settings load', () => {
            mockSettingsStore.settings = undefined;
            expect(isLiquidGlassEnabled()).toBe(true);
        });

        it('is off on Android regardless of the setting', () => {
            (Platform.OS as any) = 'android';
            expect(isLiquidGlassEnabled()).toBe(false);
            mockSettingsStore.settings = {};
            expect(isLiquidGlassEnabled()).toBe(false);
        });
    });

    describe('isGlassEffectEnabled', () => {
        it('is on when enabled and the OS supports glass', () => {
            expect(isGlassEffectEnabled()).toBe(true);
        });

        it('is off below iOS 26 even with the setting on', () => {
            mockLiquidGlass.isLiquidGlassSupported = false;
            expect(isGlassEffectEnabled()).toBe(false);
        });

        it('is off when the user turned the setting off', () => {
            mockSettingsStore.settings = { display: { liquidGlass: false } };
            expect(isGlassEffectEnabled()).toBe(false);
        });

        it('is off on Android', () => {
            (Platform.OS as any) = 'android';
            expect(isGlassEffectEnabled()).toBe(false);
        });
    });
});
