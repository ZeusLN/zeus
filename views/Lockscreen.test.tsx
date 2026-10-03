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
// ShareIntentProcessor imports the store graph, which loads native modules
jest.mock('../stores/Stores', () => ({ settingsStore: {} }));
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
    {
        biometry = false,
        biometryResult = 'success'
    }: { biometry?: boolean; biometryResult?: string } = {}
) => {
    const SettingsStore = {
        settings: { pin: PIN },
        posStatus: 'inactive',
        triggerSettingsRefresh: false,
        isBiometryConfigured: jest.fn(() => biometry),
        isPosEnabled: jest.fn(() => false),
        authenticateWithBiometry: jest.fn(async () => biometryResult),
        bindLegacyBiometryKey: jest.fn(),
        disableBiometry: jest.fn(() => Promise.resolve()),
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

describe('Lockscreen biometrics', () => {
    it('stays locked and explains why when enrollment changed', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore, navigation, instance } = await renderLockscreen(
            updateSettings,
            { biometry: true, biometryResult: 'invalidated' }
        );

        expect(SettingsStore.authenticateWithBiometry).toHaveBeenCalled();
        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
        expect(navigation.pop).not.toHaveBeenCalled();
        expect(instance.state.biometryInvalidated).toBe(true);
    });

    it.each(['cancelled', 'failed'])(
        'falls back to the PIN without a message when the prompt is %s',
        async (biometryResult) => {
            const updateSettings = jest.fn(() => Promise.resolve());
            const { SettingsStore, navigation, instance } =
                await renderLockscreen(updateSettings, {
                    biometry: true,
                    biometryResult
                });

            expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
            expect(navigation.pop).not.toHaveBeenCalled();
            expect(instance.state.biometryInvalidated).toBe(false);
        }
    );

    it('does not prompt when biometrics are not configured', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore } = await renderLockscreen(updateSettings);

        expect(SettingsStore.authenticateWithBiometry).not.toHaveBeenCalled();
    });

    it('binds a legacy biometric key after a PIN login', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore, instance } = await renderLockscreen(
            updateSettings
        );
        await enterCorrectPin(instance);

        await act(async () => {
            await instance.onAttemptLogIn();
        });

        expect(SettingsStore.bindLegacyBiometryKey).toHaveBeenCalledTimes(1);
    });

    it('does not bind a biometric key after a wrong PIN', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore, instance } = await renderLockscreen(
            updateSettings
        );
        await act(async () => {
            instance.setState({ pinAttempt: '0000' });
        });
        SettingsStore.getSettings.mockResolvedValue({});

        await act(async () => {
            await instance.onAttemptLogIn();
        });

        expect(SettingsStore.bindLegacyBiometryKey).not.toHaveBeenCalled();
    });

    it.each([
        ['PIN', 'deletePin', { pin: '', duressPin: '' }],
        ['password', 'deletePassword', { passphrase: '', duressPassphrase: '' }]
    ] as const)(
        'disables biometrics before deleting the %s',
        async (_label, method, cleared) => {
            const updateSettings = jest.fn(() => Promise.resolve());
            const { SettingsStore, navigation, instance } =
                await renderLockscreen(updateSettings);

            await act(async () => {
                await instance[method]();
            });

            expect(SettingsStore.disableBiometry).toHaveBeenCalledTimes(1);
            expect(updateSettings).toHaveBeenCalledWith(
                expect.objectContaining(cleared)
            );
            expect(
                SettingsStore.disableBiometry.mock.invocationCallOrder[0]
            ).toBeLessThan(updateSettings.mock.invocationCallOrder[0]);
            expect(navigation.popTo).toHaveBeenCalledWith('Security');
        }
    );

    it('does not clear the PIN when disabling biometrics fails', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore, navigation, instance } = await renderLockscreen(
            updateSettings
        );
        SettingsStore.disableBiometry.mockRejectedValueOnce(
            new Error('write failed')
        );

        await act(async () => {
            await instance.deletePin();
        });

        expect(updateSettings).not.toHaveBeenCalled();
        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(instance.state.deleteFailed).toBe(true);
    });
});

// A failed settings write while deleting a credential must not escape
// onAttemptLogIn as an unhandled rejection. The credential stays in place,
// the user stays on the Lockscreen and is told to try again.
describe('Lockscreen credential deletion failure', () => {
    it.each([
        'deletePin',
        'deletePassword',
        'deleteDuressPin',
        'deleteDuressPassword'
    ] as const)('shows a message and stays when %s fails', async (flag) => {
        const updateSettings = jest.fn(() =>
            Promise.reject(new Error('write failed'))
        );
        const { navigation, instance } = await renderLockscreen(updateSettings);
        await act(async () => {
            instance.setState({ [flag]: true } as any);
        });
        await enterCorrectPin(instance);

        await act(async () => {
            await expect(instance.onAttemptLogIn()).resolves.toBe(undefined);
        });

        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(instance.state.deleteFailed).toBe(true);
        expect(errorSpy).toHaveBeenCalled();
    });

    it('clears the message on the next attempt', async () => {
        const updateSettings = jest
            .fn()
            .mockRejectedValueOnce(new Error('write failed'))
            .mockResolvedValue(undefined);
        const { navigation, instance } = await renderLockscreen(updateSettings);
        await act(async () => {
            instance.setState({ deletePin: true });
        });
        await enterCorrectPin(instance);

        await act(async () => {
            await instance.onAttemptLogIn();
        });
        expect(instance.state.deleteFailed).toBe(true);

        await enterCorrectPin(instance);
        await act(async () => {
            await instance.onAttemptLogIn();
        });

        expect(instance.state.deleteFailed).toBe(false);
        expect(navigation.popTo).toHaveBeenCalledWith('Security');
    });
});
