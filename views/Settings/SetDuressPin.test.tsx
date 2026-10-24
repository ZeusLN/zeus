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

import SetDuressPin from './SetDuressPin';

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

const renderSetDuressPin = async (
    updateSettings: jest.Mock,
    { pin = '' } = {}
) => {
    const settings = { pin, scramblePin: false };
    const SettingsStore = {
        settings,
        getSettings: jest.fn(async () => settings),
        setLoginStatus: jest.fn(),
        updateSettings
    };
    const navigation = { popTo: jest.fn() };
    const ref = React.createRef<SetDuressPin>();
    await render(
        <SetDuressPin
            ref={ref}
            SettingsStore={SettingsStore as any}
            navigation={navigation as any}
        />
    );
    const instance = ref.current!;
    return { SettingsStore, navigation, instance };
};

const enterPins = (instance: SetDuressPin, pin: string, confirm: string) =>
    act(async () => {
        instance.setState({ duressPin: pin, duressPinConfirm: confirm });
    });

const errorMessages = () =>
    nodes('ErrorMessage').map((node) => node.props.message);

let errorSpy: jest.SpyInstance;
beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe('SetDuressPin save', () => {
    it('rejects a duress PIN equal to the in-memory PIN', async () => {
        const updateSettings = jest.fn();
        const { SettingsStore, instance } = await renderSetDuressPin(
            updateSettings,
            { pin: '1234' }
        );
        await enterPins(instance, '1234', '1234');
        await act(() => instance.saveSettings());
        expect(instance.state.duressPinInvalidError).toBe(true);
        expect(updateSettings).not.toHaveBeenCalled();
        expect(SettingsStore.getSettings).not.toHaveBeenCalled();
    });

    it('rejects a mismatched confirmation without saving', async () => {
        const updateSettings = jest.fn();
        const { instance } = await renderSetDuressPin(updateSettings);
        await enterPins(instance, '1234', '5678');
        await act(() => instance.saveSettings());
        expect(instance.state.duressPinMismatchError).toBe(true);
        expect(updateSettings).not.toHaveBeenCalled();
    });

    it('locks the screen while saving, then navigates', async () => {
        const write = deferred();
        const updateSettings = jest.fn(() => write.promise);
        const { SettingsStore, navigation, instance } =
            await renderSetDuressPin(updateSettings, { pin: '9999' });
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
        expect(updateSettings).toHaveBeenCalledWith({ duressPin: '1234' });
        expect(node('Pin').props.disabled).toBe(true);
        expect(node('PreventRemove').props.enabled).toBe(true);
        expect(node('Header').props.leftComponent).toBe(undefined);
        expect(navigation.popTo).not.toHaveBeenCalled();

        await act(async () => {
            write.resolve();
            await save;
        });
        expect(node('PreventRemove').props.enabled).toBe(false);
        expect(navigation.popTo).toHaveBeenCalledWith('Security');
        expect(preventRemoveAtPopTo).toBe(false);
        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
        expect(SettingsStore.getSettings).not.toHaveBeenCalled();
    });

    it('unlocks and shows an error when the write fails', async () => {
        const write = deferred();
        const updateSettings = jest.fn(() => write.promise);
        const { navigation, instance } = await renderSetDuressPin(
            updateSettings,
            { pin: '9999' }
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

        await act(async () => {
            node('Pin').props.onPinChange();
        });
        expect(errorMessages()).toEqual([]);
    });
});
