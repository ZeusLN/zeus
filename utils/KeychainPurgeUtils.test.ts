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
    autoPurgeLegacyKeychain
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
            expect(result.skipped).toEqual([]);
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
            expect(result.failures).toEqual([]);
            expect(result.skipped).toEqual(['zeus:zeus-settings-v2']);
        });

        it('skips an unprefixed entry with no migrated counterpart', async () => {
            // The unprefixed entry exists, but nothing was ever migrated to
            // the zeus: namespace for it: it may be the only copy.
            StorageModule.getRawItem.mockImplementation(
                async (server: string) =>
                    server.startsWith('zeus:') ? null : 'orphan-value'
            );

            const result = await executePurge({
                syncServers: ['note-key-2'],
                legacyLocalServers: ['note-key-1'],
                hasLegacyEncryptedSettings: false
            });

            expect(StorageModule.removeRawItem).not.toHaveBeenCalled();
            expect(result.deleted).toBe(0);
            expect(result.failures).toEqual([]);
            expect(result.skipped).toEqual(['note-key-1', 'note-key-2']);
        });

        it('maps the legacy settings blob to its v2 counterpart', async () => {
            // zeus-settings has no zeus:zeus-settings counterpart; its
            // migrated successor is zeus:zeus-settings-v2
            StorageModule.getRawItem.mockImplementation(
                async (server: string) =>
                    server === 'zeus:zeus-settings-v2' ||
                    server === 'zeus-settings'
                        ? 'value'
                        : null
            );

            const result = await executePurge({
                syncServers: [],
                legacyLocalServers: ['zeus-settings'],
                hasLegacyEncryptedSettings: false
            });

            expect(StorageModule.removeRawItem).toHaveBeenCalledWith(
                'zeus-settings',
                false
            );
            expect(result.deleted).toBe(1);
            expect(result.skipped).toEqual([]);
        });

        it('deletes retired cashu seed bytes once the seed phrase is migrated', async () => {
            // CashuStore deletes zeus:lnd-cashu-seed on every CDK start, so
            // the seed phrase is the only counterpart that can still exist
            StorageModule.getRawItem.mockImplementation(
                async (server: string) =>
                    server === 'zeus:lnd-cashu-seed-phrase' ||
                    server === 'lnd-cashu-seed'
                        ? 'value'
                        : null
            );

            const result = await executePurge({
                syncServers: ['lnd-cashu-seed'],
                legacyLocalServers: ['lnd-cashu-seed'],
                hasLegacyEncryptedSettings: false
            });

            expect(StorageModule.removeRawItem.mock.calls).toEqual([
                ['lnd-cashu-seed', false],
                ['lnd-cashu-seed', true]
            ]);
            expect(result.deleted).toBe(2);
            expect(result.skipped).toEqual([]);
        });

        it('still deletes cashu seed bytes whose own migrated copy exists', async () => {
            StorageModule.getRawItem.mockImplementation(
                async (server: string) =>
                    server === 'zeus:lnd-cashu-seed' ||
                    server === 'lnd-cashu-seed'
                        ? 'value'
                        : null
            );

            const result = await executePurge({
                syncServers: ['lnd-cashu-seed'],
                legacyLocalServers: [],
                hasLegacyEncryptedSettings: false
            });

            expect(StorageModule.removeRawItem).toHaveBeenCalledWith(
                'lnd-cashu-seed',
                true
            );
            expect(result.skipped).toEqual([]);
        });

        it('skips cashu seed bytes with neither a copy nor a seed phrase', async () => {
            StorageModule.getRawItem.mockImplementation(
                async (server: string) =>
                    server.startsWith('zeus:') ? null : 'orphan-value'
            );

            const result = await executePurge({
                syncServers: ['lnd-cashu-seed'],
                legacyLocalServers: [],
                hasLegacyEncryptedSettings: false
            });

            expect(StorageModule.removeRawItem).not.toHaveBeenCalled();
            expect(result.skipped).toEqual(['lnd-cashu-seed']);
        });

        it('deletes the legacy xprv cache without a counterpart', async () => {
            // Never migrated, and derived from the wallet seed
            StorageModule.getRawItem.mockImplementation(
                async (server: string) =>
                    server.startsWith('zeus:') ? null : 'xprv-cache'
            );

            const result = await executePurge({
                syncServers: ['02aa-extended-private-keys'],
                legacyLocalServers: ['02bb-extended-private-keys'],
                hasLegacyEncryptedSettings: false
            });

            expect(StorageModule.removeRawItem.mock.calls).toEqual([
                ['02bb-extended-private-keys', false],
                ['02aa-extended-private-keys', true]
            ]);
            expect(result.deleted).toBe(2);
            expect(result.skipped).toEqual([]);
        });

        it('counts deletions of existing entries, not attempts', async () => {
            // Counterpart exists but the entry itself is already gone:
            // resetInternetCredentials would still succeed, and that must
            // not inflate the deleted count.
            StorageModule.getRawItem.mockImplementation(
                async (server: string) =>
                    server.startsWith('zeus:') ? 'value' : null
            );

            const result = await executePurge({
                syncServers: [],
                legacyLocalServers: ['gone-key'],
                hasLegacyEncryptedSettings: false
            });

            expect(StorageModule.removeRawItem).toHaveBeenCalledWith(
                'gone-key',
                false
            );
            expect(result.deleted).toBe(0);
            expect(result.failures).toEqual([]);
            expect(result.skipped).toEqual([]);
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
            expect(result.skipped).toEqual([]);
        });
    });

    describe('executePurge legacy LNC entries', () => {
        const lncSettings = (...phrases: string[]) =>
            JSON.stringify({
                nodes: phrases.map((pairingPhrase) => ({
                    implementation: 'lightning-node-connect',
                    pairingPhrase
                }))
            });
        const scan = {
            syncServers: [],
            legacyLocalServers: [],
            hasLegacyEncryptedSettings: true
        };
        let encrypted: Map<string, string>;

        beforeEach(() => {
            encrypted = new Map();
            EncryptedStorage.getItem.mockImplementation(
                async (key: string) => encrypted.get(key) ?? null
            );
            EncryptedStorage.removeItem.mockImplementation(
                async (key: string) => {
                    if (!encrypted.has(key)) throw new Error('not found');
                    encrypted.delete(key);
                }
            );
        });

        it("removes a deleted wallet's entries named in the legacy blob", async () => {
            encrypted.set('zeus-settings', lncSettings('deleted phrase'));
            encrypted.set('lnc-rn:hashed(deleted phrase)', '{"localKey":"a"}');
            encrypted.set('lnc-rn:hashed(deleted phrase):host', 'host:443');
            StorageModule.getItem.mockResolvedValue(lncSettings());

            const result = await executePurge(scan);

            expect([...encrypted.keys()]).toEqual([]);
            expect(result.deleted).toBe(3);
            expect(result.failures).toEqual([]);
            expect(result.skipped).toEqual([]);
        });

        it("removes a configured wallet's entries once the keychain has them", async () => {
            encrypted.set('lnc-rn:hashed(live phrase)', '{"localKey":"a"}');
            StorageModule.getItem.mockResolvedValue(lncSettings('live phrase'));
            StorageModule.getRawItem.mockImplementation(
                async (server: string) =>
                    server === 'zeus:lnc-rn:hashed(live phrase)' ? 'copy' : null
            );

            const result = await executePurge({
                ...scan,
                hasLegacyEncryptedSettings: false
            });

            expect(encrypted.has('lnc-rn:hashed(live phrase)')).toBe(false);
            expect(result.deleted).toBe(1);
            expect(result.skipped).toEqual([]);
        });

        it("keeps a configured wallet's entry that has no keychain copy", async () => {
            encrypted.set('zeus-settings', lncSettings('live phrase'));
            encrypted.set('lnc-rn:hashed(live phrase)', '{"localKey":"a"}');
            StorageModule.getItem.mockResolvedValue(lncSettings('live phrase'));

            const result = await executePurge(scan);

            expect(encrypted.has('lnc-rn:hashed(live phrase)')).toBe(true);
            expect(result.skipped).toEqual(['lnc-rn:hashed(live phrase)']);
            expect(encrypted.has('zeus-settings')).toBe(false);
        });

        it('keeps every entry without a keychain copy when live settings are unreadable', async () => {
            encrypted.set('zeus-settings', lncSettings('some phrase'));
            encrypted.set('lnc-rn:hashed(some phrase)', '{"localKey":"a"}');
            StorageModule.getItem.mockResolvedValue(false);

            const result = await executePurge(scan);

            expect(encrypted.has('lnc-rn:hashed(some phrase)')).toBe(true);
            expect(result.skipped).toEqual(['lnc-rn:hashed(some phrase)']);
        });

        it('keeps the legacy blob when an entry it names fails to delete', async () => {
            encrypted.set('zeus-settings', lncSettings('deleted phrase'));
            encrypted.set('lnc-rn:hashed(deleted phrase)', '{"localKey":"a"}');
            StorageModule.getItem.mockResolvedValue(lncSettings());
            EncryptedStorage.removeItem.mockImplementation(
                async (key: string) => {
                    if (key.startsWith('lnc-rn:')) throw new Error('boom');
                    encrypted.delete(key);
                }
            );

            const result = await executePurge(scan);

            expect(encrypted.has('zeus-settings')).toBe(true);
            expect(result.failures).toEqual(['lnc-rn:hashed(deleted phrase)']);
        });
    });

    describe('autoPurgeLegacyKeychain', () => {
        it('never runs off iOS', async () => {
            Platform.OS = 'android';

            await autoPurgeLegacyKeychain();

            expect(EncryptedStorage.getItem).not.toHaveBeenCalled();
            expect(StorageModule.removeRawItem).not.toHaveBeenCalled();
        });

        it('waits for the desync migration to complete', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);

            await autoPurgeLegacyKeychain();

            expect(
                StorageModule.getInternetPasswordServers
            ).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).not.toHaveBeenCalled();
        });

        it('does not rescan once the done flag is set', async () => {
            EncryptedStorage.getItem.mockResolvedValue('true');

            await autoPurgeLegacyKeychain();

            expect(
                StorageModule.getInternetPasswordServers
            ).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).not.toHaveBeenCalled();
        });

        it('runs again on installs flagged done by the v1 pass', async () => {
            EncryptedStorage.getItem.mockImplementation(async (key: string) =>
                key === 'keychain-desync-v1' || key === 'keychain-autopurge-v1'
                    ? 'true'
                    : null
            );

            await autoPurgeLegacyKeychain();

            expect(StorageModule.getInternetPasswordServers).toHaveBeenCalled();
        });

        it('sets the done flag without deleting when nothing is found', async () => {
            EncryptedStorage.getItem.mockImplementation(async (key: string) =>
                key === 'keychain-desync-v1' ? 'true' : null
            );

            await autoPurgeLegacyKeychain();

            expect(StorageModule.removeRawItem).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'keychain-autopurge-v2',
                'true'
            );
        });

        it('retries on a later boot when the scan throws', async () => {
            EncryptedStorage.getItem.mockImplementation(async (key: string) =>
                key === 'keychain-desync-v1' ? 'true' : null
            );
            StorageModule.getInternetPasswordServers.mockRejectedValue(
                new Error('boom')
            );

            await autoPurgeLegacyKeychain();

            expect(StorageModule.removeRawItem).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).not.toHaveBeenCalled();
        });

        it('defers without deleting when the preflight fails', async () => {
            EncryptedStorage.getItem.mockImplementation(async (key: string) =>
                key === 'keychain-desync-v1' ? 'true' : null
            );
            StorageModule.getInternetPasswordServers.mockImplementation(
                async (synchronizable: boolean) =>
                    synchronizable ? ['zeus:zeus-settings-v2'] : []
            );
            StorageModule.getItem.mockResolvedValue(null); // no live blob

            await autoPurgeLegacyKeychain();

            expect(StorageModule.removeRawItem).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).not.toHaveBeenCalled();
        });

        it('purges candidates and sets the done flag on a clean pass', async () => {
            EncryptedStorage.getItem.mockImplementation(async (key: string) =>
                key === 'keychain-desync-v1' ? 'true' : null
            );
            StorageModule.getInternetPasswordServers.mockImplementation(
                async (synchronizable: boolean) =>
                    synchronizable ? ['zeus:zeus-settings-v2'] : []
            );
            StorageModule.getItem.mockResolvedValue('{"nodes":[]}');
            StorageModule.getRawItem.mockImplementation(
                async (server: string, cloudSync: boolean) =>
                    server === 'zeus:zeus-settings-v2'
                        ? cloudSync
                            ? 'sync-blob'
                            : 'local-blob'
                        : null
            );

            await autoPurgeLegacyKeychain();

            expect(StorageModule.removeRawItem).toHaveBeenCalledWith(
                'zeus:zeus-settings-v2',
                true
            );
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'keychain-autopurge-v2',
                'true'
            );
        });

        it('leaves the done flag unset when a deletion fails', async () => {
            EncryptedStorage.getItem.mockImplementation(async (key: string) =>
                key === 'keychain-desync-v1' ? 'true' : null
            );
            StorageModule.getInternetPasswordServers.mockImplementation(
                async (synchronizable: boolean) =>
                    synchronizable ? ['zeus:zeus-settings-v2'] : []
            );
            StorageModule.getItem.mockResolvedValue('{"nodes":[]}');
            StorageModule.getRawItem.mockImplementation(
                async (server: string, cloudSync: boolean) =>
                    server === 'zeus:zeus-settings-v2'
                        ? cloudSync
                            ? 'sync-blob'
                            : 'local-blob'
                        : null
            );
            StorageModule.removeRawItem.mockRejectedValue(new Error('boom'));

            await autoPurgeLegacyKeychain();

            expect(EncryptedStorage.setItem).not.toHaveBeenCalled();
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
                // Word-boundary match: a plain substring check would let
                // SWAPS_KEY be satisfied by REVERSE_SWAPS_KEY
                expect(catalogBlock).toMatch(new RegExp(`\\b${identifier}\\b`));
            }

            // Migrated by keychainCloudSyncMigration outside the
            // migrationKeys array, so the loop above cannot see them
            expect(catalogBlock).toMatch(/\bSTORAGE_KEY\b/);
            expect(catalogBlock).toMatch(/\bNOTES_KEY\b/);

            // The dynamic derivation must mirror the migration's cashu key
            // construction (lndDir fallback and walletId composition)
            expect(purgeSource).toContain("node.lndDir || 'lnd'");
            expect(purgeSource).toContain('==');
        });
    });
});
