import { AppState, AppStateStatus } from 'react-native';

import type SettingsStore from '../stores/SettingsStore';

// With loginBackground enabled, Zeus locks whenever the app backgrounds
// (views/Wallet/Wallet.tsx). On Android, system dialogs like the share sheet
// and the SAF save/open pickers run as separate activities, so presenting one
// fires a 'background' AppState event and the user lands on the lockscreen
// the moment the dialog closes, even though they never left the app. On iOS
// these dialogs are in-process ('inactive' only), so no lock fires.
//
// This module lets such flows suppress that one lock without weakening the
// lock's intent:
// - Only the lock fired while the dialog is up is skipped.
// - If the app does not foreground shortly after the flow settles (the user
//   left to another app), or the dialog was up longer than
//   BACKGROUND_LOCK_SUPPRESSION_MAX_MS, the lock is re-armed so returning
//   still requires login, matching the previous behavior.
//
// The "left the app" check must be deferred, not read off AppState at settle
// time: on Android a canceled or completed picker delivers its result via
// onActivityResult, which runs BEFORE onResume, so the flow's promise settles
// while AppState still reads 'background' even though the user is returning
// to the app. Only the absence of the imminent 'active' transition within
// BACKGROUND_LOCK_REARM_GRACE_MS means the user actually left.

export const BACKGROUND_LOCK_SUPPRESSION_MAX_MS = 60 * 1000;
export const BACKGROUND_LOCK_REARM_GRACE_MS = 2 * 1000;

let suppressionActive = false;
let lockWasSkipped = false;

// Called by the Wallet AppState handler on 'background'. Returns true if the
// lock should be skipped because a system dialog is being presented.
export const shouldSkipBackgroundLock = (): boolean => {
    if (!suppressionActive) return false;
    lockWasSkipped = true;
    return true;
};

// Resolves true if the app foregrounds within the re-arm grace window,
// false if it is still backgrounded when the window closes.
const returnsToForeground = (): Promise<boolean> =>
    new Promise((resolve) => {
        const settle = (returned: boolean) => {
            clearTimeout(timer);
            subscription.remove();
            resolve(returned);
        };
        const subscription = AppState.addEventListener(
            'change',
            (status: AppStateStatus) => {
                if (status === 'active') settle(true);
            }
        );
        const timer = setTimeout(
            () => settle(false),
            BACKGROUND_LOCK_REARM_GRACE_MS
        );
    });

// Runs a flow that presents a system dialog (share sheet, document picker,
// save dialog) with background-lock suppression, restoring normal lock
// semantics once it settles.
export const suppressBackgroundLockDuring = async <T>(
    settingsStore: SettingsStore,
    task: () => Promise<T>
): Promise<T> => {
    const startedAt = Date.now();
    suppressionActive = true;
    lockWasSkipped = false;
    try {
        return await task();
    } finally {
        const skipped = lockWasSkipped;
        const elapsed = Date.now() - startedAt;
        suppressionActive = false;
        lockWasSkipped = false;

        if (
            skipped &&
            settingsStore.settings?.loginBackground &&
            settingsStore.loginMethodConfigured()
        ) {
            // Re-arm the lock if the dialog was up long enough that skipping
            // the lock is no longer defensible, or the user actually left
            // the app (it never foregrounded after the flow settled, e.g. a
            // share target was opened or the dialog was dismissed from the
            // app switcher).
            const overdue = elapsed > BACKGROUND_LOCK_SUPPRESSION_MAX_MS;
            const leftApp = async () =>
                AppState.currentState !== 'active' &&
                !(await returnsToForeground());
            if (overdue || (await leftApp())) {
                settingsStore.setLoginStatus(false);
            }
        }
    }
};
