jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/ModalStore', () => ({}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/LockVerifierUtils', () => ({
    deriveVerifier: jest.fn(),
    matchesLockCredential: jest.fn(),
    hasLockCredential: jest.fn(() => true)
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: () => null
}));
jest.mock('../../components/TextInput', () => {
    const React = require('react');
    return React.forwardRef((_props: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({ focus: jest.fn() }));
        return null;
    });
});

import * as React from 'react';
import { act, render } from '@testing-library/react-native';
import SetPassword from './SetPassword';

describe('SetPassword deletePassword', () => {
    // The verifiers are the only thing the lock checks, so deleting the
    // password has to clear both of them or the lock stays on
    it('clears the password and duress password verifiers', async () => {
        const ref = React.createRef<any>();
        const updateSettings = jest.fn(() => Promise.resolve());
        const SettingsStore = {
            getSettings: jest.fn(async () => ({ isBiometryEnabled: false })),
            disableBiometry: jest.fn(() => Promise.resolve()),
            updateSettings
        };
        const navigation = { popTo: jest.fn() };
        await render(
            <SetPassword
                ref={ref}
                SettingsStore={SettingsStore as any}
                ModalStore={{} as any}
                navigation={navigation as any}
                route={{ params: {} }}
            />
        );

        await act(async () => {
            await ref.current.deletePassword();
        });

        expect(navigation.popTo).toHaveBeenCalledWith('Security');
        const writes = updateSettings.mock.calls.map((call: any[]) => call[0]);
        // the plaintext fields too, in case the verifier migration has not
        // hashed them yet
        for (const key of [
            'passphraseVerifier',
            'duressPassphraseVerifier',
            'passphrase',
            'duressPassphrase'
        ]) {
            expect(
                writes.some(
                    (patch: any) => key in patch && patch[key] === undefined
                )
            ).toBe(true);
        }
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
        expect('passphrase' in patch).toBe(true);
    });
});
