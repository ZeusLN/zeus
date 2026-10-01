jest.mock('@rneui/themed', () => ({ ButtonGroup: () => null }));

jest.mock('../utils/LiquidGlassUtils', () => ({
    isGlassEffectEnabled: () => true
}));

jest.mock('../utils/ThemeUtils', () => ({
    isLightTheme: () => false,
    themeColor: (key: string) => `theme-${key}`
}));

import { getGlassSelectedButtonStyle } from './GlassButtonGroup';

describe('getGlassSelectedButtonStyle', () => {
    it('keeps a background color the caller passed', () => {
        expect(
            getGlassSelectedButtonStyle(
                { backgroundColor: 'white', borderRadius: 12 },
                20
            )
        ).toEqual({ backgroundColor: 'white', borderRadius: 20 });
    });

    it('falls back to the theme highlight without a caller color', () => {
        expect(getGlassSelectedButtonStyle({ borderRadius: 12 }, 20)).toEqual({
            backgroundColor: 'theme-highlight',
            borderRadius: 20
        });
    });

    it('falls back to the theme highlight without a selected style', () => {
        expect(getGlassSelectedButtonStyle(undefined, 18)).toEqual({
            backgroundColor: 'theme-highlight',
            borderRadius: 18
        });
    });

    it('flattens style arrays and keeps other properties', () => {
        expect(
            getGlassSelectedButtonStyle(
                [{ backgroundColor: 'red', opacity: 0.5 }, { margin: 2 }],
                20
            )
        ).toEqual({
            backgroundColor: 'red',
            opacity: 0.5,
            margin: 2,
            borderRadius: 20
        });
    });
});
