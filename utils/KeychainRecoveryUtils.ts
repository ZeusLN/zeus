import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import EncryptedStorage from 'react-native-encrypted-storage';
import Storage from '../storage';

import { CURRENCY_CODES_KEY, STORAGE_KEY, Node } from '../stores/SettingsStore';
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
import { IS_BACKED_UP_KEY } from '../utils/MigrationUtils';
import { LSPS_ORDERS_KEY } from '../stores/LSPStore';
import {
    SWAPS_KEY,
    REVERSE_SWAPS_KEY,
    SWAPS_RESCUE_KEY,
    SWAPS_LAST_USED_KEY
} from '../utils/SwapUtils';

// Legacy storage key used before v0.10.0
const LEGACY_STORAGE_KEY = 'zeus-settings';

export interface RecoveryResult {
    key: string;
    source:
        | 'current'
        | 'unprefixed-local'
        | 'unprefixed-cloud'
        | 'encrypted-storage';
    data: string;
    description: string;
}

export interface RecoveryScanResult {
    settingsFound: RecoveryResult[];
    otherDataFound: RecoveryResult[];
    hasCurrentSettings: boolean;
    error?: string;
}

// Keys to scan for recovery
const CRITICAL_KEYS = [
    { key: STORAGE_KEY, description: 'Wallet Configurations' },
    { key: LEGACY_STORAGE_KEY, description: 'Legacy Wallet Configurations' }
];

const OTHER_KEYS = [
    { key: CONTACTS_KEY, description: 'Contacts' },
    { key: NOTES_KEY, description: 'Notes' },
    { key: LAST_CHANNEL_BACKUP_STATUS, description: 'Channel Backup Status' },
    { key: LAST_CHANNEL_BACKUP_TIME, description: 'Channel Backup Time' },
    { key: ADDRESS_ACTIVATED_STRING, description: 'Lightning Address Status' },
    { key: HASHES_STORAGE_STRING, description: 'Lightning Address Hashes' },
    { key: POS_HIDDEN_KEY, description: 'POS Hidden Key' },
    { key: POS_STANDALONE_KEY, description: 'POS Standalone Key' },
    { key: CATEGORY_KEY, description: 'POS Categories' },
    { key: PRODUCT_KEY, description: 'POS Products' },
    { key: UNIT_KEY, description: 'Unit Preferences' },
    { key: HIDDEN_ACCOUNTS_KEY, description: 'Hidden Accounts' },
    { key: CURRENCY_CODES_KEY, description: 'Currency Codes' },
    { key: ACTIVITY_FILTERS_KEY, description: 'Activity Filters' },
    { key: IS_BACKED_UP_KEY, description: 'Backup Status' },
    { key: LSPS_ORDERS_KEY, description: 'LSP Orders' },
    { key: SWAPS_KEY, description: 'Swaps' },
    { key: REVERSE_SWAPS_KEY, description: 'Reverse Swaps' },
    { key: SWAPS_RESCUE_KEY, description: 'Swap Rescue Data' },
    { key: SWAPS_LAST_USED_KEY, description: 'Last Used Swap Provider' }
];

class KeychainRecoveryUtils {
    /**
     * Attempts to read from current Storage (zeus: prefix, local only)
     */
    private async readFromCurrentStorage(key: string): Promise<string | null> {
        try {
            const data = await Storage.getItem(key);
            return data || null;
        } catch (e) {
            console.warn(`[Recovery] Error reading current storage ${key}:`, e);
            return null;
        }
    }

    /**
     * Attempts to read from old keychain without prefix (local)
     */
    private async readFromUnprefixedLocal(key: string): Promise<string | null> {
        try {
            const creds = await Keychain.getInternetCredentials(key);
            if (creds && creds.password) {
                return creds.password;
            }
            return null;
        } catch (e) {
            console.warn(
                `[Recovery] Error reading unprefixed local ${key}:`,
                e
            );
            return null;
        }
    }

    /**
     * Attempts to read from old keychain without prefix (cloud/iCloud)
     */
    private async readFromUnprefixedCloud(key: string): Promise<string | null> {
        if (Platform.OS !== 'ios') return null;

        try {
            const creds = await Keychain.getInternetCredentials(key, {
                cloudSync: true
            });
            if (creds && creds.password) {
                return creds.password;
            }
            return null;
        } catch (e) {
            console.warn(
                `[Recovery] Error reading unprefixed cloud ${key}:`,
                e
            );
            return null;
        }
    }

    /**
     * Attempts to read from EncryptedStorage (legacy storage before keychain)
     */
    private async readFromEncryptedStorage(
        key: string
    ): Promise<string | null> {
        try {
            const data = await EncryptedStorage.getItem(key);
            return data || null;
        } catch (e) {
            console.warn(
                `[Recovery] Error reading encrypted storage ${key}:`,
                e
            );
            return null;
        }
    }

    /**
     * Configuration for storage sources to scan
     */
    private getStorageSources(): Array<{
        source: RecoveryResult['source'];
        reader: (key: string) => Promise<string | null>;
    }> {
        return [
            {
                source: 'current',
                reader: (key) => this.readFromCurrentStorage(key)
            },
            {
                source: 'unprefixed-local',
                reader: (key) => this.readFromUnprefixedLocal(key)
            },
            {
                source: 'unprefixed-cloud',
                reader: (key) => this.readFromUnprefixedCloud(key)
            },
            {
                source: 'encrypted-storage',
                reader: (key) => this.readFromEncryptedStorage(key)
            }
        ];
    }

    /**
     * Scans a single key across all storage locations
     */
    private async scanKey(
        key: string,
        description: string
    ): Promise<RecoveryResult[]> {
        const results: RecoveryResult[] = [];
        const sources = this.getStorageSources();

        for (const { source, reader } of sources) {
            const data = await reader(key);
            if (data) {
                results.push({ key, source, data, description });
            }
        }

        return results;
    }

    /**
     * Performs a full scan of all storage locations for recoverable data
     */
    public async scanForRecoverableData(): Promise<RecoveryScanResult> {
        console.log('[Recovery] Starting scan for recoverable data...');

        const result: RecoveryScanResult = {
            settingsFound: [],
            otherDataFound: [],
            hasCurrentSettings: false
        };

        try {
            // Scan critical keys (settings)
            for (const { key, description } of CRITICAL_KEYS) {
                const keyResults = await this.scanKey(key, description);
                result.settingsFound.push(...keyResults);
            }

            // Check if current settings exist
            result.hasCurrentSettings = result.settingsFound.some(
                (r) => r.source === 'current' && r.key === STORAGE_KEY
            );

            // Scan other data keys
            for (const { key, description } of OTHER_KEYS) {
                const keyResults = await this.scanKey(key, description);
                // Only add results that are NOT from current storage
                // (we're looking for orphaned/lost data)
                const orphanedResults = keyResults.filter(
                    (r) => r.source !== 'current'
                );
                result.otherDataFound.push(...orphanedResults);
            }

            console.log(
                `[Recovery] Scan complete. Settings found: ${result.settingsFound.length}, Other data: ${result.otherDataFound.length}`
            );
        } catch (error) {
            console.error('[Recovery] Error during scan:', error);
            result.error = String(error);
        }

        return result;
    }

    /**
     * Restores settings from a recovered source to current storage
     */
    public async restoreSettings(recoveryResult: RecoveryResult): Promise<{
        success: boolean;
        error?: string;
        nodesRestored?: number;
    }> {
        console.log(
            `[Recovery] Attempting to restore settings from ${recoveryResult.source}...`
        );

        try {
            // Parse the settings to validate
            const settings = JSON.parse(recoveryResult.data);

            if (!settings || typeof settings !== 'object') {
                return {
                    success: false,
                    error: 'Invalid settings format'
                };
            }

            const nodeCount = settings.nodes?.length || 0;

            // Write to current storage
            const writeSuccess = await Storage.setItem(
                STORAGE_KEY,
                recoveryResult.data
            );

            if (!writeSuccess) {
                return {
                    success: false,
                    error: 'Failed to write to storage'
                };
            }

            // Verify the write
            const verifyData = await Storage.getItem(STORAGE_KEY);
            if (!verifyData) {
                return {
                    success: false,
                    error: 'Verification failed after write'
                };
            }

            console.log(
                `[Recovery] Successfully restored ${nodeCount} node(s)`
            );

            return {
                success: true,
                nodesRestored: nodeCount
            };
        } catch (error) {
            console.error('[Recovery] Error restoring settings:', error);
            return {
                success: false,
                error: String(error)
            };
        }
    }

    /**
     * Restores a specific data key from a recovered source
     */
    public async restoreDataKey(recoveryResult: RecoveryResult): Promise<{
        success: boolean;
        error?: string;
    }> {
        console.log(
            `[Recovery] Attempting to restore ${recoveryResult.key} from ${recoveryResult.source}...`
        );

        try {
            // Write to current storage
            const writeSuccess = await Storage.setItem(
                recoveryResult.key,
                recoveryResult.data
            );

            if (!writeSuccess) {
                return {
                    success: false,
                    error: 'Failed to write to storage'
                };
            }

            // Verify the write
            const verifyData = await Storage.getItem(recoveryResult.key);
            if (!verifyData) {
                return {
                    success: false,
                    error: 'Verification failed after write'
                };
            }

            console.log(
                `[Recovery] Successfully restored ${recoveryResult.key}`
            );

            return { success: true };
        } catch (error) {
            console.error(
                `[Recovery] Error restoring ${recoveryResult.key}:`,
                error
            );
            return {
                success: false,
                error: String(error)
            };
        }
    }

    /**
     * Gets a human-readable source name
     */
    public getSourceDisplayName(source: RecoveryResult['source']): string {
        switch (source) {
            case 'current':
                return 'Current Storage';
            case 'unprefixed-local':
                return 'Legacy Local Keychain';
            case 'unprefixed-cloud':
                return 'iCloud Keychain';
            case 'encrypted-storage':
                return 'Legacy Encrypted Storage';
            default:
                return 'Unknown';
        }
    }

    /**
     * Parses settings data to extract node information for display
     */
    public parseSettingsPreview(data: string): {
        nodeCount: number;
        nodeNames: string[];
        selectedNode: number;
    } | null {
        try {
            const settings = JSON.parse(data);
            const nodes = settings.nodes || [];
            return {
                nodeCount: nodes.length,
                nodeNames: nodes.map(
                    (n: Node, i: number) =>
                        n.nickname || n.host || `Node ${i + 1}`
                ),
                selectedNode: settings.selectedNode || 0
            };
        } catch {
            return null;
        }
    }

    /**
     * DEV ONLY: Copies current wallet configs to all legacy storage locations for testing
     */
    public async copyToLegacyLocations(): Promise<{
        success: boolean;
        locations: string[];
        error?: string;
    }> {
        console.log(
            '[Recovery DEV] Copying current settings to legacy locations...'
        );

        const locations: string[] = [];

        try {
            // Read current settings
            const currentData = await this.readFromCurrentStorage(STORAGE_KEY);
            if (!currentData) {
                return {
                    success: false,
                    locations: [],
                    error: 'No current settings found to copy'
                };
            }

            // Copy to unprefixed local keychain
            try {
                await Keychain.setInternetCredentials(
                    STORAGE_KEY,
                    STORAGE_KEY,
                    currentData
                );
                locations.push('unprefixed-local');
                console.log(
                    '[Recovery DEV] Copied to unprefixed local keychain'
                );
            } catch (e) {
                console.warn(
                    '[Recovery DEV] Failed to copy to unprefixed local:',
                    e
                );
            }

            // Copy to unprefixed cloud keychain (iOS only)
            if (Platform.OS === 'ios') {
                try {
                    await Keychain.setInternetCredentials(
                        STORAGE_KEY,
                        STORAGE_KEY,
                        currentData,
                        { cloudSync: true }
                    );
                    locations.push('unprefixed-cloud');
                    console.log(
                        '[Recovery DEV] Copied to unprefixed cloud keychain'
                    );
                } catch (e) {
                    console.warn(
                        '[Recovery DEV] Failed to copy to unprefixed cloud:',
                        e
                    );
                }
            }

            // Copy to EncryptedStorage
            try {
                await EncryptedStorage.setItem(STORAGE_KEY, currentData);
                locations.push('encrypted-storage');
                console.log('[Recovery DEV] Copied to EncryptedStorage');
            } catch (e) {
                console.warn(
                    '[Recovery DEV] Failed to copy to EncryptedStorage:',
                    e
                );
            }

            console.log(
                `[Recovery DEV] Copied to ${locations.length} legacy locations`
            );

            return {
                success: locations.length > 0,
                locations
            };
        } catch (error) {
            console.error(
                '[Recovery DEV] Error copying to legacy locations:',
                error
            );
            return {
                success: false,
                locations,
                error: String(error)
            };
        }
    }

    /**
     * DEV ONLY: Clears all legacy storage locations
     * IMPORTANT: Backs up and restores current settings to prevent accidental data loss
     */
    public async clearLegacyLocations(): Promise<{
        success: boolean;
        cleared: string[];
        error?: string;
    }> {
        console.log('[Recovery DEV] Clearing legacy storage locations...');

        const cleared: string[] = [];

        try {
            // CRITICAL: Back up current settings first
            const currentSettings = await this.readFromCurrentStorage(
                STORAGE_KEY
            );
            console.log(
                '[Recovery DEV] Backed up current settings:',
                currentSettings ? 'yes' : 'no'
            );

            // Clear unprefixed local keychain
            try {
                await Keychain.resetInternetCredentials({
                    server: STORAGE_KEY
                });
                cleared.push('unprefixed-local');
                console.log('[Recovery DEV] Cleared unprefixed local keychain');
            } catch (e) {
                console.warn(
                    '[Recovery DEV] Failed to clear unprefixed local:',
                    e
                );
            }

            // Clear unprefixed cloud keychain (iOS only)
            if (Platform.OS === 'ios') {
                try {
                    await Keychain.resetInternetCredentials({
                        server: STORAGE_KEY,
                        cloudSync: true
                    });
                    cleared.push('unprefixed-cloud');
                    console.log(
                        '[Recovery DEV] Cleared unprefixed cloud keychain'
                    );
                } catch (e) {
                    console.warn(
                        '[Recovery DEV] Failed to clear unprefixed cloud:',
                        e
                    );
                }
            }

            // Clear EncryptedStorage
            try {
                await EncryptedStorage.removeItem(STORAGE_KEY);
                cleared.push('encrypted-storage');
                console.log('[Recovery DEV] Cleared EncryptedStorage');
            } catch (e) {
                console.warn(
                    '[Recovery DEV] Failed to clear EncryptedStorage:',
                    e
                );
            }

            // CRITICAL: Verify current settings still exist, restore if lost
            const verifySettings = await this.readFromCurrentStorage(
                STORAGE_KEY
            );
            if (!verifySettings && currentSettings) {
                console.warn(
                    '[Recovery DEV] Current settings were lost! Restoring...'
                );
                await Storage.setItem(STORAGE_KEY, currentSettings);
                const restored = await this.readFromCurrentStorage(STORAGE_KEY);
                if (restored) {
                    console.log(
                        '[Recovery DEV] Successfully restored current settings'
                    );
                } else {
                    console.error(
                        '[Recovery DEV] Failed to restore current settings!'
                    );
                    return {
                        success: false,
                        cleared,
                        error: 'Current settings were lost and could not be restored'
                    };
                }
            }

            console.log(
                `[Recovery DEV] Cleared ${cleared.length} legacy locations`
            );

            return {
                success: cleared.length > 0,
                cleared
            };
        } catch (error) {
            console.error(
                '[Recovery DEV] Error clearing legacy locations:',
                error
            );
            return {
                success: false,
                cleared,
                error: String(error)
            };
        }
    }
}

const keychainRecoveryUtils = new KeychainRecoveryUtils();
export default keychainRecoveryUtils;
