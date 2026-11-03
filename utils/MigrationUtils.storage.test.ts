// Failure-path coverage for the two migrations that move data between
// storage backends: storageMigrationV2 (legacy EncryptedStorage -> zeus:
// keychain namespace) and keychainCloudSyncMigration (unprefixed keychain
// entries -> zeus: keychain namespace). Both backends are in-memory fakes
// and the real storage/index.ts runs on top of the keychain fake, so every
// test asserts what each store holds afterwards.
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

import MigrationUtils from './MigrationUtils';
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

    it('leaves the Cashu flag unset when a per-mint write fails, then finishes on the next run', async () => {
        seedLegacy();
        failWritesTo(`lnd2==${MINT_B}-proofs`, 'throw');

        await MigrationUtils.keychainCloudSyncMigration();

        expect(local(`lnd2==${MINT_B}-proofs`)).toBeUndefined();
        // Keys from the first node directory were already copied
        expect(local(`lnd==${MINT_A}-proofs`)).toBe(
            MINT_KEYS[`lnd==${MINT_A}-proofs`]
        );
        expectSourcesIntact();
        // Before the fix this was caught as a mintUrls parse error and the
        // Cashu flag was set
        expect(flagsSet()).toEqual({ main: 'true', cashu: undefined });

        mockKeychain.fault = null;
        await MigrationUtils.keychainCloudSyncMigration();

        expectAllMigrated();
        expectSourcesIntact();
        expect(flagsSet()).toEqual({ main: 'true', cashu: 'true' });
    });

    it('skips a node whose mintUrls does not parse and still migrates the other node', async () => {
        seedLegacy();
        mockKeychain.local.set('lnd-cashu-mintUrls', 'not json');

        await MigrationUtils.keychainCloudSyncMigration();

        expect(local('lnd-cashu-mintUrls')).toBe('not json');
        expect(local(`lnd==${MINT_A}-proofs`)).toBeUndefined();
        expect(local(`lnd2==${MINT_B}-proofs`)).toBe(
            MINT_KEYS[`lnd2==${MINT_B}-proofs`]
        );
        expect(flagsSet()).toEqual({ main: 'true', cashu: 'true' });
    });

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

    // Throws from every read of one unprefixed (legacy) server in one
    // partition, as iOS does with errSecInteractionNotAllowed while the
    // device is locked
    const failLegacyReadsOf = (key: string, partition: Partition) => {
        mockKeychain.fault = (op, server, p) => {
            if (op === 'get' && server === key && p === partition) {
                throw new Error('errSecInteractionNotAllowed');
            }
        };
    };

    it('fresh install: sets both flags without writing anything', async () => {
        await MigrationUtils.keychainCloudSyncMigration();

        expect(flagsSet()).toEqual({ main: 'true', cashu: 'true' });
        expect(Keychain.setInternetCredentials).not.toHaveBeenCalled();
        expect(mockKeychain.local.size).toBe(0);
    });

    it('leaves the main flag unset when an old-keychain read throws, and copies the key on the next boot', async () => {
        seedLegacy();
        failLegacyReadsOf('zeus-contacts-v2', 'local');

        await expect(
            MigrationUtils.keychainCloudSyncMigration()
        ).resolves.toBeUndefined();

        expect(local('zeus-contacts-v2')).toBeUndefined();
        expect(flagsSet().main).toBeUndefined();
        // Keys around the failed one still land
        expect(local(SETTINGS_KEY)).toBe(SETTINGS);
        expect(local('zeus-units-v2')).toBe(UNITS);
        expect(local('note-a')).toBe(NOTE_A);
        expectSourcesIntact();

        // Next boot: the device is unlocked
        mockKeychain.fault = null;
        MigrationUtils.clearConfirmedFlags();
        await MigrationUtils.keychainCloudSyncMigration();

        expectAllMigrated();
        expectSourcesIntact();
        expect(flagsSet()).toEqual({ main: 'true', cashu: 'true' });
    });

    it('leaves the main flag unset when the cloud fallback read throws', async () => {
        seedLegacy();
        failLegacyReadsOf('note-a', 'sync');

        await MigrationUtils.keychainCloudSyncMigration();

        expect(local('note-a')).toBeUndefined();
        expect(local('zeus-notes-v2')).toBe(NOTES);
        expect(flagsSet().main).toBeUndefined();
        expectSourcesIntact();
    });

    it('does not fall back to the cloud copy when the local read throws', async () => {
        seedLegacy();
        // A stale synchronizable copy next to the unreadable local one
        mockKeychain.sync.set('zeus-contacts-v2', '[{"name":"stale"}]');
        failLegacyReadsOf('zeus-contacts-v2', 'local');

        await MigrationUtils.keychainCloudSyncMigration();

        expect(local('zeus-contacts-v2')).toBeUndefined();
        expect(flagsSet().main).toBeUndefined();

        mockKeychain.fault = null;
        await MigrationUtils.keychainCloudSyncMigration();

        expect(local('zeus-contacts-v2')).toBe(CONTACTS);
    });

    it('an unreadable key does not stop later keys from copying', async () => {
        seedLegacy();
        failLegacyReadsOf(SETTINGS_KEY, 'local');

        await MigrationUtils.keychainCloudSyncMigration();

        expect(local(SETTINGS_KEY)).toBeUndefined();
        expect(local('zeus-contacts-v2')).toBe(CONTACTS);
        expect(local('zeus-units-v2')).toBe(UNITS);
        expect(local('note-a')).toBe(NOTE_A);
        expect(flagsSet().main).toBeUndefined();
        expectSourcesIntact();
    });

    it('a persistent write failure stops the pass at the first key on every run', async () => {
        // Each copy waits 500 ms on iOS and the migration runs on every
        // settings load, so a storage that keeps rejecting writes must not
        // add that wait for every remaining key
        seedLegacy();
        failWritesTo(SETTINGS_KEY, 'throw');
        const { sleep } = require('./SleepUtils');

        for (let boot = 0; boot < 2; boot++) {
            (sleep as jest.Mock).mockClear();
            MigrationUtils.clearConfirmedFlags();
            await expect(
                MigrationUtils.keychainCloudSyncMigration()
            ).resolves.toBeUndefined();
            expect((sleep as jest.Mock).mock.calls.length).toBeLessThanOrEqual(
                1
            );
            expect(local(SETTINGS_KEY)).toBeUndefined();
            expect(local('zeus-contacts-v2')).toBeUndefined();
            expect(flagsSet().main).toBeUndefined();
            expect(flagsSet().cashu).toBeUndefined();
        }
        expectSourcesIntact();
    });

    it('a persistent read error retries on every run with a fixed cost and never throws', async () => {
        seedLegacy();
        failLegacyReadsOf('zeus-contacts-v2', 'local');
        const getMock = Keychain.getInternetCredentials as jest.Mock;
        const setMock = Keychain.setInternetCredentials as jest.Mock;
        const { sleep } = require('./SleepUtils');

        const reads: number[] = [];
        const writes: number[] = [];
        const sleeps: number[] = [];
        for (let boot = 0; boot < 3; boot++) {
            getMock.mockClear();
            setMock.mockClear();
            (sleep as jest.Mock).mockClear();
            MigrationUtils.clearConfirmedFlags();
            await expect(
                MigrationUtils.keychainCloudSyncMigration()
            ).resolves.toBeUndefined();
            reads.push(getMock.mock.calls.length);
            writes.push(setMock.mock.calls.length);
            sleeps.push((sleep as jest.Mock).mock.calls.length);
            expect(flagsSet().main).toBeUndefined();
        }

        // The first run copies everything else; later runs only re-check
        // (one zeus: read per key, two legacy reads for absent keys) and
        // neither write nor sleep
        expect(writes[0]).toBeGreaterThan(0);
        expect(writes.slice(1)).toEqual([0, 0]);
        expect(sleeps.slice(1)).toEqual([0, 0]);
        expect(reads[1]).toBe(reads[2]);
        expect(reads[1]).toBeLessThan(100);
        // The Cashu pass waits for the main pass, so it never ran
        expect(flagsSet().cashu).toBeUndefined();
        expect(local('lnd-cashu-seed-phrase')).toBeUndefined();
        expectSourcesIntact();
    });

    it('retries the Cashu pass on the next boot when a Cashu write failed', async () => {
        seedLegacy();
        failWritesTo('lnd-cashu-seed-phrase', 'throw');

        await MigrationUtils.keychainCloudSyncMigration();

        expect(local('lnd-cashu-seed-phrase')).toBeUndefined();
        expect(flagsSet()).toEqual({ main: 'true', cashu: undefined });
        expectSourcesIntact();

        mockKeychain.fault = null;
        MigrationUtils.clearConfirmedFlags();
        await MigrationUtils.keychainCloudSyncMigration();

        expectAllMigrated();
        expectSourcesIntact();
        expect(flagsSet()).toEqual({ main: 'true', cashu: 'true' });
    });

    describe('main flag set, Cashu flag unset', () => {
        const NEWER_MINTS = '["https://mint.newer.example"]';
        const LEGACY_MINTS = '["https://mint.legacy.example"]';
        const LEGACY_WALLET = 'lnd==https://mint.legacy.example';

        const seedMainOnly = () => {
            seedLegacy();
            mockKeychain.local.set('lnd-cashu-mintUrls', LEGACY_MINTS);
            mockKeychain.local.set(`${LEGACY_WALLET}-counter`, '7');
            // The main pass already ran on an earlier boot
            mockEncrypted.data.set(CLOUD_SYNC_FLAG, 'true');
            mockKeychain.local.set(`zeus:${SETTINGS_KEY}`, SETTINGS);
            mockKeychain.local.set(`zeus:zeus-contacts-v2`, CONTACTS);
            // The app has written a newer value since
            mockKeychain.local.set('zeus:lnd-cashu-mintUrls', NEWER_MINTS);
        };

        // seedMainOnly replaces the legacy lnd-cashu-mintUrls source
        const expectMainOnlySourcesIntact = () => {
            for (const [k, v] of Object.entries(LEGACY_LOCAL)) {
                expect(mockKeychain.local.get(k)).toBe(
                    k === 'lnd-cashu-mintUrls' ? LEGACY_MINTS : v
                );
            }
            for (const [k, v] of Object.entries(LEGACY_SYNC)) {
                expect(mockKeychain.sync.get(k)).toBe(v);
            }
        };

        it('runs the Cashu pass once without re-running the main pass or overwriting newer values', async () => {
            seedMainOnly();

            await MigrationUtils.keychainCloudSyncMigration();

            expect(local('lnd-cashu-seed-phrase')).toBe(CASHU_SEED);
            expect(local('lnd-cashu-mintUrls')).toBe(NEWER_MINTS);
            // Per-mint keys follow the zeus: mint list, not the legacy one
            expect(local(`${LEGACY_WALLET}-counter`)).toBeUndefined();
            // The second node's list has no newer copy, so its mints migrate
            expect(local(`lnd2==${MINT_B}-proofs`)).toBe(
                MINT_KEYS[`lnd2==${MINT_B}-proofs`]
            );
            // The main pass did not run: units was never copied
            expect(local('zeus-units-v2')).toBeUndefined();
            expect(flagsSet()).toEqual({ main: 'true', cashu: 'true' });
            expectMainOnlySourcesIntact();

            // Both flags set: nothing touches the keychain again
            (Keychain.getInternetCredentials as jest.Mock).mockClear();
            await MigrationUtils.keychainCloudSyncMigration();
            expect(Keychain.getInternetCredentials).not.toHaveBeenCalled();
        });

        it('is idempotent: re-running the Cashu pass leaves the same state', async () => {
            seedMainOnly();

            await MigrationUtils.keychainCloudSyncMigration();
            const afterFirst = new Map(mockKeychain.local);

            mockEncrypted.data.delete(CASHU_FLAG);
            MigrationUtils.clearConfirmedFlags();
            (Keychain.setInternetCredentials as jest.Mock).mockClear();
            await MigrationUtils.keychainCloudSyncMigration();

            expect(Keychain.setInternetCredentials).not.toHaveBeenCalled();
            expect(new Map(mockKeychain.local)).toEqual(afterFirst);
        });
    });
});
