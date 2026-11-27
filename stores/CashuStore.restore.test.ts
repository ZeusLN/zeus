const mockStorage = new Map<string, string>();
const mockCdkMints: string[] = [];

jest.mock('./Stores', () => ({
    activityStore: {},
    connectivityStore: {
        isOffline: false,
        start: jest.fn(),
        stop: jest.fn(),
        onReconnect: jest.fn()
    }
}));
jest.mock('./SettingsStore', () => ({ DEFAULT_NOSTR_RELAYS: [] }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@nostr-dev-kit/ndk', () => ({
    __esModule: true,
    default: jest.fn()
}));
jest.mock('../utils/NostrUtils', () => ({}));
jest.mock('../utils/NostrMintBackup', () => ({
    deriveMintBackupKeypair: jest.fn(() => ({
        privateKeyHex: 'priv',
        publicKeyHex: 'pub'
    })),
    backupMintsToNostr: jest.fn().mockResolvedValue(1),
    restoreMintsFromNostr: jest.fn()
}));
jest.mock('../utils/MigrationUtils', () => ({
    migrateLegacyCashuKeysToNodeDir: jest.fn().mockResolvedValue(undefined),
    migrateCashuSeedVersion: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
jest.mock('../NavigationService', () => ({}));
jest.mock('../cashu-cdk', () => ({
    isAvailable: jest.fn(() => true),
    initializeWallet: jest.fn().mockResolvedValue(undefined),
    addMint: jest.fn(async (mintUrl: string) => {
        if (!mockCdkMints.includes(mintUrl)) mockCdkMints.push(mintUrl);
    }),
    removeMint: jest.fn(async (mintUrl: string) => {
        mockCdkMints.splice(mockCdkMints.indexOf(mintUrl), 1);
    }),
    getMintUrls: jest.fn(async () => [...mockCdkMints]),
    restore: jest.fn(),
    restoreFromSeed: jest.fn(),
    send: jest.fn(),
    melt: jest.fn(),
    getBalances: jest.fn().mockResolvedValue({}),
    getTotalBalance: jest.fn().mockResolvedValue(0),
    fetchMintInfo: jest.fn().mockResolvedValue(null),
    listTransactions: jest.fn().mockResolvedValue([])
}));
jest.mock('../storage', () => ({
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? false),
    setItem: jest.fn(async (key: string, value: any) => {
        mockStorage.set(
            key,
            typeof value === 'string' ? value : JSON.stringify(value)
        );
    }),
    removeItem: jest.fn(async (key: string) => {
        mockStorage.delete(key);
    }),
    getRawItem: jest.fn().mockResolvedValue(null),
    removeRawItem: jest.fn().mockResolvedValue(undefined),
    KEY_PREFIX: 'zeus:'
}));

import CashuStore from './CashuStore';
import CashuDevKit from '../cashu-cdk';
import { restoreMintsFromNostr } from '../utils/NostrMintBackup';

// BIP-39 zero-entropy test vector, never a real wallet
const words = `${'abandon '.repeat(11)}about`.split(' ');
const mintUrl = 'https://mint.example';
const otherMintUrl = 'https://other.example';
const pendingKey = 'lnd-cashu-pendingRestoreMints';
const unreachable = new Error('Http transport error');

// Cached info keeps fetchMintInfo from leaving its timeout timer behind
const cacheMintInfos = (store: CashuStore) => {
    store.mintInfos = { [mintUrl]: {} as any, [otherMintUrl]: {} as any };
};

// A seed-recovered embedded LND wallet
const createStore = () => {
    const store = new CashuStore(
        { implementation: 'embedded-lnd', seedPhrase: words } as any,
        {} as any,
        { channels: [] } as any,
        {} as any
    );
    store.reset();
    cacheMintInfos(store);
    return store;
};

// Starts the app and waits for the background restore retries too
const startApp = async () => {
    const store = createStore();
    await store.initializeWallets();
    await retryOf(store);
    return store;
};

const retryOf = (store: CashuStore): Promise<void> | undefined =>
    (store as any).pendingRestoreRetry;

const restoredMints = () =>
    (CashuDevKit.restore as jest.Mock).mock.calls.map(([url]) => url);

// A mint left in CDK by an interrupted restore on an earlier start
const seedPendingMints = (...urls: string[]) => {
    mockStorage.set('lnd-cashu-mintUrls', JSON.stringify(urls));
    mockStorage.set(pendingKey, JSON.stringify(urls));
    mockCdkMints.push(...urls);
};

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
};

// Resolves to whether the promise settled within the time limit
const settlesWithin = (promise: Promise<unknown>, ms = 200) =>
    Promise.race([
        promise.then(() => true),
        new Promise<boolean>((r) => setTimeout(() => r(false), ms))
    ]);

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('CashuStore: ecash restore after seed recovery', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStorage.clear();
        mockCdkMints.length = 0;
        (CashuDevKit.restore as jest.Mock).mockReset().mockResolvedValue(0);
        (CashuDevKit.getBalances as jest.Mock)
            .mockReset()
            .mockResolvedValue({});
        (CashuDevKit.getTotalBalance as jest.Mock)
            .mockReset()
            .mockResolvedValue(0);
        (restoreMintsFromNostr as jest.Mock).mockReset().mockResolvedValue({
            mints: [mintUrl],
            timestamp: 1
        });
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('restores a recovered mint once when the restore succeeds', async () => {
        await startApp();
        expect(CashuDevKit.restore).toHaveBeenCalledTimes(1);
        expect(mockStorage.has(pendingKey)).toBe(false);

        await startApp();
        expect(CashuDevKit.restore).toHaveBeenCalledTimes(1);
    });

    it('retries a failed restore on later starts until it succeeds', async () => {
        (CashuDevKit.restore as jest.Mock)
            .mockRejectedValueOnce(unreachable)
            .mockRejectedValueOnce(unreachable);

        // CDK lists the mint after the failed attempt, as the native
        // library does once the mint's keysets were fetched
        const store = await startApp();
        expect(store.mintUrls).toEqual([mintUrl]);
        expect(mockStorage.get(pendingKey)).toBe(JSON.stringify([mintUrl]));

        await startApp();
        expect(CashuDevKit.restore).toHaveBeenCalledTimes(2);
        expect(mockStorage.get(pendingKey)).toBe(JSON.stringify([mintUrl]));

        await startApp();
        expect(CashuDevKit.restore).toHaveBeenCalledTimes(3);
        expect(mockStorage.has(pendingKey)).toBe(false);

        await startApp();
        expect(CashuDevKit.restore).toHaveBeenCalledTimes(3);
    });

    it('records the restore as pending while it runs', async () => {
        let pendingDuringRestore;
        (CashuDevKit.restore as jest.Mock).mockImplementationOnce(async () => {
            pendingDuringRestore = mockStorage.get(pendingKey);
            return 0;
        });

        await startApp();
        expect(pendingDuringRestore).toBe(JSON.stringify([mintUrl]));
        expect(mockStorage.has(pendingKey)).toBe(false);
    });

    it('retries only the mint whose restore failed', async () => {
        (restoreMintsFromNostr as jest.Mock).mockResolvedValue({
            mints: [mintUrl, otherMintUrl],
            timestamp: 1
        });
        (CashuDevKit.restore as jest.Mock).mockImplementation(
            async (url: string) => {
                if (url === otherMintUrl) throw unreachable;
                return 0;
            }
        );

        await startApp();
        expect(mockStorage.get(pendingKey)).toBe(
            JSON.stringify([otherMintUrl])
        );

        (CashuDevKit.restore as jest.Mock).mockClear();
        await startApp();
        expect(restoredMints()).toEqual([otherMintUrl]);
    });

    it('does not restore mints already in CDK without a pending restore', async () => {
        mockStorage.set('lnd-cashu-mintUrls', JSON.stringify([mintUrl]));
        mockCdkMints.push(mintUrl);

        await startApp();
        expect(CashuDevKit.restore).not.toHaveBeenCalled();
    });

    it('forgets the pending restore of a removed mint', async () => {
        (CashuDevKit.restore as jest.Mock).mockRejectedValueOnce(unreachable);

        const store = await startApp();
        expect(mockStorage.get(pendingKey)).toBe(JSON.stringify([mintUrl]));

        await store.removeMint(mintUrl);
        expect(mockStorage.has(pendingKey)).toBe(false);
    });

    it('does not wait for a pending restore retry to finish', async () => {
        seedPendingMints(mintUrl);
        (CashuDevKit.restore as jest.Mock).mockImplementation(
            () => new Promise(() => {})
        );

        const store = createStore();
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();
        expect(store.initializing).toBe(false);
        expect(store.mintUrls).toEqual([mintUrl]);
        expect(store.selectedMintUrl).toBe(mintUrl);
        expect(restoredMints()).toEqual([mintUrl]);
        expect(mockStorage.get(pendingKey)).toBe(JSON.stringify([mintUrl]));
    });

    it('updates the balance and clears the pending entry when a background retry succeeds', async () => {
        seedPendingMints(mintUrl);
        const restore = deferred<number>();
        (CashuDevKit.restore as jest.Mock).mockReturnValueOnce(restore.promise);

        const store = createStore();
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();
        expect(store.totalBalanceSats).toBe(0);
        expect(mockStorage.get(pendingKey)).toBe(JSON.stringify([mintUrl]));

        (CashuDevKit.getBalances as jest.Mock).mockResolvedValue({
            [mintUrl]: 21
        });
        (CashuDevKit.getTotalBalance as jest.Mock).mockResolvedValue(21);
        restore.resolve(21);
        await retryOf(store);

        expect(store.totalBalanceSats).toBe(21);
        expect(store.mintBalances).toEqual({ [mintUrl]: 21 });
        expect(mockStorage.has(pendingKey)).toBe(false);
    });

    it('drops a background retry that finishes after reset', async () => {
        seedPendingMints(mintUrl, otherMintUrl);
        const restore = deferred<number>();
        (CashuDevKit.restore as jest.Mock).mockReturnValueOnce(restore.promise);

        const store = createStore();
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();
        const retry = retryOf(store);
        store.reset();

        (CashuDevKit.getBalances as jest.Mock).mockResolvedValue({
            [mintUrl]: 21
        });
        (CashuDevKit.getTotalBalance as jest.Mock).mockResolvedValue(21);
        restore.resolve(21);
        await retry;

        // The second mint is not attempted and nothing is written back
        expect(restoredMints()).toEqual([mintUrl]);
        expect(store.totalBalanceSats).toBe(0);
        expect(store.mintBalances).toEqual({});
        expect(mockStorage.get(pendingKey)).toBe(
            JSON.stringify([mintUrl, otherMintUrl])
        );
    });

    it('does not start a second retry while one is running', async () => {
        seedPendingMints(mintUrl);
        const restore = deferred<number>();
        (CashuDevKit.restore as jest.Mock).mockReturnValueOnce(restore.promise);

        const store = createStore();
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();
        expect(restoredMints()).toEqual([mintUrl]);

        restore.resolve(0);
        await retryOf(store);
        expect(restoredMints()).toEqual([mintUrl]);
        expect(mockStorage.has(pendingKey)).toBe(false);
    });

    it('waits for a retry from before reset before retrying again', async () => {
        seedPendingMints(mintUrl);
        const restore = deferred<number>();
        (CashuDevKit.restore as jest.Mock).mockReturnValueOnce(restore.promise);

        const store = createStore();
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();
        store.reset();
        cacheMintInfos(store);
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();
        expect(restoredMints()).toEqual([mintUrl]);

        restore.resolve(0);
        await retryOf(store);
        expect(restoredMints()).toEqual([mintUrl, mintUrl]);
        expect(mockStorage.has(pendingKey)).toBe(false);
    });

    it('skips a mint that is removed before the retry reaches it', async () => {
        seedPendingMints(mintUrl, otherMintUrl);
        const restore = deferred<number>();
        (CashuDevKit.restore as jest.Mock).mockReturnValueOnce(restore.promise);

        const store = createStore();
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();
        expect(restoredMints()).toEqual([mintUrl]);

        const removal = store.removeMint(otherMintUrl);
        restore.resolve(0);
        await removal;
        await retryOf(store);

        expect(restoredMints()).toEqual([mintUrl]);
        expect(CashuDevKit.addMint).not.toHaveBeenCalledWith(otherMintUrl);
        expect(mockCdkMints).toEqual([mintUrl]);
        expect(store.mintUrls).toEqual([mintUrl]);
        expect(mockStorage.has(pendingKey)).toBe(false);
    });

    it('removes a mint only after its running restore retry stops', async () => {
        seedPendingMints(mintUrl);
        const restore = deferred<number>();
        (CashuDevKit.restore as jest.Mock).mockReturnValueOnce(restore.promise);

        const store = createStore();
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();

        // A CDK call the retry makes after the removal would add the mint
        // back, so the removal waits for the restore to return
        const removal = store.removeMint(mintUrl);
        expect(await settlesWithin(removal)).toBe(false);
        expect(CashuDevKit.removeMint).not.toHaveBeenCalled();

        restore.resolve(21);
        await removal;
        await retryOf(store);

        expect(CashuDevKit.removeMint).toHaveBeenCalledWith(mintUrl);
        expect(mockCdkMints).toEqual([]);
        expect(store.mintUrls).toEqual([]);
        expect(mockStorage.get('lnd-cashu-mintUrls')).toBe('[]');
        expect(mockStorage.has(pendingKey)).toBe(false);
    });

    it('does not restore a mint that is removed while the retry adds it', async () => {
        seedPendingMints(mintUrl);
        const addMint = deferred<void>();
        (CashuDevKit.addMint as jest.Mock).mockReturnValueOnce(addMint.promise);

        const store = createStore();
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();
        expect(CashuDevKit.addMint).toHaveBeenCalledWith(mintUrl);

        const removal = store.removeMint(mintUrl);
        addMint.resolve();
        await removal;
        await retryOf(store);

        expect(CashuDevKit.restore).not.toHaveBeenCalled();
        expect(mockCdkMints).toEqual([]);
        expect(mockStorage.has(pendingKey)).toBe(false);
    });

    it('drops the balance sync of a retry when reset runs during it', async () => {
        seedPendingMints(mintUrl);
        const restore = deferred<number>();
        (CashuDevKit.restore as jest.Mock).mockReturnValueOnce(restore.promise);

        const store = createStore();
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();
        const retry = retryOf(store);

        const balances = deferred<Record<string, number>>();
        (CashuDevKit.getBalances as jest.Mock).mockReturnValueOnce(
            balances.promise
        );
        (CashuDevKit.getTotalBalance as jest.Mock).mockResolvedValue(21);
        restore.resolve(21);
        await flush();
        expect(CashuDevKit.getBalances).toHaveBeenCalled();

        store.reset();
        balances.resolve({ [mintUrl]: 21 });
        await retry;

        expect(store.totalBalanceSats).toBe(0);
        expect(store.mintBalances).toEqual({});
    });

    it('sends from a mint only after its restore retry finishes', async () => {
        seedPendingMints(mintUrl);
        const restore = deferred<number>();
        (CashuDevKit.restore as jest.Mock).mockReturnValueOnce(restore.promise);
        (CashuDevKit.send as jest.Mock).mockResolvedValue({ encoded: 'token' });

        const store = createStore();
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();

        // CDK's restore writes the proofs it finds back as unspent, which
        // would release proofs a send running alongside it has reserved
        const send = store.sendTokenCDK(mintUrl, 10);
        expect(await settlesWithin(send)).toBe(false);
        expect(CashuDevKit.send).not.toHaveBeenCalled();

        restore.resolve(0);
        await send;
        expect(CashuDevKit.send).toHaveBeenCalledTimes(1);
    });

    it('melts from a mint only after its restore retry finishes', async () => {
        seedPendingMints(mintUrl);
        const restore = deferred<number>();
        (CashuDevKit.restore as jest.Mock).mockReturnValueOnce(restore.promise);
        (CashuDevKit.melt as jest.Mock).mockResolvedValue({ state: 'PAID' });

        const store = createStore();
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();

        const melt = (store as any).trackAndMelt({ mintUrl, quote: 'q1' });
        expect(await settlesWithin(melt)).toBe(false);
        expect(CashuDevKit.melt).not.toHaveBeenCalled();

        restore.resolve(0);
        await melt;
        expect(CashuDevKit.melt).toHaveBeenCalledWith(mintUrl, 'q1');
    });

    it('does not hold a send from a mint that is not being retried', async () => {
        seedPendingMints(mintUrl);
        mockCdkMints.push(otherMintUrl);
        (CashuDevKit.restore as jest.Mock).mockReturnValueOnce(
            new Promise(() => {})
        );
        (CashuDevKit.send as jest.Mock).mockResolvedValue({ encoded: 'token' });

        const store = createStore();
        expect(await settlesWithin(store.initializeWallets())).toBe(true);
        await flush();

        expect(await settlesWithin(store.sendTokenCDK(otherMintUrl, 10))).toBe(
            true
        );
    });

    it('keeps every entry when pending list updates overlap', async () => {
        const store = createStore();
        const setRestorePending = (url: string, pending: boolean) =>
            (store as any).setRestorePending(url, pending, 'lnd');

        await Promise.all([
            setRestorePending(mintUrl, true),
            setRestorePending(otherMintUrl, true)
        ]);
        expect(mockStorage.get(pendingKey)).toBe(
            JSON.stringify([mintUrl, otherMintUrl])
        );

        await Promise.all([
            setRestorePending(mintUrl, false),
            setRestorePending(otherMintUrl, false)
        ]);
        expect(mockStorage.has(pendingKey)).toBe(false);
    });

    it('applies later pending list updates after a failed write', async () => {
        const store = createStore();
        const setRestorePending = (url: string, pending: boolean) =>
            (store as any).setRestorePending(url, pending, 'lnd');
        const Storage = jest.requireMock('../storage');
        Storage.setItem.mockRejectedValueOnce(new Error('keychain'));

        const first = setRestorePending(mintUrl, true);
        const second = setRestorePending(otherMintUrl, true);
        await expect(first).rejects.toThrow('keychain');
        await second;
        expect(mockStorage.get(pendingKey)).toBe(
            JSON.stringify([otherMintUrl])
        );
    });

    it('treats an unreadable pending list as empty', async () => {
        mockStorage.set('lnd-cashu-mintUrls', JSON.stringify([mintUrl]));
        mockStorage.set(pendingKey, 'not json');
        mockCdkMints.push(mintUrl);

        await startApp();
        expect(CashuDevKit.restore).not.toHaveBeenCalled();
    });
});
