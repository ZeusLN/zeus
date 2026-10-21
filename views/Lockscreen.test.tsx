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
// Each header shows which Back it wires up
jest.mock('../components/Header', () => {
    const { Text } = require('react-native');
    return ({ onBack }: any) => (
        <Text testID="header">{onBack ? 'dismiss' : 'back'}</Text>
    );
});
jest.mock('../components/LoadingIndicator', () => () => null);
// Stands in for the keypad: one press submits the stored PIN
jest.mock('../components/Pin', () => {
    const { Pressable, Text } = require('react-native');
    return ({ onSubmit }: any) => (
        <Pressable role="button" onPress={() => onSubmit('1234')}>
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
    clearAllData: jest.fn()
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/RestartUtils', () => ({
    restartApp: jest.fn()
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));

import { verifyBiometry } from '../utils/BiometricUtils';
import Lockscreen from './Lockscreen';

const PIN = '1234';

const deferred = () => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const renderLockscreen = async (
    updateSettings: jest.Mock,
    {
        biometry = false,
        posStatus = 'inactive',
        params = {}
    }: { biometry?: boolean; posStatus?: string; params?: any } = {}
) => {
    const SettingsStore = {
        settings: { pin: PIN },
        posStatus,
        triggerSettingsRefresh: false,
        isBiometryConfigured: jest.fn(() => biometry),
        isPosEnabled: jest.fn(() => false),
        loginRequired: jest.fn(() => true),
        setLoginStatus: jest.fn(),
        setPosStatus: jest.fn(),
        getSettings: jest.fn(),
        updateSettings
    };
    const navigation = {
        pop: jest.fn(),
        popTo: jest.fn(),
        replace: jest.fn()
    };
    await render(
        <Lockscreen
            SettingsStore={SettingsStore as any}
            navigation={navigation as any}
            route={{ params } as any}
        />
    );
    return { SettingsStore, navigation };
};

const submitPin = () =>
    fireEvent.press(screen.getByRole('button', { name: 'Submit PIN' }));

let errorSpy: jest.SpyInstance;

beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    errorSpy.mockRestore();
});

// A verified login resets authenticationAttempts before navigating away, so
// the refresh flag that write may arm lands before the Wallet screen regains
// focus. The reset must never keep the user on the Lockscreen, though.
describe('Lockscreen login', () => {
    it('navigates only once the attempt reset has resolved', async () => {
        const reset = deferred();
        const updateSettings = jest.fn(() => reset.promise);
        const { navigation } = await renderLockscreen(updateSettings);
        await submitPin();

        expect(updateSettings).toHaveBeenCalledWith({
            authenticationAttempts: 0
        });
        expect(navigation.pop).not.toHaveBeenCalled();

        await act(async () => reset.resolve());

        expect(navigation.pop).toHaveBeenCalledTimes(1);
    });

    it('still unlocks when the attempt reset fails', async () => {
        const error = new Error('keychain unavailable');
        const updateSettings = jest.fn(() => Promise.reject(error));
        const { SettingsStore, navigation } = await renderLockscreen(
            updateSettings
        );
        await submitPin();

        expect(SettingsStore.setLoginStatus).toHaveBeenCalledWith(true);
        expect(navigation.pop).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to reset authentication attempts',
            error
        );
    });

    it('navigates once when a second submit arrives while the reset is pending', async () => {
        const reset = deferred();
        const updateSettings = jest.fn(() => reset.promise);
        const { navigation } = await renderLockscreen(updateSettings);
        await submitPin();
        await submitPin();
        await act(async () => reset.resolve());

        expect(updateSettings).toHaveBeenCalledTimes(1);
        expect(navigation.pop).toHaveBeenCalledTimes(1);
    });

    it('still unlocks through biometrics when the attempt reset fails', async () => {
        (verifyBiometry as jest.Mock).mockResolvedValue(true);
        const error = new Error('keychain unavailable');
        const updateSettings = jest.fn(() => Promise.reject(error));

        const { SettingsStore, navigation } = await renderLockscreen(
            updateSettings,
            { biometry: true }
        );

        expect(SettingsStore.setLoginStatus).toHaveBeenCalledWith(true);
        expect(navigation.pop).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to reset authentication attempts',
            error
        );
    });
});

describe('Lockscreen header', () => {
    const headers = () =>
        screen.queryAllByTestId('header').map((h) => h.props.children);

    it('shows one Back that dismisses a POS share intent that also has a pending screen', async () => {
        await renderLockscreen(jest.fn(), {
            posStatus: 'active',
            params: {
                shareIntentData: { qrData: 'lnbc1' },
                pendingNavigation: { screen: 'LSPS1' }
            }
        });

        expect(headers()).toEqual(['dismiss']);
    });

    it('shows the regular Back for a pending screen', async () => {
        await renderLockscreen(jest.fn(), {
            params: { pendingNavigation: { screen: 'Menu' } }
        });

        expect(headers()).toEqual(['back']);
    });

    it('shows no Back on a plain unlock', async () => {
        await renderLockscreen(jest.fn());

        expect(headers()).toEqual([]);
    });
});
