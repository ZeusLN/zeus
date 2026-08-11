import { NativeModules, Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';

export const KEY_PREFIX = 'zeus:';

/**
 * Lists the servers of all keychain internet-password items in one
 * partition (synchronizable or not) via the KeychainAudit native module.
 * iOS only; resolves to [] elsewhere (Android has no partition split).
 */
export const getInternetPasswordServers = async (
    synchronizable: boolean
): Promise<string[]> => {
    if (Platform.OS !== 'ios') return [];
    return NativeModules.KeychainAudit.getInternetPasswordServers(
        synchronizable
    );
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
    const response: any = await Keychain.getInternetCredentials(
        server,
        cloudSync ? { cloudSync: true } : undefined
    );
    if (response && typeof response.password === 'string') {
        return response.password;
    }
    return null;
};

/**
 * Writes a raw server into the non-synchronizable (device-local)
 * partition. No cloudSync option is passed: with the patched
 * react-native-keychain, absent and false both mean local, and omitting
 * the option keeps this correct even on an unpatched build.
 */
export const setRawLocalItem = async (
    server: string,
    value: string
): Promise<boolean> => {
    const response = await Keychain.setInternetCredentials(
        server,
        server,
        value
    );
    return !!response;
};

export const removeRawItem = async (
    server: string,
    cloudSync: boolean
): Promise<void> => {
    await Keychain.resetInternetCredentials(
        cloudSync ? { server, cloudSync: true } : { server }
    );
};

class Storage {
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
                cloudSync: false
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
