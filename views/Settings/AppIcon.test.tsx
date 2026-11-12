jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => (key === 'highlight' ? 'HIGHLIGHT' : '#000')
}));
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Text', () => 'Text');

import * as React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

// AppIconUtils reads NativeModules.AppIcon when it loads, so install the
// native stub before requiring the view
const native = {
    setAlternateIcon: jest.fn(),
    getAlternateIcon: jest.fn(),
    setVariant: jest.fn(),
    getVariant: jest.fn()
};
require('react-native').NativeModules.AppIcon = native;
const AppIcon = require('./AppIcon').default;

const makeStore = (appIcon?: string) => ({
    getSettings: jest.fn(async () =>
        appIcon ? { display: { appIcon } } : { display: {} }
    ),
    updateSettingsGroup: jest.fn(async () => ({}))
});

const mount = async (store: ReturnType<typeof makeStore>) => {
    await render(
        <AppIcon navigation={{} as any} SettingsStore={store as any} />
    );
    // let componentDidMount's awaits settle
    await act(async () => {});
};

// Each icon is a bordered cell; the selected one gets the highlight border
const cellOf = (label: string) => {
    let node: any = screen.getByText(label);
    while (node && StyleSheet.flatten(node.props.style)?.borderWidth !== 2) {
        node = node.parent;
    }
    return node;
};

const highlighted = () =>
    screen
        .getAllByText(/^views\.Settings\.AppIcon\./)
        .map((label) => label.props.children)
        .filter(
            (key) =>
                StyleSheet.flatten(cellOf(key)?.props.style)?.borderColor ===
                'HIGHLIGHT'
        );

describe('AppIcon picker on iOS', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        native.setAlternateIcon.mockResolvedValue(true);
        native.getAlternateIcon.mockResolvedValue(null);
    });

    it('highlights the icon iOS has applied when the saved setting is stale', async () => {
        // The app was killed while the system "You have changed the icon"
        // alert was up: iOS switched the icon, but the setting was never
        // saved because setAlternateIconName had not called back yet.
        native.getAlternateIcon.mockResolvedValue('AppIconZeusEngraved');

        await mount(makeStore('maxGradient'));

        expect(highlighted()).toEqual(['views.Settings.AppIcon.zeusEngraved']);
    });

    it('highlights the primary icon when iOS reports no alternate icon', async () => {
        await mount(makeStore('red'));

        expect(highlighted()).toEqual(['views.Settings.AppIcon.maxGradient']);
    });

    it('applies and saves a new icon', async () => {
        const store = makeStore();
        await mount(store);

        await act(async () => {
            fireEvent.press(cellOf('views.Settings.AppIcon.zeusIllustrated'));
        });

        expect(native.setAlternateIcon).toHaveBeenCalledWith(
            'AppIconZeusIllustrated'
        );
        expect(store.updateSettingsGroup).toHaveBeenCalledWith('display', {
            appIcon: 'zeusIllustrated'
        });
        expect(highlighted()).toEqual([
            'views.Settings.AppIcon.zeusIllustrated'
        ]);
    });

    it('keeps the previous icon when iOS refuses the change', async () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        native.setAlternateIcon.mockRejectedValue(new Error('denied'));
        const store = makeStore();
        await mount(store);

        await act(async () => {
            fireEvent.press(cellOf('views.Settings.AppIcon.red'));
        });

        expect(store.updateSettingsGroup).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalled();
        expect(highlighted()).toEqual(['views.Settings.AppIcon.maxGradient']);
    });
});
