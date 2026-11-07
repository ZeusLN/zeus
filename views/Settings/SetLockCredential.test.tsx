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
    hasVerifier: jest.fn(() => false)
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Pin', () => 'Pin');
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

import { deriveVerifier, verifySecret } from '../../utils/LockVerifierUtils';

import SetPin from './SetPin';
import SetDuressPin from './SetDuressPin';
import SetPassword from './SetPassword';
import SetDuressPassword from './SetDuressPassword';

const mockDeriveVerifier = deriveVerifier as jest.Mock;
const mockVerifySecret = verifySecret as jest.Mock;

const VERIFIER = {
    v: 1,
    kdf: 'pbkdf2-sha256',
    iterations: 100000,
    salt: 'aa'.repeat(16),
    hash: 'bb'.repeat(32)
};

const screens = [
    {
        name: 'SetPin',
        Component: SetPin,
        entry: { pin: '123456', pinConfirm: '123456' },
        field: 'pinVerifier'
    },
    {
        name: 'SetDuressPin',
        Component: SetDuressPin,
        entry: { duressPin: '654321', duressPinConfirm: '654321' },
        field: 'duressPinVerifier'
    },
    {
        name: 'SetPassword',
        Component: SetPassword,
        entry: { passphrase: 'hunter2', passphraseConfirm: 'hunter2' },
        field: 'passphraseVerifier'
    },
    {
        name: 'SetDuressPassword',
        Component: SetDuressPassword,
        entry: {
            duressPassphrase: 'hunter3',
            duressPassphraseConfirm: 'hunter3'
        },
        field: 'duressPassphraseVerifier'
    }
];

describe.each(screens)('$name saveSettings', ({ Component, entry, field }) => {
    let updateSettings: jest.Mock;
    let navigation: { popTo: jest.Mock };
    let setLoginStatus: jest.Mock;

    const renderScreen = async () => {
        const ref = React.createRef<any>();
        updateSettings = jest.fn(() => Promise.resolve());
        setLoginStatus = jest.fn();
        navigation = { popTo: jest.fn() };
        const SettingsStore = {
            settings: {},
            getSettings: jest.fn(async () => ({})),
            updateSettings,
            setLoginStatus
        };
        const AnyComponent = Component as any;
        await render(
            <AnyComponent
                ref={ref}
                SettingsStore={SettingsStore}
                ModalStore={{}}
                navigation={navigation}
                route={{ params: {} }}
            />
        );
        await act(async () => {
            ref.current.setState(entry);
        });
        return ref;
    };

    const save = async (ref: React.RefObject<any>) => {
        await act(async () => {
            await ref.current.saveSettings();
        });
    };

    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        mockVerifySecret.mockReset().mockResolvedValue(false);
        mockDeriveVerifier.mockReset().mockResolvedValue(VERIFIER);
    });

    afterEach(() => {
        (console.error as jest.Mock).mockRestore();
    });

    it('saves the verifier and returns to Security', async () => {
        const ref = await renderScreen();

        await save(ref);

        expect(updateSettings).toHaveBeenCalledWith({ [field]: VERIFIER });
        expect(navigation.popTo).toHaveBeenCalled();
        expect(ref.current.state.saveError).toBe(false);
    });

    // Without the catch these rejected out of saveSettings: nothing was
    // saved and the screen showed no message
    it('shows an error and saves nothing when the derivation fails', async () => {
        mockDeriveVerifier.mockRejectedValue(new Error('LockKdf failed'));
        const ref = await renderScreen();

        await save(ref);

        expect(updateSettings).not.toHaveBeenCalled();
        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(setLoginStatus).not.toHaveBeenCalled();
        expect(ref.current.state.saveError).toBe(true);
    });

    it('shows an error and saves nothing when the cross-check derivation fails', async () => {
        mockVerifySecret.mockRejectedValue(new Error('LockKdf failed'));
        const ref = await renderScreen();

        await save(ref);

        expect(mockDeriveVerifier).not.toHaveBeenCalled();
        expect(updateSettings).not.toHaveBeenCalled();
        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(ref.current.state.saveError).toBe(true);
    });

    it('shows an error and stays on the screen when the settings write fails', async () => {
        const ref = await renderScreen();
        updateSettings.mockRejectedValue(new Error('keychain write failed'));

        await save(ref);

        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(setLoginStatus).not.toHaveBeenCalled();
        expect(ref.current.state.saveError).toBe(true);
    });

    it('saves after a failed attempt once the derivation recovers', async () => {
        mockDeriveVerifier.mockRejectedValueOnce(new Error('LockKdf failed'));
        const ref = await renderScreen();

        await save(ref);
        expect(ref.current.state.saveError).toBe(true);

        await act(async () => {
            ref.current.setState(entry);
        });
        await save(ref);

        expect(updateSettings).toHaveBeenCalledWith({ [field]: VERIFIER });
        expect(navigation.popTo).toHaveBeenCalled();
    });
});
