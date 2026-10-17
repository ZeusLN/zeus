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
jest.mock('../components/Header', () => () => null);
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
    isWipePending: jest.fn(),
    markWipePending: jest.fn()
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/RestartUtils', () => ({
    restartApp: jest.fn()
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn(() => '#000')
}));

import { verifyBiometry } from '../utils/BiometricUtils';
import {
    clearAllData,
    isWipePending,
    markWipePending
} from '../utils/DataClearUtils';
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
        settings = { pin: PIN }
    }: { biometry?: boolean; settings?: any } = {}
) => {
    const SettingsStore = {
        settings,
        posStatus: 'inactive',
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
    const { unmount } = await render(
        <Lockscreen
            SettingsStore={SettingsStore as any}
            navigation={navigation as any}
            route={{ params: {} } as any}
        />
    );
    return { SettingsStore, navigation, unmount };
};

const submitPin = () =>
    fireEvent.press(screen.getByRole('button', { name: 'Submit PIN' }));
const submitWrongPin = () =>
    fireEvent.press(screen.getByRole('button', { name: 'Submit wrong PIN' }));

let errorSpy: jest.SpyInstance;

beforeEach(() => {
    jest.clearAllMocks();
    (isWipePending as jest.Mock).mockResolvedValue(false);
    (markWipePending as jest.Mock).mockResolvedValue(undefined);
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

    it('saves the pending wipe before the wiping screen shows', async () => {
        const saved: any = { pin: PIN, authenticationAttempts: 4 };
        const record = deferred();
        (markWipePending as jest.Mock).mockReturnValue(record.promise);
        await renderLockscreen(makeUpdateSettings(saved), { settings: saved });

        await submitWrongPin();

        expect(markWipePending).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: 'Submit PIN' })).toBeTruthy();
        expect(clearAllData).not.toHaveBeenCalled();

        await act(async () => record.resolve());

        expect(screen.queryByRole('button', { name: 'Submit PIN' })).toBeNull();
        expect(clearAllData).toHaveBeenCalledTimes(1);
    });

    it('saves the pending wipe before the wiping screen shows for the duress PIN', async () => {
        const saved: any = { pin: PIN, duressPin: '0000' };
        const record = deferred();
        (markWipePending as jest.Mock).mockReturnValue(record.promise);
        await renderLockscreen(makeUpdateSettings(saved), { settings: saved });

        await submitWrongPin();

        expect(markWipePending).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: 'Submit PIN' })).toBeTruthy();
        expect(clearAllData).not.toHaveBeenCalled();

        await act(async () => record.resolve());

        expect(screen.queryByRole('button', { name: 'Submit PIN' })).toBeNull();
        expect(clearAllData).toHaveBeenCalledTimes(1);
    });
});

// The attempt is saved before the entry is checked, and a correct entry's
// reset can fail or be cut short. A saved count at the limit therefore does
// not show that the last entry was wrong, and must not wipe by itself.
describe('Lockscreen with a saved count at the limit', () => {
    it('does not wipe on the next launch when a correct entry could not reset the count', async () => {
        const saved: any = { pin: PIN, authenticationAttempts: 4 };
        let resetFails = true;
        const updateSettings = makeUpdateSettings(saved, async (patch) => {
            if (isReset(patch) && resetFails) {
                throw new Error('keychain unavailable');
            }
        });
        const first = await renderLockscreen(updateSettings, {
            settings: saved
        });
        await submitPin();

        expect(first.navigation.pop).toHaveBeenCalledTimes(1);
        expect(saved.authenticationAttempts).toBe(5);

        // the next launch
        await first.unmount();
        resetFails = false;
        const { SettingsStore, navigation } = await renderLockscreen(
            updateSettings,
            { settings: saved }
        );

        expect(clearAllData).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Submit PIN' })).toBeTruthy();

        await submitPin();

        expect(clearAllData).not.toHaveBeenCalled();
        expect(SettingsStore.setLoginStatus).toHaveBeenCalledWith(true);
        expect(navigation.pop).toHaveBeenCalledTimes(1);
        expect(saved.authenticationAttempts).toBe(0);
    });

    it('does not wipe on launch after a correct entry ended before its reset, and still offers biometrics', async () => {
        // the app ended between saving the fifth attempt and the reset
        const saved: any = { pin: PIN, authenticationAttempts: 5 };
        (verifyBiometry as jest.Mock).mockResolvedValue(true);
        const { SettingsStore } = await renderLockscreen(
            makeUpdateSettings(saved),
            { biometry: true, settings: saved }
        );

        expect(clearAllData).not.toHaveBeenCalled();
        expect(verifyBiometry).toHaveBeenCalledTimes(1);
        expect(SettingsStore.setLoginStatus).toHaveBeenCalledWith(true);
        expect(saved.authenticationAttempts).toBe(0);
    });

    it('wipes on the next wrong entry', async () => {
        const saved: any = { pin: PIN, authenticationAttempts: 5 };
        const { SettingsStore, navigation } = await renderLockscreen(
            makeUpdateSettings(saved),
            { settings: saved }
        );

        expect(clearAllData).not.toHaveBeenCalled();

        await submitWrongPin();

        expect(saved.authenticationAttempts).toBe(6);
        expect(markWipePending).toHaveBeenCalledTimes(1);
        expect(clearAllData).toHaveBeenCalledTimes(1);
        expect(restartApp).toHaveBeenCalledTimes(1);
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
