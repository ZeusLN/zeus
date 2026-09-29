import React from 'react';
import renderer, { act } from 'react-test-renderer';

// mobx-react's main entry needs react-dom; the stores arrive as props here
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/Button', () => () => null);
jest.mock('../components/Header', () => () => null);
jest.mock('../components/LoadingIndicator', () => () => null);
jest.mock('../components/Pin', () => () => null);
jest.mock('../components/ShowHideToggle', () => () => null);
jest.mock('../components/TextInput', () => () => null);
jest.mock('../components/SuccessErrorMessage', () => ({
    ErrorMessage: () => null
}));
jest.mock('../stores/SettingsStore', () => ({
    PosEnabled: {
        Disabled: 'disabled',
        Square: 'square',
        Standalone: 'standalone'
    }
}));
jest.mock('../utils/BiometricUtils', () => ({
    verifyBiometry: jest.fn()
}));
jest.mock('../utils/DataClearUtils', () => ({
    blockNavigationDuringWipe: jest.fn(),
    clearAllData: jest.fn()
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../utils/RestartUtils', () => ({
    restartApp: jest.fn()
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));

import { verifyBiometry } from '../utils/BiometricUtils';
import Lockscreen from './Lockscreen';

const PIN = '1234';

const deferred = () => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const renderLockscreen = async (
    updateSettings: jest.Mock,
    { biometry = false }: { biometry?: boolean } = {}
) => {
    const SettingsStore = {
        settings: { pin: PIN },
        posStatus: 'inactive',
        triggerSettingsRefresh: false,
        isBiometryConfigured: jest.fn(() => biometry),
        loginRequired: jest.fn(() => true),
        setLoginStatus: jest.fn(),
        setPosStatus: jest.fn(),
        getSettings: jest.fn(),
        updateSettings
    };
    const navigation = {
        pop: jest.fn(),
        popTo: jest.fn(),
        replace: jest.fn()
    };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
        tree = renderer.create(
            <Lockscreen
                SettingsStore={SettingsStore as any}
                navigation={navigation as any}
                route={{ params: {} } as any}
            />
        );
    });
    const instance = tree!.root.findByType(Lockscreen).instance as Lockscreen;
    return { SettingsStore, navigation, instance };
};

const enterCorrectPin = (instance: Lockscreen) =>
    act(async () => {
        instance.setState({ pinAttempt: PIN });
    });

let errorSpy: jest.SpyInstance;

beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    errorSpy.mockRestore();
});

// A verified login resets authenticationAttempts before navigating away, so
// the refresh flag that write may arm lands before the Wallet screen regains
// focus. The reset must never keep the user on the Lockscreen, though.
describe('Lockscreen login', () => {
    it('navigates only once the attempt reset has resolved', async () => {
        const reset = deferred();
        const updateSettings = jest.fn(() => reset.promise);
        const { navigation, instance } = await renderLockscreen(updateSettings);
        await enterCorrectPin(instance);

        let login: Promise<void>;
        await act(async () => {
            login = instance.onAttemptLogIn();
        });

        expect(updateSettings).toHaveBeenCalledWith({
            authenticationAttempts: 0
        });
        expect(navigation.pop).not.toHaveBeenCalled();

        await act(async () => {
            reset.resolve();
            await login;
        });

        expect(navigation.pop).toHaveBeenCalledTimes(1);
    });

    it('still unlocks when the attempt reset fails', async () => {
        const error = new Error('keychain unavailable');
        const updateSettings = jest.fn(() => Promise.reject(error));
        const { SettingsStore, navigation, instance } = await renderLockscreen(
            updateSettings
        );
        await enterCorrectPin(instance);

        await act(async () => {
            await expect(instance.onAttemptLogIn()).resolves.toBeUndefined();
        });

        expect(SettingsStore.setLoginStatus).toHaveBeenCalledWith(true);
        expect(navigation.pop).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to reset authentication attempts',
            error
        );
    });

    it('navigates once when a second submit arrives while the reset is pending', async () => {
        const reset = deferred();
        const updateSettings = jest.fn(() => reset.promise);
        const { navigation, instance } = await renderLockscreen(updateSettings);
        await enterCorrectPin(instance);

        let first: Promise<void>;
        let second: Promise<void>;
        await act(async () => {
            first = instance.onAttemptLogIn();
            second = instance.onAttemptLogIn();
        });
        await act(async () => {
            reset.resolve();
            await Promise.all([first, second]);
        });

        expect(updateSettings).toHaveBeenCalledTimes(1);
        expect(navigation.pop).toHaveBeenCalledTimes(1);
    });

    it('still unlocks through biometrics when the attempt reset fails', async () => {
        (verifyBiometry as jest.Mock).mockResolvedValue(true);
        const error = new Error('keychain unavailable');
        const updateSettings = jest.fn(() => Promise.reject(error));

        const { SettingsStore, navigation } = await renderLockscreen(
            updateSettings,
            { biometry: true }
        );

        expect(SettingsStore.setLoginStatus).toHaveBeenCalledWith(true);
        expect(navigation.pop).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to reset authentication attempts',
            error
        );
    });
});
