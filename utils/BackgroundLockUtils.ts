import { AppState } from 'react-native';

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
// - If the flow settles while the app is genuinely backgrounded (the user
//   left to another app), or the dialog was up longer than
//   BACKGROUND_LOCK_SUPPRESSION_MAX_MS, the lock is re-armed so returning
//   still requires login, matching the previous behavior.

export const BACKGROUND_LOCK_SUPPRESSION_MAX_MS = 60 * 1000;

let suppressionActive = false;
let lockWasSkipped = false;

// Called by the Wallet AppState handler on 'background'. Returns true if the
// lock should be skipped because a system dialog is being presented.
export const shouldSkipBackgroundLock = (): boolean => {
    if (!suppressionActive) return false;
    lockWasSkipped = true;
    return true;
};

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

        // Re-arm the lock if the user actually left the app (the flow
        // settled while backgrounded, e.g. a share target was opened or the
        // dialog was dismissed from the app switcher) or the dialog was up
        // long enough that skipping the lock is no longer defensible.
        const leftApp = AppState.currentState === 'background';
        if (
            skipped &&
            (leftApp || elapsed > BACKGROUND_LOCK_SUPPRESSION_MAX_MS) &&
            settingsStore.settings?.loginBackground &&
            settingsStore.loginMethodConfigured()
        ) {
            settingsStore.setLoginStatus(false);
        }
    }
};
