import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { BackHandler, Platform } from 'react-native';
import Storage from '../storage';

import {
    STORAGE_KEY,
    CURRENCY_CODES_KEY,
    LEGACY_CURRENCY_CODES_KEY,
    FAVORITE_CURRENCIES_KEY
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
import {
    NWC_CONNECTIONS_KEY,
    NWC_CLIENT_KEYS,
    NWC_SERVICE_KEYS,
    NWC_CASHU_ENABLED,
    NWC_LUD16_ENABLED,
    NWC_PERSISTENT_SERVICE_ENABLED
} from '../stores/NostrWalletConnectStore';
import { PAYMENT_COUNT_KEY, RATING_DISMISSED_KEY } from '../utils/RatingUtils';
import { deriveEmbeddedNodeId } from './AezeedUtils';
import { sha256StringToHex } from './HashingUtils';
import { deleteLndWallet } from './LndMobileUtils';
import { deleteLdkNodeWallet, stopLdkNode } from './LdkNodeUtils';
import { sleep } from './SleepUtils';

// LNC credentials are persisted by backends/LNC/credentialStore.ts under
// `lnc-rn:<sha256(pairingPhrase)>` and `...:host`. Reconstruct those keys from
// each node's pairing phrase so a wipe removes them (clearing the literal
// `lnc-rn` prefix alone never matches the hashed keys).
const LNC_STORAGE_KEY = 'lnc-rn';
const lncHash = (value: string) => sha256StringToHex(value);

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
    FAVORITE_CURRENCIES_KEY,
    ACTIVITY_FILTERS_KEY,
    IS_BACKED_UP_KEY,
    LSPS_ORDERS_KEY,
    SWAPS_KEY,
    REVERSE_SWAPS_KEY,
    SWAPS_RESCUE_KEY,
    SWAPS_LAST_USED_KEY,
    // NWC service and client key material (nostr secret keys) plus flags
    NWC_CONNECTIONS_KEY,
    NWC_CLIENT_KEYS,
    NWC_SERVICE_KEYS,
    NWC_CASHU_ENABLED,
    NWC_LUD16_ENABLED,
    NWC_PERSISTENT_SERVICE_ENABLED,
    // Rating prompt state
    PAYMENT_COUNT_KEY,
    RATING_DISMISSED_KEY,
    // LnurlPayStore writes 'lnurlpay:<paymentHash>' entries with no index to
    // enumerate them; at least clear the bare key written when a hash is
    // undefined. Hash-keyed entries are a documented residual.
    'lnurlpay:',
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
 * Pins the user to the current screen while a wipe runs. clearAllData()
 * takes tens of seconds on device, and both wipe surfaces sit on screens
 * the user can otherwise leave mid-wipe: hardware/gesture back either
 * exits the app (Lockscreen, via the App-level loginRequired handler) or
 * pops back into an app whose data is being destroyed underneath it
 * (Tools). Swallows hardware back presses (registered after the App-level
 * handler, so it runs first), blocks removal of the screen from the
 * navigation stack, and disables the iOS back-swipe gesture. Returns a
 * release function for unmount hygiene; in practice the guard holds until
 * the post-wipe restart tears the JS context down.
 */
export function blockNavigationDuringWipe(navigation: any): () => void {
    navigation.setOptions({ gestureEnabled: false });
    const backSubscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => true
    );
    const removeBeforeRemove = navigation.addListener(
        'beforeRemove',
        (e: any) => e.preventDefault()
    );
    return () => {
        backSubscription.remove();
        removeBeforeRemove();
    };
}

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
 * Deletes react-native-keychain's Android backing stores wholesale: the
 * Jetpack DataStore file (current versions) and the legacy shared-prefs XML
 * (older versions). This is the only way to remove orphaned entries that
 * config-driven clearing can never reach: keys from wallets deleted by older
 * builds and unenumerable hash-keyed dynamic entries. Android-only; on iOS
 * the keychain is system-managed with no file to delete.
 *
 * MUST run as the final step of a full wipe: react-native-keychain caches
 * the full preference map in memory, and any keychain write after this
 * deletion would re-persist that map, resurrecting the orphans. Storage's
 * write latch blocks the known writers until the post-wipe restart.
 */
async function clearKeychainBackingStore(): Promise<void> {
    if (Platform.OS !== 'android') return;
    const dirs = ReactNativeBlobUtil.fs.dirs;
    const appRoot = `${dirs.DocumentDir}/..`;
    const targets = [
        `${appRoot}/files/datastore/RN_KEYCHAIN.preferences_pb`,
        `${appRoot}/shared_prefs/RN_KEYCHAIN.xml`
    ];
    for (const path of targets) {
        try {
            if (await ReactNativeBlobUtil.fs.exists(path)) {
                await ReactNativeBlobUtil.fs.unlink(path);
                console.log(
                    '[ClearData] Keychain backing store deleted:',
                    path
                );
            }
        } catch (e) {
            console.warn(
                `[ClearData] Error deleting keychain backing store ${path}:`,
                e
            );
        }
    }
}

/**
 * Directory holding the CDK SQLite database files
 * iOS: Application Support; Android: files dir
 */
function cdkDatabaseDir(): string {
    const dirs = ReactNativeBlobUtil.fs.dirs;
    return Platform.OS === 'ios'
        ? `${dirs.LibraryDir}/Application Support`
        : `${dirs.DocumentDir}/../files`;
}

/**
 * Deletes every CDK SQLite database file (mints, proofs, transactions).
 *
 * CDK databases are per-wallet since v13.0.0 (e14d0e9ed):
 * `cashu_wallet_<sha256(mnemonic)[0..8]>.db`, alongside the pre-v13 shared
 * `cashu_wallet.db`. CDK opens SQLite with journal_mode=WAL
 * (cdk-sqlite common.rs), so `-wal`/`-shm` sidecars can hold proof data too.
 * Sweep everything with the prefix rather than reconstructing filenames,
 * which is impossible once the seed keys are gone. Full-wipe paths only:
 * this destroys every wallet's ecash state.
 */
export async function clearCDKDatabase(): Promise<void> {
    try {
        const dbDir = cdkDatabaseDir();
        const entries: string[] = await ReactNativeBlobUtil.fs.ls(dbDir);
        for (const entry of entries) {
            if (!entry.startsWith('cashu_wallet')) continue;
            try {
                await ReactNativeBlobUtil.fs.unlink(`${dbDir}/${entry}`);
                if (__DEV__) {
                    console.log(
                        '[ClearData] CDK database file deleted:',
                        entry
                    );
                }
            } catch (e) {
                console.warn(
                    `[ClearData] Error deleting CDK database file ${entry}:`,
                    e
                );
            }
        }
    } catch (e) {
        console.warn('[ClearData] Error sweeping CDK database files:', e);
    }
}

/**
 * Deletes a single wallet's per-wallet CDK database (plus WAL/SHM sidecars).
 *
 * The filename embeds sha256(cashu mnemonic) (CashuDevKitModule.kt/.swift),
 * reconstructed here from the node's stored `<nodeDir>-cashu-seed-phrase`,
 * so this must run BEFORE clearNodeKeychainData wipes that key. Node-dir
 * rules match clearNodeKeychainData: only embedded-lnd and ldk-node have an
 * unambiguous namespace; remote nodes share the 'lnd' default, so deleting
 * "their" database could destroy another wallet's proofs.
 */
export async function clearCDKDatabaseForNode(node: any): Promise<void> {
    if (!node) return;

    let nodeDir: string | null = null;
    if (node.implementation === 'embedded-lnd') {
        nodeDir = node.lndDir || 'lnd';
    } else if (node.implementation === 'ldk-node') {
        nodeDir = node.ldkNodeDir || 'ldk';
    }
    if (!nodeDir) return;

    try {
        const stored = await Storage.getItem(`${nodeDir}-cashu-seed-phrase`);
        if (!stored) return;

        // Stored as a JSON word array; the native modules hash the
        // space-joined mnemonic string
        let mnemonic: string;
        try {
            const parsed = JSON.parse(stored);
            mnemonic = Array.isArray(parsed)
                ? parsed.join(' ')
                : String(parsed);
        } catch {
            mnemonic = stored;
        }

        const hash = sha256StringToHex(mnemonic).slice(0, 16);
        const dbDir = cdkDatabaseDir();
        for (const suffix of ['', '-wal', '-shm']) {
            const path = `${dbDir}/cashu_wallet_${hash}.db${suffix}`;
            try {
                if (await ReactNativeBlobUtil.fs.exists(path)) {
                    await ReactNativeBlobUtil.fs.unlink(path);
                    if (__DEV__) {
                        console.log(
                            '[ClearData] CDK wallet database file deleted:',
                            path
                        );
                    }
                }
            } catch (e) {
                console.warn(
                    `[ClearData] Error deleting CDK wallet database ${path}:`,
                    e
                );
            }
        }
    } catch (e) {
        console.warn('[ClearData] Error clearing CDK database for node:', e);
    }
}

/**
 * Suffixes of every node-dir-namespaced Cashu storage key written by
 * CashuStore (`<nodeDir>-cashu-<suffix>`). Kept complete by the drift guard
 * in DataClearUtils.test.ts, which extracts the `-cashu-` literals from
 * stores/CashuStore.ts and fails when a new key is written but not cleared.
 */
export const CASHU_KEY_SUFFIXES = [
    'mintUrls',
    'selectedMintUrl',
    'selectedMintUrls',
    'multiMintSelectedUrls',
    'totalBalanceSats',
    'invoices',
    'payments',
    'received-tokens',
    'sent-tokens',
    'offline-pending-tokens',
    'offline-spent-tokens',
    'seed-version',
    'seed-phrase',
    'seed',
    'original-seed-version',
    'v1-restore-done',
    'dismissedUpgradeThreshold',
    'randomizeMintSelection',
    'nostrMintBackupTimestamp'
];

/**
 * Clears Cashu data for a specific node directory
 */
async function clearCashuDataForNode(lndDir: string) {
    // Read the legacy pre-CDK mint list BEFORE clearing: the loop below
    // removes the mintUrls key this read depends on
    let legacyMintUrls: string[] = [];
    try {
        const mintUrlsJson = await Storage.getItem(`${lndDir}-cashu-mintUrls`);
        if (mintUrlsJson) {
            const parsed = JSON.parse(mintUrlsJson);
            if (Array.isArray(parsed)) {
                legacyMintUrls = parsed;
            }
        }
    } catch (e) {
        console.warn(
            `[ClearData] Error reading Cashu mint list for ${lndDir}:`,
            e
        );
    }

    // Clear app-level Cashu storage keys
    for (const suffix of CASHU_KEY_SUFFIXES) {
        await clearKey(`${lndDir}-cashu-${suffix}`);
    }

    // Clear per-mint wallet keys (legacy pre-CDK storage)
    try {
        for (const mintUrl of legacyMintUrls) {
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
    } catch (e) {
        console.warn(
            `[ClearData] Error clearing Cashu mint keys for ${lndDir}:`,
            e
        );
    }
}

const NODE_DIR_DELETE_ATTEMPTS = 3;
const NODE_DIR_RETRY_DELAY_MS = 500;

/**
 * Stops and deletes a single node's data directory. Never throws - returns
 * whether the directory was removed so the caller can retry.
 */
async function deleteNodeDataDirectory(node: any): Promise<boolean> {
    try {
        if (node.implementation === 'embedded-lnd') {
            // deleteLndWallet stops LND before unlinking the directory
            return await deleteLndWallet(node.lndDir || 'lnd');
        }
        if (node.implementation === 'ldk-node' && node.ldkNodeDir) {
            // deleteLdkNodeWallet does not stop the node itself
            await stopLdkNode();
            await deleteLdkNodeWallet(node.ldkNodeDir);
        }
        // no on-disk directory for remote implementations
        return true;
    } catch (e) {
        console.warn('[ClearData] Error clearing node data directory:', e);
        return false;
    }
}

/**
 * Stops and deletes a single node's on-disk data directory, retrying on
 * failure. The likely cause of failure is a file handle still held by a node
 * that hasn't finished shutting down, which clears on its own after a moment.
 * Returns whether the directory was removed. Exported so single-wallet
 * deletion (WalletConfiguration.deleteNodeConfig) shares the wipe path's
 * retry behavior instead of assuming the first attempt succeeded.
 */
export async function deleteNodeDataDirectoryWithRetry(
    node: any
): Promise<boolean> {
    for (let attempt = 1; attempt <= NODE_DIR_DELETE_ATTEMPTS; attempt++) {
        if (await deleteNodeDataDirectory(node)) return true;

        if (attempt < NODE_DIR_DELETE_ATTEMPTS) {
            await sleep(NODE_DIR_RETRY_DELAY_MS);
        }
    }
    console.warn(
        `[ClearData] Gave up deleting node data directory after ${NODE_DIR_DELETE_ATTEMPTS} attempts`
    );
    return false;
}

/**
 * Clears the LNC pairing credentials for a given pairing phrase.
 * Keys are namespaced by sha256(pairingPhrase), so they can only be removed
 * when the phrase is known (it lives in the node config).
 */
async function clearLncCredentials(pairingPhrase: string) {
    const baseKey = `${LNC_STORAGE_KEY}:${lncHash(pairingPhrase)}`;
    await clearKey(baseKey);
    await clearKey(`${baseKey}:host`);
}

/**
 * Clears all node-namespaced keychain material for a single node config:
 * - Cashu keys, which are namespaced by getNodeDir() (lndDir for LND-family,
 *   ldkNodeDir for LDK) - CashuStore.getNodeDir
 * - LNC pairing credentials, namespaced by sha256(pairingPhrase)
 * - the legacy '<pubkey>-extended-private-keys' xprv cache (KEY-006)
 *
 * Exported so both clearAllData() and single-wallet deletion
 * (WalletConfiguration.deleteNodeConfig) clear the same set of keys.
 */
export async function clearNodeKeychainData(
    node: any,
    opts?: { skipXprvPurge?: boolean }
): Promise<void> {
    if (!node) return;
    if (node.lndDir) {
        await clearCashuDataForNode(node.lndDir);
    }
    if (node.ldkNodeDir) {
        await clearCashuDataForNode(node.ldkNodeDir);
    }
    // Legacy configs can predate explicit node dirs (see the `lndDir || 'lnd'`
    // fallbacks in WalletConfiguration/getNodeDir). Mirror getNodeDir()'s
    // defaults so those wallets' Cashu keys are cleared too. Gate on
    // implementation: only one config can occupy a default namespace per
    // implementation, and remote nodes must never clear the 'lnd'/'ldk'
    // namespaces owned by embedded wallets.
    if (node.implementation === 'embedded-lnd' && !node.lndDir) {
        await clearCashuDataForNode('lnd');
    }
    if (node.implementation === 'ldk-node' && !node.ldkNodeDir) {
        await clearCashuDataForNode('ldk');
    }
    if (node.pairingPhrase) {
        await clearLncCredentials(node.pairingPhrase);
    }
    // Builds between Jan 2025 (ba70ce58f) and the removal in this PR
    // cached ypriv/zpriv under '<pubkey>-extended-private-keys'. The node
    // pubkey is not stored in the config, so re-derive it from the aezeed
    // (entropy -> BIP32 master -> m/1017'/coinType'/6'/0/0, lnd's node
    // identity key). Derivation failure means a non-default aezeed
    // passphrase; those wallets never had the cache written, because the
    // export screen's decryption failed the same way before its write.
    // Belt and braces: NodeInfoStore also purges the cache at connect
    // time using the runtime nodeId, which is passphrase-independent.
    if (
        !opts?.skipXprvPurge &&
        node.implementation === 'embedded-lnd' &&
        Array.isArray(node.seedPhrase) &&
        node.seedPhrase.length > 0
    ) {
        try {
            // Coin type 1 for every non-mainnet network: testnet, signet
            // (mutinynet), and regtest share HDCoinType 1. Matches the
            // `(network || 'mainnet').toLowerCase() !== 'mainnet'` rule
            // WalletConfiguration uses for the same field.
            const nodeId = await deriveEmbeddedNodeId(
                node.seedPhrase,
                String(node.embeddedLndNetwork || 'mainnet').toLowerCase() !==
                    'mainnet'
            );
            if (nodeId) {
                await clearKey(`${nodeId}-extended-private-keys`);
            }
        } catch (e) {
            console.warn('[ClearData] Error purging xprv cache for node:', e);
        }
    }
}

/**
 * Stops and deletes the on-disk node data directories (channel state, wallet
 * db) for every configured node. clearKey/clearCashuDataForNode only touch
 * keychain and Cashu storage; the LND/LDK node directories must be unlinked
 * separately or seed-bearing wallet state survives a "wipe".
 *
 * Deletion is retried: the likely cause of failure is a file handle still
 * held by a node that hasn't finished shutting down, which clears on its own
 * after a moment. A directory we still can't remove is logged and skipped -
 * it never aborts the wipe and never reaches the UI. This runs on the duress
 * path, where stopping mid-wipe would strand the user with the remaining
 * steps (keychain, settings blob, pins) unwiped, and where showing an error
 * would disclose the duress mechanism to a coercer.
 */
async function clearNodeDataDirectories(settings: any): Promise<void> {
    if (!settings?.nodes || !Array.isArray(settings.nodes)) return;

    for (const node of settings.nodes) {
        await deleteNodeDataDirectoryWithRetry(node);
    }
}

/**
 * Clears all app data including:
 * - Storage (new zeus: namespace)
 * - Old keychain entries (local and cloud)
 * - AsyncStorage
 * - EncryptedStorage
 * - Dynamic keys (notes, Cashu, LNC)
 * - CDK SQLite database (Cashu wallet state)
 * - LND/LDK on-disk node data directories (channel + wallet state)
 *
 * After clearing, the app should be restarted.
 */
export async function clearAllData(): Promise<void> {
    console.log('[ClearData] Starting to clear all data...');

    // 0. Block all Storage writes for the rest of this JS context. The app
    // keeps running until the post-wipe restart lands, and an async writer
    // (biometry check, push token, connection events) calling
    // updateSettings would re-persist the full in-memory settings blob,
    // resurrecting every wallet config after the wipe. Observed on-device:
    // the settings write landed ~20ms after the wipe finished.
    Storage.blockWrites();

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

    // 2. Clear node-namespaced keychain material (Cashu keys for both LND and
    // LDK node dirs, plus LNC pairing credentials) for every known node.
    if (settings?.nodes && Array.isArray(settings.nodes)) {
        for (const node of settings.nodes) {
            // Skip the scrypt-heavy xprv re-derivation on Android: the
            // backing-store deletion in step 8 removes every keychain entry
            // wholesale, and this path runs on the duress wipe, where added
            // seconds per embedded wallet matter. iOS has no backing store
            // to delete, so it must pay for the derivation here.
            await clearNodeKeychainData(node, {
                skipXprvPurge: Platform.OS === 'android'
            });
        }
    }
    // Also try common node-dir defaults (getNodeDir falls back to 'lnd' / 'ldk')
    await clearCashuDataForNode('lnd');
    await clearCashuDataForNode('ldk');
    await clearCashuDataForNode('');

    // 2b. Clear CDK SQLite database (contains mints, proofs, transactions)
    await clearCDKDatabase();

    // 2c. Stop and delete the on-disk LND/LDK node data directories. These
    // hold channel + wallet state and are not covered by the keychain/Cashu
    // clears above, so they must be unlinked explicitly.
    await clearNodeDataDirectories(settings);

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

    // 8. Android: delete the keychain backing stores wholesale, killing the
    // orphaned entries no config-driven clear can reach. Keep this the LAST
    // clearing action (see clearKeychainBackingStore).
    await clearKeychainBackingStore();

    console.log('[ClearData] All data cleared successfully');
}
