import * as Keychain from 'react-native-keychain';

const KEY_PREFIX = 'zeus:';

class Storage {
    // Set once a data wipe has started. The dying JS context keeps running
    // until the post-wipe restart lands, and any in-flight writer would
    // otherwise re-persist wiped data from memory (SettingsStore.updateSettings
    // merges the full in-memory settings on a storage miss, resurrecting every
    // node config). The post-wipe restart (restartApp) resets this naturally.
    private writesBlocked = false;

    blockWrites = () => {
        this.writesBlocked = true;
    };

    private prefixKey = (key: string) => `${KEY_PREFIX}${key}`;

    getItem = async (key: string) => {
        const prefixedKey = this.prefixKey(key);
        const response: any = await Keychain.getInternetCredentials(
            prefixedKey,
            {
                cloudSync: false
            }
        );

        if (response && response.password) {
            return response.password;
        }
        return false;
    };

    setItem = async (key: string, value: any) => {
        if (this.writesBlocked) {
            console.warn(`[Storage] Write blocked during data wipe: ${key}`);
            return false;
        }

        const prefixedKey = this.prefixKey(key);
        const stringValue =
            typeof value === 'string' ? value : JSON.stringify(value);

        // Keychain rejects empty/null passwords with EmptyParameterException.
        // getItem returns `false` for both unset and empty values, so routing
        // empty writes through removeItem preserves the observable semantics.
        if (stringValue == null || stringValue === '') {
            return this.removeItem(key);
        }

        const response = await Keychain.setInternetCredentials(
            prefixedKey,
            prefixedKey,
            stringValue,
            {
                cloudSync: false,
                // iOS: keep keychain items on this device only. The default
                // (AFTER_FIRST_UNLOCK) migrates to a new device through
                // encrypted iCloud/Finder backups, carrying the settings blob
                // (wallet seeds, LND password, macaroons, lock verifiers) with
                // it. THIS_DEVICE_ONLY blocks that migration while staying
                // readable at boot after first unlock, and (unlike
                // WHEN_PASSCODE_SET) never requires a device passcode, so it
                // cannot lock a user out of their own wallet. No-op on Android.
                accessible:
                    Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
            }
        );
        return response;
    };

    removeItem = async (key: string) => {
        const prefixedKey = this.prefixKey(key);
        const response = await Keychain.resetInternetCredentials({
            server: prefixedKey,
            cloudSync: false
        });
        return response;
    };
}

const storage = new Storage();
export default storage;
