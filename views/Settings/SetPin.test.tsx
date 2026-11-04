import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

// mobx-react's main entry needs react-dom; the store arrives as a prop here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/Pin', () => 'Pin');
jest.mock('../../components/PreventRemove', () => 'PreventRemove');
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: 'ErrorMessage'
}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));

import SetPin from './SetPin';

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

const renderSetPin = async (
    updateSettings: jest.Mock,
    { duressPin = '', forBiometrics = false } = {}
) => {
    const settings = { duressPin, scramblePin: false };
    const SettingsStore = {
        settings,
        getSettings: jest.fn(async () => settings),
        setLoginStatus: jest.fn(),
        updateSettings
    };
    const navigation = { popTo: jest.fn() };
    const ref = React.createRef<SetPin>();
    await render(
        <SetPin
            ref={ref}
            SettingsStore={SettingsStore as any}
            navigation={navigation as any}
            route={{ params: { forBiometrics } } as any}
        />
    );
    const instance = ref.current!;
    return { SettingsStore, navigation, instance };
};

const enterPins = (instance: SetPin, pin: string, confirm: string) =>
    act(async () => {
        instance.setState({ pin, pinConfirm: confirm });
    });

const errorMessages = () =>
    nodes('ErrorMessage').map((node) => node.props.message);

let errorSpy: jest.SpyInstance;
beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe('SetPin save', () => {
    it('rejects a PIN equal to the in-memory duress PIN', async () => {
        const updateSettings = jest.fn();
        const { SettingsStore, instance } = await renderSetPin(updateSettings, {
            duressPin: '1234'
        });
        await enterPins(instance, '1234', '1234');
        await act(() => instance.saveSettings());
        expect(instance.state.pinInvalidError).toBe(true);
        expect(updateSettings).not.toHaveBeenCalled();
        expect(SettingsStore.getSettings).not.toHaveBeenCalled();
    });

    it('rejects a mismatched confirmation without saving', async () => {
        const updateSettings = jest.fn();
        const { instance } = await renderSetPin(updateSettings);
        await enterPins(instance, '1234', '5678');
        await act(() => instance.saveSettings());
        expect(instance.state.pinMismatchError).toBe(true);
        expect(updateSettings).not.toHaveBeenCalled();
    });

    it('locks the screen while saving, then navigates', async () => {
        const write = deferred();
        const updateSettings = jest.fn(() => write.promise);
        const { SettingsStore, navigation, instance } = await renderSetPin(
            updateSettings,
            { forBiometrics: true }
        );
        // PreventRemove would also block the screen's own popTo if still enabled
        let preventRemoveAtPopTo: boolean | undefined;
        navigation.popTo.mockImplementation(() => {
            preventRemoveAtPopTo = node('PreventRemove').props.enabled;
        });
        await enterPins(instance, '1234', '1234');

        let save: Promise<void>;
        await act(async () => {
            save = instance.saveSettings();
        });
        expect(updateSettings).toHaveBeenCalledWith({ pin: '1234' });
        expect(node('Pin').props.disabled).toBe(true);
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
        expect(SettingsStore.getSettings).not.toHaveBeenCalled();
    });

    it('unlocks and shows an error when the write fails', async () => {
        const write = deferred();
        const updateSettings = jest.fn(() => write.promise);
        const { SettingsStore, navigation, instance } = await renderSetPin(
            updateSettings
        );
        await enterPins(instance, '1234', '1234');

        let save: Promise<void>;
        await act(async () => {
            save = instance.saveSettings();
        });
        await act(async () => {
            write.reject(new Error('keychain'));
            await save;
        });
        expect(node('Pin').props.disabled).toBe(false);
        expect(node('PreventRemove').props.enabled).toBe(false);
        expect(node('Header').props.leftComponent).toBe('Back');
        expect(errorMessages()).toEqual(['views.Settings.SetPin.saveError']);
        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();

        await act(async () => {
            node('Pin').props.onPinChange();
        });
        expect(errorMessages()).toEqual([]);
    });
});
