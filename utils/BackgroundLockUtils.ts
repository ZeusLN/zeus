import { AppState, AppStateStatus, Platform } from 'react-native';

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
//
// A lock re-armed here only shows the Lockscreen on the next 'active' event
// (views/Wallet/Wallet.tsx), so it must not be re-armed after that event.
// Only a canceled picker is sure to settle before it: a flow that does more
// after its dialog (copying the saved file, removing staged files) settles
// once the app is back in front. For those the Wallet handler applies the
// ceiling itself, through skippedBackgroundLockIsOverdue.
//
// On iOS these dialogs never fire 'background', so one that arrives while a
// dialog is up means the user left the app or locked the phone, and the lock
// is never skipped there.

export const BACKGROUND_LOCK_SUPPRESSION_MAX_MS = 60 * 1000;
export const BACKGROUND_LOCK_REARM_GRACE_MS = 2 * 1000;

let suppressionActive = false;
let lockWasSkipped = false;
let startedAt = 0;
let startedAtMonotonic = 0;

// performance.now() cannot be set but stops while the phone sleeps, so check
// both clocks, and treat a wall clock that shows less time than the
// monotonic one as set back.
const suppressionOverdue = (): boolean => {
    const elapsed = Date.now() - startedAt;
    const elapsedMonotonic = global.performance.now() - startedAtMonotonic;
    return (
        elapsed > BACKGROUND_LOCK_SUPPRESSION_MAX_MS ||
        elapsedMonotonic > BACKGROUND_LOCK_SUPPRESSION_MAX_MS ||
        elapsed < elapsedMonotonic - 1000
    );
};

// Called by the Wallet AppState handler on 'background'. Returns true if the
// lock should be skipped because a system dialog is being presented.
export const shouldSkipBackgroundLock = (): boolean => {
    if (!suppressionActive || Platform.OS !== 'android') return false;
    lockWasSkipped = true;
    return true;
};

// Called by the Wallet AppState handler on 'active', before it decides
// whether to show the Lockscreen. Returns true if the lock was skipped for a
// dialog that has been up longer than the ceiling and whose flow has not
// settled yet.
export const skippedBackgroundLockIsOverdue = (): boolean =>
    suppressionActive && lockWasSkipped && suppressionOverdue();

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
    startedAt = Date.now();
    startedAtMonotonic = global.performance.now();
    suppressionActive = true;
    lockWasSkipped = false;
    try {
        return await task();
    } finally {
        const skipped = lockWasSkipped;
        const overdue = suppressionOverdue();
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
            //
            // Not once the app is back in front: the Wallet handler has
            // applied the ceiling by then, and a lock set now would leave
            // the session locked with no Lockscreen in front of it.
            if (
                AppState.currentState !== 'active' &&
                (overdue || !(await returnsToForeground()))
            ) {
                settingsStore.setLoginStatus(false);
            }
        }
    }
};
