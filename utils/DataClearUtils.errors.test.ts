// Per-step failure coverage for the wipe paths in DataClearUtils (#4913).
//
// clearAllData() runs on the duress and lockout paths, so one failing step
// must not stop the steps after it. These tests run the real Storage wrapper
// against in-memory fakes of the keychain (local and iCloud partitions),
// EncryptedStorage, AsyncStorage and the filesystem, make one step reject at
// a time, and assert what is actually left behind afterward.

jest.mock('@react-native-async-storage/async-storage', () => ({
    clear: jest.fn(async () => {
        if (mockAsyncStorage.failClear) throw new Error('clear failed');
        mockAsyncStorage.items.clear();
    })
}));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn(async (key: string) => {
        if (mockEncryptedStorage.failGet) throw new Error('get failed');
        return mockEncryptedStorage.items.get(key) ?? null;
    }),
    setItem: jest.fn(async (key: string, value: string) => {
        if (mockEncryptedStorage.failSet) throw new Error('set failed');
        mockEncryptedStorage.items.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
        if (mockEncryptedStorage.failRemove) throw new Error('remove failed');
        mockEncryptedStorage.items.delete(key);
    }),
    clear: jest.fn(async () => {
        if (mockEncryptedStorage.failClear) throw new Error('clear failed');
        mockEncryptedStorage.items.clear();
    })
}));
jest.mock('react-native-blob-util', () => ({
    fs: {
        dirs: { LibraryDir: '/lib', DocumentDir: '/docs' },
        exists: jest.fn(async (path: string) => {
            if (mockFs.failExists(path)) throw new Error('exists failed');
            return mockFs.files.has(path);
        }),
        unlink: jest.fn(async (path: string) => {
            if (mockFs.failUnlink(path)) throw new Error('unlink failed');
            mockFs.files.delete(path);
        }),
        ls: jest.fn(async (dir: string) => {
            if (mockFs.failLs) throw new Error('ls failed');
            return [...mockFs.files]
                .filter((f) => f.startsWith(`${dir}/`))
                .map((f) => f.slice(dir.length + 1));
        })
    }
}));

jest.mock('../cashu-cdk', () => ({
    __esModule: true,
    default: {
        isAvailable: jest.fn().mockReturnValue(true),
        deleteWalletDatabase: jest.fn().mockResolvedValue(true),
        closeWalletDatabase: jest.fn().mockResolvedValue(true)
    }
}));
jest.mock('./LndMobileUtils', () => ({
    deleteLndWallet: jest.fn().mockResolvedValue(true)
}));
jest.mock('./LdkNodeUtils', () => ({
    deleteLdkNodeWallet: jest.fn().mockResolvedValue(undefined),
    stopLdkNode: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('./SleepUtils', () => ({
    sleep: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('./AezeedUtils', () => ({
    deriveEmbeddedNodeId: jest.fn().mockResolvedValue('02nodeid')
}));

// Store modules are imported only for their key constants
jest.mock('../stores/SettingsStore', () => ({
    STORAGE_KEY: 'zeus-settings-v2',
    CURRENCY_CODES_KEY: 'zeus-currency-codes',
    LEGACY_CURRENCY_CODES_KEY: 'currency-codes',
    FAVORITE_CURRENCIES_KEY: 'favorite-currencies'
}));
jest.mock('../stores/NotesStore', () => ({
    NOTES_KEY: 'zeus-notes-v2',
    LEGACY_NOTES_KEY: 'note-Keys'
}));
jest.mock('../stores/ContactStore', () => ({
    CONTACTS_KEY: 'zeus-contacts',
    LEGACY_CONTACTS_KEY: 'contacts'
}));
jest.mock('../stores/ChannelBackupStore', () => ({
    LAST_CHANNEL_BACKUP_STATUS: 'last-channel-backup-status',
    LAST_CHANNEL_BACKUP_TIME: 'last-channel-backup-time',
    LEGACY_LAST_CHANNEL_BACKUP_STATUS: 'lastChannelBackupStatus',
    LEGACY_LAST_CHANNEL_BACKUP_TIME: 'lastChannelBackupTime'
}));
jest.mock('../stores/LightningAddressStore', () => ({
    ADDRESS_ACTIVATED_STRING: 'address-activated',
    HASHES_STORAGE_STRING: 'hashes',
    LEGACY_ADDRESS_ACTIVATED_STRING: 'addressActivated',
    LEGACY_HASHES_STORAGE_STRING: 'hashesStorage'
}));
jest.mock('../stores/PosStore', () => ({
    POS_HIDDEN_KEY: 'pos-hidden',
    POS_STANDALONE_KEY: 'pos-standalone',
    LEGACY_POS_HIDDEN_KEY: 'posHidden',
    LEGACY_POS_STANDALONE_KEY: 'posStandalone'
}));
jest.mock('../stores/InventoryStore', () => ({
    CATEGORY_KEY: 'category',
    PRODUCT_KEY: 'product',
    LEGACY_CATEGORY_KEY: 'categoryLegacy',
    LEGACY_PRODUCT_KEY: 'productLegacy'
}));
jest.mock('../stores/UnitsStore', () => ({
    UNIT_KEY: 'unit',
    LEGACY_UNIT_KEY: 'unitLegacy'
}));
jest.mock('../stores/UTXOsStore', () => ({
    HIDDEN_ACCOUNTS_KEY: 'hidden-accounts',
    LEGACY_HIDDEN_ACCOUNTS_KEY: 'hiddenAccounts'
}));
jest.mock('../stores/LSPStore', () => ({
    LSPS_ORDERS_KEY: 'lsps-orders',
    LEGACY_LSPS1_ORDERS_KEY: 'lsps1Orders'
}));
jest.mock('../stores/ActivityStore', () => ({
    ACTIVITY_FILTERS_KEY: 'activity-filters',
    LEGACY_ACTIVITY_FILTERS_KEY: 'activityFilters'
}));
jest.mock('../utils/MigrationUtils', () => ({
    __esModule: true,
    IS_BACKED_UP_KEY: 'is-backed-up',
    default: { clearConfirmedFlags: jest.fn() }
}));
jest.mock('../utils/SwapUtils', () => ({
    SWAPS_KEY: 'swaps',
    REVERSE_SWAPS_KEY: 'reverse-swaps',
    SWAPS_RESCUE_KEY: 'swaps-rescue-key',
    SWAPS_LAST_USED_KEY: 'swaps-last-used-key',
    purgeLegacyRescueKeyFiles: jest.fn().mockResolvedValue(undefined),
    unlinkRescueKeyStagingFile: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../stores/NostrWalletConnectStore', () => ({
    NWC_CONNECTIONS_KEY: 'zeus-nwc-connections',
    NWC_CLIENT_KEYS: 'zeus-nwc-client-keys',
    NWC_SERVICE_KEYS: 'zeus-nwc-service-keys',
    NWC_CASHU_ENABLED: 'zeus-nwc-cashu-enabled',
    NWC_LUD16_ENABLED: 'zeus-nwc-lud16-enabled',
    NWC_PERSISTENT_SERVICE_ENABLED: 'persistentNWCServicesEnabled'
}));
jest.mock('../utils/RatingUtils', () => ({
    PAYMENT_COUNT_KEY: 'successfulPaymentCount',
    RATING_DISMISSED_KEY: 'ratingDismissedPermanently'
}));

import hashjs from 'hash.js';
import { NativeModules, Platform } from 'react-native';

import Storage from '../storage';
import MigrationUtils from './MigrationUtils';
import {
    clearAllData,
    clearCDKDatabase,
    clearCDKDatabaseForNode,
    clearNodeKeychainData,
    deleteNodeDataDirectoryWithRetry,
    isWipePending,
    markWipePending,
    CASHU_KEY_SUFFIXES
} from './DataClearUtils';
import { deleteLndWallet } from './LndMobileUtils';
import { deleteLdkNodeWallet } from './LdkNodeUtils';

type Partition = 'local' | 'cloud';
type FailFn = (server: string, cloud: boolean) => boolean;

const never = () => false;

const mockKeychain = {
    local: new Map<string, string>(),
    cloud: new Map<string, string>(),
    failReset: never as FailFn,
    failGet: never as FailFn
};
// ZeusSecureStorage over the fake keychain partitions. Writes are not
// recorded: every write here happens after Storage blocks writes for the wipe.
const mockSecureStorage = {
    get: jest.fn(async (server: string, cloud: boolean) => {
        if (mockKeychain.failGet(server, cloud)) {
            throw new Error(`get failed: ${server}`);
        }
        const value = (cloud ? mockKeychain.cloud : mockKeychain.local).get(
            server
        );
        return value === undefined ? null : value;
    }),
    set: jest.fn(async () => true),
    remove: jest.fn(async (server: string, cloud: boolean) => {
        if (mockKeychain.failReset(server, cloud)) {
            throw new Error(`reset failed: ${server}`);
        }
        (cloud ? mockKeychain.cloud : mockKeychain.local).delete(server);
        return true;
    }),
    listServers: jest.fn(async (_cloudSync: boolean): Promise<string[]> => []),
    wipe: jest.fn(async () => true)
};
NativeModules.ZeusSecureStorage = mockSecureStorage;

const mockEncryptedStorage = {
    items: new Map<string, string>(),
    failGet: false,
    failSet: false,
    failRemove: false,
    failClear: false
};
const mockAsyncStorage = {
    items: new Map<string, string>(),
    failClear: false
};
const mockFs = {
    files: new Set<string>(),
    failExists: never as (path: string) => boolean,
    failUnlink: never as (path: string) => boolean,
    failLs: false
};

const mockedDeleteLndWallet = deleteLndWallet as jest.Mock;
const mockedDeleteLdkNodeWallet = deleteLdkNodeWallet as jest.Mock;
const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'log').mockImplementation(() => {});

let replacedPlatformOS: { restore: () => void } | undefined;
const setPlatformOS = (os: typeof Platform.OS) => {
    replacedPlatformOS = jest.replaceProperty(Platform, 'OS', os);
};

// Every location clearKey() targets: zeus:<key> and <key>, each in the
// local and iCloud partitions
const seedEverywhere = (key: string, value: string) => {
    for (const server of [`zeus:${key}`, key]) {
        mockKeychain.local.set(server, value);
        mockKeychain.cloud.set(server, value);
    }
};
const remainingEntries = (): string[] => [
    ...[...mockKeychain.local.keys()].map((s) => `local:${s}`),
    ...[...mockKeychain.cloud.keys()].map((s) => `cloud:${s}`)
];
const failOn =
    (server: string, partition: Partition): FailFn =>
    (s, cloud) =>
        s === server && cloud === (partition === 'cloud');
const warnedAbout = (text: string) =>
    warnSpy.mock.calls.some((call) => String(call[0]).includes(text));
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

const NODES = [
    {
        implementation: 'embedded-lnd',
        lndDir: 'lnd-uuid',
        seedPhrase: ['abandon'],
        macaroonHex: 'secret-macaroon'
    },
    { implementation: 'ldk-node', ldkNodeDir: 'ldk-uuid' }
];

// A representative populated install: the settings blob with node secrets,
// a static key, per-node Cashu seed keys, the legacy EncryptedStorage blob,
// migration flags, AsyncStorage data and the Android keychain files
const seedInstall = () => {
    seedEverywhere('zeus-settings-v2', JSON.stringify({ nodes: NODES }));
    seedEverywhere('zeus-contacts', '[{"name":"alice"}]');
    seedEverywhere('swaps-rescue-key', 'rescue mnemonic');
    seedEverywhere('lnd-uuid-cashu-seed-phrase', '["lnd","seed"]');
    seedEverywhere('ldk-uuid-cashu-seed-phrase', '["ldk","seed"]');
    seedEverywhere('lnc-rn', 'lnc');
    mockEncryptedStorage.items.set('zeus-settings', '{"nodes":["legacy"]}');
    mockEncryptedStorage.items.set('lsp-taproot-mod', 'true');
    mockAsyncStorage.items.set('install-uuid', 'abc');
};

const ANDROID_DATASTORE = '/docs/../files/datastore/RN_KEYCHAIN.preferences_pb';
const ANDROID_LEGACY_PREFS = '/docs/../shared_prefs/RN_KEYCHAIN.xml';

beforeEach(() => {
    jest.clearAllMocks();
    mockKeychain.local.clear();
    mockKeychain.cloud.clear();
    mockKeychain.failReset = never;
    mockKeychain.failGet = never;
    mockEncryptedStorage.items.clear();
    mockEncryptedStorage.failGet = false;
    mockEncryptedStorage.failSet = false;
    mockEncryptedStorage.failRemove = false;
    mockEncryptedStorage.failClear = false;
    mockAsyncStorage.items.clear();
    mockAsyncStorage.failClear = false;
    mockFs.files.clear();
    mockFs.failExists = never;
    mockFs.failUnlink = never;
    mockFs.failLs = false;
    mockedDeleteLndWallet.mockResolvedValue(true);
    mockedDeleteLdkNodeWallet.mockResolvedValue(undefined);
});

afterEach(() => {
    replacedPlatformOS?.restore();
    replacedPlatformOS = undefined;
});

describe('clearAllData baseline (no failures)', () => {
    it('leaves no keychain, EncryptedStorage or AsyncStorage data behind', async () => {
        seedInstall();

        await clearAllData();

        expect(remainingEntries()).toEqual([]);
        expect([...mockEncryptedStorage.items.keys()]).toEqual([]);
        expect([...mockAsyncStorage.items.keys()]).toEqual([]);
        expect(mockedDeleteLndWallet).toHaveBeenCalledWith('lnd-uuid');
        expect(mockedDeleteLdkNodeWallet).toHaveBeenCalledWith('ldk-uuid');
        expect(MigrationUtils.clearConfirmedFlags).toHaveBeenCalled();
    });

    // Step 3 clears NOTES_KEY (it is in STORAGE_KEYS), then step 4 reads
    // NOTES_KEY to find the per-note keys, so it always reads a miss
    it.todo(
        'clears individual note entries (step 4 reads the note index after step 3 deleted it)'
    );
});

describe('clearKey: one location rejects, the others are still cleared', () => {
    it('falls back to the direct keychain reset when Storage.removeItem rejects', async () => {
        seedInstall();
        const removeSpy = jest
            .spyOn(Storage, 'removeItem')
            .mockRejectedValue(new Error('storage remove failed'));

        try {
            await expect(clearAllData()).resolves.toBeUndefined();
        } finally {
            removeSpy.mockRestore();
        }

        // The direct zeus: local reset right after it covers the same entry
        expect(remainingEntries()).toEqual([]);
        expect(warnedAbout('Error clearing Storage key zeus-settings-v2')).toBe(
            true
        );
    });

    it.each([
        ['zeus:zeus-settings-v2', 'local', 'Error clearing Storage key'],
        [
            'zeus:zeus-settings-v2',
            'cloud',
            'Error clearing prefixed cloud keychain'
        ],
        ['zeus-settings-v2', 'local', 'Error clearing local keychain'],
        ['zeus-settings-v2', 'cloud', 'Error clearing cloud keychain']
    ] as Array<[string, Partition, string]>)(
        'logs and skips a persistent reset failure on %s (%s), leaving only that entry',
        async (server, partition, warning) => {
            seedInstall();
            mockKeychain.failReset = failOn(server, partition);

            await expect(clearAllData()).resolves.toBeUndefined();

            // Nothing retries the failed location; every other location of
            // the same key and every other key is gone
            expect(remainingEntries()).toEqual([`${partition}:${server}`]);
            expect(warnedAbout(warning)).toBe(true);
            // Later wipe stages still ran
            expect([...mockEncryptedStorage.items.keys()]).toEqual([]);
            expect([...mockAsyncStorage.items.keys()]).toEqual([]);
        }
    );

    it('still completes when every keychain reset rejects', async () => {
        seedInstall();
        mockKeychain.failReset = () => true;

        await expect(clearAllData()).resolves.toBeUndefined();

        expect(mockedDeleteLndWallet).toHaveBeenCalledWith('lnd-uuid');
        expect([...mockEncryptedStorage.items.keys()]).toEqual([]);
        expect([...mockAsyncStorage.items.keys()]).toEqual([]);
    });
});

describe('clearAllData: a failing step does not stop later steps', () => {
    it('continues past an unreadable settings blob', async () => {
        seedInstall();
        mockKeychain.failGet = failOn('zeus:zeus-settings-v2', 'local');

        await expect(clearAllData()).resolves.toBeUndefined();

        expect(warnedAbout('Could not read settings')).toBe(true);
        // The blob itself and the static keys are still cleared
        expect(remainingEntries()).not.toContain('local:zeus:zeus-settings-v2');
        expect(remainingEntries()).not.toContain('local:zeus:zeus-contacts');
        expect([...mockEncryptedStorage.items.keys()]).toEqual([]);
    });

    // With no settings, clearNodeDataDirectories and clearNodeKeychainData
    // have no node list, so UUID-named LND/LDK dirs and their
    // <uuid>-cashu-* keys survive, and the blob that names them is deleted
    it.todo(
        'deletes node data directories and per-node keys when the settings blob read fails'
    );

    it('continues past a failed per-node Cashu key reset', async () => {
        seedInstall();
        mockKeychain.failReset = failOn(
            'zeus:lnd-uuid-cashu-seed-phrase',
            'cloud'
        );

        await expect(clearAllData()).resolves.toBeUndefined();

        expect(remainingEntries()).toEqual([
            'cloud:zeus:lnd-uuid-cashu-seed-phrase'
        ]);
        expect(mockedDeleteLndWallet).toHaveBeenCalledWith('lnd-uuid');
        expect(mockedDeleteLdkNodeWallet).toHaveBeenCalledWith('ldk-uuid');
    });

    it('continues past a CDK database sweep whose directory listing rejects', async () => {
        seedInstall();
        mockFs.files.add('/lib/Application Support/cashu_wallet.db');
        mockFs.failLs = true;

        await expect(clearAllData()).resolves.toBeUndefined();

        expect(warnedAbout('Error sweeping CDK database files')).toBe(true);
        expect(
            mockFs.files.has('/lib/Application Support/cashu_wallet.db')
        ).toBe(true);
        expect(mockedDeleteLndWallet).toHaveBeenCalledWith('lnd-uuid');
        expect(remainingEntries()).toEqual([]);
    });

    it('retries a rejecting LND directory deletion, then moves on to the next node and the keychain', async () => {
        seedInstall();
        mockedDeleteLndWallet.mockRejectedValue(new Error('busy'));

        await expect(clearAllData()).resolves.toBeUndefined();

        expect(mockedDeleteLndWallet).toHaveBeenCalledTimes(3);
        expect(mockedDeleteLdkNodeWallet).toHaveBeenCalledWith('ldk-uuid');
        expect(warnedAbout('Gave up deleting node data directory')).toBe(true);
        expect(remainingEntries()).toEqual([]);
        expect([...mockEncryptedStorage.items.keys()]).toEqual([]);
    });

    it('continues past AsyncStorage.clear rejecting', async () => {
        seedInstall();
        mockAsyncStorage.failClear = true;

        await expect(clearAllData()).resolves.toBeUndefined();

        expect(warnedAbout('Error clearing AsyncStorage')).toBe(true);
        expect([...mockAsyncStorage.items.keys()]).toEqual(['install-uuid']);
        // EncryptedStorage (step 6) and the step 7 keychain keys still go
        expect([...mockEncryptedStorage.items.keys()]).toEqual([]);
        expect(remainingEntries()).toEqual([]);
    });

    it('removes the legacy settings blob even when EncryptedStorage.clear rejects', async () => {
        seedInstall();
        mockEncryptedStorage.failClear = true;

        await expect(clearAllData()).resolves.toBeUndefined();

        expect(warnedAbout('Error clearing EncryptedStorage')).toBe(true);
        expect(mockEncryptedStorage.items.has('zeus-settings')).toBe(false);
        // Migration flags stay (the clear failed) and the in-memory flag
        // cache is not reset, since both share one try block
        expect(mockEncryptedStorage.items.has('lsp-taproot-mod')).toBe(true);
        expect(MigrationUtils.clearConfirmedFlags).not.toHaveBeenCalled();
        // Step 7 still runs after the failed step 6
        expect(remainingEntries()).toEqual([]);
    });

    it('still runs step 7 and the backing-store deletion when EncryptedStorage.removeItem rejects', async () => {
        setPlatformOS('android');
        seedInstall();
        mockFs.files.add(ANDROID_DATASTORE);
        mockEncryptedStorage.failRemove = true;

        await expect(clearAllData()).resolves.toBeUndefined();

        expect(warnedAbout('Error clearing legacy settings')).toBe(true);
        expect(remainingEntries()).toEqual([]);
        expect(mockFs.files.has(ANDROID_DATASTORE)).toBe(false);
    });

    // removeItem('zeus-settings') and clear() share one try block, so a
    // rejected removeItem skips clear() and leaves the legacy settings blob
    // (node configs with seeds and macaroons) in EncryptedStorage
    it.todo(
        'clears EncryptedStorage, including the legacy zeus-settings blob, when removeItem rejects'
    );

    it.each([
        [
            'checking',
            (path: string) => {
                mockFs.failExists = (p) => p === path;
            }
        ],
        [
            'deleting',
            (path: string) => {
                mockFs.failUnlink = (p) => p === path;
            }
        ]
    ] as Array<[string, (path: string) => void]>)(
        'deletes the second Android keychain file when %s the first rejects',
        async (_step, failOnPath) => {
            setPlatformOS('android');
            mockFs.files.add(ANDROID_DATASTORE);
            mockFs.files.add(ANDROID_LEGACY_PREFS);
            failOnPath(ANDROID_DATASTORE);

            await expect(clearAllData()).resolves.toBeUndefined();

            expect(mockFs.files.has(ANDROID_DATASTORE)).toBe(true);
            expect(mockFs.files.has(ANDROID_LEGACY_PREFS)).toBe(false);
            expect(warnedAbout('Error deleting keychain backing store')).toBe(
                true
            );
        }
    );

    it('resolves when every storage layer and the filesystem reject', async () => {
        setPlatformOS('android');
        seedInstall();
        mockKeychain.failReset = () => true;
        mockKeychain.failGet = () => true;
        mockEncryptedStorage.failRemove = true;
        mockEncryptedStorage.failClear = true;
        mockAsyncStorage.failClear = true;
        mockFs.failExists = () => true;
        mockFs.failUnlink = () => true;
        mockFs.failLs = true;

        // The wipe UI must never see an error (it would reveal the duress
        // path), so the contract is: log and resolve
        await expect(clearAllData()).resolves.toBeUndefined();
    });
});

describe('clearNodeKeychainData step failures', () => {
    const node = {
        implementation: 'embedded-lnd',
        lndDir: 'lnd-uuid',
        pairingPhrase: 'pair words'
    };
    const lncKey = `lnc-rn:${hashjs
        .sha256()
        .update('pair words')
        .digest('hex')}`;

    it('clears the remaining Cashu suffixes and LNC credentials after one key reset rejects', async () => {
        for (const suffix of CASHU_KEY_SUFFIXES) {
            seedEverywhere(`lnd-uuid-cashu-${suffix}`, 'x');
        }
        seedEverywhere(lncKey, 'lnc');
        seedEverywhere(`${lncKey}:host`, 'host');
        mockKeychain.failReset = failOn('lnd-uuid-cashu-seed-phrase', 'local');

        await expect(clearNodeKeychainData(node)).resolves.toBeUndefined();

        expect(remainingEntries()).toEqual([
            'local:lnd-uuid-cashu-seed-phrase'
        ]);
    });

    it('still clears the suffix keys when reading the legacy mint list rejects', async () => {
        for (const suffix of CASHU_KEY_SUFFIXES) {
            seedEverywhere(`lnd-uuid-cashu-${suffix}`, 'x');
        }
        mockKeychain.failGet = failOn('zeus:lnd-uuid-cashu-mintUrls', 'local');

        await expect(clearNodeKeychainData(node)).resolves.toBeUndefined();

        expect(warnedAbout('Error reading Cashu mint list for lnd-uuid')).toBe(
            true
        );
        expect(remainingEntries()).toEqual([]);
    });

    it('still clears the per-mint keys after one of them fails to reset', async () => {
        const mint = 'https://mint.example';
        seedEverywhere('lnd-uuid-cashu-mintUrls', JSON.stringify([mint]));
        const walletKeys = ['mintInfo', 'counter', 'proofs', 'balance'].map(
            (k) => `lnd-uuid==${mint}-${k}`
        );
        walletKeys.forEach((k) => seedEverywhere(k, 'x'));
        mockKeychain.failReset = failOn(`zeus:${walletKeys[0]}`, 'cloud');

        await expect(clearNodeKeychainData(node)).resolves.toBeUndefined();

        expect(remainingEntries()).toEqual([`cloud:zeus:${walletKeys[0]}`]);
    });
});

describe('clearCDKDatabase / clearCDKDatabaseForNode step failures', () => {
    const dir = '/lib/Application Support';

    it('clearCDKDatabase resolves without deleting anything when listing rejects', async () => {
        mockFs.files.add(`${dir}/cashu_wallet.db`);
        mockFs.failLs = true;

        await expect(clearCDKDatabase()).resolves.toBeUndefined();

        expect(mockFs.files.has(`${dir}/cashu_wallet.db`)).toBe(true);
        expect(warnedAbout('Error sweeping CDK database files')).toBe(true);
    });

    it('clearCDKDatabase still deletes the other database files when one unlink rejects', async () => {
        const db = `${dir}/cashu_wallet.db`;
        [db, `${db}-wal`, `${db}-shm`].forEach((f) => mockFs.files.add(f));
        mockFs.failUnlink = (path) => path === db;

        await expect(clearCDKDatabase()).resolves.toBeUndefined();

        expect([...mockFs.files]).toEqual([db]);
        expect(
            warnedAbout('Error deleting CDK database file cashu_wallet.db')
        ).toBe(true);
    });

    it('clearCDKDatabaseForNode resolves and deletes nothing when the seed read rejects', async () => {
        mockFs.files.add(`${dir}/cashu_wallet_0123.db`);
        mockKeychain.failGet = () => true;

        await expect(
            clearCDKDatabaseForNode({
                implementation: 'embedded-lnd',
                lndDir: 'lnd-uuid'
            })
        ).resolves.toBeUndefined();

        expect(mockFs.files.size).toBe(1);
        expect(warnedAbout('Error clearing CDK database for node')).toBe(true);
    });

    it.each([
        [
            'check',
            (path: string) => {
                mockFs.failExists = (p) => p === path;
            }
        ],
        [
            'unlink',
            (path: string) => {
                mockFs.failUnlink = (p) => p === path;
            }
        ]
    ] as Array<[string, (path: string) => void]>)(
        'clearCDKDatabaseForNode still deletes the WAL and SHM sidecars when the main file %s rejects',
        async (_step, failOnPath) => {
            const words = ['one', 'two'];
            seedEverywhere('lnd-uuid-cashu-seed-phrase', JSON.stringify(words));
            const hash = hashjs
                .sha256()
                .update(words.join(' '))
                .digest('hex')
                .slice(0, 16);
            const base = `${dir}/cashu_wallet_${hash}.db`;
            [base, `${base}-wal`, `${base}-shm`].forEach((f) =>
                mockFs.files.add(f)
            );
            failOnPath(base);

            await expect(
                clearCDKDatabaseForNode({
                    implementation: 'embedded-lnd',
                    lndDir: 'lnd-uuid'
                })
            ).resolves.toBeUndefined();

            expect([...mockFs.files]).toEqual([base]);
            expect(
                warnedAbout(`Error deleting CDK wallet database ${base}`)
            ).toBe(true);
        }
    );
});

describe('deleteNodeDataDirectoryWithRetry rejections', () => {
    it('recovers when deleteLndWallet rejects once and then succeeds', async () => {
        mockedDeleteLndWallet
            .mockRejectedValueOnce(new Error('busy'))
            .mockResolvedValueOnce(true);

        await expect(
            deleteNodeDataDirectoryWithRetry({
                implementation: 'embedded-lnd',
                lndDir: 'lnd-uuid'
            })
        ).resolves.toBe(true);
        expect(mockedDeleteLndWallet).toHaveBeenCalledTimes(2);
    });

    it('returns false instead of throwing when every attempt rejects', async () => {
        mockedDeleteLdkNodeWallet.mockRejectedValue(new Error('busy'));

        await expect(
            deleteNodeDataDirectoryWithRetry({
                implementation: 'ldk-node',
                ldkNodeDir: 'ldk-uuid'
            })
        ).resolves.toBe(false);
        expect(mockedDeleteLdkNodeWallet).toHaveBeenCalledTimes(3);
    });
});

describe('clearAllData: POS order records and the iOS keychain sweep', () => {
    // listServers returns the servers in one partition of the fake keychain
    const enableKeychainAudit = (failLocal = false) => {
        const getInternetPasswordServers = jest.fn(
            async (synchronizable: boolean) => {
                if (failLocal && !synchronizable) {
                    throw new Error('SecItemCopyMatching failed: -34018');
                }
                return [
                    ...(synchronizable
                        ? mockKeychain.cloud
                        : mockKeychain.local
                    ).keys()
                ];
            }
        );
        mockSecureStorage.listServers.mockImplementation(
            getInternetPasswordServers
        );
        return getInternetPasswordServers;
    };

    afterEach(() => {
        mockSecureStorage.listServers.mockImplementation(
            async (_cloudSync: boolean) => []
        );
    });

    it('clears pos-<id> and pos-invoice-<id> for standalone and hidden orders on iOS', async () => {
        seedInstall();
        seedEverywhere(
            'pos-standalone',
            JSON.stringify([{ id: 'order-1' }, { id: 'order-2' }])
        );
        seedEverywhere('pos-hidden', JSON.stringify(['square-hidden']));
        seedEverywhere('pos-order-1', '{"tx":"lnbc1order","preimage":"ab"}');
        seedEverywhere('pos-invoice-order-2', '{"payment_request":"lnbc1"}');
        seedEverywhere('pos-square-hidden', '{"tx":"txid"}');

        await clearAllData();

        expect(remainingEntries()).toEqual([]);
    });

    it('still clears hidden orders when the standalone order list is malformed', async () => {
        seedEverywhere('pos-standalone', 'not json');
        seedEverywhere('pos-hidden', JSON.stringify(['order-3']));
        seedEverywhere('pos-order-3', '{"tx":"txid"}');

        await clearAllData();

        expect(remainingEntries()).toEqual([]);
        expect(warnedAbout('Error reading POS orders pos-standalone')).toBe(
            true
        );
    });

    it('deletes entries no index names (Square order records, lnurlpay:<hash>) in both iOS partitions', async () => {
        seedInstall();
        enableKeychainAudit();
        mockKeychain.local.set('zeus:pos-square-order', '{"tx":"lnbc1"}');
        mockKeychain.cloud.set('zeus:pos-square-order', '{"tx":"lnbc1"}');
        mockKeychain.local.set('zeus:lnurlpay:abcd', '{"metadata":"x"}');

        await clearAllData();

        expect(remainingEntries()).toEqual([]);
    });

    it('keeps sweeping when listing one partition or deleting one entry fails', async () => {
        enableKeychainAudit(true);
        mockKeychain.cloud.set('zeus:pos-a', 'a');
        mockKeychain.cloud.set('zeus:pos-b', 'b');
        mockKeychain.failReset = failOn('zeus:pos-a', 'cloud');

        await expect(clearAllData()).resolves.toBeUndefined();

        expect(remainingEntries()).toEqual(['cloud:zeus:pos-a']);
        expect(warnedAbout('Error listing keychain entries')).toBe(true);
        expect(warnedAbout('Error clearing keychain entry zeus:pos-a')).toBe(
            true
        );
    });

    it('does not enumerate the keychain or clear POS records by name on Android', async () => {
        setPlatformOS('android');
        const listServers = enableKeychainAudit();
        seedEverywhere('pos-standalone', JSON.stringify([{ id: 'order-1' }]));
        seedEverywhere('pos-order-1', '{"tx":"lnbc1"}');

        await clearAllData();

        expect(listServers).not.toHaveBeenCalled();
        // Left to the backing store deletion in step 8
        expect(mockKeychain.local.has('zeus:pos-order-1')).toBe(true);
    });
});

// A stored config whose values cannot be turned into key names (accepted by
// the wallet config import) made clearNodeKeychainData throw, which ended
// the wipe before the settings blob and everything after it
describe('clearAllData with a malformed node config', () => {
    it.each([
        ['an lndDir', { implementation: 'lnd', lndDir: { toString: null } }],
        [
            'an ldkNodeDir',
            { implementation: 'lnd', ldkNodeDir: { toString: null } }
        ],
        [
            'a pairingPhrase',
            {
                implementation: 'lightning-node-connect',
                pairingPhrase: { length: { toString: null } }
            }
        ]
    ])(
        'still clears everything when %s is not a string',
        async (_field, malformed) => {
            setPlatformOS('android');
            seedInstall();
            seedEverywhere(
                'zeus-settings-v2',
                JSON.stringify({ nodes: [malformed, ...NODES] })
            );
            mockFs.files.add(ANDROID_DATASTORE);

            await expect(clearAllData()).resolves.toBeUndefined();

            expect(warnedAbout('Error clearing node keys')).toBe(true);
            expect(remainingEntries()).toEqual([]);
            expect(mockedDeleteLndWallet).toHaveBeenCalledWith('lnd-uuid');
            expect(mockedDeleteLdkNodeWallet).toHaveBeenCalledWith('ldk-uuid');
            expect([...mockEncryptedStorage.items.keys()]).toEqual([]);
            expect(mockFs.files.has(ANDROID_DATASTORE)).toBe(false);
        }
    );
});

// The write latch lives in JS memory, so a process that ended mid-wipe left
// the settings blob (cleared late) for the next launch to load as if no wipe
// had started. The wipe is recorded in EncryptedStorage until it finishes.
describe('clearAllData pending-wipe record', () => {
    it('is saved before anything is cleared and kept while the wipe is cut short', async () => {
        seedInstall();
        const lndStop = deferred<boolean>();
        mockedDeleteLndWallet.mockReturnValueOnce(lndStop.promise);
        const recordAtFirstReset: Array<string | undefined> = [];
        mockKeychain.failReset = () => {
            if (recordAtFirstReset.length === 0) {
                recordAtFirstReset.push(
                    mockEncryptedStorage.items.get('wipe-pending')
                );
            }
            return false;
        };

        const wipe = clearAllData();
        await new Promise((resolve) => setImmediate(resolve));

        // the process would end here, with LND still stopping
        expect(mockedDeleteLndWallet).toHaveBeenCalledWith('lnd-uuid');
        expect(recordAtFirstReset).toEqual(['true']);
        expect(remainingEntries()).toContain('local:zeus:zeus-settings-v2');
        expect(mockEncryptedStorage.items.get('wipe-pending')).toBe('true');
        // not reported as unfinished to this JS context, which is running it
        expect(await isWipePending()).toBe(false);

        lndStop.resolve(true);
        await wipe;
    });

    it('is kept through EncryptedStorage.clear and the keychain file deletion, then removed', async () => {
        setPlatformOS('android');
        seedInstall();
        mockFs.files.add(ANDROID_DATASTORE);
        let recordAtStep8: string | undefined;
        mockFs.failUnlink = (path) => {
            if (path === ANDROID_DATASTORE) {
                recordAtStep8 = mockEncryptedStorage.items.get('wipe-pending');
            }
            return false;
        };

        await clearAllData();

        expect(recordAtStep8).toBe('true');
        expect(mockFs.files.has(ANDROID_DATASTORE)).toBe(false);
        expect(mockEncryptedStorage.items.has('wipe-pending')).toBe(false);
        expect(await isWipePending()).toBe(false);
    });

    it('removes the legacy settings blob before the keychain settings blob', async () => {
        seedInstall();
        let legacyAtBlobReset: boolean | undefined;
        mockKeychain.failReset = (server) => {
            if (
                legacyAtBlobReset === undefined &&
                server === 'zeus:zeus-settings-v2'
            ) {
                legacyAtBlobReset =
                    mockEncryptedStorage.items.has('zeus-settings');
            }
            return false;
        };

        await clearAllData();

        expect(legacyAtBlobReset).toBe(false);
    });

    it('still wipes when the record cannot be saved', async () => {
        seedInstall();
        mockEncryptedStorage.failSet = true;

        await expect(clearAllData()).resolves.toBeUndefined();

        expect(warnedAbout('Error recording the pending wipe')).toBe(true);
        expect(remainingEntries()).toEqual([]);
    });

    it('isWipePending reports a record left by an earlier launch', async () => {
        expect(await isWipePending()).toBe(false);

        mockEncryptedStorage.items.set('wipe-pending', 'true');
        expect(await isWipePending()).toBe(true);

        mockEncryptedStorage.failGet = true;
        expect(await isWipePending()).toBe(false);
    });

    it('markWipePending saves the record and does not throw when it cannot', async () => {
        await markWipePending();
        expect(await isWipePending()).toBe(true);

        mockEncryptedStorage.items.clear();
        mockEncryptedStorage.failSet = true;
        await expect(markWipePending()).resolves.toBeUndefined();
        expect(warnedAbout('Error recording the pending wipe')).toBe(true);
    });
});
