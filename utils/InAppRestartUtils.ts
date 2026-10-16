import { Platform } from 'react-native';
import RNRestart from 'react-native-restart';

// Passed to RNRestart by every in-app restart. The native module keeps the
// reason of the last restart until the process ends, so the next JS runtime
// can tell how it was started. A restart without a reason clears it.
export const IN_APP_RESTART = 'in-app restart';

/**
 * On iOS an in-app restart reloads JS inside the running process, and the
 * launch options (including the URL that launched the app) stay as they
 * were. True if this JS runtime is the result of such a reload, false if iOS
 * launched the app.
 */
export const startedByInAppRestart = async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') return false;
    try {
        return (await RNRestart.getReason()) != null;
    } catch (e) {
        return false;
    }
};
