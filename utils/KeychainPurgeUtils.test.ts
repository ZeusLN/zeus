import * as fs from 'fs';
import * as path from 'path';

jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
}));
jest.mock('../storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    KEY_PREFIX: 'zeus:',
    getInternetPasswordServers: jest.fn().mockResolvedValue([]),
    getRawItem: jest.fn().mockResolvedValue(null),
    setRawLocalItem: jest.fn().mockResolvedValue(true),
    removeRawItem: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('./MigrationUtils', () => ({
    IS_BACKED_UP_KEY: 'backup-complete-v2',
    KEYCHAIN_DESYNC_KEY: 'keychain-desync-v1'
}));
jest.mock('../stores/SettingsStore', () => ({
    STORAGE_KEY: 'zeus-settings-v2',
    CURRENCY_CODES_KEY: 'zeus-currency-codes'
}));
jest.mock('../stores/ContactStore', () => ({
    CONTACTS_KEY: 'zeus-contacts-v2'
}));
jest.mock('../stores/NotesStore', () => ({ NOTES_KEY: 'zeus-notes-v2' }));
jest.mock('../stores/ChannelBackupStore', () => ({
    LAST_CHANNEL_BACKUP_STATUS: 'last-channel-backup-status',
    LAST_CHANNEL_BACKUP_TIME: 'last-channel-backup-time'
}));
jest.mock('../stores/LightningAddressStore', () => ({
    ADDRESS_ACTIVATED_STRING: 'zeus-pay-activated',
    HASHES_STORAGE_STRING: 'zeus-pay-hashes'
}));
jest.mock('../stores/PosStore', () => ({
    POS_HIDDEN_KEY: 'pos-hidden',
    POS_STANDALONE_KEY: 'pos-standalone'
}));
jest.mock('../stores/InventoryStore', () => ({
    CATEGORY_KEY: 'zeus-product-categories',
    PRODUCT_KEY: 'zeus-products'
}));
jest.mock('../stores/UnitsStore', () => ({ UNIT_KEY: 'zeus-units' }));
jest.mock('../stores/UTXOsStore', () => ({
    HIDDEN_ACCOUNTS_KEY: 'hidden-accounts'
}));
jest.mock('../stores/ActivityStore', () => ({
    ACTIVITY_FILTERS_KEY: 'zeus-activity-filters'
}));
jest.mock('../stores/LSPStore', () => ({ LSPS_ORDERS_KEY: 'orders' }));
jest.mock('./SwapUtils', () => ({
    SWAPS_KEY: 'swaps',
    REVERSE_SWAPS_KEY: 'reverse-swaps',
    SWAPS_RESCUE_KEY: 'swaps-rescue-key',
    SWAPS_LAST_USED_KEY: 'swaps-last-used-key'
}));
jest.mock('../backends/LNC/credentialStore', () => ({
    LNC_STORAGE_KEY: 'lnc-rn',
    hash: (value: string) => `hashed(${value})`
}));

import {
    scanPurgeCandidates,
    verifyPurgePreflight,
    executePurge,
    shouldOfferKeychainPurge
} from './KeychainPurgeUtils';

const EncryptedStorage = require('react-native-encrypted-storage');
const StorageModule = require('../storage');
const { Platform } = require('react-native');

jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
    EncryptedStorage.getItem.mockReset();
    EncryptedStorage.getItem.mockResolvedValue(null);
    EncryptedStorage.setItem.mockReset();
    EncryptedStorage.removeItem.mockReset();
    EncryptedStorage.removeItem.mockResolvedValue(undefined);
    StorageModule.getItem.mockReset();
    StorageModule.getInternetPasswordServers.mockReset();
    StorageModule.getInternetPasswordServers.mockResolvedValue([]);
    StorageModule.getRawItem.mockReset();
    StorageModule.getRawItem.mockResolvedValue(null);
    StorageModule.setRawLocalItem.mockReset();
    StorageModule.setRawLocalItem.mockResolvedValue(true);
    StorageModule.removeRawItem.mockReset();
    StorageModule.removeRawItem.mockResolvedValue(undefined);
    Platform.OS = 'ios';
});

describe('KeychainPurgeUtils', () => {
    describe('scanPurgeCandidates (iOS)', () => {
        it('returns all sync servers and only unprefixed local servers', async () => {
            StorageModule.getInternetPasswordServers.mockImplementation(
                async (synchronizable: boolean) =>
                    synchronizable
                        ? ['zeus:zeus-settings-v2', 'zeus-settings-v2']
                        : ['zeus:zeus-settings-v2', 'swaps-rescue-key']
            );

            const scan = await scanPurgeCandidates();

            expect(scan.syncServers).toEqual([
                'zeus:zeus-settings-v2',
                'zeus-settings-v2'
            ]);
            expect(scan.legacyLocalServers).toEqual(['swaps-rescue-key']);
        });

        it('reports the legacy EncryptedStorage settings blob', async () => {
            EncryptedStorage.getItem.mockImplementation(async (key: string) =>
                key === 'zeus-settings' ? '{"nodes":[]}' : null
            );

            const scan = await scanPurgeCandidates();

            expect(scan.hasLegacyEncryptedSettings).toBe(true);
        });
    });

    describe('scanPurgeCandidates (Android)', () => {
        it('probes the reconstructed catalog and derives dynamic keys', async () => {
            Platform.OS = 'android';
            const existing: Record<string, string> = {
                'zeus-settings-v2': JSON.stringify({
                    nodes: [
                        {
                            implementation: 'lightning-node-connect',
                            pairingPhrase: 'phrase'
                        },
                        { implementation: 'embedded-lnd', lndDir: 'dir1' }
                    ]
                }),
                'zeus-notes-v2': JSON.stringify(['note-key-1']),
                'note-key-1': 'hello',
                'lnc-rn:hashed(phrase)': 'creds',
                'dir1-cashu-mintUrls': JSON.stringify(['https://mint']),
                'dir1==https://mint-proofs': 'proofs',
                'swaps-rescue-key': 'rescue'
            };
            StorageModule.getRawItem.mockImplementation(
                async (server: string) => existing[server] ?? null
            );

            const scan = await scanPurgeCandidates();

            expect(scan.syncServers).toEqual([]);
            expect(scan.legacyLocalServers).toEqual(
                expect.arrayContaining([
                    'zeus-settings-v2',
                    'zeus-notes-v2',
                    'note-key-1',
                    'lnc-rn:hashed(phrase)',
                    'dir1-cashu-mintUrls',
                    'dir1==https://mint-proofs',
                    'swaps-rescue-key'
                ])
            );
            // Only entries that actually exist are listed
            expect(scan.legacyLocalServers).not.toContain('pos-hidden');
        });
    });

    describe('verifyPurgePreflight', () => {
        it('refuses when the live settings blob is missing', async () => {
            StorageModule.getItem.mockResolvedValue(false);

            const result = await verifyPurgePreflight({
                syncServers: [],
                legacyLocalServers: [],
                hasLegacyEncryptedSettings: false
            });

            expect(result).toEqual({ ok: false, reason: 'missing-settings' });
        });

        it('refuses when the live settings blob does not parse', async () => {
            StorageModule.getItem.mockResolvedValue('{"nodes":');

            const result = await verifyPurgePreflight({
                syncServers: [],
                legacyLocalServers: [],
                hasLegacyEncryptedSettings: false
            });

            expect(result).toEqual({ ok: false, reason: 'invalid-settings' });
        });

        it('copies a missing local counterpart before allowing the purge', async () => {
            StorageModule.getItem.mockResolvedValue('{"nodes":[]}');
            const local: Record<string, string> = {};
            StorageModule.getRawItem.mockImplementation(
                async (server: string, cloudSync: boolean) =>
                    cloudSync ? 'sync-value' : local[server] ?? null
            );
            StorageModule.setRawLocalItem.mockImplementation(
                async (server: string, value: string) => {
                    local[server] = value;
                    return true;
                }
            );

            const result = await verifyPurgePreflight({
                syncServers: ['zeus:zeus-notes-v2'],
                legacyLocalServers: [],
                hasLegacyEncryptedSettings: false
            });

            expect(result.ok).toBe(true);
            expect(StorageModule.setRawLocalItem).toHaveBeenCalledWith(
                'zeus:zeus-notes-v2',
                'sync-value'
            );
        });

        it('fails when the catch-up copy cannot be verified', async () => {
            StorageModule.getItem.mockResolvedValue('{"nodes":[]}');
            StorageModule.getRawItem.mockImplementation(
                async (_server: string, cloudSync: boolean) =>
                    cloudSync ? 'sync-value' : null
            );

            const result = await verifyPurgePreflight({
                syncServers: ['zeus:zeus-notes-v2'],
                legacyLocalServers: [],
                hasLegacyEncryptedSettings: false
            });

            expect(result.ok).toBe(false);
            expect(result.reason).toContain('copy-failed');
        });

        it('accepts a local copy that differs from the sync copy', async () => {
            // After desync, writes land locally, so local is the fresher copy
            StorageModule.getItem.mockResolvedValue('{"nodes":[]}');
            StorageModule.getRawItem.mockImplementation(
                async (_server: string, cloudSync: boolean) =>
                    cloudSync ? 'old-sync-value' : 'newer-local-value'
            );

            const result = await verifyPurgePreflight({
                syncServers: ['zeus:zeus-settings-v2'],
                legacyLocalServers: [],
                hasLegacyEncryptedSettings: false
            });

            expect(result.ok).toBe(true);
            expect(StorageModule.setRawLocalItem).not.toHaveBeenCalled();
        });
    });

    describe('executePurge', () => {
        it('deletes stale copies first and zeus: sync entries last', async () => {
            const order: string[] = [];
            StorageModule.removeRawItem.mockImplementation(
                async (server: string, cloudSync: boolean) => {
                    order.push(`${cloudSync ? 'sync' : 'local'}:${server}`);
                }
            );
            StorageModule.getRawItem.mockResolvedValue('value');
            EncryptedStorage.removeItem.mockImplementation(async () => {
                order.push('encrypted-storage:zeus-settings');
            });

            const result = await executePurge({
                syncServers: ['zeus:zeus-settings-v2', 'zeus-settings-v2'],
                legacyLocalServers: ['swaps-rescue-key'],
                hasLegacyEncryptedSettings: true
            });

            expect(order).toEqual([
                'local:swaps-rescue-key',
                'sync:zeus-settings-v2',
                'sync:zeus:zeus-settings-v2',
                'encrypted-storage:zeus-settings'
            ]);
            expect(result.deleted).toBe(4);
            expect(result.failures).toEqual([]);
        });

        it('never deletes a zeus: sync entry that is the only copy', async () => {
            StorageModule.getRawItem.mockImplementation(
                async (_server: string, cloudSync: boolean) =>
                    cloudSync ? 'only-copy' : null
            );

            const result = await executePurge({
                syncServers: ['zeus:zeus-settings-v2'],
                legacyLocalServers: [],
                hasLegacyEncryptedSettings: false
            });

            expect(StorageModule.removeRawItem).not.toHaveBeenCalled();
            expect(result.deleted).toBe(0);
            expect(result.failures).toEqual(['zeus:zeus-settings-v2']);
        });

        it('aggregates failures and keeps deleting', async () => {
            StorageModule.getRawItem.mockResolvedValue('value');
            StorageModule.removeRawItem.mockImplementation(
                async (server: string) => {
                    if (server === 'bad-key') throw new Error('boom');
                }
            );

            const result = await executePurge({
                syncServers: [],
                legacyLocalServers: ['bad-key', 'good-key'],
                hasLegacyEncryptedSettings: false
            });

            expect(result.deleted).toBe(1);
            expect(result.failures).toEqual(['bad-key']);
        });
    });

    describe('shouldOfferKeychainPurge', () => {
        it('never offers off iOS', async () => {
            Platform.OS = 'android';

            expect(await shouldOfferKeychainPurge()).toBe(false);
            expect(EncryptedStorage.getItem).not.toHaveBeenCalled();
        });

        it('waits for the desync migration to complete', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);

            expect(await shouldOfferKeychainPurge()).toBe(false);
            expect(EncryptedStorage.setItem).not.toHaveBeenCalled();
        });

        it('offers exactly once when candidates exist', async () => {
            EncryptedStorage.getItem.mockImplementation(async (key: string) =>
                key === 'keychain-desync-v1' ? 'true' : null
            );
            StorageModule.getInternetPasswordServers.mockImplementation(
                async (synchronizable: boolean) =>
                    synchronizable ? ['zeus:zeus-settings-v2'] : []
            );

            expect(await shouldOfferKeychainPurge()).toBe(true);
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'keychain-purge-offer-v1',
                'true'
            );
        });

        it('consumes the offer silently when nothing is found', async () => {
            EncryptedStorage.getItem.mockImplementation(async (key: string) =>
                key === 'keychain-desync-v1' ? 'true' : null
            );

            expect(await shouldOfferKeychainPurge()).toBe(false);
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'keychain-purge-offer-v1',
                'true'
            );
        });
    });

    describe('drift guard', () => {
        it('covers every key that keychainCloudSyncMigration migrates', () => {
            const migrationSource = fs.readFileSync(
                path.join(__dirname, 'MigrationUtils.ts'),
                'utf8'
            );
            const purgeSource = fs.readFileSync(
                path.join(__dirname, 'KeychainPurgeUtils.ts'),
                'utf8'
            );

            const migrationKeysMatch = migrationSource.match(
                /const migrationKeys = \[([\s\S]*?)\]/
            );
            expect(migrationKeysMatch).toBeTruthy();
            const migrationIdentifiers = migrationKeysMatch![1]
                .split(',')
                .map((identifier) => identifier.trim())
                .filter(Boolean);
            expect(migrationIdentifiers.length).toBeGreaterThanOrEqual(19);

            const staticCatalogMatch = purgeSource.match(
                /const STATIC_LEGACY_KEYS = \[([\s\S]*?)\]/
            );
            expect(staticCatalogMatch).toBeTruthy();
            const catalogBlock = staticCatalogMatch![1];

            for (const identifier of migrationIdentifiers) {
                expect(catalogBlock).toContain(identifier);
            }

            // The dynamic derivation must mirror the migration's cashu key
            // construction (lndDir fallback and walletId composition)
            expect(purgeSource).toContain("node.lndDir || 'lnd'");
            expect(purgeSource).toContain('==');
        });
    });
});
