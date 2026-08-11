// Regression coverage for the updateSettings lost-update race (KEY-006
// review follow-up): updateSettings is a read-merge-write against the
// persisted settings blob, so two concurrent callers could each read the
// same snapshot and the later write would clobber the earlier one. The
// worst case is a background settings write straddling a wallet deletion:
// its stale snapshot still contains the deleted node, so committing it
// resurrects the node config, seed phrase and wallet password included,
// after the wallet's keychain material and data directories are gone.
// updateSettings now serializes updates through an internal queue and
// accepts a functional updater so deletion computes the new nodes array
// inside the critical section.

jest.mock('react-native-biometrics', () => ({ BiometryType: {} }));
jest.mock('react-native-blob-util', () => ({
    fs: {
        dirs: { LibraryDir: '/lib', DocumentDir: '/docs' }
    }
}));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../utils/BackendUtils', () => ({}));
jest.mock('../utils/BiometricUtils', () => ({
    getSupportedBiometryType: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../utils/MigrationUtils', () => ({
    keychainCloudSyncMigration: jest.fn().mockResolvedValue(undefined),
    purgeRescueKeyFiles: jest.fn().mockResolvedValue(undefined),
    purgeLegacyExportFiles: jest.fn().mockResolvedValue(undefined),
    migrateRgsDefaultToZeus: jest.fn().mockResolvedValue(undefined),
    migrateInvoiceExpiryDisplay: jest.fn().mockResolvedValue(undefined),
    legacySettingsMigrations: jest.fn().mockResolvedValue({}),
    storageMigrationV2: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    RequestMethod: {}
}));
jest.mock('../utils/LdkNodeUtils', () => ({
    DEFAULT_SCORER_URL: '',
    DEFAULT_VSS_SERVER: '',
    getDefaultEsploraServer: jest.fn().mockReturnValue(''),
    getDefaultRgsServer: jest.fn().mockReturnValue('')
}));

// In-memory keychain-backed storage: getItem returns the persisted string
// or false, setItem stringifies objects, matching storage/index.ts. Every
// call resolves through the microtask queue, so unserialized concurrent
// read-merge-write cycles genuinely interleave (both reads complete before
// either write) and the lost update reproduces without the queue.
jest.mock('../storage', () => {
    const backing: Record<string, string> = {};
    return {
        _backing: backing,
        getItem: jest.fn(async (key: string) => backing[key] ?? false),
        setItem: jest.fn(async (key: string, value: any) => {
            backing[key] =
                typeof value === 'string' ? value : JSON.stringify(value);
            return true;
        }),
        removeItem: jest.fn(async (key: string) => {
            delete backing[key];
            return true;
        })
    };
});

import SettingsStore, { STORAGE_KEY } from './SettingsStore';

const StorageMock: any = jest.requireMock('../storage');

const seedSettings = (settings: any) => {
    StorageMock._backing[STORAGE_KEY] = JSON.stringify(settings);
};

const persistedSettings = () => JSON.parse(StorageMock._backing[STORAGE_KEY]);

let logSpy: jest.SpyInstance;

beforeEach(() => {
    for (const key of Object.keys(StorageMock._backing)) {
        delete StorageMock._backing[key];
    }
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    logSpy.mockRestore();
});

describe('SettingsStore.updateSettings', () => {
    it('serializes concurrent updates so neither is lost', async () => {
        seedSettings({ fiat: 'USD', locale: 'en' });
        const store = new SettingsStore();

        // Fired without awaiting in between: both would read the same
        // snapshot if updates were not queued, and the later write would
        // drop the earlier one's key.
        const [first, second] = await Promise.all([
            store.updateSettings({ fiat: 'EUR' }),
            store.updateSettings({ locale: 'cs' })
        ]);

        expect(first.fiat).toEqual('EUR');
        expect(second.fiat).toEqual('EUR');
        expect(second.locale).toEqual('cs');

        const persisted = persistedSettings();
        expect(persisted.fiat).toEqual('EUR');
        expect(persisted.locale).toEqual('cs');
    });

    it('does not resurrect a deleted node from a straddling write', async () => {
        const embeddedNode = {
            implementation: 'embedded-lnd',
            lndDir: 'lnd',
            seedPhrase: ['abandon', 'ability', 'able'],
            walletPassword: 'hunter2',
            certVerification: false,
            dismissCustodialWarning: true
        };
        const remoteNode = {
            implementation: 'lnd',
            host: 'example.com',
            certVerification: true,
            dismissCustodialWarning: true
        };
        seedSettings({
            nodes: [embeddedNode, remoteNode],
            selectedNode: 1,
            fiat: 'USD'
        });
        const store = new SettingsStore();

        // A background write starts before the deletion and would finish
        // after it; the deletion uses a functional updater so the new
        // nodes array is computed inside the critical section.
        await Promise.all([
            store.updateSettings({ fiat: 'EUR' }),
            store.updateSettings((currentSettings: any) => ({
                nodes: (currentSettings.nodes || []).filter(
                    (_: any, i: number) => i !== 0
                ),
                selectedNode: 0,
                justDeletedWallet: false
            }))
        ]);

        const persisted = persistedSettings();
        expect(persisted.fiat).toEqual('EUR');
        expect(persisted.nodes).toHaveLength(1);
        expect(persisted.nodes[0].host).toEqual('example.com');
        // The deleted node's key material must not survive anywhere in
        // the persisted blob.
        expect(StorageMock._backing[STORAGE_KEY]).not.toContain('abandon');
        expect(StorageMock._backing[STORAGE_KEY]).not.toContain('hunter2');
    });

    it('keeps memory consistent with disk when the write is blocked', async () => {
        seedSettings({ fiat: 'USD', locale: 'en' });
        const store = new SettingsStore();
        // Load once so the store holds the seeded settings before the
        // blocked write, mirroring a wipe that latches mid-session.
        await store.getSettings();

        // Storage.setItem returns false while the data-wipe write latch
        // is engaged (storage/index.ts blockWrites).
        StorageMock.setItem.mockImplementationOnce(async () => false);
        const result = await store.updateSettings({ fiat: 'EUR' });

        // The unpersisted update must not surface anywhere: not in the
        // returned settings, not in memory, not in derived state.
        expect(result.fiat).toEqual('USD');
        expect(store.settings.fiat).toEqual('USD');
        expect(store.triggerSettingsRefresh).toEqual(false);
        expect(persistedSettings().fiat).toEqual('USD');

        // Once writes land again, updates flow through as normal.
        const after = await store.updateSettings({ fiat: 'CAD' });
        expect(after.fiat).toEqual('CAD');
        expect(store.settings.fiat).toEqual('CAD');
        expect(persistedSettings().fiat).toEqual('CAD');
    });

    it('keeps processing queued updates after one rejects', async () => {
        seedSettings({ fiat: 'USD' });
        const store = new SettingsStore();

        await expect(
            store.updateSettings(() => {
                throw new Error('boom');
            })
        ).rejects.toThrow('boom');

        const result = await store.updateSettings({ fiat: 'CAD' });
        expect(result.fiat).toEqual('CAD');
        expect(persistedSettings().fiat).toEqual('CAD');
        expect(store.settingsUpdateInProgress).toEqual(false);
    });
});
