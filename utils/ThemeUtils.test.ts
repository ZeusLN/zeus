const mockSettings = { display: { theme: 'dark' } };
jest.mock('../stores/Stores', () => ({
    settingsStore: {
        get settings() {
            return mockSettings;
        }
    }
}));

import {
    blendHexColors,
    getUpgradeBackgroundColor,
    getUpgradeIntensity,
    isLightTheme,
    themeColor,
    themeColorFor
} from './ThemeUtils';

// Every value in THEME_KEYS (stores/SettingsStore.ts)
const THEMES = [
    'kyriaki',
    'dark',
    'light',
    'blacked-out',
    'scarlet',
    'purple',
    'blueberry',
    'deep-purple',
    'deadpool',
    'mighty',
    'green',
    'pub',
    'popsicle',
    'nostrich',
    'orange-cream-soda',
    'red-metallic',
    'radioactive',
    'gilded',
    'ember',
    'orange'
];

// Dark theme values
const SECONDARY = '#31363F';
const ERROR = '#992600';

describe('ThemeUtils', () => {
    describe('getUpgradeIntensity', () => {
        it('is 0 below the first upgrade threshold', () => {
            expect(getUpgradeIntensity(0)).toBe(0);
            expect(getUpgradeIntensity(9_999)).toBe(0);
        });

        it('ramps linearly from 10k to 100k', () => {
            expect(getUpgradeIntensity(10_000)).toBe(0);
            expect(getUpgradeIntensity(55_000)).toBeCloseTo(0.5);
            expect(getUpgradeIntensity(100_000)).toBe(1);
        });

        it('caps at 1 above 100k', () => {
            expect(getUpgradeIntensity(250_000)).toBe(1);
        });
    });

    describe('getUpgradeBackgroundColor', () => {
        it('returns undefined below the first upgrade threshold', () => {
            expect(getUpgradeBackgroundColor(SECONDARY, 9_999)).toBeUndefined();
        });

        it('applies no tint at exactly 10k', () => {
            expect(getUpgradeBackgroundColor(SECONDARY, 10_000)).toBe(
                '#31363f'
            );
        });

        it('blends partway at 25k', () => {
            expect(getUpgradeBackgroundColor(SECONDARY, 25_000)).toBe(
                '#3b3439'
            );
        });

        it('follows getUpgradeIntensity across the ramp', () => {
            for (const balance of [10_000, 25_000, 55_000, 90_000, 100_000]) {
                expect(getUpgradeBackgroundColor(SECONDARY, balance)).toBe(
                    blendHexColors(
                        SECONDARY,
                        ERROR,
                        getUpgradeIntensity(balance) * 0.6
                    )
                );
            }
        });

        it('reaches a 60% blend at 100k and stays there', () => {
            expect(getUpgradeBackgroundColor(SECONDARY, 100_000)).toBe(
                '#6f2c19'
            );
            expect(getUpgradeBackgroundColor(SECONDARY, 500_000)).toBe(
                '#6f2c19'
            );
        });

        it('returns undefined for missing or non-hex base colors', () => {
            expect(
                getUpgradeBackgroundColor(undefined, 50_000)
            ).toBeUndefined();
            expect(
                getUpgradeBackgroundColor('rgb(191, 0, 28)', 50_000)
            ).toBeUndefined();
            expect(getUpgradeBackgroundColor('#fff', 50_000)).toBeUndefined();
        });
    });

    describe('gilded theme', () => {
        beforeEach(() => {
            mockSettings.display.theme = 'gilded';
        });

        afterEach(() => {
            mockSettings.display.theme = 'dark';
        });

        it('anchors a radial background gradient at the top-left corner', () => {
            const gradient = themeColor('gradientBackground');
            const locations = themeColor('gradientLocations');
            expect(gradient[gradient.length - 1]).toBe('#000000');
            expect(locations).toHaveLength(gradient.length);
            expect(themeColor('gradientRadial')).toEqual(
                expect.objectContaining({ cx: 0, cy: 0 })
            );
        });

        it('uses the gold accent for buttons and highlights', () => {
            expect(themeColor('buttonBackground')).toBe('#D5BF8D');
            expect(themeColor('highlight')).toBe('#D5BF8D');
        });

        it('draws black QR modules on the gold accent', () => {
            expect(themeColor('qr')).toBe('#000');
            expect(themeColor('qrBackground')).toBe('#D5BF8D');
            expect(themeColor('qrLogoBackground')).toBe('#D5BF8D');
        });

        it('falls back to Dark for keys it does not define', () => {
            expect(themeColor('placeholderText')).toBeUndefined();
            mockSettings.display.theme = 'dark';
            const darkFallback = themeColor('generalStyle');
            mockSettings.display.theme = 'gilded';
            expect(themeColor('generalStyle')).toBe(darkFallback);
        });

        it('is treated as a dark theme', () => {
            expect(isLightTheme()).toBe(false);
        });
    });

    describe('ember theme', () => {
        afterEach(() => {
            mockSettings.display.theme = 'dark';
        });

        it('swaps the gold accent for #FFA900', () => {
            mockSettings.display.theme = 'ember';
            for (const key of [
                'highlight',
                'outbound',
                'qrBackground',
                'qrLogoBackground',
                'qrFrame',
                'buttonBackground',
                'bitcoin',
                'bolt',
                'chain'
            ]) {
                expect(themeColor(key)).toBe('#FFA900');
            }
        });

        it('tints the background gradient with #FFA900', () => {
            mockSettings.display.theme = 'ember';
            const gradient = themeColor('gradientBackground');
            expect(gradient[0].toLowerCase()).toBe(
                blendHexColors('#000000', '#FFA900', 0.3)
            );
            expect(gradient[gradient.length - 1]).toBe('#000000');
            expect(themeColor('gradientLocations')).toHaveLength(
                gradient.length
            );
        });

        it('keeps the Gilded gradient shape and button text', () => {
            mockSettings.display.theme = 'gilded';
            const gilded = ['gradientRadial', 'buttonText'].map((key) =>
                themeColor(key)
            );
            mockSettings.display.theme = 'ember';
            expect(
                ['gradientRadial', 'buttonText'].map((key) => themeColor(key))
            ).toEqual(gilded);
        });

        it('moves the Gilded surfaces 8% toward #FFA900', () => {
            mockSettings.display.theme = 'gilded';
            const surfaces = ['secondary', 'modalBackground', 'separator'];
            const expected = surfaces.map((key) =>
                blendHexColors(themeColor(key), '#FFA900', 0.08)
            );
            mockSettings.display.theme = 'ember';
            expect(
                surfaces.map((key) => themeColor(key).toLowerCase())
            ).toEqual(expected);
        });
    });

    describe('themeColorFor', () => {
        afterEach(() => {
            mockSettings.display.theme = 'dark';
        });

        it('reads the given theme without changing the selected one', () => {
            expect(themeColorFor('ember', 'highlight')).toBe('#FFA900');
            expect(themeColorFor('gilded', 'highlight')).toBe('#D5BF8D');
            expect(themeColor('highlight')).toBe('#ffd24b');
        });

        it('follows the selected theme when no theme is given', () => {
            mockSettings.display.theme = 'ember';
            expect(themeColorFor(undefined, 'highlight')).toBe('#FFA900');
        });

        it('matches themeColor for every theme', () => {
            const keys = [
                'background',
                'secondary',
                'text',
                'secondaryText',
                'highlight',
                'buttonBackground',
                'buttonText',
                'outbound',
                'inbound',
                'qr',
                'qrBackground',
                'gradientBackground',
                'bolt'
            ];
            for (const theme of THEMES) {
                mockSettings.display.theme = theme;
                for (const key of keys) {
                    expect(themeColorFor(theme, key)).toEqual(themeColor(key));
                }
            }
        });

        it('keeps the Light fallback for Memberberry and Spooky', () => {
            // Dark's buttonText is #FFF, Light's is black
            expect(themeColorFor('purple', 'buttonText')).toBe('black');
            expect(themeColorFor('dark', 'buttonText')).toBe('#FFF');
            expect(themeColorFor('orange', 'secondary')).toBe('#31363F');
        });

        it('uses Dark for an unknown theme', () => {
            expect(themeColorFor('junkie', 'background')).toBe(
                themeColorFor('dark', 'background')
            );
        });
    });

    describe('isLightTheme', () => {
        afterEach(() => {
            mockSettings.display.theme = 'dark';
        });

        it('checks the given theme', () => {
            expect(isLightTheme('light')).toBe(true);
            expect(isLightTheme('purple')).toBe(true);
            expect(isLightTheme('ember')).toBe(false);
            expect(isLightTheme('blueberry')).toBe(false);
        });

        it('checks the selected theme when none is given', () => {
            expect(isLightTheme()).toBe(false);
            mockSettings.display.theme = 'light';
            expect(isLightTheme()).toBe(true);
        });
    });

    it('defines no radial gradient for other themes', () => {
        for (const theme of ['dark', 'kyriaki', 'pub', 'radioactive']) {
            mockSettings.display.theme = theme;
            expect(themeColor('gradientRadial')).toBeUndefined();
        }
        mockSettings.display.theme = 'dark';
    });
});
