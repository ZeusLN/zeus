import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/PreventRemove', () => 'PreventRemove');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
// forwardRef: the screen focuses the first input through a ref
jest.mock('../../components/TextInput', () => {
    const React = require('react');
    return React.forwardRef((props: any, _ref: any) =>
        React.createElement('TextInput', props)
    );
});
jest.mock('../../stores/ModalStore', () => ({}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../utils/ActionUtils', () => ({
    confirmAction: jest.fn()
}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));

import SetPassword from './SetPassword';

const SAVE = 'views.Settings.SetPassword.save';
const DELETE = 'views.Settings.SetPassword.deletePassword';

const nodes = (type: string) =>
    screen.container.queryAll((node) => node.type === type);
const node = (type: string) => nodes(type)[0];

const deferred = () => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const renderSetPassword = async (
    updateSettings: jest.Mock,
    { duressPassphrase = '', forBiometrics = false } = {}
) => {
    const settings = {
        passphrase: 'saved',
        duressPassphrase,
        isBiometryEnabled: false
    };
    const SettingsStore = {
        settings,
        // componentDidMount loads the stored settings through this
        getSettings: jest.fn(async () => settings),
        setLoginStatus: jest.fn(),
        updateSettings
    };
    const navigation = { popTo: jest.fn() };
    const ref = React.createRef<SetPassword>();
    await render(
        <SetPassword
            ref={ref}
            SettingsStore={SettingsStore as any}
            ModalStore={{} as any}
            navigation={navigation as any}
            route={{ params: { forBiometrics } } as any}
        />
    );
    const instance = ref.current!;
    return { SettingsStore, navigation, instance };
};

const enterPasswords = (
    instance: SetPassword,
    passphrase: string,
    confirm: string
) =>
    act(async () => {
        instance.setState({ passphrase, passphraseConfirm: confirm });
    });

const button = (title: string) =>
    nodes('Button').filter((node) => node.props.title === title)[0];

const inputsLocked = () => nodes('TextInput').map((node) => node.props.locked);

const inputsMasked = () =>
    nodes('TextInput').map((node) => node.props.secureTextEntry);

const errorMessages = () =>
    nodes('ErrorMessage').map((node) => node.props.message);

let errorSpy: jest.SpyInstance;
beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe('SetPassword inputs', () => {
    it('are masked', async () => {
        await renderSetPassword(jest.fn());
        expect(inputsMasked()).toEqual([true, true]);
    });
});

describe('SetPassword save', () => {
    it('rejects a password equal to the in-memory duress password', async () => {
        const updateSettings = jest.fn();
        const { SettingsStore, instance } = await renderSetPassword(
            updateSettings,
            { duressPassphrase: 'secret' }
        );
        await enterPasswords(instance, 'secret', 'secret');
        await act(() => instance.saveSettings());
        expect(instance.state.passphraseInvalidError).toBe(true);
        expect(updateSettings).not.toHaveBeenCalled();
        // the call from componentDidMount; saving must not read again
        expect(SettingsStore.getSettings).toHaveBeenCalledTimes(1);
    });

    it('rejects a mismatched confirmation without saving', async () => {
        const updateSettings = jest.fn();
        const { instance } = await renderSetPassword(updateSettings);
        await enterPasswords(instance, 'secret', 'other');
        await act(() => instance.saveSettings());
        expect(instance.state.passphraseMismatchError).toBe(true);
        expect(updateSettings).not.toHaveBeenCalled();
    });

    it('rejects an empty password without saving', async () => {
        const updateSettings = jest.fn();
        const { instance } = await renderSetPassword(updateSettings);
        await enterPasswords(instance, '', '');
        await act(() => instance.saveSettings());
        expect(instance.state.passphraseEmptyError).toBe(true);
        expect(updateSettings).not.toHaveBeenCalled();
    });

    it('locks the screen while saving, then navigates', async () => {
        const write = deferred();
        const updateSettings = jest.fn(() => write.promise);
        const { SettingsStore, navigation, instance } = await renderSetPassword(
            updateSettings,
            { forBiometrics: true }
        );
        // PreventRemove would also block the screen's own popTo if still enabled
        let preventRemoveAtPopTo: boolean | undefined;
        navigation.popTo.mockImplementation(() => {
            preventRemoveAtPopTo = node('PreventRemove').props.enabled;
        });
        await enterPasswords(instance, 'secret', 'secret');

        let save: Promise<void>;
        await act(async () => {
            save = instance.saveSettings();
        });
        expect(updateSettings).toHaveBeenCalledWith({ passphrase: 'secret' });
        expect(inputsLocked()).toEqual([true, true]);
        expect(button(SAVE).props.disabled).toBe(true);
        expect(button(DELETE).props.disabled).toBe(true);
        expect(node('PreventRemove').props.enabled).toBe(true);
        expect(node('Header').props.leftComponent).toBe(undefined);
        expect(navigation.popTo).not.toHaveBeenCalled();

        await act(async () => {
            write.resolve();
            await save;
        });
        expect(node('PreventRemove').props.enabled).toBe(false);
        expect(SettingsStore.setLoginStatus).toHaveBeenCalledWith(true);
        expect(navigation.popTo).toHaveBeenCalledWith('Security', {
            enableBiometrics: true
        });
        expect(preventRemoveAtPopTo).toBe(false);
        // the call from componentDidMount; saving must not read again
        expect(SettingsStore.getSettings).toHaveBeenCalledTimes(1);
    });

    it('unlocks and shows an error when the write fails', async () => {
        const firstWrite = deferred();
        const retryWrite = deferred();
        const updateSettings = jest
            .fn()
            .mockReturnValueOnce(firstWrite.promise)
            .mockReturnValueOnce(retryWrite.promise);
        const { SettingsStore, navigation, instance } = await renderSetPassword(
            updateSettings
        );
        await enterPasswords(instance, 'secret', 'secret');

        let save: Promise<void>;
        await act(async () => {
            save = instance.saveSettings();
        });
        await act(async () => {
            firstWrite.reject(new Error('keychain'));
            await save;
        });
        expect(inputsLocked()).toEqual([false, false]);
        expect(button(SAVE).props.disabled).toBe(false);
        expect(button(DELETE).props.disabled).toBe(false);
        expect(node('PreventRemove').props.enabled).toBe(false);
        expect(node('Header').props.leftComponent).toBe('Back');
        expect(errorMessages()).toEqual([
            'views.Settings.SetPassword.saveError'
        ]);
        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();

        // a retry clears the error while it runs
        await act(async () => {
            save = instance.saveSettings();
        });
        expect(errorMessages()).toEqual([]);
        await act(async () => {
            retryWrite.reject(new Error('keychain'));
            await save;
        });
        expect(errorMessages()).toEqual([
            'views.Settings.SetPassword.saveError'
        ]);

        // so does editing the input
        await act(async () => {
            nodes('TextInput')[0].props.onChangeText('x');
        });
        expect(errorMessages()).toEqual([]);
    });
});
