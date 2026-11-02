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
    autoPurgeLegacyKeychain,
    liveSettingsCoverLegacy
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
            StorageModule.getRawItem.mockResolvedValue('{"nodes":[]}');
            EncryptedStorage.getItem.mockResolvedValue('{"nodes":[]}');
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
                        ? '{"nodes":[]}'
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

    describe('legacy settings blobs', () => {
        const first = {
            nickname: 'first',
            implementation: 'embedded-lnd',
            seedPhrase: ['a', 'b'],
            walletPassword: 'pw1',
            lndDir: 'dir-1'
        };
        const second = {
            nickname: 'second',
            implementation: 'embedded-lnd',
            seedPhrase: ['c', 'd'],
            walletPassword: 'pw2',
            lndDir: 'dir-2'
        };
        const remote = {
            nickname: 'remote',
            implementation: 'lnd',
            host: 'node.example',
            macaroonHex: 'abcd'
        };
        const blob = (...nodes: any[]) => JSON.stringify({ nodes });

        describe('liveSettingsCoverLegacy', () => {
            it('is true when every legacy wallet is in the live blob', () => {
                expect(
                    liveSettingsCoverLegacy(
                        blob(first),
                        blob({ ...first, nickname: 'renamed' }, second)
                    )
                ).toBe(true);
            });

            it('is false when a legacy wallet is missing from the live blob', () => {
                expect(
                    liveSettingsCoverLegacy(blob(first, second), blob(first))
                ).toBe(false);
            });

            it('is false when a wallet secret differs', () => {
                expect(
                    liveSettingsCoverLegacy(
                        blob(remote),
                        blob({ ...remote, macaroonHex: 'other' })
                    )
                ).toBe(false);
            });

            it('matches secrets per wallet, not across wallets', () => {
                // each secret of the legacy wallet exists in some live
                // wallet, but no live wallet has both
                expect(
                    liveSettingsCoverLegacy(
                        blob({ username: 'u', password: 'p' }),
                        blob(
                            { username: 'u', password: 'x' },
                            { username: 'y', password: 'p' }
                        )
                    )
                ).toBe(false);
            });

            it('is false for a legacy wallet with no secrets', () => {
                expect(
                    liveSettingsCoverLegacy(
                        blob({ implementation: 'lnd', host: 'h' }),
                        blob(remote)
                    )
                ).toBe(false);
                expect(
                    liveSettingsCoverLegacy(
                        blob({ implementation: 'lnd', host: 'h' }),
                        blob({ implementation: 'lnd', host: 'h' })
                    )
                ).toBe(false);
            });

            it('is false for the same lndhub login on another hub', () => {
                const hub = {
                    implementation: 'lndhub',
                    lndhubUrl: 'https://a',
                    username: 'u',
                    password: 'p'
                };
                expect(
                    liveSettingsCoverLegacy(
                        blob({ ...hub, lndhubUrl: 'https://b' }),
                        blob(hub)
                    )
                ).toBe(false);
                expect(
                    liveSettingsCoverLegacy(
                        blob(hub),
                        blob({ ...hub, nickname: 'renamed' })
                    )
                ).toBe(true);
            });

            it('compares host and port for lnd and cln-rest', () => {
                const lnd = { ...remote, port: '8080' };
                expect(
                    liveSettingsCoverLegacy(
                        blob(lnd),
                        blob({ ...lnd, nickname: 'renamed' })
                    )
                ).toBe(true);
                expect(
                    liveSettingsCoverLegacy(
                        blob(lnd),
                        blob({ ...lnd, host: 'other.example' })
                    )
                ).toBe(false);
                expect(
                    liveSettingsCoverLegacy(
                        blob(lnd),
                        blob({ ...lnd, port: '10009' })
                    )
                ).toBe(false);
                const cln = {
                    implementation: 'cln-rest',
                    host: 'cln.example',
                    port: '3010',
                    rune: 'r'
                };
                expect(liveSettingsCoverLegacy(blob(cln), blob(cln))).toBe(
                    true
                );
                expect(
                    liveSettingsCoverLegacy(
                        blob(cln),
                        blob({ ...cln, port: '3011' })
                    )
                ).toBe(false);
            });

            it('requires the same implementation', () => {
                expect(
                    liveSettingsCoverLegacy(
                        blob(remote),
                        blob({ ...remote, implementation: 'cln-rest' })
                    )
                ).toBe(false);
            });

            it('treats a missing implementation as lnd', () => {
                const { implementation, ...noImplementation } = remote;
                expect(implementation).toBe('lnd');
                expect(
                    liveSettingsCoverLegacy(
                        blob(noImplementation),
                        blob(remote)
                    )
                ).toBe(true);
                expect(
                    liveSettingsCoverLegacy(
                        blob(remote),
                        blob(noImplementation)
                    )
                ).toBe(true);
            });

            it('treats a missing lndDir as lnd for embedded-lnd', () => {
                const { lndDir, ...noDir } = first;
                expect(lndDir).toBe('dir-1');
                expect(
                    liveSettingsCoverLegacy(
                        blob(noDir),
                        blob({ ...first, lndDir: 'lnd' })
                    )
                ).toBe(true);
                expect(liveSettingsCoverLegacy(blob(noDir), blob(first))).toBe(
                    false
                );
            });

            it('compares ldkNodeDir for ldk-node', () => {
                const ldk = {
                    implementation: 'ldk-node',
                    ldkNodeDir: 'ldk-1',
                    ldkMnemonic: 'm'
                };
                expect(
                    liveSettingsCoverLegacy(
                        blob(ldk),
                        blob({ ...ldk, nickname: 'renamed' })
                    )
                ).toBe(true);
                expect(
                    liveSettingsCoverLegacy(
                        blob(ldk),
                        blob({ ...ldk, ldkNodeDir: 'ldk-2' })
                    )
                ).toBe(false);
            });

            it('uses the secret as identity for LNC and NWC', () => {
                const lnc = {
                    implementation: 'lightning-node-connect',
                    pairingPhrase: 'phrase'
                };
                const nwc = {
                    implementation: 'nostr-wallet-connect',
                    nostrWalletConnectUrl: 'nostr+walletconnect://x'
                };
                expect(liveSettingsCoverLegacy(blob(lnc), blob(lnc))).toBe(
                    true
                );
                expect(liveSettingsCoverLegacy(blob(nwc), blob(nwc))).toBe(
                    true
                );
            });

            it('is true for a legacy blob without wallets', () => {
                expect(liveSettingsCoverLegacy('{}', blob(first))).toBe(true);
                expect(liveSettingsCoverLegacy(blob(), blob())).toBe(true);
            });

            it('throws on a blob that does not parse', () => {
                expect(() =>
                    liveSettingsCoverLegacy('{"nodes":', blob(first))
                ).toThrow();
                expect(() =>
                    liveSettingsCoverLegacy('"text"', blob(first))
                ).toThrow();
            });
        });

        describe('executePurge', () => {
            let local: Record<string, string>;
            let sync: Record<string, string>;

            beforeEach(() => {
                local = { 'zeus:zeus-settings-v2': blob(first) };
                sync = {};
                StorageModule.getRawItem.mockImplementation(
                    async (server: string, cloudSync: boolean) =>
                        (cloudSync ? sync : local)[server] ?? null
                );
                StorageModule.removeRawItem.mockImplementation(
                    async (server: string, cloudSync: boolean) => {
                        delete (cloudSync ? sync : local)[server];
                    }
                );
            });

            const purge = (hasLegacyEncryptedSettings = false) =>
                executePurge({
                    syncServers: Object.keys(sync),
                    legacyLocalServers: Object.keys(local).filter(
                        (server) => !server.startsWith('zeus:')
                    ),
                    hasLegacyEncryptedSettings
                });

            it('keeps a synchronizable blob holding a wallet the live blob lacks', async () => {
                // v0.11 original, which the zeus: migration copied; the
                // wallet added on v0.12.0 is only in the synchronizable blob
                local['zeus-settings-v2'] = blob(first);
                sync['zeus-settings-v2'] = blob(first, second);

                const result = await purge();

                expect(local['zeus-settings-v2']).toBeUndefined();
                expect(sync['zeus-settings-v2']).toBe(blob(first, second));
                expect(result.deleted).toBe(1);
                expect(result.failures).toEqual([]);
                expect(result.skipped).toEqual(['zeus-settings-v2']);
            });

            it('keeps a device-local blob holding a wallet the live blob lacks', async () => {
                local['zeus-settings'] = blob(first, remote);

                const result = await purge();

                expect(local['zeus-settings']).toBe(blob(first, remote));
                expect(result.deleted).toBe(0);
                expect(result.skipped).toEqual(['zeus-settings']);
            });

            it('deletes legacy blobs once the live blob holds their wallets', async () => {
                local['zeus:zeus-settings-v2'] = blob(
                    { ...first, nickname: 'renamed' },
                    second
                );
                local['zeus-settings-v2'] = blob(first);
                sync['zeus-settings-v2'] = blob(first, second);

                const result = await purge();

                expect(local['zeus-settings-v2']).toBeUndefined();
                expect(sync).toEqual({});
                expect(result.deleted).toBe(2);
                expect(result.skipped).toEqual([]);
            });

            it('keeps a legacy blob holding a wallet with no secrets', async () => {
                const bare = { implementation: 'lnd', host: 'h' };
                local['zeus-settings-v2'] = blob(bare);

                const result = await purge();

                expect(local['zeus-settings-v2']).toBe(blob(bare));
                expect(result.deleted).toBe(0);
                expect(result.skipped).toEqual(['zeus-settings-v2']);
            });

            it('keeps a legacy blob that does not parse', async () => {
                local['zeus-settings-v2'] = '{"nodes":';

                const result = await purge();

                expect(local['zeus-settings-v2']).toBe('{"nodes":');
                expect(result.deleted).toBe(0);
                expect(result.skipped).toEqual(['zeus-settings-v2']);
            });

            it('keeps a legacy blob when the live blob cannot be read', async () => {
                local['zeus-settings-v2'] = blob(first);
                StorageModule.getRawItem.mockImplementation(
                    async (server: string, cloudSync: boolean) => {
                        if (server === 'zeus:zeus-settings-v2') {
                            throw new Error('keychain error');
                        }
                        return (cloudSync ? sync : local)[server] ?? null;
                    }
                );

                const result = await purge();

                expect(local['zeus-settings-v2']).toBe(blob(first));
                expect(result.skipped).toEqual(['zeus-settings-v2']);
            });

            it('keeps the EncryptedStorage blob holding a wallet the live blob lacks', async () => {
                EncryptedStorage.getItem.mockResolvedValue(blob(second));

                const result = await purge(true);

                expect(EncryptedStorage.removeItem).not.toHaveBeenCalled();
                expect(result.deleted).toBe(0);
                expect(result.skipped).toEqual(['zeus-settings']);
            });

            it('deletes the EncryptedStorage blob once the live blob holds its wallets', async () => {
                EncryptedStorage.getItem.mockResolvedValue(blob(first));

                const result = await purge(true);

                expect(EncryptedStorage.removeItem).toHaveBeenCalledWith(
                    'zeus-settings'
                );
                expect(result.deleted).toBe(1);
                expect(result.skipped).toEqual([]);
            });

            it('still deletes other legacy keys by name', async () => {
                local['zeus:zeus-contacts-v2'] = '[]';
                local['zeus-contacts-v2'] = '[{"name":"old"}]';

                const result = await purge();

                expect(local['zeus-contacts-v2']).toBeUndefined();
                expect(result.deleted).toBe(1);
            });
        });

        it('keeps the only copy of a wallet through the automatic purge', async () => {
            const local: Record<string, string> = {
                'zeus:zeus-settings-v2': blob(first),
                'zeus-settings-v2': blob(first)
            };
            const sync: Record<string, string> = {
                'zeus-settings-v2': blob(first, second)
            };
            EncryptedStorage.getItem.mockImplementation(async (key: string) =>
                key === 'keychain-desync-v1' ? 'true' : null
            );
            StorageModule.getInternetPasswordServers.mockImplementation(
                async (synchronizable: boolean) =>
                    Object.keys(synchronizable ? sync : local)
            );
            StorageModule.getItem.mockResolvedValue(blob(first));
            StorageModule.getRawItem.mockImplementation(
                async (server: string, cloudSync: boolean) =>
                    (cloudSync ? sync : local)[server] ?? null
            );
            StorageModule.removeRawItem.mockImplementation(
                async (server: string, cloudSync: boolean) => {
                    delete (cloudSync ? sync : local)[server];
                }
            );

            await autoPurgeLegacyKeychain();

            const stored = [...Object.values(local), ...Object.values(sync)];
            expect(stored.some((value) => value.includes('"pw2"'))).toBe(true);
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
