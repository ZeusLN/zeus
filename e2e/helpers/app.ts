import { execFileSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { device } from 'detox';

const IOS_BUNDLE_ID = 'com.zeusln.zeus';

// Granted before launch so system prompts never cover the screen under test:
// push notification registration on start, and the one-time Face ID
// permission before the app's first biometric prompt.
const IOS_PERMISSIONS = { notifications: 'YES', faceid: 'YES' } as const;

// iOS asks before an app reads text that another app put on the pasteboard,
// and the read blocks the app until the prompt is answered. The simulator
// syncs the Mac's clipboard in, and ZEUS reads the clipboard by default (for
// example to offer importing a copied connection string), so the suite sets
// "Paste from Other Apps" to Allow, as the toggle in Settings would. simctl
// and Detox have no option for this permission, so it is written to the
// simulator's privacy database. The simulator's privacy daemon can hold the
// database briefly after an install, so the write waits for its lock.
const TCC_LOCK_TIMEOUT_MS = 10000;

const allowIosPaste = (): void => {
    const tccDb = join(
        homedir(),
        'Library/Developer/CoreSimulator/Devices',
        device.id,
        'data/Library/TCC/TCC.db'
    );
    execFileSync('sqlite3', [
        '-cmd',
        `.timeout ${TCC_LOCK_TIMEOUT_MS}`,
        tccDb,
        'INSERT OR REPLACE INTO access ' +
            '(service, client, client_type, auth_value, auth_reason, auth_version, flags) ' +
            `VALUES ('kTCCServicePasteboard', '${IOS_BUNDLE_ID}', 0, 2, 2, 1, 0);`
    ]);
};

// Starts the app as a first-time user. Zeus keeps its settings in the keychain,
// which survives an app uninstall on the iOS simulator, so iOS also needs its
// keychain reset. Android drops the app's keystore entries with the app, and
// Detox installs it with every runtime permission granted.
// Every spec starts synchronized, even after one that left synchronization
// off for a busy node.
const SYNCHRONIZED = { detoxEnableSynchronization: 1 };

export const launchFreshApp = async (): Promise<void> => {
    if (device.getPlatform() === 'ios') {
        await device.terminateApp();
        await device.uninstallApp();
        await device.installApp();
        execFileSync('xcrun', ['simctl', 'keychain', device.id, 'reset']);
        allowIosPaste();
        await device.launchApp({
            newInstance: true,
            permissions: IOS_PERMISSIONS,
            launchArgs: SYNCHRONIZED
        });
        return;
    }
    await device.launchApp({
        delete: true,
        newInstance: true,
        launchArgs: SYNCHRONIZED
    });
};

export const relaunchApp = async (): Promise<void> => {
    await device.launchApp({ newInstance: true });
};

// Restarts the app without waiting for it to go idle, for a start that never
// does: with Face ID on, the app opens on the system's Face ID prompt.
// Synchronization stays off until the caller turns it back on.
export const relaunchAppUnsynchronized = async (): Promise<void> => {
    await device.launchApp({
        newInstance: true,
        launchArgs: { detoxEnableSynchronization: 0 }
    });
};

// The Face ID prompt is system UI, which Detox can't see or wait for. It
// slides in after the app asks for it, and a face matched before then is
// lost, so this waits for the prompt to settle first.
const BIOMETRIC_PROMPT_DELAY_MS = 2000;

// Detox's setBiometricEnrollment() and matchFace() run applesimutils with
// --booted, which acts on whichever simulator is booted, not necessarily the
// one under test. These target the test simulator by its id.
const appleSimUtils = (...args: string[]): void => {
    execFileSync('applesimutils', ['--byId', device.id, ...args]);
};

export const setFaceIdEnrollment = (enrolled: boolean): void => {
    appleSimUtils('--biometricEnrollment', enrolled ? 'YES' : 'NO');
};

const waitForBiometricPrompt = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, BIOMETRIC_PROMPT_DELAY_MS));

export const matchFaceWhenPrompted = async (): Promise<void> => {
    await waitForBiometricPrompt();
    appleSimUtils('--biometricMatch');
};
