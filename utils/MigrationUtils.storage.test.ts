// Failure-path coverage for the two migrations that move data between
// storage backends: storageMigrationV2 (legacy EncryptedStorage -> zeus:
// keychain namespace) and keychainCloudSyncMigration (unprefixed keychain
// entries -> zeus: keychain namespace). Both backends are in-memory fakes
// and the real storage/index.ts runs on top of the keychain fake, so every
// test asserts what each store holds afterwards. retireWalletSeedRescueKey
// is also run here together with the real keychain purge
// (KeychainPurgeUtils), which reads both partitions of the same fake.
//
// Kept separate from MigrationUtils.test.ts, which mocks ../storage
// wholesale.

type Partition = 'local' | 'sync';
type KeychainOp = 'get' | 'set' | 'reset';
type Fault = (
    op: KeychainOp,
    server: string,
    partition: Partition
) => { value: any } | void;

const mockKeychain = {
    local: new Map<string, string>(),
    sync: new Map<string, string>(),
    // Lets a test throw from, or override the result of, one keychain op.
    // Return undefined to fall through to the in-memory behaviour.
    fault: null as Fault | null,
    reset() {
        this.local.clear();
        this.sync.clear();
        this.fault = null;
    }
};

const mockEncrypted = {
    data: new Map<string, string>(),
    failGet: null as ((key: string) => boolean) | null
};

jest.mock('react-native-keychain', () => {
    const partitionOf = (opts: any): Partition =>
        opts && opts.cloudSync === true ? 'sync' : 'local';
    const applyFault = (op: KeychainOp, server: string, p: Partition) =>
        mockKeychain.fault ? mockKeychain.fault(op, server, p) : undefined;
    return {
        getInternetCredentials: jest.fn(async (server: string, opts?: any) => {
            const p = partitionOf(opts);
            const injected = applyFault('get', server, p);
            if (injected) return injected.value;
            const password = mockKeychain[p].get(server);
            return password === undefined
                ? false
                : { server, username: server, password };
        }),
        setInternetCredentials: jest.fn(
            async (
                server: string,
                _username: string,
                password: string,
                opts?: any
            ) => {
                const p = partitionOf(opts);
                const injected = applyFault('set', server, p);
                if (injected) return injected.value;
                mockKeychain[p].set(server, password);
                return { service: server, storage: 'fake' };
            }
        ),
        resetInternetCredentials: jest.fn(async (opts: any) => {
            const p = partitionOf(opts);
            const injected = applyFault('reset', opts.server, p);
            if (injected) return injected.value;
            mockKeychain[p].delete(opts.server);
        })
    };
});

jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn(async (key: string) => {
        if (mockEncrypted.failGet && mockEncrypted.failGet(key)) {
            throw new Error(`EncryptedStorage read failed: ${key}`);
        }
        return mockEncrypted.data.has(key) ? mockEncrypted.data.get(key) : null;
    }),
    setItem: jest.fn(async (key: string, value: string) => {
        mockEncrypted.data.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
        mockEncrypted.data.delete(key);
    }),
    clear: jest.fn(async () => {
        mockEncrypted.data.clear();
    })
}));

jest.mock('./SleepUtils', () => ({ sleep: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn()
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: { isMigrating: false }
}));
jest.mock('../utils/BackendUtils', () => ({}));
jest.mock('../stores/ChannelBackupStore', () => ({
    LEGACY_LAST_CHANNEL_BACKUP_STATUS: 'LAST_CHANNEL_BACKUP_STATUS',
    LEGACY_LAST_CHANNEL_BACKUP_TIME: 'LAST_CHANNEL_BACKUP_TIME',
    LAST_CHANNEL_BACKUP_STATUS: 'zeus-last-channel-backup-status',
    LAST_CHANNEL_BACKUP_TIME: 'zeus-last-channel-backup-time'
}));
jest.mock('../stores/LightningAddressStore', () => ({
    LEGACY_ADDRESS_ACTIVATED_STRING: 'olympus-lightning-address',
    LEGACY_HASHES_STORAGE_STRING: 'olympus-lightning-address-hashes',
    ADDRESS_ACTIVATED_STRING: 'zeuspay-lightning-address',
    HASHES_STORAGE_STRING: 'zeuspay-lightning-address-hashes'
}));
jest.mock('../stores/LSPStore', () => ({
    LEGACY_LSPS1_ORDERS_KEY: 'orderResponses',
    LSPS_ORDERS_KEY: 'zeus-lsps1-orders'
}));
jest.mock('../stores/SettingsStore', () => ({
    STORAGE_KEY: 'zeus-settings-v2',
    LEGACY_CURRENCY_CODES_KEY: 'currency-codes',
    CURRENCY_CODES_KEY: 'zeus-currency-codes',
    DEFAULT_SETTINGS: {},
    PosEnabled: {
        Disabled: 'disabled',
        Square: 'square',
        Standalone: 'standalone'
    }
}));

import * as Keychain from 'react-native-keychain';

import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import MigrationUtils, { KEYCHAIN_DESYNC_KEY } from './MigrationUtils';
import { autoPurgeLegacyKeychain } from './KeychainPurgeUtils';
import { hash } from '../backends/LNC/credentialStore';
// The mocked store; read through require because jest.mock factories run
// before this file's own const declarations are initialised
const mockSettingsStore: { isMigrating: boolean } =
    require('../stores/Stores').settingsStore;

const SETTINGS_KEY = 'zeus-settings-v2';
const LEGACY_SETTINGS_KEY = 'zeus-settings';
const CLOUD_SYNC_FLAG = 'ios-keychain-cloud-sync-migration-v1';
const CASHU_FLAG = 'ios-keychain-cashu-fix-v1';

const local = (key: string) => mockKeychain.local.get(`zeus:${key}`);
const enc = (key: string) => mockEncrypted.data.get(key);

let consoleLogSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;
let consoleWarnSpy: jest.SpyInstance;

beforeEach(() => {
    jest.clearAllMocks();
    mockKeychain.reset();
    mockEncrypted.data.clear();
    mockEncrypted.failGet = null;
    mockSettingsStore.isMigrating = false;
    MigrationUtils.clearConfirmedFlags();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
});

describe('storageMigrationV2', () => {
    // storageMigrationV2 has no verify or delete step and no flag of its own:
    // getSettings stops calling it once zeus-settings-v2 exists. Its return
    // value is not asserted because it is false even on success (it
    // requires every task to resolve to exactly true, but Storage.setItem
    // resolves to the keychain result object) and no caller reads it.
    const LNC_PAIRING = 'alpha bravo charlie delta';
    const LNC_BASE = `lnc-rn:${hash(LNC_PAIRING)}`;
    const LNC_HOST = `${LNC_BASE}:host`;

    const SETTINGS = {
        nodes: [
            {
                implementation: 'lightning-node-connect',
                pairingPhrase: LNC_PAIRING
            }
        ],
        fiat: 'EUR'
    };

    // legacy EncryptedStorage key -> zeus: keychain key, with the value
    // seeded under the legacy key
    const LEGACY_TO_V2: Array<[string, string, string]> = [
        ['zeus-contacts', 'zeus-contacts-v2', '[{"name":"alice"}]'],
        ['olympus-lightning-address', 'zeuspay-lightning-address', 'true'],
        [
            'olympus-lightning-address-hashes',
            'zeuspay-lightning-address-hashes',
            '["h1","h2"]'
        ],
        [
            'LAST_CHANNEL_BACKUP_STATUS',
            'zeus-last-channel-backup-status',
            'SUCCESS'
        ],
        [
            'LAST_CHANNEL_BACKUP_TIME',
            'zeus-last-channel-backup-time',
            '1700000000'
        ],
        ['pos-hidden', 'zeus-pos-hidden', '["item1"]'],
        ['pos-standalone', 'zeus-pos-standalone', 'true'],
        [
            'zeus-product-categories',
            'zeus-product-categories-v2',
            '[{"id":"c1"}]'
        ],
        ['zeus-products', 'zeus-products-v2', '[{"id":"p1"}]'],
        ['zeus-units', 'zeus-units-v2', 'sats'],
        ['hidden-accounts', 'zeus-hidden-accounts', '["acct"]'],
        ['currency-codes', 'zeus-currency-codes', '["USD","EUR"]'],
        [
            'zeus-activity-filters',
            'zeus-activity-filters-v2',
            '{"lightning":true}'
        ],
        ['backup-complete', 'backup-complete-v2', 'true'],
        ['orderResponses', 'zeus-lsps1-orders', '[{"order":1}]']
    ];
    const NOTE_KEYS = ['note-a', 'note-b'];

    const seedLegacy = () => {
        mockEncrypted.data.set(LEGACY_SETTINGS_KEY, JSON.stringify(SETTINGS));
        for (const [legacy, , value] of LEGACY_TO_V2) {
            mockEncrypted.data.set(legacy, value);
        }
        mockEncrypted.data.set('note-Keys', JSON.stringify(NOTE_KEYS));
        mockEncrypted.data.set('note-a', 'first note');
        mockEncrypted.data.set('note-b', 'second note');
        mockEncrypted.data.set(LNC_BASE, '{"localKey":"lk"}');
        mockEncrypted.data.set(LNC_HOST, 'mailbox.example:443');
    };

    const expectLegacySourcesIntact = () => {
        expect(enc(LEGACY_SETTINGS_KEY)).toBe(JSON.stringify(SETTINGS));
        for (const [legacy, , value] of LEGACY_TO_V2) {
            expect(enc(legacy)).toBe(value);
        }
        expect(enc('note-Keys')).toBe(JSON.stringify(NOTE_KEYS));
        expect(enc('note-a')).toBe('first note');
        expect(enc('note-b')).toBe('second note');
        expect(enc(LNC_BASE)).toBe('{"localKey":"lk"}');
        expect(enc(LNC_HOST)).toBe('mailbox.example:443');
    };

    const expectAllMigrated = () => {
        expect(JSON.parse(local(SETTINGS_KEY)!)).toEqual(SETTINGS);
        for (const [, v2, value] of LEGACY_TO_V2) {
            expect(local(v2)).toBe(value);
        }
        expect(local('zeus-notes-v2')).toBe(JSON.stringify(NOTE_KEYS));
        expect(local('note-a')).toBe('first note');
        expect(local('note-b')).toBe('second note');
        expect(local(LNC_BASE)).toBe('{"localKey":"lk"}');
        expect(local(LNC_HOST)).toBe('mailbox.example:443');
    };

    const failWritesTo = (key: string, mode: 'throw' | 'false') => {
        mockKeychain.fault = (op, server) => {
            if (op === 'set' && server === `zeus:${key}`) {
                if (mode === 'throw') throw new Error('errSecIO');
                return { value: false };
            }
        };
    };

    it('copies every legacy key into the zeus: local namespace and keeps the sources', async () => {
        seedLegacy();

        await MigrationUtils.storageMigrationV2(SETTINGS);

        expectAllMigrated();
        expectLegacySourcesIntact();
        // Nothing goes to the synchronizable partition or to unprefixed
        // keychain servers
        expect(mockKeychain.sync.size).toBe(0);
        for (const server of mockKeychain.local.keys()) {
            expect(server.startsWith('zeus:')).toBe(true);
        }
        expect(Keychain.resetInternetCredentials).not.toHaveBeenCalled();
    });

    it('keeps the legacy value when a write throws', async () => {
        seedLegacy();
        failWritesTo('zeus-contacts-v2', 'throw');

        await MigrationUtils.storageMigrationV2(SETTINGS);

        expect(local('zeus-contacts-v2')).toBeUndefined();
        expect(enc('zeus-contacts')).toBe('[{"name":"alice"}]');
        // Independent keys still land
        expect(local('zeus-units-v2')).toBe('sats');
        expectLegacySourcesIntact();
    });

    it('keeps the legacy value when a write returns false', async () => {
        seedLegacy();
        failWritesTo('zeus-units-v2', 'false');

        await MigrationUtils.storageMigrationV2(SETTINGS);

        expect(local('zeus-units-v2')).toBeUndefined();
        expectLegacySourcesIntact();
    });

    it('keeps every note source when one note write fails', async () => {
        seedLegacy();
        failWritesTo('note-b', 'false');

        await MigrationUtils.storageMigrationV2(SETTINGS);

        expect(local('note-a')).toBe('first note');
        expect(local('note-b')).toBeUndefined();
        expectLegacySourcesIntact();
    });

    it('rejects without writing the settings blob when its write throws, so the legacy path runs again', async () => {
        seedLegacy();
        failWritesTo(SETTINGS_KEY, 'throw');

        await expect(
            MigrationUtils.storageMigrationV2(SETTINGS)
        ).rejects.toThrow('errSecIO');

        // zeus-settings-v2 is what getSettings checks to pick the modern
        // path; with it absent the next boot re-reads the legacy blob
        expect(local(SETTINGS_KEY)).toBeUndefined();
        expectLegacySourcesIntact();
    });

    it('keeps the source when the legacy read throws', async () => {
        seedLegacy();
        mockEncrypted.failGet = (key) => key === 'hidden-accounts';

        await MigrationUtils.storageMigrationV2(SETTINGS);

        expect(local('zeus-hidden-accounts')).toBeUndefined();
        expectLegacySourcesIntact();
    });

    it('is idempotent: a second run leaves the same state', async () => {
        seedLegacy();

        await MigrationUtils.storageMigrationV2(SETTINGS);
        const afterFirst = new Map(mockKeychain.local);
        await MigrationUtils.storageMigrationV2(SETTINGS);

        expect(new Map(mockKeychain.local)).toEqual(afterFirst);
        expectLegacySourcesIntact();
    });

    it('a re-run after a partial failure fills in the key that failed', async () => {
        seedLegacy();
        failWritesTo('zeus-contacts-v2', 'throw');
        await MigrationUtils.storageMigrationV2(SETTINGS);
        expect(local('zeus-contacts-v2')).toBeUndefined();

        mockKeychain.fault = null;
        await MigrationUtils.storageMigrationV2(SETTINGS);

        expectAllMigrated();
        expectLegacySourcesIntact();
    });

    it.todo(
        'BUG: a failed sibling key is never retried once zeus-settings-v2 lands, because getSettings only re-runs storageMigrationV2 while the blob is absent'
    );
});

describe('keychainCloudSyncMigration', () => {
    const LNC_PAIRING = 'echo foxtrot golf hotel';
    const LNC_BASE = `lnc-rn:${hash(LNC_PAIRING)}`;
    const LNC_HOST = `${LNC_BASE}:host`;
    const MINT_A = 'https://mint.a';
    const MINT_B = 'https://mint.b';
    // Two embedded nodes: the first has no lndDir, so it falls back to 'lnd'
    const SETTINGS = JSON.stringify({
        nodes: [
            { implementation: 'embedded-lnd' },
            { implementation: 'embedded-lnd', lndDir: 'lnd2' },
            {
                implementation: 'lightning-node-connect',
                pairingPhrase: LNC_PAIRING
            }
        ]
    });
    const CONTACTS = '[{"name":"alice"}]';
    const UNITS = 'sats';
    const NOTES = '["note-a"]';
    const NOTE_A = 'first note';
    const CASHU_SEED = 'cashu seed words';
    const CASHU_SEED_2 = 'second cashu seed words';
    // Per-mint wallet keys, enumerated from each node's own mintUrls
    const MINT_KEYS: Record<string, string> = {
        [`lnd==${MINT_A}-proofs`]: '[{"amount":8}]',
        [`lnd==${MINT_A}-counter`]: '3',
        [`lnd2==${MINT_B}-proofs`]: '[{"amount":16}]',
        [`lnd2==${MINT_B}-counter`]: '5'
    };
    // Not in lnd's mintUrls, so the migration must leave it alone
    const ORPHAN_MINT_KEY = `lnd==${MINT_B}-proofs`;

    // Pre-2026 unprefixed entries. Notes live only in the synchronizable
    // partition to exercise migrateKey's cloud fallback.
    const LEGACY_LOCAL: Record<string, string> = {
        [SETTINGS_KEY]: SETTINGS,
        'zeus-contacts-v2': CONTACTS,
        'zeus-units-v2': UNITS,
        'lnd-cashu-seed-phrase': CASHU_SEED,
        'lnd-cashu-mintUrls': JSON.stringify([MINT_A]),
        'lnd2-cashu-seed-phrase': CASHU_SEED_2,
        'lnd2-cashu-mintUrls': JSON.stringify([MINT_B]),
        ...MINT_KEYS,
        [ORPHAN_MINT_KEY]: '[{"amount":32}]',
        [LNC_BASE]: '{"localKey":"lk"}',
        [LNC_HOST]: 'mailbox.example:443'
    };
    const LEGACY_SYNC: Record<string, string> = {
        'zeus-notes-v2': NOTES,
        'note-a': NOTE_A
    };

    const seedLegacy = () => {
        for (const [k, v] of Object.entries(LEGACY_LOCAL)) {
            mockKeychain.local.set(k, v);
        }
        for (const [k, v] of Object.entries(LEGACY_SYNC)) {
            mockKeychain.sync.set(k, v);
        }
    };

    const expectSourcesIntact = () => {
        for (const [k, v] of Object.entries(LEGACY_LOCAL)) {
            expect(mockKeychain.local.get(k)).toBe(v);
        }
        for (const [k, v] of Object.entries(LEGACY_SYNC)) {
            expect(mockKeychain.sync.get(k)).toBe(v);
        }
    };

    const expectAllMigrated = () => {
        expect(local(SETTINGS_KEY)).toBe(SETTINGS);
        expect(local('zeus-contacts-v2')).toBe(CONTACTS);
        expect(local('zeus-units-v2')).toBe(UNITS);
        expect(local('zeus-notes-v2')).toBe(NOTES);
        expect(local('note-a')).toBe(NOTE_A);
        expect(local('lnd-cashu-seed-phrase')).toBe(CASHU_SEED);
        expect(local('lnd-cashu-mintUrls')).toBe(JSON.stringify([MINT_A]));
        expect(local('lnd2-cashu-seed-phrase')).toBe(CASHU_SEED_2);
        expect(local('lnd2-cashu-mintUrls')).toBe(JSON.stringify([MINT_B]));
        for (const [k, v] of Object.entries(MINT_KEYS)) {
            expect(local(k)).toBe(v);
        }
        expect(local(LNC_BASE)).toBe('{"localKey":"lk"}');
        expect(local(LNC_HOST)).toBe('mailbox.example:443');
    };

    const flagsSet = () => ({
        main: enc(CLOUD_SYNC_FLAG),
        cashu: enc(CASHU_FLAG)
    });

    // Fails every write to one zeus: key. 'drop' reports success but stores
    // nothing, which only the read-back verification can catch.
    const failWritesTo = (key: string, mode: 'throw' | 'false' | 'drop') => {
        mockKeychain.fault = (op, server) => {
            if (op === 'set' && server === `zeus:${key}`) {
                if (mode === 'throw') throw new Error('errSecIO');
                if (mode === 'false') return { value: false };
                return { value: { service: server, storage: 'fake' } };
            }
        };
    };

    it('copies every unprefixed key into zeus:, keeps the sources, and sets both flags', async () => {
        seedLegacy();

        await MigrationUtils.keychainCloudSyncMigration();

        expectAllMigrated();
        expect(local(ORPHAN_MINT_KEY)).toBeUndefined();
        expectSourcesIntact();
        expect(flagsSet()).toEqual({ main: 'true', cashu: 'true' });
        expect(mockSettingsStore.isMigrating).toBe(true);
        // Migrated copies are device-local only
        for (const server of mockKeychain.sync.keys()) {
            expect(server.startsWith('zeus:')).toBe(false);
        }
        // The delete step is disabled: nothing is ever reset
        expect(Keychain.resetInternetCredentials).not.toHaveBeenCalled();
    });

    it('does nothing once the flags are set', async () => {
        seedLegacy();
        mockEncrypted.data.set(CLOUD_SYNC_FLAG, 'true');
        mockEncrypted.data.set(CASHU_FLAG, 'true');

        await MigrationUtils.keychainCloudSyncMigration();

        expect(Keychain.getInternetCredentials).not.toHaveBeenCalled();
        expect(Keychain.setInternetCredentials).not.toHaveBeenCalled();
        expect(local(SETTINGS_KEY)).toBeUndefined();
        expectSourcesIntact();
    });

    it.each([
        ['throws', 'throw'],
        ['returns false', 'false']
    ] as const)(
        'leaves the flags unset and the sources intact when a write %s',
        async (_label, mode) => {
            seedLegacy();
            failWritesTo('zeus-contacts-v2', mode);

            // Errors are logged, not thrown, so getSettings can continue
            await expect(
                MigrationUtils.keychainCloudSyncMigration()
            ).resolves.toBeUndefined();

            expect(local('zeus-contacts-v2')).toBeUndefined();
            expectSourcesIntact();
            expect(flagsSet()).toEqual({
                main: undefined,
                cashu: undefined
            });
        }
    );

    it('leaves the flags unset and the sources intact when the verify read-back throws', async () => {
        seedLegacy();
        let written = false;
        mockKeychain.fault = (op, server) => {
            if (server !== 'zeus:zeus-contacts-v2') return;
            if (op === 'set') written = true;
            if (op === 'get' && written) throw new Error('errSecAuthFailed');
        };

        await MigrationUtils.keychainCloudSyncMigration();

        expectSourcesIntact();
        expect(flagsSet()).toEqual({ main: undefined, cashu: undefined });
    });

    it('leaves the flags unset and the sources intact when the verify read-back finds nothing', async () => {
        seedLegacy();
        failWritesTo('zeus-contacts-v2', 'drop');

        await MigrationUtils.keychainCloudSyncMigration();

        expect(local('zeus-contacts-v2')).toBeUndefined();
        expectSourcesIntact();
        expect(flagsSet()).toEqual({ main: undefined, cashu: undefined });
    });

    it('keeps the proofs source when a per-mint write fails', async () => {
        seedLegacy();
        failWritesTo(`lnd2==${MINT_B}-proofs`, 'throw');

        await MigrationUtils.keychainCloudSyncMigration();

        expect(local(`lnd2==${MINT_B}-proofs`)).toBeUndefined();
        // Keys from the first node directory were already copied
        expect(local(`lnd==${MINT_A}-proofs`)).toBe(
            MINT_KEYS[`lnd==${MINT_A}-proofs`]
        );
        expectSourcesIntact();
    });

    it.todo(
        'BUG: a per-mint write failure is caught as a mintUrls parse error, so the rest of that mint list is skipped and the Cashu flag is set'
    );

    it.todo(
        'verify read-back returning a different value than written: master only checks truthiness and sets the flag (fixed by #4736)'
    );

    it('completes with the sources intact even if the keychain would fail deletes', async () => {
        seedLegacy();
        mockKeychain.fault = (op) => {
            if (op === 'reset') throw new Error('errSecIO');
        };

        await MigrationUtils.keychainCloudSyncMigration();

        expectAllMigrated();
        expectSourcesIntact();
        expect(flagsSet()).toEqual({ main: 'true', cashu: 'true' });
    });

    it('a re-run after a failed write finishes the migration without touching keys already copied', async () => {
        seedLegacy();
        failWritesTo('zeus-contacts-v2', 'throw');
        await MigrationUtils.keychainCloudSyncMigration();
        expect(flagsSet().main).toBeUndefined();
        expect(local(SETTINGS_KEY)).toBe(SETTINGS);

        // The app wrote fresher settings between the two boots; the retry
        // must not overwrite them with the legacy copy
        const FRESH = '{"nodes":[],"fresh":true}';
        mockKeychain.local.set(`zeus:${SETTINGS_KEY}`, FRESH);
        mockKeychain.fault = null;

        await MigrationUtils.keychainCloudSyncMigration();

        expect(local(SETTINGS_KEY)).toBe(FRESH);
        expect(local('zeus-contacts-v2')).toBe(CONTACTS);
        expect(local('zeus-units-v2')).toBe(UNITS);
        expect(local('zeus-notes-v2')).toBe(NOTES);
        expect(local('note-a')).toBe(NOTE_A);
        expectSourcesIntact();
        expect(flagsSet().main).toBe('true');
    });

    it.todo(
        'BUG: an old-keychain read error is swallowed as "key absent", so the key is skipped and the flag is set'
    );

    it.todo(
        'BUG: a failed Cashu pass is never retried, because the next boot sees the main flag set and marks the Cashu flag without migrating'
    );
});

// The migration used to remove only the device-local zeus: entry. On iOS the
// keychain purge preflight then copied the synchronizable zeus: entry back
// into the local partition, so the wallet seed was the rescue key again.
describe('retireWalletSeedRescueKey with the keychain purge', () => {
    const ldkMnemonic =
        'legal winner thank year wave sausage worth useful legal winner thank yellow';
    const independentKey =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const settings = {
        nodes: [{ implementation: 'ldk-node', ldkNodeDir: 'a', ldkMnemonic }]
    };
    const RESCUE = 'zeus:swaps-rescue-key';
    const LAST_USED = 'zeus:swaps-last-used-key';
    const NOTICE = 'swaps-rescue-key-replaced';
    const asyncData = new Map<string, string>();
    let replacedOS: { restore: () => void };
    const originalKeychainAudit = NativeModules.KeychainAudit;

    // One app start: the settings load runs the migration (getSettings),
    // then the wallet view runs the purge (autoPurgeLegacyKeychain)
    const appStart = async () => {
        MigrationUtils.clearConfirmedFlags();
        await MigrationUtils.retireWalletSeedRescueKey(settings);
        await autoPurgeLegacyKeychain();
    };

    beforeEach(() => {
        replacedOS = jest.replaceProperty(Platform, 'OS', 'ios');
        NativeModules.KeychainAudit = {
            getInternetPasswordServers: async (synchronizable: boolean) =>
                Array.from(
                    mockKeychain[synchronizable ? 'sync' : 'local'].keys()
                )
        };
        asyncData.clear();
        (AsyncStorage.setItem as jest.Mock).mockImplementation(
            async (key: string, value: string) => {
                asyncData.set(key, value);
            }
        );
        (AsyncStorage.getItem as jest.Mock).mockImplementation(
            async (key: string) => asyncData.get(key) ?? null
        );
        mockKeychain.local.set(
            `zeus:${SETTINGS_KEY}`,
            JSON.stringify(settings)
        );
        mockEncrypted.data.set(KEYCHAIN_DESYNC_KEY, 'true');
    });

    afterEach(() => {
        replacedOS.restore();
        NativeModules.KeychainAudit = originalKeychainAudit;
    });

    it('keeps a wallet-seed rescue key and its index out of both partitions across the purge and the next start', async () => {
        for (const partition of [mockKeychain.local, mockKeychain.sync]) {
            partition.set(RESCUE, ldkMnemonic);
            partition.set(LAST_USED, '4');
        }
        // pre-2026 unprefixed copies of the rescue key
        mockKeychain.local.set('swaps-rescue-key', ldkMnemonic);
        mockKeychain.sync.set('swaps-rescue-key', ldkMnemonic);

        await appStart();
        await appStart();

        for (const partition of [mockKeychain.local, mockKeychain.sync]) {
            expect(partition.has(RESCUE)).toBe(false);
            expect(partition.has(LAST_USED)).toBe(false);
            expect(partition.has('swaps-rescue-key')).toBe(false);
        }
        expect(asyncData.get(NOTICE)).toBe('true');
    });

    it('does not restore a retired copy that reappears in iCloud before the purge', async () => {
        mockKeychain.local.set(RESCUE, ldkMnemonic);
        mockKeychain.local.set(LAST_USED, '4');

        await MigrationUtils.retireWalletSeedRescueKey(settings);
        // e.g. synced from another device that has not been updated yet
        mockKeychain.sync.set(RESCUE, ldkMnemonic);
        mockKeychain.sync.set(LAST_USED, '4');
        await autoPurgeLegacyKeychain();

        expect(mockKeychain.local.has(RESCUE)).toBe(false);
        expect(mockKeychain.local.has(LAST_USED)).toBe(false);
    });

    it('still copies an independent iCloud rescue key into the local partition before purging it', async () => {
        mockKeychain.sync.set(RESCUE, independentKey);
        mockKeychain.sync.set(LAST_USED, '7');

        await appStart();

        expect(mockKeychain.local.get(RESCUE)).toBe(independentKey);
        expect(mockKeychain.local.get(LAST_USED)).toBe('7');
        expect(mockKeychain.sync.has(RESCUE)).toBe(false);
        expect(asyncData.has(NOTICE)).toBe(false);
    });
});
