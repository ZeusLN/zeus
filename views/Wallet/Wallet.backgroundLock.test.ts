// Runs the production Wallet.handleAppStateChange with the real
// BackgroundLockUtils: with "Require login after app returns from
// background" on, coming back from a system dialog must show the Lockscreen
// whenever the session is locked.
import { AppState, Platform } from 'react-native';

import {
    BACKGROUND_LOCK_SUPPRESSION_MAX_MS,
    shouldSkipBackgroundLock,
    skippedBackgroundLockIsOverdue,
    suppressBackgroundLockDuring
} from '../../utils/BackgroundLockUtils';
import { sourceMethods } from '../../backends/lncTestUtils';

jest.mock('react-native', () => {
    const listeners: Array<(status: string) => void> = [];
    const AppState: any = {
        currentState: 'active',
        addEventListener: (
            _type: string,
            handler: (status: string) => void
        ) => {
            listeners.push(handler);
            return {
                remove: () => {
                    const idx = listeners.indexOf(handler);
                    if (idx !== -1) listeners.splice(idx, 1);
                }
            };
        },
        emit: (status: string) => {
            AppState.currentState = status;
            [...listeners].forEach((handler) => handler(status));
        }
    };
    return { AppState, Platform: { OS: 'android' } };
});

const setup = () => {
    let loggedIn = true;
    const SettingsStore = {
        settings: { loginBackground: true },
        loginMethodConfigured: () => true,
        setLoginStatus: jest.fn((status: boolean) => (loggedIn = status)),
        loginRequired: () => !loggedIn
    };
    const Wallet = sourceMethods(
        'views/Wallet/Wallet.tsx',
        'Wallet',
        ['handleAppStateChange'],
        {
            BackendUtils: { supportsNostrWalletConnectService: () => false },
            shouldSkipBackgroundLock,
            skippedBackgroundLockIsOverdue
        }
    );
    const wallet = new Wallet();
    const navigation = {
        navigate: jest.fn(),
        isFocused: jest.fn(() => false)
    };
    wallet.props = {
        SettingsStore,
        NostrWalletConnectStore: { reset: jest.fn() },
        navigation
    };
    wallet.refreshRunner = { running: false, run: jest.fn() };
    const unsubscribe = (AppState as any).addEventListener(
        'change',
        wallet.handleAppStateChange
    );
    return { SettingsStore, navigation, unsubscribe };
};

// An export: the save dialog, then work that only finishes once the app is
// back in front (copying the file, removing staged files).
const exportWithDialogOpenFor = async (dialogUpForMs: number) => {
    jest.useFakeTimers();
    const { SettingsStore, navigation, unsubscribe } = setup();
    let finishExport!: () => void;
    const flow = suppressBackgroundLockDuring(
        SettingsStore as any,
        () => new Promise<void>((resolve) => (finishExport = resolve))
    );

    (AppState as any).emit('background');
    jest.advanceTimersByTime(dialogUpForMs);
    (AppState as any).emit('active');
    finishExport();
    await flow;
    unsubscribe.remove();

    return { SettingsStore, navigation };
};

describe('Wallet background lock around a system dialog', () => {
    afterEach(() => {
        (AppState as any).currentState = 'active';
        Platform.OS = 'android';
        jest.useRealTimers();
    });

    it('shows the Lockscreen on return from a dialog left open past the ceiling', async () => {
        const { SettingsStore, navigation } = await exportWithDialogOpenFor(
            BACKGROUND_LOCK_SUPPRESSION_MAX_MS + 1
        );

        expect(SettingsStore.loginRequired()).toBe(true);
        expect(navigation.navigate).toHaveBeenCalledWith('Lockscreen');
    });

    it('stays unlocked on return from a dialog closed within the ceiling', async () => {
        const { SettingsStore, navigation } = await exportWithDialogOpenFor(
            5 * 1000
        );

        expect(SettingsStore.loginRequired()).toBe(false);
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('locks on iOS when the app is left while a dialog is up', async () => {
        Platform.OS = 'ios';

        const { SettingsStore, navigation } = await exportWithDialogOpenFor(
            5 * 1000
        );

        expect(SettingsStore.loginRequired()).toBe(true);
        expect(navigation.navigate).toHaveBeenCalledWith('Lockscreen');
    });
});
