jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('../../stores/SettingsStore', () => ({
    THEME_KEYS: [
        { key: 'Kyriaki', value: 'kyriaki' },
        {
            key: 'Dark',
            translateKey: 'views.Settings.Theme.dark',
            value: 'dark'
        },
        {
            key: 'Ember',
            translateKey: 'views.Settings.Theme.ember',
            value: 'ember'
        }
    ]
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => `t:${key}`
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `#${key}`
}));
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/ThemePreview', () => {
    const { View } = require('react-native');
    return (props: any) => (
        <View testID={`preview-${props.theme}`} {...props} />
    );
});

import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ThemePicker, { themeLabel } from './ThemePicker';

const renderPicker = async (theme = 'ember') => {
    const navigation = { navigate: jest.fn() };
    await render(
        <ThemePicker
            {...({
                navigation,
                SettingsStore: { settings: { display: { theme } } }
            } as any)}
        />
    );
    // The grid waits for its width before laying out the cards
    const container = screen.container.queryAll((node) =>
        Boolean(node.props.onLayout)
    )[0];
    await fireEvent(container, 'layout', {
        nativeEvent: { layout: { width: 390, height: 800 } }
    });
    return navigation;
};

describe('themeLabel', () => {
    it('translates themes that have a translate key', () => {
        expect(themeLabel('ember')).toBe('t:views.Settings.Theme.ember');
    });

    it('uses the key for themes without one', () => {
        expect(themeLabel('kyriaki')).toBe('Kyriaki');
    });

    it('falls back to the raw value for an unknown theme', () => {
        expect(themeLabel('junkie')).toBe('junkie');
        expect(themeLabel(undefined)).toBe('');
    });
});

describe('ThemePicker', () => {
    it('shows a balance preview for every theme', async () => {
        await renderPicker();
        for (const theme of ['kyriaki', 'dark', 'ember']) {
            const preview = screen.getByTestId(`preview-${theme}`);
            expect(preview).toHaveProp('view', 'balance');
        }
    });

    it('sizes two previews per row inside the padding', async () => {
        await renderPicker();
        // (390 - 2 * 15 padding - 15 gap) / 2, minus 3px of border and
        // padding on each side
        expect(screen.getByTestId('preview-dark')).toHaveProp(
            'width',
            172.5 - 6
        );
    });

    it('marks only the selected theme', async () => {
        await renderPicker('ember');
        expect(screen.getByTestId('theme-ember')).toHaveProp(
            'accessibilityState',
            { selected: true }
        );
        expect(screen.getByTestId('theme-dark')).toHaveProp(
            'accessibilityState',
            { selected: false }
        );
    });

    it('opens the details of the pressed theme', async () => {
        const navigation = await renderPicker();
        await fireEvent.press(screen.getByTestId('theme-kyriaki'));
        expect(navigation.navigate).toHaveBeenCalledWith('ThemeDetails', {
            theme: 'kyriaki'
        });
    });
});
