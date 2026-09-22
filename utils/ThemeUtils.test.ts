jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: { display: { theme: 'dark' } } }
}));

import {
    blendHexColors,
    getUpgradeBackgroundColor,
    getUpgradeIntensity
} from './ThemeUtils';

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
});
