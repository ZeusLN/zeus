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
    verifySecret: jest.fn(),
    hasVerifier: jest.fn(() => true)
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
        for (const key of ['passphraseVerifier', 'duressPassphraseVerifier']) {
            expect(
                writes.some(
                    (patch: any) => key in patch && patch[key] === undefined
                )
            ).toBe(true);
        }
    });
});
