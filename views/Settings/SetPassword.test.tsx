import React from 'react';
import renderer, { act } from 'react-test-renderer';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../components/Button', () => () => null);
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/Screen', () => () => null);
jest.mock('../../components/TextInput', () => () => null);
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: () => null
}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../stores/ModalStore', () => ({}));
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

const renderSetPassword = async (updateSettings: jest.Mock) => {
    const SettingsStore = {
        getSettings: jest.fn(async () => ({ passphrase: 'secret' })),
        disableBiometry: jest.fn(() => Promise.resolve()),
        updateSettings
    };
    const navigation = { popTo: jest.fn() };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
        tree = renderer.create(
            <SetPassword
                SettingsStore={SettingsStore as any}
                ModalStore={{ toggleInfoModal: jest.fn() } as any}
                navigation={navigation as any}
                route={{ params: {} }}
            />
        );
    });
    const instance = tree!.root.findByType(SetPassword).instance as SetPassword;
    return { SettingsStore, navigation, instance };
};

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
        const { SettingsStore, navigation, instance } = await renderSetPassword(
            updateSettings
        );

        await act(async () => {
            await instance.deletePassword();
        });

        expect(SettingsStore.disableBiometry).toHaveBeenCalledTimes(1);
        expect(updateSettings).toHaveBeenCalledWith({
            duressPassphrase: '',
            passphrase: ''
        });
        expect(navigation.popTo).toHaveBeenCalledWith('Security');
        expect(instance.state.deleteFailedError).toBe(false);
    });

    it('shows a message and stays when the settings write fails', async () => {
        const updateSettings = jest.fn(() =>
            Promise.reject(new Error('write failed'))
        );
        const { navigation, instance } = await renderSetPassword(
            updateSettings
        );

        await act(async () => {
            await expect(instance.deletePassword()).resolves.toBe(undefined);
        });

        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(instance.state.deleteFailedError).toBe(true);
        expect(errorSpy).toHaveBeenCalled();
    });
});
