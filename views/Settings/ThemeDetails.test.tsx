jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Icon: 'Icon' }));
jest.mock('react-native-system-navigation-bar', () => ({
    setNavigationColor: jest.fn(),
    setNavigationBarDividerColor: jest.fn()
}));
jest.mock('../../stores/SettingsStore', () => ({
    THEME_KEYS: [
        {
            key: 'Ember',
            translateKey: 'views.Settings.Theme.ember',
            value: 'ember'
        }
    ]
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `#${key}`,
    isLightTheme: () => false
}));
jest.mock('../../components/ThemeTransition', () => ({
    switchThemeWithTransition: jest.fn(async (apply: () => Promise<void>) => {
        await apply();
    })
}));
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress, disabled }: any) => (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
        >
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/ThemePreview', () => {
    const { View } = require('react-native');
    const Preview = (props: any) => (
        <View testID={`preview-${props.view}`} {...props} />
    );
    return {
        __esModule: true,
        default: Preview,
        PREVIEW_ASPECT_RATIO: 2,
        THEME_PREVIEW_VIEWS: ['balance', 'keypad', 'channels', 'receive']
    };
});

import * as React from 'react';
import { StyleSheet } from 'react-native';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { switchThemeWithTransition } from '../../components/ThemeTransition';
import ThemeDetails from './ThemeDetails';

const renderDetails = async ({
    selected = 'dark',
    settingsUpdateInProgress = false
} = {}) => {
    const calls: string[] = [];
    const navigation = {
        goBack: jest.fn(() => calls.push('goBack'))
    };
    const SettingsStore = {
        settings: { display: { theme: selected } },
        settingsUpdateInProgress,
        updateSettingsGroup: jest.fn(async () => {
            calls.push('updateSettingsGroup');
        })
    };
    await render(
        <ThemeDetails
            {...({
                navigation,
                route: { params: { theme: 'ember' } },
                SettingsStore
            } as any)}
        />
    );
    const pager = screen.container.queryAll((node) =>
        Boolean(node.props.onLayout)
    )[0];
    await fireEvent(pager, 'layout', {
        nativeEvent: { layout: { width: 400, height: 640 } }
    });
    return { calls, navigation, SettingsStore };
};

const dotColors = () =>
    screen.container
        .queryAll(
            (node) =>
                node.type === 'View' &&
                StyleSheet.flatten(node.props.style)?.borderRadius === 4
        )
        .map((node) => StyleSheet.flatten(node.props.style).backgroundColor);

describe('ThemeDetails', () => {
    beforeEach(() => jest.clearAllMocks());

    it('pages through all four previews of the theme', async () => {
        await renderDetails();
        for (const view of ['balance', 'keypad', 'channels', 'receive']) {
            const preview = screen.getByTestId(`preview-${view}`);
            expect(preview).toHaveProp('theme', 'ember');
        }
        expect(screen.getByText('views.Receive.title')).toBeTruthy();
    });

    it('fits the preview and its caption in the page', async () => {
        await renderDetails();
        // Height limits it: (640 - 40 caption) / aspect ratio 2
        expect(screen.getByTestId('preview-balance')).toHaveProp('width', 300);
    });

    it('moves the page dot when a swipe settles', async () => {
        await renderDetails();
        expect(dotColors()).toEqual([
            '#highlight',
            '#secondaryText',
            '#secondaryText',
            '#secondaryText'
        ]);
        const list = screen.container.queryAll((node) =>
            Boolean(node.props.onMomentumScrollEnd)
        )[0];
        await act(() =>
            list.props.onMomentumScrollEnd({
                nativeEvent: { contentOffset: { x: 800 } }
            })
        );
        expect(dotColors()).toEqual([
            '#secondaryText',
            '#secondaryText',
            '#highlight',
            '#secondaryText'
        ]);
    });

    it('applies the theme, recolors the navigation bar and goes back', async () => {
        const { calls, SettingsStore } = await renderDetails();
        await fireEvent.press(screen.getByText('views.Settings.Theme.apply'));
        expect(SettingsStore.updateSettingsGroup).toHaveBeenCalledWith(
            'display',
            { theme: 'ember' }
        );
        expect(SystemNavigationBar.setNavigationColor).toHaveBeenCalledWith(
            '#background',
            'light'
        );
        expect(
            SystemNavigationBar.setNavigationBarDividerColor
        ).toHaveBeenCalledWith('#secondary');
        // Back only after the setting is saved
        expect(calls).toEqual(['updateSettingsGroup', 'goBack']);
    });

    it('opens the new theme from where Apply was tapped', async () => {
        await renderDetails();
        await fireEvent.press(screen.getByText('views.Settings.Theme.apply'), {
            nativeEvent: { pageX: 180, pageY: 760 }
        });
        expect(switchThemeWithTransition).toHaveBeenCalledWith(
            expect.any(Function),
            { x: 180, y: 760 }
        );
    });

    it('goes back only after the transition has finished', async () => {
        const order: string[] = [];
        (switchThemeWithTransition as jest.Mock).mockImplementationOnce(
            async (apply: () => Promise<void>) => {
                await apply();
                order.push('transition');
            }
        );
        const { navigation } = await renderDetails();
        navigation.goBack.mockImplementation(() => order.push('goBack'));
        await fireEvent.press(screen.getByText('views.Settings.Theme.apply'));
        expect(order).toEqual(['transition', 'goBack']);
    });

    it('disables the button on the theme already in use', async () => {
        await renderDetails({ selected: 'ember' });
        expect(screen.queryByText('views.Settings.Theme.apply')).toBeNull();
        expect(screen.getByRole('button')).toBeDisabled();
        expect(screen.getByText('views.Settings.Theme.current')).toBeTruthy();
    });

    it('disables the button while settings are being saved', async () => {
        await renderDetails({ settingsUpdateInProgress: true });
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
