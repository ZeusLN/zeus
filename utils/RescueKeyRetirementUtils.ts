import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';

import { KEY_PREFIX, getRawItem, removeRawItem } from '../storage';
import {
    SWAPS_RESCUE_KEY,
    SWAPS_LAST_USED_KEY,
    RESCUE_KEY_REPLACED_KEY,
    isWalletSeed
} from './SwapUtils';

// EncryptedStorage: JSON list of zeus:-prefixed servers whose values were
// retired. KeychainPurgeUtils.verifyPurgePreflight does not copy their
// synchronizable copies back into the device-local partition.
export const RETIRED_KEYCHAIN_SERVERS_KEY = 'keychain-retired-servers-v1';

export const getRetiredKeychainServers = async (): Promise<string[]> => {
    const json = await EncryptedStorage.getItem(RETIRED_KEYCHAIN_SERVERS_KEY);
    if (!json) return [];
    try {
        const servers = JSON.parse(json);
        return Array.isArray(servers)
            ? servers.filter((server) => typeof server === 'string')
            : [];
    } catch {
        return [];
    }
};

const addRetiredKeychainServers = async (servers: string[]) => {
    const retired = await getRetiredKeychainServers();
    const merged = Array.from(new Set([...retired, ...servers]));
    if (merged.length === retired.length) return;
    await EncryptedStorage.setItem(
        RETIRED_KEYCHAIN_SERVERS_KEY,
        JSON.stringify(merged)
    );
};

interface KeychainCopy {
    server: string;
    cloudSync: boolean;
}

// Every keychain location a key can be in: the zeus: entries the app reads
// and writes, and the unprefixed entries from before the 2026 keychain
// migration. The synchronizable (iCloud) partition only exists on iOS.
const copiesOf = (key: string): KeychainCopy[] => {
    const servers = [`${KEY_PREFIX}${key}`, key];
    const copies = servers.map((server) => ({ server, cloudSync: false }));
    if (Platform.OS === 'ios') {
        copies.push(...servers.map((server) => ({ server, cloudSync: true })));
    }
    return copies;
};

/**
 * Removes every keychain copy of the swap rescue key that is the mnemonic
 * of one of `nodes` (v13.0.0 to v13.1.3 stored an LDK Node wallet's own
 * mnemonic as the rescue key). Removing only the device-local zeus: entry
 * is not enough: the keychain purge preflight copies a synchronizable
 * zeus: entry back when its local counterpart is missing, and an
 * unprefixed copy never gets deleted once the zeus: entry is gone.
 * Deleting a synchronizable copy also removes it from the user's other
 * Apple devices.
 *
 * The rescue key counts as retired when the copy the app reads (local
 * zeus:) is a wallet seed, or is absent while another copy is. Only then
 * is the notice flag set and the key index (swaps-last-used-key) removed,
 * since an independent rescue key still needs its index. The retired
 * servers are recorded before anything is deleted, so the purge preflight
 * cannot restore a copy that was missed. The local zeus: rescue key goes
 * last, so an interrupted run is retried on the next load.
 *
 * Returns whether the rescue key was retired.
 */
export const retireWalletSeedRescueKeyCopies = async (
    nodes?: Array<{ ldkMnemonic?: string }>
): Promise<boolean> => {
    const rescueKeyCopies = copiesOf(SWAPS_RESCUE_KEY);
    const values = await Promise.all(
        rescueKeyCopies.map(({ server, cloudSync }) =>
            getRawItem(server, cloudSync)
        )
    );
    const seedCopies = rescueKeyCopies.filter((_copy, i) =>
        isWalletSeed(values[i], nodes)
    );
    if (seedCopies.length === 0) return false;

    // rescueKeyCopies[0] is the local zeus: entry, the one the app reads
    const liveValue = values[0];
    const retired = liveValue === null || isWalletSeed(liveValue, nodes);

    const prefixedRescueKey = `${KEY_PREFIX}${SWAPS_RESCUE_KEY}`;
    const prefixedLastUsedKey = `${KEY_PREFIX}${SWAPS_LAST_USED_KEY}`;

    if (retired) {
        await AsyncStorage.setItem(RESCUE_KEY_REPLACED_KEY, 'true');
    }
    await addRetiredKeychainServers(
        retired ? [prefixedRescueKey, prefixedLastUsedKey] : [prefixedRescueKey]
    );

    if (retired) {
        for (const { server, cloudSync } of copiesOf(SWAPS_LAST_USED_KEY)) {
            await removeRawItem(server, cloudSync);
        }
    }

    const ordered = [
        ...seedCopies.filter((copy) => copy !== rescueKeyCopies[0]),
        ...seedCopies.filter((copy) => copy === rescueKeyCopies[0])
    ];
    for (const { server, cloudSync } of ordered) {
        await removeRawItem(server, cloudSync);
    }

    return retired;
};
