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
jest.mock('../components/Button', () => {
    const { Pressable, Text } = require('react-native');
    return ({ title, onPress }: any) => (
        <Pressable role="button" onPress={onPress}>
            <Text>{title}</Text>
        </Pressable>
    );
});
// Each header shows which Back it wires up
jest.mock('../components/Header', () => {
    const { Text } = require('react-native');
    return ({ onBack }: any) => (
        <Text testID="header">{onBack ? 'dismiss' : 'back'}</Text>
    );
});
jest.mock('../components/LoadingIndicator', () => () => null);
// Stands in for the keypad: one press submits mockPinEntry (the stored PIN
// unless a test changes it), the other a wrong one
let mockPinEntry = '1234';
jest.mock('../components/Pin', () => {
    const { Pressable, Text } = require('react-native');
    return ({ onSubmit }: any) => (
        <>
            <Pressable role="button" onPress={() => onSubmit(mockPinEntry)}>
                <Text>Submit PIN</Text>
            </Pressable>
            <Pressable role="button" onPress={() => onSubmit('0000')}>
                <Text>Submit wrong PIN</Text>
            </Pressable>
        </>
    );
});
jest.mock('../components/ShowHideToggle', () => () => null);
jest.mock('../components/TextInput', () => {
    const { TextInput } = require('react-native');
    return (props: any) => <TextInput {...props} />;
});
jest.mock('../components/SuccessErrorMessage', () => {
    const { Text } = require('react-native');
    return {
        ErrorMessage: ({ message }: any) => <Text>{message}</Text>
    };
});
jest.mock('../stores/SettingsStore', () => ({
    PosEnabled: {
        Disabled: 'disabled',
        Square: 'square',
        Standalone: 'standalone'
    }
}));
// ShareIntentProcessor imports the store graph, which loads native modules
jest.mock('../stores/Stores');
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

import {
    clearAllData,
    isWipePending,
    markWipePending
} from '../utils/DataClearUtils';
import { restartApp } from '../utils/RestartUtils';
import Lockscreen from './Lockscreen';

const PIN = '1234';
const PASSWORD = 'correct horse';

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
        biometryResult = 'success',
        params = {},
        settings = { pin: PIN }
    }: {
        biometry?: boolean;
        posStatus?: string;
        biometryResult?: string;
        params?: any;
        settings?: any;
    } = {}
) => {
    const SettingsStore = {
        settings,
        posStatus,
        triggerSettingsRefresh: false,
        isBiometryConfigured: jest.fn(() => biometry),
        authenticateWithBiometry: jest.fn(async () => biometryResult),
        bindLegacyBiometryKey: jest.fn(),
        disableBiometry: jest.fn(() => Promise.resolve()),
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
            route={{ params } as any}
        />
    );
    return { SettingsStore, navigation, unmount };
};

const submitPin = () =>
    fireEvent.press(screen.getByRole('button', { name: 'Submit PIN' }));
const submitWrongPin = () =>
    fireEvent.press(screen.getByRole('button', { name: 'Submit wrong PIN' }));

const submitPassword = async (buttonTitle: string) => {
    await fireEvent.changeText(
        screen.getByPlaceholderText('****************'),
        PASSWORD
    );
    await fireEvent.press(screen.getByRole('button', { name: buttonTitle }));
};

let errorSpy: jest.SpyInstance;

beforeEach(() => {
    jest.clearAllMocks();
    mockPinEntry = PIN;
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

describe('Lockscreen biometrics', () => {
    it('stays locked and explains why when enrollment changed', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore, navigation } = await renderLockscreen(
            updateSettings,
            { biometry: true, biometryResult: 'invalidated' }
        );

        expect(SettingsStore.authenticateWithBiometry).toHaveBeenCalled();
        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
        expect(navigation.pop).not.toHaveBeenCalled();
        expect(
            screen.getByText('views.Lockscreen.biometricsChanged')
        ).toBeOnTheScreen();
    });

    it.each(['cancelled', 'failed'])(
        'falls back to the PIN without a message when the prompt is %s',
        async (biometryResult) => {
            const updateSettings = jest.fn(() => Promise.resolve());
            const { SettingsStore, navigation } = await renderLockscreen(
                updateSettings,
                { biometry: true, biometryResult }
            );

            expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
            expect(navigation.pop).not.toHaveBeenCalled();
            expect(
                screen.queryByText('views.Lockscreen.biometricsChanged')
            ).not.toBeOnTheScreen();
            expect(
                screen.getByRole('button', { name: 'Submit PIN' })
            ).toBeOnTheScreen();
        }
    );

    it('does not prompt when biometrics are not configured', async () => {
        const updateSettings = jest.fn(() => Promise.resolve());
        const { SettingsStore } = await renderLockscreen(updateSettings);

        expect(SettingsStore.authenticateWithBiometry).not.toHaveBeenCalled();
    });

    it('binds a legacy biometric key after a PIN login', async () => {
        const updateSettings = makeUpdateSettings({ pin: PIN });
        const { SettingsStore } = await renderLockscreen(updateSettings);
        await submitPin();

        expect(SettingsStore.bindLegacyBiometryKey).toHaveBeenCalledTimes(1);
    });

    it('does not bind a biometric key after a wrong PIN', async () => {
        const updateSettings = makeUpdateSettings({ pin: PIN });
        const { SettingsStore, navigation } = await renderLockscreen(
            updateSettings
        );
        mockPinEntry = '0000';
        await submitPin();

        expect(SettingsStore.bindLegacyBiometryKey).not.toHaveBeenCalled();
        expect(navigation.pop).not.toHaveBeenCalled();
    });

    it.each([
        [
            'PIN',
            { pin: PIN },
            { deletePin: true },
            () => submitPin(),
            { pin: '', duressPin: '' }
        ],
        [
            'password',
            { passphrase: PASSWORD },
            { deletePassword: true },
            () => submitPassword('views.Settings.SetPassword.deletePassword'),
            { passphrase: '', duressPassphrase: '' }
        ]
    ] as const)(
        'disables biometrics before deleting the %s',
        async (_label, settings, params, submit, cleared) => {
            const updateSettings = makeUpdateSettings({ ...settings });
            const { SettingsStore, navigation } = await renderLockscreen(
                updateSettings,
                { settings, params }
            );
            await submit();

            expect(SettingsStore.disableBiometry).toHaveBeenCalledTimes(1);
            const clearIndex = updateSettings.mock.calls.findIndex(
                ([update]: any) =>
                    Object.keys(cleared).every((key) => key in update)
            );
            expect(clearIndex).toBeGreaterThan(-1);
            expect(updateSettings.mock.calls[clearIndex][0]).toEqual(
                expect.objectContaining(cleared)
            );
            expect(
                SettingsStore.disableBiometry.mock.invocationCallOrder[0]
            ).toBeLessThan(updateSettings.mock.invocationCallOrder[clearIndex]);
            expect(navigation.popTo).toHaveBeenCalledWith('Security');
        }
    );

    it('does not clear the PIN when disabling biometrics fails', async () => {
        const updateSettings = makeUpdateSettings({ pin: PIN });
        const { SettingsStore, navigation } = await renderLockscreen(
            updateSettings,
            { params: { deletePin: true } }
        );
        SettingsStore.disableBiometry.mockRejectedValueOnce(
            new Error('write failed')
        );
        await submitPin();

        expect(updateSettings).not.toHaveBeenCalledWith(
            expect.objectContaining({ pin: '' })
        );
        expect(navigation.popTo).not.toHaveBeenCalled();
        expect(
            screen.getByText('views.Settings.Security.deleteFailed')
        ).toBeOnTheScreen();
    });
});

// The attempt count is saved before the entry is checked, so only the write
// that clears a credential fails here
const isCredentialWrite = (patch: any) =>
    Object.keys(patch).some((key) => key !== 'authenticationAttempts');

// A failed settings write while deleting a credential must not escape
// onAttemptLogIn as an unhandled rejection. The credential stays in place,
// the user stays on the Lockscreen and is told to try again.
describe('Lockscreen credential deletion failure', () => {
    it.each([
        ['deletePin', { pin: PIN }, () => submitPin()],
        ['deleteDuressPin', { pin: PIN }, () => submitPin()],
        [
            'deletePassword',
            { passphrase: PASSWORD },
            () => submitPassword('views.Settings.SetPassword.deletePassword')
        ],
        [
            'deleteDuressPassword',
            { passphrase: PASSWORD },
            () =>
                submitPassword(
                    'views.Settings.SetDuressPassword.deletePassword'
                )
        ]
    ] as const)(
        'shows a message and stays when %s fails',
        async (flag, settings, submit) => {
            const updateSettings = makeUpdateSettings(
                { ...settings },
                async (patch) => {
                    if (isCredentialWrite(patch)) {
                        throw new Error('write failed');
                    }
                }
            );
            const { navigation } = await renderLockscreen(updateSettings, {
                settings,
                params: { [flag]: true }
            });
            await submit();

            expect(navigation.popTo).not.toHaveBeenCalled();
            expect(
                screen.getByText('views.Settings.Security.deleteFailed')
            ).toBeOnTheScreen();
            expect(errorSpy).toHaveBeenCalled();
        }
    );

    it('clears the message on the next attempt', async () => {
        let failWrite = true;
        const updateSettings = makeUpdateSettings(
            { pin: PIN },
            async (patch) => {
                if (isCredentialWrite(patch) && failWrite) {
                    failWrite = false;
                    throw new Error('write failed');
                }
            }
        );
        const { navigation } = await renderLockscreen(updateSettings, {
            params: { deletePin: true }
        });
        await submitPin();
        expect(
            screen.getByText('views.Settings.Security.deleteFailed')
        ).toBeOnTheScreen();

        await submitPin();

        expect(
            screen.queryByText('views.Settings.Security.deleteFailed')
        ).not.toBeOnTheScreen();
        expect(navigation.popTo).toHaveBeenCalledWith('Security');
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

    it('runs the duress wipe while attempts cannot be saved', async () => {
        const saved: any = { pin: PIN, duressPin: '0000' };
        const updateSettings = makeUpdateSettings(saved, async () => {
            throw new Error('no space left on device');
        });
        const { SettingsStore } = await renderLockscreen(updateSettings, {
            settings: saved
        });

        await submitWrongPin();

        expect(updateSettings).not.toHaveBeenCalled();
        expect(markWipePending).toHaveBeenCalledTimes(1);
        expect(clearAllData).toHaveBeenCalledTimes(1);
        expect(restartApp).toHaveBeenCalledTimes(1);
        expect(SettingsStore.setLoginStatus).not.toHaveBeenCalled();
    });

    it('treats the duress PIN as a wrong entry in a security flow while attempts cannot be saved', async () => {
        const saved: any = { pin: PIN, duressPin: '0000' };
        const updateSettings = makeUpdateSettings(saved, async () => {
            throw new Error('no space left on device');
        });
        await renderLockscreen(updateSettings, {
            settings: saved,
            params: { deletePin: true }
        });

        await submitWrongPin();

        expect(updateSettings).toHaveBeenCalledTimes(1);
        expect(markWipePending).not.toHaveBeenCalled();
        expect(clearAllData).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to save authentication attempt',
            expect.any(Error)
        );
    });

    it.each([
        ['the fifth wrong entry', { pin: PIN, authenticationAttempts: 4 }],
        ['the duress PIN', { pin: PIN, duressPin: '0000' }]
    ])(
        'starts one wipe when an entry arrives while the pending wipe for %s is saved',
        async (_case, settings) => {
            const saved: any = { ...settings };
            const record = deferred();
            (markWipePending as jest.Mock).mockReturnValue(record.promise);
            const updateSettings = makeUpdateSettings(saved);
            await renderLockscreen(updateSettings, { settings: saved });

            await submitWrongPin();
            const writes = updateSettings.mock.calls.length;
            await submitWrongPin();
            await act(async () => record.resolve());

            expect(updateSettings).toHaveBeenCalledTimes(writes);
            expect(markWipePending).toHaveBeenCalledTimes(1);
            expect(clearAllData).toHaveBeenCalledTimes(1);
        }
    );

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
        const { SettingsStore } = await renderLockscreen(
            makeUpdateSettings(saved),
            { biometry: true, settings: saved }
        );

        expect(clearAllData).not.toHaveBeenCalled();
        expect(SettingsStore.authenticateWithBiometry).toHaveBeenCalledTimes(1);
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
        expect(SettingsStore.authenticateWithBiometry).not.toHaveBeenCalled();
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
