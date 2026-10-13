import React from 'react';
import renderer, { act } from 'react-test-renderer';

// mobx-react's main entry needs react-dom; the store arrives as a prop here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Header', () => () => null);
jest.mock('../../components/LoadingIndicator', () => () => null);
jest.mock('../../components/Pin', () => () => null);
jest.mock('../../components/PreventRemove', () => () => null);
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: () => null
}));
jest.mock('../../stores/SettingsStore', () => ({}));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));

import Header from '../../components/Header';
import Pin from '../../components/Pin';
import PreventRemove from '../../components/PreventRemove';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import SetDuressPin from './SetDuressPin';

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
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
        tree = renderer.create(
            <SetDuressPin
                SettingsStore={SettingsStore as any}
                navigation={navigation as any}
            />
        );
    });
    const instance = tree!.root.findByType(SetDuressPin)
        .instance as SetDuressPin;
    return { tree: tree!, SettingsStore, navigation, instance };
};

const enterPins = (instance: SetDuressPin, pin: string, confirm: string) =>
    act(async () => {
        instance.setState({ duressPin: pin, duressPinConfirm: confirm });
    });

const errorMessages = (tree: renderer.ReactTestRenderer) =>
    tree.root.findAllByType(ErrorMessage).map((node) => node.props.message);

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
        const { tree, SettingsStore, navigation, instance } =
            await renderSetDuressPin(updateSettings, { pin: '9999' });
        // PreventRemove would also block the screen's own popTo if still enabled
        let preventRemoveAtPopTo: boolean | undefined;
        navigation.popTo.mockImplementation(() => {
            preventRemoveAtPopTo =
                tree.root.findByType(PreventRemove).props.enabled;
        });
        await enterPins(instance, '1234', '1234');

        let save: Promise<void>;
        await act(async () => {
            save = instance.saveSettings();
        });
        expect(updateSettings).toHaveBeenCalledWith({ duressPin: '1234' });
        expect(tree.root.findByType(Pin).props.disabled).toBe(true);
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
        expect(navigation.popTo).toHaveBeenCalledWith('Security');
        expect(preventRemoveAtPopTo).toBe(false);
        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
        expect(SettingsStore.getSettings).not.toHaveBeenCalled();
    });

    it('unlocks and shows an error when the write fails', async () => {
        const write = deferred();
        const updateSettings = jest.fn(() => write.promise);
        const { tree, navigation, instance } = await renderSetDuressPin(
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
        expect(tree.root.findByType(Pin).props.disabled).toBe(false);
        expect(tree.root.findByType(PreventRemove).props.enabled).toBe(false);
        expect(tree.root.findByType(Header).props.leftComponent).toBe('Back');
        expect(errorMessages(tree)).toEqual([
            'views.Settings.SetPin.saveError'
        ]);
        expect(navigation.popTo).not.toHaveBeenCalled();

        await act(async () => {
            tree.root.findByType(Pin).props.onPinChange();
        });
        expect(errorMessages(tree)).toEqual([]);
    });
});
