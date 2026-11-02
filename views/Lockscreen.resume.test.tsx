import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/Button', () => () => null);
jest.mock('../components/Header', () => {
    const { Text } = require('react-native');
    return () => <Text testID="header">back</Text>;
});
jest.mock('../components/LoadingIndicator', () => () => null);
// Stands in for the keypad: one press submits mockPinEntry.value
const mockPinEntry = { value: '' };
jest.mock('../components/Pin', () => {
    const { Pressable, Text } = require('react-native');
    return ({ onSubmit }: any) => (
        <Pressable role="button" onPress={() => onSubmit(mockPinEntry.value)}>
            <Text>Submit PIN</Text>
        </Pressable>
    );
});
jest.mock('../components/ShowHideToggle', () => () => null);
jest.mock('../components/TextInput', () => () => null);
jest.mock('../components/SuccessErrorMessage', () => ({
    ErrorMessage: () => null
}));
jest.mock('../stores/SettingsStore', () => ({
    PosEnabled: {
        Disabled: 'disabled',
        Square: 'square',
        Standalone: 'standalone'
    }
}));
// ShareIntentProcessor imports the store graph, which loads native modules
jest.mock('../stores/Stores');
jest.mock('../utils/BiometricUtils', () => ({
    verifyBiometry: jest.fn()
}));
jest.mock('../utils/DataClearUtils', () => ({
    blockNavigationDuringWipe: jest.fn(),
    clearAllData: jest.fn(() => Promise.resolve())
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/RestartUtils', () => ({
    restartApp: jest.fn()
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));

import { clearAllData } from '../utils/DataClearUtils';
import Lockscreen from './Lockscreen';

const PIN = '1234';
const DURESS_PIN = '9999';

// Settings > Security opens the Lockscreen with one of these params as a PIN
// prompt. With "Require login after app returns from background" on, leaving
// the app on that prompt makes Wallet.handleAppStateChange call
// navigate('Lockscreen'), which keeps the focused Lockscreen mounted and
// replaces its params with none.
const renderPrompt = async (params: any) => {
    const SettingsStore = {
        settings: { pin: PIN, duressPin: DURESS_PIN },
        posStatus: 'inactive',
        triggerSettingsRefresh: false,
        isBiometryConfigured: jest.fn(() => false),
        isPosEnabled: jest.fn(() => false),
        loginRequired: jest.fn(() => true),
        setLoginStatus: jest.fn(),
        setPosStatus: jest.fn(),
        getSettings: jest.fn(() => Promise.resolve({})),
        updateSettings: jest.fn(() => Promise.resolve())
    };
    const navigation = {
        pop: jest.fn(),
        popTo: jest.fn(),
        replace: jest.fn()
    };
    const element = (routeParams: any) => (
        <Lockscreen
            SettingsStore={SettingsStore as any}
            navigation={navigation as any}
            route={{ params: routeParams } as any}
        />
    );
    const { rerender } = await render(element(params));
    const lockOnResume = () =>
        act(async () => {
            rerender(element(undefined));
        });
    return { SettingsStore, navigation, lockOnResume };
};

const enterPin = async (value: string) => {
    mockPinEntry.value = value;
    await fireEvent.press(screen.getByRole('button', { name: 'Submit PIN' }));
};

const backArrows = () => screen.queryAllByTestId('header').length;

beforeEach(() => {
    (clearAllData as jest.Mock).mockClear();
});

describe('Lockscreen prompt reused by the background lock', () => {
    it.each([
        { modifySecurityScreen: 'SetPin' },
        { deletePin: true },
        { deleteDuressPin: true },
        { deletePassword: true },
        { deleteDuressPassword: true }
    ])('drops the Back arrow of %j', async (params) => {
        const { lockOnResume } = await renderPrompt(params);
        expect(backArrows()).toBe(1);

        await lockOnResume();

        expect(backArrows()).toBe(0);
    });

    it('wipes on the duress PIN', async () => {
        const { lockOnResume } = await renderPrompt({
            modifySecurityScreen: 'SetPin'
        });
        await lockOnResume();

        await enterPin(DURESS_PIN);

        expect(clearAllData).toHaveBeenCalledTimes(1);
    });

    it('unlocks on the PIN instead of deleting it', async () => {
        const { SettingsStore, navigation, lockOnResume } = await renderPrompt({
            deletePin: true
        });
        await lockOnResume();

        await enterPin(PIN);

        expect(SettingsStore.updateSettings).not.toHaveBeenCalledWith(
            expect.objectContaining({ pin: '' })
        );
        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(navigation.pop).toHaveBeenCalledTimes(1);
    });

    it('keeps the prompt behaviour while its params are unchanged', async () => {
        const { SettingsStore, navigation } = await renderPrompt({
            deletePin: true
        });
        expect(backArrows()).toBe(1);

        await enterPin(PIN);

        expect(SettingsStore.updateSettings).toHaveBeenCalledWith(
            expect.objectContaining({ pin: '' })
        );
        expect(navigation.popTo).toHaveBeenCalledWith('Security');
    });
});
