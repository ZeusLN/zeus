import { AppState, NativeEventSubscription, Platform } from 'react-native';
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

// Returns true when Android refused the read because ZEUS did not have window
// focus. Android then returns an empty string instead of failing.
const clearIfUnchanged = async (value: string): Promise<boolean> => {
    try {
        const current = await Clipboard.getString();
        if (current === value) Clipboard.setString('');
        return current === '' && Platform.OS === 'android';
    } catch (e) {
        // reading the clipboard failed; leave it as it is
        return false;
    }
};

// Android 10+ only lets the app with window focus read the clipboard, and
// AppState turns 'active' before the window gets focus, so Android waits for
// the 'focus' event instead
const waitForResume = (value: string) => {
    pendingResume =
        Platform.OS === 'android'
            ? AppState.addEventListener('focus', () => {
                  cancelPending();
                  clearIfUnchanged(value);
              })
            : AppState.addEventListener('change', (state) => {
                  if (state !== 'active') return;
                  cancelPending();
                  clearIfUnchanged(value);
              });
};

/**
 * Copies a secret and clears it from the clipboard after clearAfterMs, but
 * only if the clipboard still holds the same value, so text the user copied
 * in the meantime is kept. Only the most recent secret copy is cleared.
 *
 * Android 10+ only lets the app with window focus read the clipboard, so if
 * the timer fires while ZEUS is in the background the check waits until the
 * app is active again (on Android, until it has focus again). If Android
 * refuses the read while ZEUS is active, for example with the notification
 * shade open, the check runs once more when ZEUS next gets focus.
 *
 * @react-native-clipboard/clipboard 1.16.3 cannot mark a clip as sensitive
 * (Android ClipDescription.EXTRA_IS_SENSITIVE) or local-only with an expiry
 * (iOS UIPasteboard options), so the timed clear is all this can do from JS.
 */
export const copySensitive = (
    value: string,
    clearAfterMs: number = SENSITIVE_CLIPBOARD_CLEAR_MS
) => {
    cancelPending();
    Clipboard.setString(value);

    const copy = ++latestCopy;

    pendingTimer = setTimeout(async () => {
        pendingTimer = undefined;
        if (AppState.currentState !== 'active') {
            waitForResume(value);
            return;
        }
        const denied = await clearIfUnchanged(value);
        // a newer copy has its own timer
        if (denied && copy === latestCopy) waitForResume(value);
    }, clearAfterMs);
};

export default { copySensitive, SENSITIVE_CLIPBOARD_CLEAR_MS };
