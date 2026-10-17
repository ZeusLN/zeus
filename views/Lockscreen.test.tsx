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
jest.mock('../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable role="button" onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../components/Header', () => () => null);
jest.mock('../components/LoadingIndicator', () => () => null);
// Stands in for the keypad: one press submits mockPinEntry
let mockPinEntry = '1234';
jest.mock('../components/Pin', () => {
    const { Pressable, Text } = require('react-native');
    return ({ onSubmit }: any) => (
        <Pressable role="button" onPress={() => onSubmit(mockPinEntry)}>
            <Text>Submit PIN</Text>
        </Pressable>
    );
});
jest.mock('../components/ShowHideToggle', () => () => null);
jest.mock('../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return (props: any) => <TextInput {...props} />;
});
jest.mock('../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>
    };
});
jest.mock('../stores/SettingsStore', () => ({
    PosEnabled: {
        Disabled: 'disabled',
        Square: 'square',
        Standalone: 'standalone'
    }
}));
// ShareIntentProcessor imports the store graph, which loads native modules
jest.mock('../stores/Stores');
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

import Lockscreen from './Lockscreen';

const PIN = '1234';
const PASSWORD = 'correct horse';

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
        biometryResult = 'success',
        settings = { pin: PIN },
        params = {}
    }: {
        biometry?: boolean;
        biometryResult?: string;
        settings?: Record<string, any>;
        params?: Record<string, any>;
    } = {}
) => {
    const SettingsStore = {
        settings,
        posStatus: 'inactive',
        triggerSettingsRefresh: false,
        isBiometryConfigured: jest.fn(() => biometry),
        authenticateWithBiometry: jest.fn(async () => biometryResult),
        bindLegacyBiometryKey: jest.fn(),
        disableBiometry: jest.fn(() => Promise.resolve()),
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

const submitPassword = async (buttonTitle: string) => {
    await fireEvent.changeText(
        screen.getByPlaceholderText('****************'),
        PASSWORD
    );
    await fireEvent.press(screen.getByRole('button', { name: buttonTitle }));
};

let errorSpy: jest.SpyInstance;

beforeEach(() => {
    mockPinEntry = PIN;
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

describe('Lockscreen biometrics', () => {
    it('stays locked and explains why when enrollment changed', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore, navigation } = await renderLockscreen(
            updateSettings,
            { biometry: true, biometryResult: 'invalidated' }
        );

        expect(SettingsStore.authenticateWithBiometry).toHaveBeenCalled();
        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
        expect(navigation.pop).not.toHaveBeenCalled();
        expect(
            screen.getByText('views.Lockscreen.biometricsChanged')
        ).toBeOnTheScreen();
    });

    it.each(['cancelled', 'failed'])(
        'falls back to the PIN without a message when the prompt is %s',
        async (biometryResult) => {
            const updateSettings = jest.fn(() => Promise.resolve());
            const { SettingsStore, navigation } = await renderLockscreen(
                updateSettings,
                { biometry: true, biometryResult }
            );

            expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
            expect(navigation.pop).not.toHaveBeenCalled();
            expect(
                screen.queryByText('views.Lockscreen.biometricsChanged')
            ).not.toBeOnTheScreen();
            expect(
                screen.getByRole('button', { name: 'Submit PIN' })
            ).toBeOnTheScreen();
        }
    );

    it('does not prompt when biometrics are not configured', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore } = await renderLockscreen(updateSettings);

        expect(SettingsStore.authenticateWithBiometry).not.toHaveBeenCalled();
    });

    it('binds a legacy biometric key after a PIN login', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore } = await renderLockscreen(updateSettings);
        await submitPin();

        expect(SettingsStore.bindLegacyBiometryKey).toHaveBeenCalledTimes(1);
    });

    it('does not bind a biometric key after a wrong PIN', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore, navigation } = await renderLockscreen(
            updateSettings
        );
        SettingsStore.getSettings.mockResolvedValue({});
        mockPinEntry = '0000';
        await submitPin();

        expect(SettingsStore.bindLegacyBiometryKey).not.toHaveBeenCalled();
        expect(navigation.pop).not.toHaveBeenCalled();
    });

    it.each([
        [
            'PIN',
            { pin: PIN },
            { deletePin: true },
            () => submitPin(),
            { pin: '', duressPin: '' }
        ],
        [
            'password',
            { passphrase: PASSWORD },
            { deletePassword: true },
            () => submitPassword('views.Settings.SetPassword.deletePassword'),
            { passphrase: '', duressPassphrase: '' }
        ]
    ] as const)(
        'disables biometrics before deleting the %s',
        async (_label, settings, params, submit, cleared) => {
            const updateSettings = jest.fn((_update: any) => Promise.resolve());
            const { SettingsStore, navigation } = await renderLockscreen(
                updateSettings,
                { settings, params }
            );
            await submit();

            expect(SettingsStore.disableBiometry).toHaveBeenCalledTimes(1);
            const clearIndex = updateSettings.mock.calls.findIndex(
                ([update]: any) =>
                    Object.keys(cleared).every((key) => key in update)
            );
            expect(clearIndex).toBeGreaterThan(-1);
            expect(updateSettings.mock.calls[clearIndex][0]).toEqual(
                expect.objectContaining(cleared)
            );
            expect(
                SettingsStore.disableBiometry.mock.invocationCallOrder[0]
            ).toBeLessThan(updateSettings.mock.invocationCallOrder[clearIndex]);
            expect(navigation.popTo).toHaveBeenCalledWith('Security');
        }
    );

    it('does not clear the PIN when disabling biometrics fails', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore, navigation } = await renderLockscreen(
            updateSettings,
            { params: { deletePin: true } }
        );
        SettingsStore.disableBiometry.mockRejectedValueOnce(
            new Error('write failed')
        );
        await submitPin();

        expect(updateSettings).not.toHaveBeenCalledWith(
            expect.objectContaining({ pin: '' })
        );
        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(
            screen.getByText('views.Settings.Security.deleteFailed')
        ).toBeOnTheScreen();
    });
});

// A failed settings write while deleting a credential must not escape
// onAttemptLogIn as an unhandled rejection. The credential stays in place,
// the user stays on the Lockscreen and is told to try again.
describe('Lockscreen credential deletion failure', () => {
    it.each([
        ['deletePin', { pin: PIN }, () => submitPin()],
        ['deleteDuressPin', { pin: PIN }, () => submitPin()],
        [
            'deletePassword',
            { passphrase: PASSWORD },
            () => submitPassword('views.Settings.SetPassword.deletePassword')
        ],
        [
            'deleteDuressPassword',
            { passphrase: PASSWORD },
            () =>
                submitPassword(
                    'views.Settings.SetDuressPassword.deletePassword'
                )
        ]
    ] as const)(
        'shows a message and stays when %s fails',
        async (flag, settings, submit) => {
            const updateSettings = jest.fn(() =>
                Promise.reject(new Error('write failed'))
            );
            const { navigation } = await renderLockscreen(updateSettings, {
                settings,
                params: { [flag]: true }
            });
            await submit();

            expect(navigation.popTo).not.toHaveBeenCalled();
            expect(
                screen.getByText('views.Settings.Security.deleteFailed')
            ).toBeOnTheScreen();
            expect(errorSpy).toHaveBeenCalled();
        }
    );

    it('clears the message on the next attempt', async () => {
        const updateSettings = jest
            .fn()
            .mockRejectedValueOnce(new Error('write failed'))
            .mockResolvedValue(undefined);
        const { navigation } = await renderLockscreen(updateSettings, {
            params: { deletePin: true }
        });
        await submitPin();
        expect(
            screen.getByText('views.Settings.Security.deleteFailed')
        ).toBeOnTheScreen();

        await submitPin();

        expect(
            screen.queryByText('views.Settings.Security.deleteFailed')
        ).not.toBeOnTheScreen();
        expect(navigation.popTo).toHaveBeenCalledWith('Security');
    });
});
