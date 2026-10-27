import { NativeModules, Platform } from 'react-native';

export const KEY_PREFIX = 'zeus:';

/**
 * ZEUS's own native keychain module (#4471), replacing react-native-keychain.
 * iOS keeps using the same keychain items (internet passwords, server
 * "zeus:<key>"); Android keeps its own encrypted files and reads entries
 * react-native-keychain wrote. Missing entries resolve to null; anything
 * that cannot be read rejects, so a failed read is never mistaken for a
 * missing value.
 */
interface SecureStorageModule {
    get(server: string, cloudSync: boolean): Promise<string | null>;
    set(server: string, value: string, cloudSync: boolean): Promise<boolean>;
    remove(server: string, cloudSync: boolean): Promise<boolean>;
    listServers(cloudSync: boolean): Promise<string[]>;
    wipe(): Promise<boolean>;
}

const secureStorage = (): SecureStorageModule => {
    const module = NativeModules.ZeusSecureStorage;
    if (!module) {
        throw new Error('ZeusSecureStorage native module is not available');
    }
    return module;
};

/**
 * Lists the servers of all keychain internet-password items in one
 * partition (synchronizable or not). iOS only; resolves to [] elsewhere
 * (Android has no partition split).
 */
export const getInternetPasswordServers = async (
    synchronizable: boolean
): Promise<string[]> => {
    if (Platform.OS !== 'ios') return [];
    // A missing module throws rather than resolving []: callers treat [] as
    // "no entries exist" and would set one-shot migration flags on it,
    // permanently skipping work that was never done.
    return secureStorage().listServers(synchronizable);
};

/**
 * Raw, partition-explicit keychain ops on FULL server names. Unlike the
 * Storage methods these do not apply the zeus: prefix and do not route
 * empty values to deletion; migration and purge code must address exact
 * servers in an exact partition.
 *
 * Returns null on miss, diverging from Storage.getItem's `false`, so
 * callers can distinguish "absent" without ambiguity.
 */
export const getRawItem = async (
    server: string,
    cloudSync: boolean
): Promise<string | null> => {
    const value = await secureStorage().get(server, cloudSync);
    return typeof value === 'string' ? value : null;
};

/** Writes a raw server into the non-synchronizable (device-local) partition. */
export const setRawLocalItem = async (
    server: string,
    value: string
): Promise<boolean> => {
    // The module resolves true or rejects; a false result is still treated
    // as a failed write
    return (await secureStorage().set(server, value, false)) !== false;
};

/**
 * Development only: writes into either partition, so the recovery tool can
 * recreate the legacy layouts it scans. App data is never written to the
 * synchronizable (iCloud) partition.
 */
export const setRawItemForDevelopment = async (
    server: string,
    value: string,
    cloudSync: boolean
): Promise<void> => {
    if (!__DEV__) {
        throw new Error('setRawItemForDevelopment is development only');
    }
    await secureStorage().set(server, value, cloudSync);
};

export const removeRawItem = async (
    server: string,
    cloudSync: boolean
): Promise<void> => {
    await secureStorage().remove(server, cloudSync);
};

/**
 * Deletes everything the module stores. On Android that is its own files
 * and key plus every entry react-native-keychain left behind; on iOS every
 * internet-password item the app owns, in both partitions.
 */
export const wipeSecureStorage = async (): Promise<void> => {
    await secureStorage().wipe();
};

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

    getItem = async (key: string): Promise<any> => {
        const value = await getRawItem(this.prefixKey(key), false);
        return value ? value : false;
    };

    setItem = async (key: string, value: any) => {
        if (this.writesBlocked) {
            console.warn(`[Storage] Write blocked during data wipe: ${key}`);
            return false;
        }

        const stringValue =
            typeof value === 'string' ? value : JSON.stringify(value);

        // getItem returns `false` for both unset and empty values, so routing
        // empty writes through removeItem preserves the observable semantics.
        if (stringValue == null || stringValue === '') {
            return this.removeItem(key);
        }

        return setRawLocalItem(this.prefixKey(key), stringValue);
    };

    removeItem = async (key: string) => {
        await removeRawItem(this.prefixKey(key), false);
        return true;
    };
}

const storage = new Storage();
export default storage;
