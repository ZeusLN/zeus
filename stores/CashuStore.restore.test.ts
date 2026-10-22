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

// A seed-recovered embedded LND wallet starting the app
const startApp = async () => {
    const store = new CashuStore(
        { implementation: 'embedded-lnd', seedPhrase: words } as any,
        {} as any,
        { channels: [] } as any,
        {} as any
    );
    store.reset();
    // Cached info keeps fetchMintInfo from leaving its timeout timer behind
    store.mintInfos = { [mintUrl]: {} as any, [otherMintUrl]: {} as any };
    await store.initializeWallets();
    return store;
};

const restoredMints = () =>
    (CashuDevKit.restore as jest.Mock).mock.calls.map(([url]) => url);

describe('CashuStore: ecash restore after seed recovery', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStorage.clear();
        mockCdkMints.length = 0;
        (CashuDevKit.restore as jest.Mock).mockReset().mockResolvedValue(0);
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

    it('treats an unreadable pending list as empty', async () => {
        mockStorage.set('lnd-cashu-mintUrls', JSON.stringify([mintUrl]));
        mockStorage.set(pendingKey, 'not json');
        mockCdkMints.push(mintUrl);

        await startApp();
        expect(CashuDevKit.restore).not.toHaveBeenCalled();
    });
});
