import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

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
// The screen offers Delete password when a password verifier is saved
jest.mock('../../utils/LockVerifierUtils', () => ({
    deriveVerifier: jest.fn(),
    matchesLockCredential: jest.fn(),
    hasLockCredential: jest.fn(() => true)
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
            passphraseVerifier: {
                kdf: 'pbkdf2-sha256',
                salt: 'aa',
                hash: 'bb'
            },
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
    it('disables biometrics, clears both password verifiers and returns to Security', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore, navigation } = await renderSetPassword(
            updateSettings
        );

        await pressDelete();

        expect(SettingsStore.disableBiometry).toHaveBeenCalledTimes(1);
        expect(updateSettings).toHaveBeenCalledWith({
            duressPassphraseVerifier: undefined,
            passphraseVerifier: undefined
        });
        expect(
            SettingsStore.disableBiometry.mock.invocationCallOrder[0]
        ).toBeLessThan(updateSettings.mock.invocationCallOrder[0]);
        expect(navigation.popTo).toHaveBeenCalledWith('Security');
        expect(screen.queryByText(DELETE_FAILED)).not.toBeOnTheScreen();
    });

    // The lock checks the verifiers, any plaintext the verifier migration
    // has not hashed yet, and the other method's records from before a
    // downgrade, so deleting the password has to clear all of them or the
    // lock stays on
    it('clears the plaintext and the other method records too', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { navigation } = await renderSetPassword(updateSettings);

        await pressDelete();

        expect(navigation.popTo).toHaveBeenCalledWith('Security');
        const writes = updateSettings.mock.calls.map((call: any[]) => call[0]);
        for (const key of [
            'passphraseVerifier',
            'duressPassphraseVerifier',
            'passphrase',
            'duressPassphrase',
            'pinVerifier',
            'duressPinVerifier'
        ]) {
            expect(
                writes.some(
                    (patch: any) => key in patch && patch[key] === undefined
                )
            ).toBe(true);
        }
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
            duressPassphraseVerifier: undefined,
            passphraseVerifier: undefined
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

describe('SetPassword saveSettings', () => {
    // a plaintext passphrase the verifier migration has not hashed yet
    // would otherwise win over the new record at the next unlock
    it('clears the plaintext passphrase with the new verifier', async () => {
        const { deriveVerifier, matchesLockCredential } = jest.requireMock(
            '../../utils/LockVerifierUtils'
        );
        const record = { kdf: 'pbkdf2-sha256', salt: 'aa', hash: 'bb' };
        deriveVerifier.mockResolvedValue(record);
        matchesLockCredential.mockResolvedValue(false);
        const ref = React.createRef<any>();
        const updateSettings = jest.fn(() => Promise.resolve());
        const SettingsStore = {
            getSettings: jest.fn(async () => ({ passphrase: 'old secret' })),
            updateSettings,
            setLoginStatus: jest.fn()
        };
        await render(
            <SetPassword
                ref={ref}
                SettingsStore={SettingsStore as any}
                ModalStore={{} as any}
                navigation={{ popTo: jest.fn() } as any}
                route={{ params: {} }}
            />
        );

        await act(async () => {
            ref.current.setState({
                passphrase: 'new secret',
                passphraseConfirm: 'new secret'
            });
        });
        await act(async () => {
            await ref.current.saveSettings();
        });

        expect(updateSettings).toHaveBeenCalledWith({
            passphraseVerifier: record,
            passphrase: undefined
        });
        const patch: any = (updateSettings.mock.calls[0] as any[])[0];
        // with the PIN records from before a downgrade
        for (const key of ['passphrase', 'pinVerifier', 'duressPinVerifier']) {
            expect(key in patch && patch[key] === undefined).toBe(true);
        }
    });
});
