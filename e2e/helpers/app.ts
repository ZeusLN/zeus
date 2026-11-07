import { execFileSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { device } from 'detox';

const IOS_BUNDLE_ID = 'com.zeusln.zeus';

// Granted before launch so the system prompt that the app triggers on start
// (push notification registration) never covers the screen under test.
const IOS_PERMISSIONS = { notifications: 'YES' } as const;

// iOS asks before an app reads text that another app put on the pasteboard,
// and the read blocks the app until the prompt is answered. The simulator
// syncs the Mac's clipboard in, and ZEUS reads the clipboard by default (for
// example to offer importing a copied connection string), so the suite sets
// "Paste from Other Apps" to Allow, as the toggle in Settings would. simctl
// and Detox have no option for this permission, so it is written to the
// simulator's privacy database.
const allowIosPaste = (): void => {
    const tccDb = join(
        homedir(),
        'Library/Developer/CoreSimulator/Devices',
        device.id,
        'data/Library/TCC/TCC.db'
    );
    execFileSync('sqlite3', [
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
export const launchFreshApp = async (): Promise<void> => {
    if (device.getPlatform() === 'ios') {
        await device.terminateApp();
        await device.uninstallApp();
        await device.installApp();
        execFileSync('xcrun', ['simctl', 'keychain', device.id, 'reset']);
        allowIosPaste();
        await device.launchApp({
            newInstance: true,
            permissions: IOS_PERMISSIONS
        });
        return;
    }
    await device.launchApp({ delete: true, newInstance: true });
};

export const relaunchApp = async (): Promise<void> => {
    await device.launchApp({ newInstance: true });
};
