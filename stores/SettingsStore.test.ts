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

jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        clearCachedCalls: jest.fn(),
        initLNC: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn()
    }
}));
jest.mock('../utils/BiometricUtils', () => ({
    getSupportedBiometryType: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../utils/MigrationUtils', () => ({
    keychainDesyncMigration: jest.fn().mockResolvedValue(undefined),
    keychainCloudSyncMigration: jest.fn().mockResolvedValue(undefined),
    purgeRescueKeyFiles: jest.fn().mockResolvedValue(undefined),
    // getSettings adopts the return value (the queue's authoritative
    // object when consolidation routes through updateSettings), so the
    // stub must hand the settings back rather than resolve undefined
    runSettingsMigrations: jest
        .fn()
        .mockImplementation(async (settings: any) => settings),
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
        }),
        KEY_PREFIX: 'zeus:',
        getRawItem: jest.fn(async () => null)
    };
});

import SettingsStore, {
    DEFAULT_SETTINGS,
    PosEnabled,
    DEFAULT_LSP_MAINNET,
    DEFAULT_LSP_MUTINYNET,
    DEFAULT_LSP_TESTNET,
    DEFAULT_LSPS1_HOST_MAINNET,
    DEFAULT_LSPS1_HOST_MUTINYNET,
    DEFAULT_LSPS1_HOST_TESTNET,
    DEFAULT_LSPS1_PUBKEY_MAINNET,
    DEFAULT_LSPS1_PUBKEY_MUTINYNET,
    DEFAULT_LSPS1_PUBKEY_TESTNET,
    DEFAULT_LSPS1_REST_MAINNET,
    DEFAULT_LSPS1_REST_MUTINYNET,
    DEFAULT_LSPS1_REST_TESTNET,
    STORAGE_KEY,
    getLspConfigForNetwork,
    isOlympusPeer
} from './SettingsStore';

const StorageMock: any = jest.requireMock('../storage');

const seedSettings = (settings: any) => {
    StorageMock._backing[STORAGE_KEY] = JSON.stringify(settings);
};

const persistedSettings = () => JSON.parse(StorageMock._backing[STORAGE_KEY]);

let logSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
    for (const key of Object.keys(StorageMock._backing)) {
        delete StorageMock._backing[key];
    }
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    // getSettings swallows load failures (console.error, then falls
    // through with defaults), which has repeatedly let a stale
    // MigrationUtils mock pass this suite without ever completing the
    // load path; fail loudly instead
    expect(
        errorSpy.mock.calls.filter(
            ([message]) => message === 'Could not load settings'
        )
    ).toEqual([]);
    errorSpy.mockRestore();
    logSpy.mockRestore();
});

describe('SettingsStore DEFAULT_SETTINGS', () => {
    // Object-valued top-level groups DEFAULT_SETTINGS is expected to have.
    // MigrationUtils.test.ts hand-copies these groups into its own mock, so
    // a group added here without updating that mock would go unexercised by
    // the migration backfill tests. Pin the list so that drift fails CI.
    const EXPECTED_GROUP_KEYS = [
        'privacy',
        'display',
        'pos',
        'payments',
        'invoices',
        'channels',
        'swaps',
        'lightningAddress',
        'bolt12Address',
        'ecash',
        'networking'
    ];

    it('has exactly the expected object-valued top-level groups', () => {
        const groupKeys = Object.keys(DEFAULT_SETTINGS).filter((key) => {
            const value = (DEFAULT_SETTINGS as any)[key];
            return (
                value !== null &&
                typeof value === 'object' &&
                !Array.isArray(value)
            );
        });
        expect(groupKeys.sort()).toEqual([...EXPECTED_GROUP_KEYS].sort());
    });

    it('initializes settings equal to DEFAULT_SETTINGS', () => {
        const store = new SettingsStore();
        // supportedBiometryType is set to `undefined` in the DEFAULT_SETTINGS
        // literal, which JSON.parse(JSON.stringify(...)) drops entirely from
        // the clone; toEqual treats an absent key the same as an undefined
        // one, so this still holds.
        expect(store.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('does not let mutating a store instance affect the shared default', () => {
        const store = new SettingsStore();
        store.settings.privacy.lurkerMode = true;
        expect(DEFAULT_SETTINGS.privacy.lurkerMode).toBe(false);

        const otherStore = new SettingsStore();
        expect(otherStore.settings.privacy.lurkerMode).toBe(false);
    });
});

// The native LNC dial retries on its own until it connects and cannot be
// cancelled, so connect() must not init or dial a second time when its
// budget runs out: a second client on the same mailbox session evicts the
// first, and neither connects until the app restarts.
describe('SettingsStore.connect (LNC)', () => {
    const BackendUtilsMock: any = jest.requireMock(
        '../utils/BackendUtils'
    ).default;

    beforeEach(() => {
        jest.useFakeTimers();
        BackendUtilsMock.initLNC.mockReset().mockResolvedValue(undefined);
        BackendUtilsMock.connect.mockReset().mockResolvedValue(undefined);
        BackendUtilsMock.isConnected.mockReset().mockResolvedValue(false);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const settle = async (ms: number) => {
        await jest.advanceTimersByTimeAsync(ms);
    };

    it('resolves once the session is up', async () => {
        const store = new SettingsStore();
        BackendUtilsMock.isConnected
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        const result = store.connect();
        await settle(1000);

        expect(await result).toBeUndefined();
        expect(store.error).toBe(false);
        expect(store.loading).toBe(false);
    });

    it('reports a timeout without dialing again', async () => {
        const store = new SettingsStore();

        const result = store.connect();
        await settle(61000);

        expect(await result).toBe('stores.SettingsStore.lncConnectError');
        expect(store.error).toBe(true);
        expect(store.loading).toBe(false);
        expect(BackendUtilsMock.initLNC).toHaveBeenCalledTimes(1);
        expect(BackendUtilsMock.connect).toHaveBeenCalledTimes(1);
    });

    it('waits the full minute before giving up', async () => {
        const store = new SettingsStore();
        let done = false;
        store.connect().then(() => (done = true));

        await settle(59000);
        expect(done).toBe(false);
        await settle(2000);
        expect(done).toBe(true);
    });

    it('returns a dial rejection without waiting', async () => {
        const store = new SettingsStore();
        BackendUtilsMock.connect.mockResolvedValue('invalid mailbox');

        expect(await store.connect()).toBe('invalid mailbox');
        expect(store.errorMsg).toBe('invalid mailbox');
        expect(BackendUtilsMock.isConnected).not.toHaveBeenCalled();
    });

    it('surfaces an initLNC failure as the error', async () => {
        const store = new SettingsStore();
        BackendUtilsMock.initLNC.mockRejectedValue(
            new Error('keychain read failed')
        );

        expect(await store.connect()).toBe('keychain read failed');
        expect(store.error).toBe(true);
        expect(BackendUtilsMock.connect).not.toHaveBeenCalled();
    });

    it('clears a timeout error once the session comes up later', async () => {
        const store = new SettingsStore();

        const result = store.connect();
        await settle(61000);
        await result;
        expect(store.error).toBe(true);

        store.clearConnectError();

        expect(store.error).toBe(false);
        expect(store.errorMsg).toBe('');
        expect(BackendUtilsMock.connect).toHaveBeenCalledTimes(1);
    });
});

// The error screen's retry calls setConnectingStatus(true) while an earlier
// fetchData may still be running, so a reconnect must clear the error and
// free the lock, and the earlier run must not free the retry's lock.
describe('SettingsStore reconnect and fetch lock', () => {
    const BackendUtilsMock: any = jest.requireMock(
        '../utils/BackendUtils'
    ).default;

    beforeEach(() => {
        BackendUtilsMock.clearCachedCalls.mockReset();
    });

    it('does not hand out the lock twice', () => {
        const store = new SettingsStore();

        expect(store.acquireFetchLock()).not.toBeNull();
        expect(store.acquireFetchLock()).toBeNull();
    });

    it('frees the lock for the owner', () => {
        const store = new SettingsStore();
        const seq = store.acquireFetchLock()!;

        store.releaseFetchLock(seq);

        expect(store.fetchLock).toBe(false);
        expect(store.acquireFetchLock()).not.toBeNull();
    });

    it('clears the connect error and cached calls on reconnect', () => {
        const store = new SettingsStore();
        store.error = true;
        store.errorMsg = 'connection refused';
        store.lndFolderMissing = true;

        store.setConnectingStatus(true);

        expect(store.connecting).toBe(true);
        expect(store.error).toBe(false);
        expect(store.errorMsg).toBe('');
        expect(store.lndFolderMissing).toBe(false);
        expect(BackendUtilsMock.clearCachedCalls).toHaveBeenCalledTimes(1);
    });

    it('frees a held lock on reconnect', () => {
        const store = new SettingsStore();
        store.acquireFetchLock();

        store.setConnectingStatus(true);

        expect(store.fetchLock).toBe(false);
        expect(store.acquireFetchLock()).not.toBeNull();
    });

    it('keeps the lock of the run started by the reconnect', () => {
        const store = new SettingsStore();
        const staleSeq = store.acquireFetchLock()!;

        store.setConnectingStatus(true);
        const currentSeq = store.acquireFetchLock()!;
        store.releaseFetchLock(staleSeq);

        expect(store.fetchLock).toBe(true);
        expect(store.acquireFetchLock()).toBeNull();

        store.releaseFetchLock(currentSeq);
        expect(store.fetchLock).toBe(false);
    });

    it('leaves the error and the lock alone when connecting ends', () => {
        const store = new SettingsStore();
        store.acquireFetchLock();
        store.error = true;
        store.errorMsg = 'connection refused';

        store.setConnectingStatus(false);

        expect(store.connecting).toBe(false);
        expect(store.error).toBe(true);
        expect(store.errorMsg).toBe('connection refused');
        expect(store.fetchLock).toBe(true);
        expect(BackendUtilsMock.clearCachedCalls).not.toHaveBeenCalled();
    });
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

// triggerSettingsRefresh makes the Wallet screen run a full node refetch on
// its next focus, which costs the user a noticeable loading time.
// Writes that re-persist what is already stored must not arm it.
describe('SettingsStore.updateSettings refresh flag', () => {
    it('stays unarmed when a write re-persists an identical value', async () => {
        seedSettings({ fiat: 'USD' });
        const store = new SettingsStore();

        await store.updateSettings({ fiat: 'USD' });

        expect(store.triggerSettingsRefresh).toEqual(false);
    });

    it('is armed when a write changes a value', async () => {
        seedSettings({ fiat: 'USD' });
        const store = new SettingsStore();

        await store.updateSettings({ fiat: 'EUR' });

        expect(store.triggerSettingsRefresh).toEqual(true);
    });

    it('stays unarmed when a functional update resolves to the stored values', async () => {
        // Functional updaters are resolved inside the queue, so the no-op
        // check has to run on their result. A filter that removes nothing
        // returns a new but equal array.
        seedSettings({
            nodes: [{ implementation: 'lnd', host: 'example.com' }],
            selectedNode: 0
        });
        const store = new SettingsStore();

        await store.updateSettings((currentSettings: any) => ({
            nodes: currentSettings.nodes.filter(() => true),
            selectedNode: currentSettings.selectedNode
        }));

        expect(store.triggerSettingsRefresh).toEqual(false);
    });

    it('stays unarmed when an undefined value is written for an absent key', async () => {
        // JSON.stringify drops the key, so nothing changes on disk.
        seedSettings({});
        const store = new SettingsStore();

        await store.updateSettings({ fiat: undefined });

        expect(store.triggerSettingsRefresh).toEqual(false);
        expect(persistedSettings()).not.toHaveProperty('fiat');
    });

    it('is armed and clears the key when undefined overwrites a stored value', async () => {
        seedSettings({ fiat: 'USD' });
        const store = new SettingsStore();

        await store.updateSettings({ fiat: undefined });

        expect(store.triggerSettingsRefresh).toEqual(true);
        expect(store.settings.fiat).toBeUndefined();
        expect(persistedSettings()).not.toHaveProperty('fiat');
    });

    // Bookkeeping keys and the one-shot flags the refresh itself resets
    // only take effect on the next node start, so a change to them alone
    // must not cost another refetch (#4751).
    it.each([
        ['authenticationAttempts', 0, 1],
        ['supportedBiometryType', 'Biometrics', 'FaceID'],
        ['initialLoad', true, false],
        ['resetExpressGraphSyncOnStartup', true, false],
        ['rescan', true, false],
        ['recovery', true, false]
    ])(
        'stays unarmed when only %s changes',
        async (key, storedValue, newValue) => {
            seedSettings({ [key]: storedValue });
            const store = new SettingsStore();

            await store.updateSettings({ [key]: newValue });

            expect(store.triggerSettingsRefresh).toEqual(false);
            expect(persistedSettings()[key]).toEqual(newValue);
        }
    );

    it('is armed when an exempt key changes together with another key', async () => {
        // Restoring a wallet writes the new node along with recovery and
        // initialLoad; the node change still needs the refetch.
        seedSettings({ nodes: [], recovery: false, initialLoad: true });
        const store = new SettingsStore();

        await store.updateSettings({
            nodes: [{ implementation: 'embedded-lnd', lndDir: 'lnd' }],
            selectedNode: 0,
            recovery: true,
            initialLoad: false
        });

        expect(store.triggerSettingsRefresh).toEqual(true);
    });

    // Turning POS on relies on this flag alone: the refetch on the next
    // Wallet focus is what navigates into POS mode.
    it('is armed when POS gets enabled', async () => {
        seedSettings({ pos: { posEnabled: 'disabled', merchantName: '' } });
        const store = new SettingsStore();

        await store.updateSettings({
            pos: { posEnabled: 'standalone', merchantName: '' }
        });

        expect(store.triggerSettingsRefresh).toEqual(true);
    });

    it('stays unarmed when a POS write changes nothing while POS is enabled', async () => {
        // POS settings writes spread the whole pos group, posEnabled
        // included, so saving an unchanged field re-persists it.
        seedSettings({
            pos: { posEnabled: 'standalone', merchantName: 'Shop' }
        });
        const store = new SettingsStore();

        await store.updateSettings({
            pos: { posEnabled: 'standalone', merchantName: 'Shop' }
        });

        expect(store.triggerSettingsRefresh).toEqual(false);
    });

    it('stays unarmed and clears the key when biometrics are removed', async () => {
        // Biometrics removed in the OS settings: writing undefined is how
        // the stored sensor type gets cleared.
        seedSettings({ supportedBiometryType: 'Biometrics' });
        const store = new SettingsStore();

        await store.updateSettings({ supportedBiometryType: undefined });

        expect(store.triggerSettingsRefresh).toEqual(false);
        expect(store.settings.supportedBiometryType).toBeUndefined();
        expect(persistedSettings()).not.toHaveProperty('supportedBiometryType');
    });
});

describe('SettingsStore.getSettings', () => {
    afterEach(() => {
        StorageMock.getRawItem.mockReset();
        StorageMock.getRawItem.mockResolvedValue(null);
    });

    it('falls back to the synchronizable blob when the local partition is empty', async () => {
        // Desync migration not yet complete: nothing in local storage, the
        // real blob still lives only in the synchronizable partition. A user
        // with wallets must never be routed to onboarding on such a boot.
        const node = {
            implementation: 'lnd',
            host: 'example.com',
            certVerification: true,
            dismissCustodialWarning: true
        };
        StorageMock.getRawItem.mockImplementation(
            async (server: string, cloudSync: boolean) =>
                cloudSync && server === `zeus:${STORAGE_KEY}`
                    ? JSON.stringify({ nodes: [node], selectedNode: 0 })
                    : null
        );
        const store = new SettingsStore();

        const settings = await store.getSettings();

        expect(settings.nodes?.length).toEqual(1);
        expect(settings.nodes?.[0].host).toEqual('example.com');
        // Read-only fallback: the local partition must not be written
        expect(StorageMock._backing[STORAGE_KEY]).toBeUndefined();
    });
});

// The LSP settings screens decide whether to show Reset by comparing the
// field against these defaults, so they must never follow the saved value.
describe('getLspConfigForNetwork', () => {
    const custom = {
        flow: 'https://flow.example.com',
        rest: 'https://lsps1.example.com',
        host: '127.0.0.1:9735'
    };
    const customSettings: any = {};
    for (const net of ['Mainnet', 'Testnet', 'Mutinynet']) {
        customSettings[`lsp${net}`] = custom.flow;
        customSettings[`lsps1Rest${net}`] = custom.rest;
        customSettings[`lsps1Host${net}`] = custom.host;
    }

    it.each([
        [
            'mainnet',
            DEFAULT_LSP_MAINNET,
            DEFAULT_LSPS1_REST_MAINNET,
            DEFAULT_LSPS1_HOST_MAINNET,
            DEFAULT_LSPS1_PUBKEY_MAINNET
        ],
        [
            'testnet',
            DEFAULT_LSP_TESTNET,
            DEFAULT_LSPS1_REST_TESTNET,
            DEFAULT_LSPS1_HOST_TESTNET,
            DEFAULT_LSPS1_PUBKEY_TESTNET
        ],
        [
            'mutinynet',
            DEFAULT_LSP_MUTINYNET,
            DEFAULT_LSPS1_REST_MUTINYNET,
            DEFAULT_LSPS1_HOST_MUTINYNET,
            DEFAULT_LSPS1_PUBKEY_MUTINYNET
        ]
    ])(
        'keeps %s defaults while settings hold custom values',
        (network, flow, rest, host, pubkey) => {
            const config = getLspConfigForNetwork(customSettings, network);

            expect(config.flowHost).toEqual(custom.flow);
            expect(config.lsps1Rest).toEqual(custom.rest);
            expect(config.lsps1Host).toEqual(custom.host);

            expect(config.defaultFlowHost).toEqual(flow);
            expect(config.defaultLsps1Rest).toEqual(rest);
            expect(config.defaultLsps1Host).toEqual(host);
            expect(config.defaultPubkey).toEqual(pubkey);
        }
    );
});

describe('SettingsStore.externalInputAuthRequired', () => {
    const withPin = () => {
        const store = new SettingsStore();
        store.settings = { pin: '1234' } as any;
        return store;
    };

    it('requires auth when logged out', () => {
        expect(withPin().externalInputAuthRequired()).toBe(true);
    });

    it('does not require auth when logged in outside POS', () => {
        const store = withPin();
        store.setLoginStatus(true);
        store.setPosStatus('inactive');
        expect(store.externalInputAuthRequired()).toBe(false);
    });

    // The Lockscreen's POS waiver sets loggedIn with no PIN, so a POS
    // terminal that has been resumed once reads as logged in
    it('requires auth when logged in but POS is active', () => {
        const store = withPin();
        store.setLoginStatus(true);
        store.setPosStatus('active');
        expect(store.loginRequired()).toBe(false);
        expect(store.externalInputAuthRequired()).toBe(true);
    });

    it('does not require auth when no login is configured', () => {
        const store = new SettingsStore();
        store.settings = {} as any;
        store.setPosStatus('active');
        expect(store.externalInputAuthRequired()).toBe(false);
    });
});

describe('SettingsStore.isPosEnabled', () => {
    const withPos = (pos: any) => {
        const store = new SettingsStore();
        store.settings = { pos } as any;
        return store;
    };

    it('is false when there are no POS settings', () => {
        expect(withPos(undefined).isPosEnabled()).toBe(false);
    });

    it('is false when posEnabled is unset', () => {
        expect(withPos({}).isPosEnabled()).toBe(false);
    });

    it('is false when POS is disabled', () => {
        expect(
            withPos({ posEnabled: PosEnabled.Disabled }).isPosEnabled()
        ).toBe(false);
    });

    it('is true for Standalone and Square', () => {
        expect(
            withPos({ posEnabled: PosEnabled.Standalone }).isPosEnabled()
        ).toBe(true);
        expect(withPos({ posEnabled: PosEnabled.Square }).isPosEnabled()).toBe(
            true
        );
    });
});

// Open Channel names the LSPS1 peer it dials, so it has to tell ZEUS's own
// node from one the user pointed elsewhere.
describe('isOlympusPeer', () => {
    it('is true on the shipped defaults', () => {
        expect(isOlympusPeer({} as any, 'mainnet')).toEqual(true);
        expect(isOlympusPeer({} as any, 'testnet')).toEqual(true);
        expect(isOlympusPeer({} as any, 'mutinynet')).toEqual(true);
    });

    it('is false when the pubkey is customized', () => {
        expect(
            isOlympusPeer({ lsps1PubkeyMainnet: '02abc' } as any, 'mainnet')
        ).toEqual(false);
    });

    // the handshake is keyed on the pubkey, so a custom address for the same
    // node is still Olympus
    it('is true when only the host is customized', () => {
        expect(
            isOlympusPeer(
                { lsps1HostMainnet: '127.0.0.1:9735' } as any,
                'mainnet'
            )
        ).toEqual(true);
    });

    it('reads the network it is asked about', () => {
        const settings: any = { lsps1PubkeyTestnet: '02abc' };
        expect(isOlympusPeer(settings, 'testnet')).toEqual(false);
        expect(isOlympusPeer(settings, 'mainnet')).toEqual(true);
    });
});
