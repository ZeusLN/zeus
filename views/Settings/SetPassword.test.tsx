import React from 'react';
import renderer, { act } from 'react-test-renderer';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Button', () => () => null);
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/LoadingIndicator', () => () => null);
jest.mock('../../components/PreventRemove', () => () => null);
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: () => null
}));
// forwardRef: the screen focuses the first input through a ref
jest.mock('../../components/TextInput', () =>
    require('react').forwardRef(() => null)
);
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

import Button from '../../components/Button';
import Header from '../../components/Header';
import PreventRemove from '../../components/PreventRemove';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import TextInput from '../../components/TextInput';
import SetPassword from './SetPassword';

const SAVE = 'views.Settings.SetPassword.save';
const DELETE = 'views.Settings.SetPassword.deletePassword';

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
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
        tree = renderer.create(
            <SetPassword
                SettingsStore={SettingsStore as any}
                ModalStore={{} as any}
                navigation={navigation as any}
                route={{ params: { forBiometrics } } as any}
            />
        );
    });
    const instance = tree!.root.findByType(SetPassword).instance as SetPassword;
    return { tree: tree!, SettingsStore, navigation, instance };
};

const enterPasswords = (
    instance: SetPassword,
    passphrase: string,
    confirm: string
) =>
    act(async () => {
        instance.setState({ passphrase, passphraseConfirm: confirm });
    });

const button = (tree: renderer.ReactTestRenderer, title: string) =>
    tree.root.findAll(
        (node) => node.type === Button && node.props.title === title
    )[0];

const inputsLocked = (tree: renderer.ReactTestRenderer) =>
    tree.root.findAllByType(TextInput).map((node) => node.props.locked);

const inputsMasked = (tree: renderer.ReactTestRenderer) =>
    tree.root
        .findAllByType(TextInput)
        .map((node) => node.props.secureTextEntry);

const errorMessages = (tree: renderer.ReactTestRenderer) =>
    tree.root.findAllByType(ErrorMessage).map((node) => node.props.message);

let errorSpy: jest.SpyInstance;
beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe('SetPassword inputs', () => {
    it('are masked', async () => {
        const { tree } = await renderSetPassword(jest.fn());
        expect(inputsMasked(tree)).toEqual([true, true]);
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
        const { tree, SettingsStore, navigation, instance } =
            await renderSetPassword(updateSettings, { forBiometrics: true });
        // PreventRemove would also block the screen's own popTo if still enabled
        let preventRemoveAtPopTo: boolean | undefined;
        navigation.popTo.mockImplementation(() => {
            preventRemoveAtPopTo =
                tree.root.findByType(PreventRemove).props.enabled;
        });
        await enterPasswords(instance, 'secret', 'secret');

        let save: Promise<void>;
        await act(async () => {
            save = instance.saveSettings();
        });
        expect(updateSettings).toHaveBeenCalledWith({ passphrase: 'secret' });
        expect(inputsLocked(tree)).toEqual([true, true]);
        expect(button(tree, SAVE).props.disabled).toBe(true);
        expect(button(tree, DELETE).props.disabled).toBe(true);
        expect(tree.root.findByType(PreventRemove).props.enabled).toBe(true);
        expect(tree.root.findByType(Header).props.leftComponent).toBe(
            undefined
        );
        expect(navigation.popTo).not.toHaveBeenCalled();

        await act(async () => {
            write.resolve();
            await save;
        });
        expect(tree.root.findByType(PreventRemove).props.enabled).toBe(false);
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
        const { tree, SettingsStore, navigation, instance } =
            await renderSetPassword(updateSettings);
        await enterPasswords(instance, 'secret', 'secret');

        let save: Promise<void>;
        await act(async () => {
            save = instance.saveSettings();
        });
        await act(async () => {
            firstWrite.reject(new Error('keychain'));
            await save;
        });
        expect(inputsLocked(tree)).toEqual([false, false]);
        expect(button(tree, SAVE).props.disabled).toBe(false);
        expect(button(tree, DELETE).props.disabled).toBe(false);
        expect(tree.root.findByType(PreventRemove).props.enabled).toBe(false);
        expect(tree.root.findByType(Header).props.leftComponent).toBe('Back');
        expect(errorMessages(tree)).toEqual([
            'views.Settings.SetPassword.saveError'
        ]);
        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();

        // a retry clears the error while it runs
        await act(async () => {
            save = instance.saveSettings();
        });
        expect(errorMessages(tree)).toEqual([]);
        await act(async () => {
            retryWrite.reject(new Error('keychain'));
            await save;
        });
        expect(errorMessages(tree)).toEqual([
            'views.Settings.SetPassword.saveError'
        ]);

        // so does editing the input
        await act(async () => {
            tree.root.findAllByType(TextInput)[0].props.onChangeText('x');
        });
        expect(errorMessages(tree)).toEqual([]);
    });
});
