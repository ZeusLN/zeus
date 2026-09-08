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
    migrateRgsDefaultsToV2: jest.fn().mockResolvedValue(undefined),
    migrateSwapHostsToBoltz: jest.fn().mockResolvedValue(undefined),
    migrateRetiredSwapHosts: jest.fn().mockResolvedValue(undefined),
    migrateInvoiceExpiryDisplay: jest.fn().mockResolvedValue(undefined),
    migrateOlympusHostsToZeusLsp: jest.fn().mockResolvedValue(undefined),
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
let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
    for (const key of Object.keys(StorageMock._backing)) {
        delete StorageMock._backing[key];
    }
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
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

// Regression coverage for #4612: a settings read that FAILS is not the
// same as a user with no wallets, but getSettings returned the store's
// defaults for both, and the very next write (the launch-time biometry
// refresh) merged onto those defaults and persisted a wallet-less blob
// over the real one. On iOS that write is a delete-then-add of a single
// keychain item, so the wallet list was gone with no prior copy left.
describe('SettingsStore write guards', () => {
    const nodeA = {
        implementation: 'lnd',
        host: 'a.example.com',
        macaroonHex: 'aaaa'
    };
    const nodeB = {
        implementation: 'lnd',
        host: 'b.example.com',
        macaroonHex: 'bbbb'
    };

    it('does not persist defaults over the wallet list when the read fails', async () => {
        seedSettings({ nodes: [nodeA, nodeB], selectedNode: 0, fiat: 'USD' });
        // Fresh store, as on app launch: `settings` is still the default
        // object, which has no `nodes`.
        const store = new SettingsStore();
        StorageMock.getItem.mockRejectedValueOnce(
            new Error('errSecInteractionNotAllowed')
        );

        const result = await store.updateSettings({
            supportedBiometryType: 'FaceID'
        });

        expect(persistedSettings().nodes).toHaveLength(2);
        expect(persistedSettings().fiat).toEqual('USD');
        expect(result.supportedBiometryType).toBeUndefined();
        expect(store.settings.nodes).toBeUndefined();
        expect(store.settingsLoadFailed).toEqual(true);
    });

    it('does not persist over a corrupt settings blob', async () => {
        StorageMock._backing[STORAGE_KEY] = '{"nodes":[{"host":"a.exa';
        const store = new SettingsStore();

        await store.updateSettings({ fiat: 'EUR' });

        expect(StorageMock._backing[STORAGE_KEY]).toEqual(
            '{"nodes":[{"host":"a.exa'
        );
        expect(store.settingsLoadFailed).toEqual(true);
    });

    it('resumes writing once a later load succeeds', async () => {
        seedSettings({ nodes: [nodeA], fiat: 'USD' });
        const store = new SettingsStore();
        StorageMock.getItem.mockRejectedValueOnce(
            new Error('errSecInteractionNotAllowed')
        );

        await store.updateSettings({ fiat: 'EUR' });
        expect(persistedSettings().fiat).toEqual('USD');

        const result = await store.updateSettings({ fiat: 'CAD' });

        expect(result.fiat).toEqual('CAD');
        expect(persistedSettings().fiat).toEqual('CAD');
        expect(persistedSettings().nodes).toHaveLength(1);
        expect(store.settingsLoadFailed).toEqual(false);
    });

    it('refuses to persist an empty wallet list over an existing one', async () => {
        seedSettings({ nodes: [nodeA, nodeB], selectedNode: 0 });
        const store = new SettingsStore();
        await store.getSettings();

        const result = await store.updateSettings({ nodes: [] });

        expect(persistedSettings().nodes).toHaveLength(2);
        expect(store.settings.nodes).toHaveLength(2);
        expect(result.nodes).toHaveLength(2);
    });

    it('lets the last wallet be deleted with allowEmptyNodes', async () => {
        seedSettings({ nodes: [nodeA], selectedNode: 0 });
        const store = new SettingsStore();
        await store.getSettings();

        await store.updateSettings(
            { nodes: [], selectedNode: 0, justDeletedWallet: true },
            { allowEmptyNodes: true }
        );

        expect(persistedSettings().nodes).toHaveLength(0);
        expect(StorageMock._backing[STORAGE_KEY]).not.toContain('aaaa');
    });

    it('still persists on a fresh install with no wallets', async () => {
        const store = new SettingsStore();

        const result = await store.updateSettings({ fiat: 'EUR' });

        expect(result.fiat).toEqual('EUR');
        expect(persistedSettings().fiat).toEqual('EUR');
        expect(store.settingsLoadFailed).toEqual(false);
    });

    it('skips the write when nothing changed', async () => {
        seedSettings({ nodes: [nodeA], fiat: 'USD' });
        const store = new SettingsStore();
        await store.getSettings();
        StorageMock.setItem.mockClear();

        const result = await store.updateSettings({ fiat: 'USD' });

        expect(StorageMock.setItem).not.toHaveBeenCalled();
        expect(result.fiat).toEqual('USD');
        expect(store.triggerSettingsRefresh).toEqual(false);
    });
});
