import { AppState, NativeEventSubscription } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

// How long a secret (seed phrase, channel backup) stays on the clipboard
export const SENSITIVE_CLIPBOARD_CLEAR_MS = 60000;

let pendingTimer: ReturnType<typeof setTimeout> | undefined;
let pendingResume: NativeEventSubscription | undefined;

const cancelPending = () => {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = undefined;
    pendingResume?.remove();
    pendingResume = undefined;
};

const clearIfUnchanged = async (value: string) => {
    try {
        const current = await Clipboard.getString();
        if (current === value) Clipboard.setString('');
    } catch (e) {
        // reading the clipboard failed; leave it as it is
    }
};

/**
 * Copies a secret and clears it from the clipboard after clearAfterMs, but
 * only if the clipboard still holds the same value, so text the user copied
 * in the meantime is kept. Only the most recent secret copy is cleared.
 *
 * Android 10+ does not let a background app read the clipboard, so if the
 * timer fires while ZEUS is in the background the check waits until the app
 * is active again.
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

    pendingTimer = setTimeout(() => {
        pendingTimer = undefined;
        if (AppState.currentState === 'active') {
            clearIfUnchanged(value);
            return;
        }
        pendingResume = AppState.addEventListener('change', (state) => {
            if (state !== 'active') return;
            cancelPending();
            clearIfUnchanged(value);
        });
    }, clearAfterMs);
};

export default { copySensitive, SENSITIVE_CLIPBOARD_CLEAR_MS };
