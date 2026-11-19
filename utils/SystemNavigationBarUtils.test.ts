jest.mock('react-native-system-navigation-bar', () => ({
    __esModule: true,
    default: {
        setBarColor: jest.fn(() => Promise.resolve()),
        setBarStyle: jest.fn(() => Promise.resolve()),
        setDividerColor: jest.fn(() => Promise.resolve())
    }
}));

const mockIsLightTheme = jest.fn();
jest.mock('./ThemeUtils', () => ({
    themeColor: (key: string) =>
        (({ background: '#101010', secondary: '#202020' } as any)[key]),
    isLightTheme: () => mockIsLightTheme()
}));

import SystemNavigationBar from 'react-native-system-navigation-bar';
import { applySystemNavigationBarTheme } from './SystemNavigationBarUtils';

const bar = SystemNavigationBar as unknown as {
    setBarColor: jest.Mock;
    setBarStyle: jest.Mock;
    setDividerColor: jest.Mock;
};

beforeEach(() => jest.clearAllMocks());

describe('applySystemNavigationBarTheme', () => {
    it('colors the navigation bar and divider from the theme', async () => {
        mockIsLightTheme.mockReturnValue(false);
        await applySystemNavigationBarTheme();

        expect(bar.setBarColor).toHaveBeenCalledWith('#101010', {
            bar: 'navigation'
        });
        expect(bar.setDividerColor).toHaveBeenCalledWith('#202020');
    });

    it('uses light icons on dark themes', async () => {
        mockIsLightTheme.mockReturnValue(false);
        await applySystemNavigationBarTheme();

        expect(bar.setBarStyle).toHaveBeenCalledWith('light', 'both');
    });

    it('uses dark icons on light themes', async () => {
        mockIsLightTheme.mockReturnValue(true);
        await applySystemNavigationBarTheme();

        expect(bar.setBarStyle).toHaveBeenCalledWith('dark', 'both');
    });

    it('still sets the icon style and divider when the bar color rejects', async () => {
        mockIsLightTheme.mockReturnValue(true);
        bar.setBarColor.mockRejectedValueOnce(new Error('bad color'));
        jest.spyOn(console, 'log').mockImplementation(() => {});

        await expect(applySystemNavigationBarTheme()).resolves.toBeUndefined();
        expect(bar.setBarStyle).toHaveBeenCalledWith('dark', 'both');
        expect(bar.setDividerColor).toHaveBeenCalledWith('#202020');
    });

    it('still sets the divider when the icon style rejects', async () => {
        mockIsLightTheme.mockReturnValue(false);
        bar.setBarStyle.mockRejectedValueOnce(new Error('no activity'));
        jest.spyOn(console, 'log').mockImplementation(() => {});

        await expect(applySystemNavigationBarTheme()).resolves.toBeUndefined();
        expect(bar.setDividerColor).toHaveBeenCalledWith('#202020');
    });

    it('applies the calls in order: bar color, icon style, divider', async () => {
        mockIsLightTheme.mockReturnValue(false);
        await applySystemNavigationBarTheme();

        const order = (m: jest.Mock) => m.mock.invocationCallOrder[0];
        expect(order(bar.setBarColor)).toBeLessThan(order(bar.setBarStyle));
        expect(order(bar.setBarStyle)).toBeLessThan(order(bar.setDividerColor));
    });
});
