import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable role="button" onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/TextInput', () => () => null);
jest.mock('../../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>
    };
});
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/ModalStore', () => ({}));
// Confirm the destructive choice straight away
jest.mock('../../utils/ActionUtils', () => ({
    confirmAction: jest.fn((_title, _message, confirm) => confirm.onPress())
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));

import SetPassword from './SetPassword';

const DELETE = 'views.Settings.SetPassword.deletePassword';
const DELETE_FAILED = 'views.Settings.Security.deleteFailed';

const renderSetPassword = async (
    updateSettings: jest.Mock,
    { isBiometryEnabled = false }: { isBiometryEnabled?: boolean } = {}
) => {
    const SettingsStore = {
        getSettings: jest.fn(async () => ({
            passphrase: 'secret',
            isBiometryEnabled
        })),
        disableBiometry: jest.fn(() => Promise.resolve()),
        updateSettings
    };
    const ModalStore = { toggleInfoModal: jest.fn() };
    const navigation = { popTo: jest.fn() };
    await render(
        <SetPassword
            SettingsStore={SettingsStore as any}
            ModalStore={ModalStore as any}
            navigation={navigation as any}
            route={{ params: {} }}
        />
    );
    return { SettingsStore, ModalStore, navigation };
};

const pressDelete = () =>
    fireEvent.press(screen.getByRole('button', { name: DELETE }));

let errorSpy: jest.SpyInstance;

beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    errorSpy.mockRestore();
});

describe('SetPassword deletePassword', () => {
    it('disables biometrics, clears both passwords and returns to Security', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore, navigation } = await renderSetPassword(
            updateSettings
        );

        await pressDelete();

        expect(SettingsStore.disableBiometry).toHaveBeenCalledTimes(1);
        expect(updateSettings).toHaveBeenCalledWith({
            duressPassphrase: '',
            passphrase: ''
        });
        expect(
            SettingsStore.disableBiometry.mock.invocationCallOrder[0]
        ).toBeLessThan(updateSettings.mock.invocationCallOrder[0]);
        expect(navigation.popTo).toHaveBeenCalledWith('Security');
        expect(screen.queryByText(DELETE_FAILED)).not.toBeOnTheScreen();
    });

    it('warns that biometrics will be turned off before deleting', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { ModalStore, navigation } = await renderSetPassword(
            updateSettings,
            { isBiometryEnabled: true }
        );

        await pressDelete();

        expect(updateSettings).not.toHaveBeenCalled();
        const [{ text, buttons }] = ModalStore.toggleInfoModal.mock.calls[0];
        expect(text).toBe('views.Settings.Security.biometricsWillBeDisabled');

        await buttons[0].callback();
        expect(updateSettings).toHaveBeenCalledWith({
            duressPassphrase: '',
            passphrase: ''
        });
        expect(navigation.popTo).toHaveBeenCalledWith('Security');
    });

    it('shows a message and stays when the settings write fails', async () => {
        const updateSettings = jest.fn(() =>
            Promise.reject(new Error('write failed'))
        );
        const { navigation } = await renderSetPassword(updateSettings);

        await pressDelete();

        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(screen.getByText(DELETE_FAILED)).toBeOnTheScreen();
        expect(errorSpy).toHaveBeenCalled();
    });
});
