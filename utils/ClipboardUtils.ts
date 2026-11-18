import {
    AppState,
    NativeEventSubscription,
    NativeModules,
    Platform
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

// How long a secret (seed phrase, channel backup) stays on the clipboard
export const SENSITIVE_CLIPBOARD_CLEAR_MS = 60000;

let pendingTimer: ReturnType<typeof setTimeout> | undefined;
let pendingResume: NativeEventSubscription | undefined;
let latestCopy = 0;

const cancelPending = () => {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = undefined;
    pendingResume?.remove();
    pendingResume = undefined;
};

// Clears the clipboard if it still holds value and no newer secret was copied
// while the read was in progress: the read can return the older value after a
// newer copy has replaced it, and that copy has its own timer.
// Returns true when Android refused the read because ZEUS did not have window
// focus. Android then returns an empty string instead of failing.
const clearIfUnchanged = async (
    value: string,
    copy: number
): Promise<boolean> => {
    try {
        const current = await Clipboard.getString();
        if (current === value && copy === latestCopy) Clipboard.setString('');
        return current === '' && Platform.OS === 'android';
    } catch (e) {
        // reading the clipboard failed; leave it as it is
        return false;
    }
};

// Android 10+ only lets the app with window focus read the clipboard, and
// AppState turns 'active' before the window gets focus, so Android waits for
// the 'focus' event instead
const waitForResume = (value: string, copy: number) => {
    pendingResume =
        Platform.OS === 'android'
            ? AppState.addEventListener('focus', () => {
                  cancelPending();
                  clearIfUnchanged(value, copy);
              })
            : AppState.addEventListener('change', (state) => {
                  if (state !== 'active') return;
                  cancelPending();
                  clearIfUnchanged(value, copy);
              });
};

// Clears value after clearAfterMs if it is still on the clipboard
const scheduleClear = (value: string, copy: number, clearAfterMs: number) => {
    pendingTimer = setTimeout(async () => {
        pendingTimer = undefined;
        if (AppState.currentState !== 'active') {
            waitForResume(value, copy);
            return;
        }
        // Android can refuse this read. The listener for the retry is added
        // before the read, so focus that returns during the read is not missed
        if (Platform.OS === 'android') waitForResume(value, copy);
        const denied = await clearIfUnchanged(value, copy);
        // The read was allowed, so no retry is needed. A newer copy has
        // removed this listener already and has its own timer
        if (!denied && copy === latestCopy) cancelPending();
    }, clearAfterMs);
};

/**
 * Copies a secret (seed phrase, channel backup) to the clipboard and removes
 * it again after clearAfterMs.
 *
 * With the SensitiveClipboard native module (android
 * SensitiveClipboardModule.kt, ios SensitiveClipboard.m):
 * - iOS writes a local-only item that expires after clearAfterMs, so it does
 *   not sync through Universal Clipboard and iOS removes it. No timer runs
 *   and the clipboard is not read back.
 * - Android marks the clip sensitive (ClipDescription.EXTRA_IS_SENSITIVE),
 *   which hides its text in the Android 13+ clipboard preview, and the timed
 *   clear below removes it.
 * If the module is missing or fails, the value is copied with
 * @react-native-clipboard/clipboard and the timed clear removes it.
 *
 * The timed clear only clears the clipboard if it still holds the same value,
 * so text the user copied in the meantime is kept. Only the most recent
 * secret copy is cleared. Android 10+ only lets the app with window focus
 * read the clipboard, so if the timer fires while ZEUS is in the background
 * the check waits until the app is active again (on Android, until it has
 * focus again). If Android refuses the read while ZEUS is active, for
 * example with the notification shade open, the check runs once more when
 * ZEUS next gets focus.
 */
export const copySensitive = (
    value: string,
    clearAfterMs: number = SENSITIVE_CLIPBOARD_CLEAR_MS
): Promise<void> => {
    cancelPending();
    const copy = ++latestCopy;

    const { SensitiveClipboard } = NativeModules;
    if (!SensitiveClipboard?.setString) {
        Clipboard.setString(value);
        scheduleClear(value, copy, clearAfterMs);
        return Promise.resolve();
    }

    // iOS removes the item itself at its expiration date
    if (Platform.OS !== 'ios') scheduleClear(value, copy, clearAfterMs);

    return new Promise<void>((resolve) =>
        resolve(SensitiveClipboard.setString(value, clearAfterMs))
    ).catch(() => {
        // A newer copy has replaced this one
        if (copy !== latestCopy) return;
        Clipboard.setString(value);
        if (Platform.OS === 'ios') scheduleClear(value, copy, clearAfterMs);
    });
};

export default { copySensitive, SENSITIVE_CLIPBOARD_CLEAR_MS };
