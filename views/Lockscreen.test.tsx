import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

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
// Each header shows which Back it wires up
jest.mock('../components/Header', () => {
    const { Text } = require('react-native');
    return ({ onBack }: any) => (
        <Text testID="header">{onBack ? 'dismiss' : 'back'}</Text>
    );
});
jest.mock('../components/LoadingIndicator', () => () => null);
// Stands in for the keypad: one press submits the stored PIN, the other a
// wrong one
jest.mock('../components/Pin', () => {
    const { Pressable, Text } = require('react-native');
    return ({ onSubmit }: any) => (
        <>
            <Pressable role="button" onPress={() => onSubmit('1234')}>
                <Text>Submit PIN</Text>
            </Pressable>
            <Pressable role="button" onPress={() => onSubmit('0000')}>
                <Text>Submit wrong PIN</Text>
            </Pressable>
        </>
    );
});
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
jest.mock('../stores/Stores');
jest.mock('../utils/BiometricUtils', () => ({
    verifyBiometry: jest.fn()
}));
jest.mock('../utils/DataClearUtils', () => ({
    blockNavigationDuringWipe: jest.fn(),
    clearAllData: jest.fn(),
    isWipePending: jest.fn()
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/RestartUtils', () => ({
    restartApp: jest.fn()
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));

import { verifyBiometry } from '../utils/BiometricUtils';
import { clearAllData, isWipePending } from '../utils/DataClearUtils';
import { restartApp } from '../utils/RestartUtils';
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

// Stands in for SettingsStore.updateSettings: resolves a function patch
// against the saved settings, passes the result to `write` (which may delay
// or reject it), then saves it and resolves with the saved settings
const makeUpdateSettings = (
    saved: any,
    write: (patch: any) => Promise<void> = async () => {}
) =>
    jest.fn(async (patch: any) => {
        const resolved = typeof patch === 'function' ? patch(saved) : patch;
        await write(resolved);
        Object.assign(saved, resolved);
        return { ...saved };
    });

const isReset = (patch: any) => patch.authenticationAttempts === 0;

const renderLockscreen = async (
    updateSettings: jest.Mock,
    {
        biometry = false,
        posStatus = 'inactive',
        params = {},
        settings = { pin: PIN }
    }: {
        biometry?: boolean;
        posStatus?: string;
        params?: any;
        settings?: any;
    } = {}
) => {
    const SettingsStore = {
        settings,
        posStatus,
        triggerSettingsRefresh: false,
        isBiometryConfigured: jest.fn(() => biometry),
        isPosEnabled: jest.fn(() => false),
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
    await render(
        <Lockscreen
            SettingsStore={SettingsStore as any}
            navigation={navigation as any}
            route={{ params } as any}
        />
    );
    return { SettingsStore, navigation };
};

const submitPin = () =>
    fireEvent.press(screen.getByRole('button', { name: 'Submit PIN' }));
const submitWrongPin = () =>
    fireEvent.press(screen.getByRole('button', { name: 'Submit wrong PIN' }));

let errorSpy: jest.SpyInstance;

beforeEach(() => {
    jest.clearAllMocks();
    (isWipePending as jest.Mock).mockResolvedValue(false);
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
        const updateSettings = makeUpdateSettings({ pin: PIN }, (patch) =>
            isReset(patch) ? reset.promise : Promise.resolve()
        );
        const { navigation } = await renderLockscreen(updateSettings);
        await submitPin();

        expect(updateSettings).toHaveBeenCalledWith({
            authenticationAttempts: 0
        });
        expect(navigation.pop).not.toHaveBeenCalled();

        await act(async () => reset.resolve());

        expect(navigation.pop).toHaveBeenCalledTimes(1);
    });

    it('still unlocks when the attempt reset fails', async () => {
        const error = new Error('keychain unavailable');
        const updateSettings = makeUpdateSettings({ pin: PIN }, (patch) =>
            isReset(patch) ? Promise.reject(error) : Promise.resolve()
        );
        const { SettingsStore, navigation } = await renderLockscreen(
            updateSettings
        );
        await submitPin();

        expect(SettingsStore.setLoginStatus).toHaveBeenCalledWith(true);
        expect(navigation.pop).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to reset authentication attempts',
            error
        );
    });

    it('navigates once when a second submit arrives while the reset is pending', async () => {
        const reset = deferred();
        const updateSettings = makeUpdateSettings({ pin: PIN }, (patch) =>
            isReset(patch) ? reset.promise : Promise.resolve()
        );
        const { navigation } = await renderLockscreen(updateSettings);
        await submitPin();
        await submitPin();
        await act(async () => reset.resolve());

        // the first entry's attempt and its reset; the second entry is
        // dropped
        expect(updateSettings).toHaveBeenCalledTimes(2);
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

describe('Lockscreen header', () => {
    const headers = () =>
        screen.queryAllByTestId('header').map((h) => h.props.children);

    it('shows one Back that dismisses a POS share intent that also has a pending screen', async () => {
        await renderLockscreen(jest.fn(), {
            posStatus: 'active',
            params: {
                shareIntentData: { qrData: 'lnbc1' },
                pendingNavigation: { screen: 'LSPS1' }
            }
        });

        expect(headers()).toEqual(['dismiss']);
    });

    it('shows the regular Back for a pending screen', async () => {
        await renderLockscreen(jest.fn(), {
            params: { pendingNavigation: { screen: 'Menu' } }
        });

        expect(headers()).toEqual(['back']);
    });

    it('shows no Back on a plain unlock', async () => {
        await renderLockscreen(jest.fn());

        expect(headers()).toEqual([]);
    });
});

// Each entry is counted in storage before it is checked, so the wipe after
// five wrong entries cannot be avoided by a failed write or by closing the
// app before the count is saved.
describe('Lockscreen failed attempts', () => {
    it('saves the fifth wrong attempt before starting the wipe', async () => {
        const saved: any = { pin: PIN };
        const updateSettings = makeUpdateSettings(saved, async () => {
            // the wipe must not have started before the write lands
            expect(clearAllData).not.toHaveBeenCalled();
        });
        await renderLockscreen(updateSettings, { settings: saved });

        for (let i = 1; i <= 4; i++) {
            await submitWrongPin();
            expect(saved.authenticationAttempts).toBe(i);
        }
        expect(clearAllData).not.toHaveBeenCalled();

        await submitWrongPin();

        expect(saved.authenticationAttempts).toBe(5);
        expect(clearAllData).toHaveBeenCalledTimes(1);
        expect(restartApp).toHaveBeenCalledTimes(1);
    });

    it('does not check entries while attempts cannot be saved', async () => {
        const saved: any = { pin: PIN };
        const updateSettings = makeUpdateSettings(saved, async (patch) => {
            if (!isReset(patch)) throw new Error('no space left on device');
        });
        const { SettingsStore, navigation } = await renderLockscreen(
            updateSettings,
            { settings: saved }
        );

        for (let i = 0; i < 6; i++) await submitWrongPin();
        await submitPin();

        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
        expect(navigation.pop).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to save authentication attempt',
            expect.any(Error)
        );
    });

    it('drops an entry made while the previous attempt is being saved', async () => {
        const saved: any = { pin: PIN };
        const write = deferred();
        const updateSettings = makeUpdateSettings(saved, () => write.promise);
        const { SettingsStore } = await renderLockscreen(updateSettings, {
            settings: saved
        });

        await submitWrongPin();
        // dropped: not checked, so it cannot unlock without being counted
        await submitPin();
        await act(async () => write.resolve());

        expect(updateSettings).toHaveBeenCalledTimes(1);
        expect(saved.authenticationAttempts).toBe(1);
        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
    });

    it('wipes on launch when the saved attempts reached the limit', async () => {
        const saved: any = { pin: PIN, authenticationAttempts: 5 };
        const updateSettings = makeUpdateSettings(saved);
        const { SettingsStore, navigation } = await renderLockscreen(
            updateSettings,
            { biometry: true, settings: saved }
        );

        expect(clearAllData).toHaveBeenCalledTimes(1);
        expect(restartApp).toHaveBeenCalledTimes(1);
        expect(verifyBiometry).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Submit PIN' })).toBeNull();
        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
        expect(navigation.pop).not.toHaveBeenCalled();
    });
});

// A wipe cut short by the end of the process (app killed, crash) is
// finished on the next launch before a credential can be entered
describe('Lockscreen with a wipe that did not finish', () => {
    it('finishes the wipe and restarts instead of asking for a credential', async () => {
        (isWipePending as jest.Mock).mockResolvedValue(true);
        const updateSettings = makeUpdateSettings({ pin: PIN });
        const { SettingsStore } = await renderLockscreen(updateSettings, {
            biometry: true
        });

        expect(clearAllData).toHaveBeenCalledTimes(1);
        expect(restartApp).toHaveBeenCalledTimes(1);
        expect(verifyBiometry).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Submit PIN' })).toBeNull();
        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
    });

    it('finishes the wipe before the POS waiver applies', async () => {
        (isWipePending as jest.Mock).mockResolvedValue(true);
        const updateSettings = makeUpdateSettings({ pin: PIN });
        const SettingsStore = {
            settings: { pin: PIN },
            posStatus: 'active',
            isBiometryConfigured: jest.fn(() => false),
            isPosEnabled: jest.fn(() => true),
            loginRequired: jest.fn(() => true),
            setLoginStatus: jest.fn(),
            setPosStatus: jest.fn(),
            updateSettings
        };
        const navigation = { pop: jest.fn(), popTo: jest.fn() };
        await render(
            <Lockscreen
                SettingsStore={SettingsStore as any}
                navigation={navigation as any}
                route={{ params: {} } as any}
            />
        );

        expect(clearAllData).toHaveBeenCalledTimes(1);
        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
        expect(navigation.popTo).not.toHaveBeenCalled();
    });
});
