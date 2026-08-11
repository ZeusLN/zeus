import { Platform } from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';

import Storage, {
    KEY_PREFIX,
    getInternetPasswordServers,
    getRawItem,
    setRawLocalItem,
    removeRawItem
} from '../storage';

import { CURRENCY_CODES_KEY, STORAGE_KEY } from '../stores/SettingsStore';
import { CONTACTS_KEY } from '../stores/ContactStore';
import { NOTES_KEY } from '../stores/NotesStore';
import {
    LAST_CHANNEL_BACKUP_STATUS,
    LAST_CHANNEL_BACKUP_TIME
} from '../stores/ChannelBackupStore';
import {
    ADDRESS_ACTIVATED_STRING,
    HASHES_STORAGE_STRING
} from '../stores/LightningAddressStore';
import { POS_HIDDEN_KEY, POS_STANDALONE_KEY } from '../stores/PosStore';
import { CATEGORY_KEY, PRODUCT_KEY } from '../stores/InventoryStore';
import { UNIT_KEY } from '../stores/UnitsStore';
import { HIDDEN_ACCOUNTS_KEY } from '../stores/UTXOsStore';
import { ACTIVITY_FILTERS_KEY } from '../stores/ActivityStore';
import { IS_BACKED_UP_KEY, KEYCHAIN_DESYNC_KEY } from './MigrationUtils';
import { LSPS_ORDERS_KEY } from '../stores/LSPStore';
import {
    SWAPS_KEY,
    REVERSE_SWAPS_KEY,
    SWAPS_RESCUE_KEY,
    SWAPS_LAST_USED_KEY
} from './SwapUtils';
import {
    LNC_STORAGE_KEY,
    hash as lncHash
} from '../backends/LNC/credentialStore';

// Not exported by SettingsStore; same local definition as KeychainRecoveryUtils
const LEGACY_STORAGE_KEY = 'zeus-settings';

const PURGE_OFFER_KEY = 'keychain-purge-offer-v1';

const CASHU_KEY_SUFFIXES = [
    'cashu-mintUrls',
    'cashu-selectedMintUrl',
    'cashu-totalBalanceSats',
    'cashu-invoices',
    'cashu-payments',
    'cashu-received-tokens',
    'cashu-sent-tokens',
    'cashu-seed-version',
    'cashu-seed-phrase',
    'cashu-seed'
];

const CASHU_WALLET_KEY_SUFFIXES = [
    'mintInfo',
    'counter',
    'proofs',
    'balance',
    'pubkey'
];

/**
 * The static half of the unprefixed legacy key catalog: every fixed key that
 * keychainCloudSyncMigration copies into the zeus: namespace. Kept in sync
 * with MigrationUtils' migrationKeys by a source-level drift-guard test.
 */
const STATIC_LEGACY_KEYS = [
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
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
    SWAPS_LAST_USED_KEY
];

export interface PurgeScan {
    /** All synchronizable internet-password items (zeus:* and unprefixed). iOS only. */
    syncServers: string[];
    /** Device-local unprefixed legacy entries. */
    legacyLocalServers: string[];
    /** Legacy pre-keychain settings blob in EncryptedStorage. */
    hasLegacyEncryptedSettings: boolean;
}

export interface PurgeResult {
    deleted: number;
    failures: string[];
}

const probeExists = async (server: string): Promise<boolean> => {
    try {
        return (await getRawItem(server, false)) !== null;
    } catch {
        return false;
    }
};

/**
 * Reconstructs every dynamic unprefixed key the 2026 keychain migration
 * knew how to derive: per-note keys from the notes index, LNC credential
 * keys from each node's pairing phrase, and Cashu keys from each embedded
 * node's lndDir and mint list. Reads the UNPREFIXED sources (that is what
 * is being purged); used on Android, where there is no native enumeration.
 */
const deriveDynamicLegacyKeys = async (): Promise<string[]> => {
    const keys: string[] = [];

    try {
        const notesIndex = await getRawItem(NOTES_KEY, false);
        if (notesIndex) {
            const noteKeys = JSON.parse(notesIndex);
            if (Array.isArray(noteKeys)) keys.push(...noteKeys);
        }
    } catch {
        // ignore, static catalog still covers the index itself
    }

    try {
        const settingsJson =
            (await getRawItem(STORAGE_KEY, false)) ||
            (await Storage.getItem(STORAGE_KEY)) ||
            '';
        const settings = settingsJson ? JSON.parse(settingsJson) : {};
        if (Array.isArray(settings.nodes)) {
            for (const node of settings.nodes) {
                if (
                    node.implementation === 'lightning-node-connect' &&
                    node.pairingPhrase
                ) {
                    const baseKey = `${LNC_STORAGE_KEY}:${lncHash(
                        node.pairingPhrase
                    )}`;
                    keys.push(baseKey, `${baseKey}:host`);
                }
                if (node.implementation === 'embedded-lnd') {
                    const lndDir = node.lndDir || 'lnd';
                    for (const suffix of CASHU_KEY_SUFFIXES) {
                        keys.push(`${lndDir}-${suffix}`);
                    }
                    try {
                        const mintUrlsJson = await getRawItem(
                            `${lndDir}-cashu-mintUrls`,
                            false
                        );
                        const mintUrls = mintUrlsJson
                            ? JSON.parse(mintUrlsJson)
                            : [];
                        if (Array.isArray(mintUrls)) {
                            for (const mintUrl of mintUrls) {
                                for (const suffix of CASHU_WALLET_KEY_SUFFIXES) {
                                    keys.push(
                                        `${lndDir}==${mintUrl}-${suffix}`
                                    );
                                }
                            }
                        }
                    } catch {
                        // ignore malformed mint list
                    }
                }
            }
        }
    } catch {
        // ignore, purge simply covers less
    }

    return keys;
};

/**
 * Finds every keychain location that still holds legacy or iCloud-synced
 * copies of app data. On iOS this is authoritative (native enumeration of
 * both keychain partitions); on Android, which has no synchronizable
 * partition, candidates come from the reconstructed legacy key catalog.
 */
export const scanPurgeCandidates = async (): Promise<PurgeScan> => {
    const hasLegacyEncryptedSettings = !!(await EncryptedStorage.getItem(
        LEGACY_STORAGE_KEY
    ));

    if (Platform.OS === 'ios') {
        const syncServers = await getInternetPasswordServers(true);
        const legacyLocalServers = (
            await getInternetPasswordServers(false)
        ).filter((server) => !server.startsWith(KEY_PREFIX));
        return { syncServers, legacyLocalServers, hasLegacyEncryptedSettings };
    }

    const candidates = [
        ...STATIC_LEGACY_KEYS,
        ...(await deriveDynamicLegacyKeys())
    ];
    const seen = new Set<string>();
    const legacyLocalServers: string[] = [];
    for (const key of candidates) {
        if (seen.has(key)) continue;
        seen.add(key);
        if (await probeExists(key)) legacyLocalServers.push(key);
    }
    return { syncServers: [], legacyLocalServers, hasLegacyEncryptedSettings };
};

/**
 * Safety gate that must pass before any deletion:
 * - the live (zeus:-prefixed, device-local) settings blob exists and parses,
 *   which also makes the purge a no-op after Clear All Data style wipes;
 * - every zeus:* synchronizable entry slated for deletion has a device-local
 *   counterpart. A missing one is copied over (with equality verification)
 *   before the purge may proceed, so the synchronizable copy is never the
 *   last copy of anything. Local copies that DIFFER from the synchronizable
 *   ones are expected and fine: after the desync migration all writes go to
 *   the local partition, so local is the fresher of the two.
 */
export const verifyPurgePreflight = async (
    scan: PurgeScan
): Promise<{ ok: boolean; reason?: string }> => {
    try {
        const settingsJson = await Storage.getItem(STORAGE_KEY);
        if (!settingsJson) {
            return { ok: false, reason: 'missing-settings' };
        }
        const settings = JSON.parse(settingsJson);
        if (!settings || typeof settings !== 'object') {
            return { ok: false, reason: 'invalid-settings' };
        }
    } catch {
        return { ok: false, reason: 'invalid-settings' };
    }

    for (const server of scan.syncServers) {
        if (!server.startsWith(KEY_PREFIX)) continue;
        const local = await getRawItem(server, false);
        if (local !== null) continue;
        const syncValue = await getRawItem(server, true);
        if (!syncValue) continue; // nothing of value to preserve
        await setRawLocalItem(server, syncValue);
        const verify = await getRawItem(server, false);
        if (verify !== syncValue) {
            return { ok: false, reason: `copy-failed:${server}` };
        }
    }

    return { ok: true };
};

/**
 * Decides whether to show the one-time keychain cleanup offer: iOS only,
 * only after the desync migration has completed, and only once ever (the
 * offer flag is set the moment this returns true, so a dismissal is final;
 * the Tools screen remains permanently available). Returns false when a
 * scan finds nothing to clean, silently consuming the offer.
 */
export const shouldOfferKeychainPurge = async (): Promise<boolean> => {
    if (Platform.OS !== 'ios') return false;
    try {
        const desyncDone = await EncryptedStorage.getItem(KEYCHAIN_DESYNC_KEY);
        if (desyncDone !== 'true') return false;
        const offered = await EncryptedStorage.getItem(PURGE_OFFER_KEY);
        if (offered === 'true') return false;
        await EncryptedStorage.setItem(PURGE_OFFER_KEY, 'true');
        const scan = await scanPurgeCandidates();
        return (
            scan.syncServers.length +
                scan.legacyLocalServers.length +
                (scan.hasLegacyEncryptedSettings ? 1 : 0) >
            0
        );
    } catch (e) {
        console.error('Keychain purge offer check failed', e);
        return false;
    }
};

/**
 * Deletes all scanned locations. Order is chosen for crash safety: stale
 * unprefixed entries go first and the zeus:* synchronizable entries last,
 * so the redundant copy of live data survives the longest. Re-runnable;
 * callers must have run verifyPurgePreflight on the same scan first.
 */
export const executePurge = async (scan: PurgeScan): Promise<PurgeResult> => {
    let deleted = 0;
    const failures: string[] = [];

    const remove = async (server: string, cloudSync: boolean) => {
        try {
            await removeRawItem(server, cloudSync);
            deleted++;
        } catch {
            failures.push(server);
        }
    };

    for (const server of scan.legacyLocalServers) {
        await remove(server, false);
    }

    const unprefixedSync = scan.syncServers.filter(
        (server) => !server.startsWith(KEY_PREFIX)
    );
    const prefixedSync = scan.syncServers.filter((server) =>
        server.startsWith(KEY_PREFIX)
    );

    for (const server of unprefixedSync) {
        await remove(server, true);
    }

    for (const server of prefixedSync) {
        // Last line of defense: never delete the only copy of live data
        const local = await getRawItem(server, false);
        const syncValue = await getRawItem(server, true);
        if (local === null && syncValue) {
            failures.push(server);
            continue;
        }
        await remove(server, true);
    }

    if (scan.hasLegacyEncryptedSettings) {
        try {
            await EncryptedStorage.removeItem(LEGACY_STORAGE_KEY);
            deleted++;
        } catch {
            failures.push(LEGACY_STORAGE_KEY);
        }
    }

    return { deleted, failures };
};
