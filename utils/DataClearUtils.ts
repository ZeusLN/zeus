import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import Storage from '../storage';

import {
    STORAGE_KEY,
    CURRENCY_CODES_KEY,
    LEGACY_CURRENCY_CODES_KEY
} from '../stores/SettingsStore';
import { NOTES_KEY, LEGACY_NOTES_KEY } from '../stores/NotesStore';
import { CONTACTS_KEY, LEGACY_CONTACTS_KEY } from '../stores/ContactStore';
import {
    LAST_CHANNEL_BACKUP_STATUS,
    LAST_CHANNEL_BACKUP_TIME,
    LEGACY_LAST_CHANNEL_BACKUP_STATUS,
    LEGACY_LAST_CHANNEL_BACKUP_TIME
} from '../stores/ChannelBackupStore';
import {
    ADDRESS_ACTIVATED_STRING,
    HASHES_STORAGE_STRING,
    LEGACY_ADDRESS_ACTIVATED_STRING,
    LEGACY_HASHES_STORAGE_STRING
} from '../stores/LightningAddressStore';
import {
    POS_HIDDEN_KEY,
    POS_STANDALONE_KEY,
    LEGACY_POS_HIDDEN_KEY,
    LEGACY_POS_STANDALONE_KEY
} from '../stores/PosStore';
import {
    CATEGORY_KEY,
    PRODUCT_KEY,
    LEGACY_CATEGORY_KEY,
    LEGACY_PRODUCT_KEY
} from '../stores/InventoryStore';
import { UNIT_KEY, LEGACY_UNIT_KEY } from '../stores/UnitsStore';
import {
    HIDDEN_ACCOUNTS_KEY,
    LEGACY_HIDDEN_ACCOUNTS_KEY
} from '../stores/UTXOsStore';
import { LSPS_ORDERS_KEY, LEGACY_LSPS1_ORDERS_KEY } from '../stores/LSPStore';
import {
    ACTIVITY_FILTERS_KEY,
    LEGACY_ACTIVITY_FILTERS_KEY
} from '../stores/ActivityStore';
import { IS_BACKED_UP_KEY } from '../utils/MigrationUtils';
import {
    SWAPS_KEY,
    REVERSE_SWAPS_KEY,
    SWAPS_RESCUE_KEY,
    SWAPS_LAST_USED_KEY
} from '../utils/SwapUtils';

const KEY_PREFIX = 'zeus:';

// All known storage keys that need to be cleared (both new and legacy)
const STORAGE_KEYS = [
    // Current keys
    STORAGE_KEY,
    CONTACTS_KEY,
    NOTES_KEY,
    LAST_CHANNEL_BACKUP_STATUS,
    LAST_CHANNEL_BACKUP_TIME,
    ADDRESS_ACTIVATED_STRING,
    HASHES_STORAGE_STRING,
    POS_HIDDEN_KEY,
    POS_STANDALONE_KEY,
    CATEGORY_KEY,
    PRODUCT_KEY,
    UNIT_KEY,
    HIDDEN_ACCOUNTS_KEY,
    CURRENCY_CODES_KEY,
    ACTIVITY_FILTERS_KEY,
    IS_BACKED_UP_KEY,
    LSPS_ORDERS_KEY,
    SWAPS_KEY,
    REVERSE_SWAPS_KEY,
    SWAPS_RESCUE_KEY,
    SWAPS_LAST_USED_KEY,
    // Legacy keys
    LEGACY_CONTACTS_KEY,
    LEGACY_NOTES_KEY,
    LEGACY_LAST_CHANNEL_BACKUP_STATUS,
    LEGACY_LAST_CHANNEL_BACKUP_TIME,
    LEGACY_ADDRESS_ACTIVATED_STRING,
    LEGACY_HASHES_STORAGE_STRING,
    LEGACY_POS_HIDDEN_KEY,
    LEGACY_POS_STANDALONE_KEY,
    LEGACY_CATEGORY_KEY,
    LEGACY_PRODUCT_KEY,
    LEGACY_UNIT_KEY,
    LEGACY_HIDDEN_ACCOUNTS_KEY,
    LEGACY_CURRENCY_CODES_KEY,
    LEGACY_ACTIVITY_FILTERS_KEY,
    LEGACY_LSPS1_ORDERS_KEY,
    // Other known keys
    'backup-complete',
    'backup-complete-v2'
];

/**
 * Clears a key from all possible locations:
 * - New Storage namespace (zeus:key)
 * - Old keychain (key) - both local and cloud
 * - Direct zeus: prefixed keychain entries
 */
async function clearKey(key: string) {
    const prefixedKey = `${KEY_PREFIX}${key}`;

    // Clear from new Storage (zeus: prefix) via Storage API
    try {
        await Storage.removeItem(key);
    } catch (e) {
        console.warn(`[ClearData] Error clearing Storage key ${key}:`, e);
    }

    // Clear zeus: prefixed key directly from keychain (local)
    try {
        await Keychain.resetInternetCredentials({ server: prefixedKey });
    } catch (e) {
        console.warn(
            `[ClearData] Error clearing prefixed keychain ${prefixedKey}:`,
            e
        );
    }

    // Clear zeus: prefixed key directly from keychain (cloud)
    try {
        await Keychain.resetInternetCredentials({
            server: prefixedKey,
            cloudSync: true
        });
    } catch (e) {
        console.warn(
            `[ClearData] Error clearing prefixed cloud keychain ${prefixedKey}:`,
            e
        );
    }

    // Clear from old keychain (no prefix, local)
    try {
        await Keychain.resetInternetCredentials({ server: key });
    } catch (e) {
        console.warn(`[ClearData] Error clearing local keychain ${key}:`, e);
    }

    // Clear from old keychain (no prefix, cloud)
    try {
        await Keychain.resetInternetCredentials({
            server: key,
            cloudSync: true
        });
    } catch (e) {
        console.warn(`[ClearData] Error clearing cloud keychain ${key}:`, e);
    }
}

/**
 * Clears Cashu data for a specific node directory
 */
async function clearCashuDataForNode(lndDir: string) {
    const cashuKeys = [
        `${lndDir}-cashu-mintUrls`,
        `${lndDir}-cashu-selectedMintUrl`,
        `${lndDir}-cashu-totalBalanceSats`,
        `${lndDir}-cashu-invoices`,
        `${lndDir}-cashu-payments`,
        `${lndDir}-cashu-received-tokens`,
        `${lndDir}-cashu-sent-tokens`,
        `${lndDir}-cashu-seed-version`,
        `${lndDir}-cashu-seed-phrase`,
        `${lndDir}-cashu-seed`
    ];

    for (const key of cashuKeys) {
        await clearKey(key);
    }

    // Try to clear per-mint wallet keys
    try {
        const mintUrlsJson = await Storage.getItem(`${lndDir}-cashu-mintUrls`);
        if (mintUrlsJson) {
            const mintUrls = JSON.parse(mintUrlsJson);
            if (Array.isArray(mintUrls)) {
                for (const mintUrl of mintUrls) {
                    // walletId format: ${lndDir}==${mintUrl}
                    const walletId = `${lndDir}==${mintUrl}`;
                    const walletKeys = [
                        `${walletId}-mintInfo`,
                        `${walletId}-counter`,
                        `${walletId}-proofs`,
                        `${walletId}-balance`,
                        `${walletId}-pubkey`
                    ];
                    for (const walletKey of walletKeys) {
                        await clearKey(walletKey);
                    }
                }
            }
        }
    } catch (e) {
        console.warn(
            `[ClearData] Error clearing Cashu mint keys for ${lndDir}:`,
            e
        );
    }
}

/**
 * Clears all app data including:
 * - Storage (new zeus: namespace)
 * - Old keychain entries (local and cloud)
 * - AsyncStorage
 * - EncryptedStorage
 * - Dynamic keys (notes, Cashu, LNC)
 *
 * After clearing, the app should be restarted.
 */
export async function clearAllData(): Promise<void> {
    console.log('[ClearData] Starting to clear all data...');

    // 1. First, try to get settings to find node-specific data
    let settings: any = null;
    try {
        const settingsJson = await Storage.getItem(STORAGE_KEY);
        if (settingsJson) {
            settings = JSON.parse(settingsJson);
        }
    } catch (e) {
        console.warn('[ClearData] Could not read settings:', e);
    }

    // 2. Clear Cashu data for all known nodes
    if (settings?.nodes && Array.isArray(settings.nodes)) {
        for (const node of settings.nodes) {
            if (node.lndDir) {
                console.log(
                    `[ClearData] Clearing Cashu data for node: ${node.lndDir}`
                );
                await clearCashuDataForNode(node.lndDir);
            }
        }
    }
    // Also try common lndDir values
    await clearCashuDataForNode('lnd');
    await clearCashuDataForNode('');

    // 3. Clear all known storage keys
    console.log('[ClearData] Clearing known storage keys...');
    for (const key of STORAGE_KEYS) {
        await clearKey(key);
    }

    // 4. Clear notes (dynamic keys)
    try {
        const notesListJson = await Storage.getItem(NOTES_KEY);
        if (notesListJson) {
            const noteKeys = JSON.parse(notesListJson);
            if (Array.isArray(noteKeys)) {
                for (const noteKey of noteKeys) {
                    await clearKey(noteKey);
                }
            }
        }
    } catch (e) {
        console.warn('[ClearData] Error clearing notes:', e);
    }

    // 5. Clear AsyncStorage (includes install UUID)
    try {
        await AsyncStorage.clear();
        console.log('[ClearData] AsyncStorage cleared');
    } catch (e) {
        console.warn('[ClearData] Error clearing AsyncStorage:', e);
    }

    // 6. Clear EncryptedStorage (migration flags, etc.)
    try {
        // Also explicitly clear the legacy settings key
        await EncryptedStorage.removeItem('zeus-settings');
        await EncryptedStorage.clear();
        console.log('[ClearData] EncryptedStorage cleared');
    } catch (e) {
        console.warn('[ClearData] Error clearing EncryptedStorage:', e);
    }

    // 7. Clear any remaining keychain items with common prefixes
    const additionalKeys = [
        'zeus-settings',
        'zeus-settings-v2',
        'settings',
        'lnc-rn'
    ];
    for (const key of additionalKeys) {
        await clearKey(key);
    }

    console.log('[ClearData] All data cleared successfully');
}
