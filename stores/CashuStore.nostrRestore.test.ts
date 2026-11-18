// The startup restore of the mint list from Nostr runs only while no mint
// list has been stored for the wallet. When no relay can be reached it must
// leave the list unstored, so the next start asks again, and must not
// publish a backup over the one it could not read.
jest.mock('./Stores', () => ({
    activityStore: { getSortedActivity: jest.fn() },
    connectivityStore: {
        start: jest.fn(),
        stop: jest.fn(),
        onReconnect: jest.fn()
    }
}));
jest.mock('./SettingsStore', () => ({
    DEFAULT_NOSTR_RELAYS: ['wss://relay.one', 'wss://relay.two']
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@nostr-dev-kit/ndk', () => ({
    __esModule: true,
    default: jest.fn()
}));
jest.mock('../utils/NostrUtils', () => ({}));
jest.mock('../utils/NostrMintBackup', () => {
    class MintBackupRelaysUnreachableError extends Error {}
    return {
        MintBackupRelaysUnreachableError,
        deriveMintBackupKeypair: jest.fn(() => ({
            privateKeyHex: 'priv',
            publicKeyHex: 'pub'
        })),
        backupMintsToNostr: jest.fn().mockResolvedValue(1768435200),
        restoreMintsFromNostr: jest.fn()
    };
});
jest.mock('../utils/MigrationUtils', () => ({
    __esModule: true,
    default: {
        migrateCashuSeedVersion: jest.fn().mockResolvedValue(undefined)
    }
}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils');
jest.mock('../NavigationService', () => ({}));
jest.mock('../cashu-cdk', () => ({
    isAvailable: jest.fn(() => true),
    getMintUrls: jest.fn().mockResolvedValue([]),
    addMint: jest.fn().mockResolvedValue(undefined),
    removeMint: jest.fn().mockResolvedValue(undefined),
    restore: jest.fn().mockResolvedValue(0),
    deleteWalletDatabase: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../storage', () => ({
    setItem: jest.fn().mockResolvedValue(true),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(true),
    getRawItem: jest.fn(),
    removeRawItem: jest.fn().mockResolvedValue(undefined),
    KEY_PREFIX: 'zeus:'
}));

import CashuStore from './CashuStore';
import Storage from '../storage';
import CashuDevKit from '../cashu-cdk';
import {
    MintBackupRelaysUnreachableError,
    backupMintsToNostr,
    restoreMintsFromNostr
} from '../utils/NostrMintBackup';

const MINT_URLS_KEY = 'lnd-cashu-mintUrls';
const SAVED_MINT = 'https://mint.savings.example';

const newStore = (initialMintUrls?: string[]) => {
    const settingsStore: any = {
        implementation: 'embedded-lnd',
        lndDir: 'lnd',
        settings: { ecash: { initialMintUrls } },
        updateSettingsGroup: jest.fn().mockResolvedValue(undefined)
    };
    const store = new CashuStore(
        settingsStore,
        {} as any,
        {} as any,
        {} as any
    );
    const s: any = store;
    s.initializeCDK = jest.fn().mockResolvedValue(true);
    s.initializeWallet = jest.fn().mockResolvedValue(undefined);
    s.syncCDKBalances = jest.fn().mockResolvedValue(undefined);
    s.enrichTokensWithProofs = jest.fn().mockResolvedValue(undefined);
    s.fetchMintInfo = jest.fn().mockResolvedValue(undefined);
    s.checkPendingItems = jest.fn();
    s.sweepOfflinePendingTokens = jest.fn();
    s.restoreV1Proofs = jest.fn().mockResolvedValue(false);
    s.getNostrBackupSeed = jest.fn(() => new Uint8Array(32));
    return store;
};

const OTHER_MINT = 'https://mint.spending.example';

// A promise the test settles by hand
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

// Lets initializeWallets run until the mock has been called
const untilCalled = async (mock: any) => {
    for (let i = 0; i < 50; i++) {
        if ((mock as jest.Mock).mock.calls.length > 0) return;
        await new Promise((resolve) => setImmediate(resolve));
    }
    throw new Error('mock was not called');
};

const storedMintLists = () =>
    (Storage.setItem as jest.Mock).mock.calls
        .filter(([key]) => key === MINT_URLS_KEY)
        .map(([, value]) => value);

describe('CashuStore startup restore of the mint list from Nostr', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Storage.getItem as jest.Mock).mockResolvedValue(null);
        (CashuDevKit.getMintUrls as jest.Mock).mockResolvedValue([]);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    describe('when no relay can be reached', () => {
        beforeEach(() => {
            (restoreMintsFromNostr as jest.Mock).mockRejectedValue(
                new MintBackupRelaysUnreachableError()
            );
        });

        it('does not store an empty mint list', async () => {
            await newStore().initializeWallets();

            expect(storedMintLists()).toEqual([]);
        });

        // A CDK mint missing from the list (from a token swept to
        // self-custody) is kept out of it until its recovery removes it
        it('does not store a mint list when CDK has a mint that is not in it', async () => {
            (CashuDevKit.getMintUrls as jest.Mock).mockResolvedValue([
                'https://m'
            ]);

            const store = newStore();
            await store.initializeWallets();

            expect(store.mintUrls).toEqual([]);
            expect(storedMintLists()).toEqual([]);
        });

        it('does not add the onboarding mints over the unread backup', async () => {
            const store = newStore(['https://onboarding.example']);
            const addMint = jest
                .spyOn(store, 'addMint')
                .mockResolvedValue({} as any);

            await store.initializeWallets();

            expect(addMint).not.toHaveBeenCalled();
        });

        it('does not publish a backup until the restore has been read', async () => {
            const store = newStore();
            await store.initializeWallets();

            await store.nostrBackupMints();

            expect(backupMintsToNostr).not.toHaveBeenCalled();
        });

        it('restores the mint list once a relay answers', async () => {
            const store = newStore();
            await store.initializeWallets();

            (restoreMintsFromNostr as jest.Mock).mockResolvedValue({
                mints: [SAVED_MINT],
                timestamp: 1768435200
            });
            await store.initializeWallets();

            expect(restoreMintsFromNostr).toHaveBeenCalledTimes(2);
            expect(storedMintLists()[0]).toEqual(JSON.stringify([SAVED_MINT]));
            expect(CashuDevKit.addMint).toHaveBeenCalledWith(SAVED_MINT);

            await store.nostrBackupMints();
            expect(backupMintsToNostr).toHaveBeenCalled();
        });
    });

    describe('while the relays are being asked', () => {
        // A restore that stays unanswered until the test settles it
        const deferRestore = () => {
            let resolve!: (value: any) => void;
            let reject!: (reason: any) => void;
            (restoreMintsFromNostr as jest.Mock).mockReturnValueOnce(
                new Promise((res, rej) => {
                    resolve = res;
                    reject = rej;
                })
            );
            return { resolve, reject };
        };

        // Lets initializeWallets run up to the pending restore
        const untilRestoreStarted = async (calls: number) => {
            for (let i = 0; i < 50; i++) {
                if (
                    (restoreMintsFromNostr as jest.Mock).mock.calls.length ===
                    calls
                ) {
                    return;
                }
                await new Promise((resolve) => setImmediate(resolve));
            }
            throw new Error('restore was not started');
        };

        it('does not publish a backup during a retry of a restore that reached no relay', async () => {
            (restoreMintsFromNostr as jest.Mock).mockRejectedValueOnce(
                new MintBackupRelaysUnreachableError()
            );
            const store = newStore();
            await store.initializeWallets();

            const restore = deferRestore();
            const init = store.initializeWallets();
            await untilRestoreStarted(2);

            await store.nostrBackupMints();
            expect(backupMintsToNostr).not.toHaveBeenCalled();

            restore.resolve({ mints: [SAVED_MINT], timestamp: 1768435200 });
            await init;

            expect(storedMintLists()[0]).toEqual(JSON.stringify([SAVED_MINT]));
            await store.nostrBackupMints();
            expect(backupMintsToNostr).toHaveBeenCalledTimes(1);
        });

        it('does not publish a backup while CDK starts for a retry', async () => {
            (restoreMintsFromNostr as jest.Mock).mockRejectedValueOnce(
                new MintBackupRelaysUnreachableError()
            );
            const store = newStore();
            await store.initializeWallets();

            (restoreMintsFromNostr as jest.Mock).mockResolvedValue(null);
            (store as any).initializeCDK = jest.fn(async () => {
                await store.nostrBackupMints();
                return true;
            });
            await store.initializeWallets();

            expect((store as any).initializeCDK).toHaveBeenCalledTimes(1);
            expect(backupMintsToNostr).not.toHaveBeenCalled();
        });

        it('does not publish a backup during the first restore', async () => {
            const restore = deferRestore();
            const store = newStore();
            const init = store.initializeWallets();
            await untilRestoreStarted(1);

            await store.nostrBackupMints();
            expect(backupMintsToNostr).not.toHaveBeenCalled();

            restore.resolve(null);
            await init;

            await store.nostrBackupMints();
            expect(backupMintsToNostr).toHaveBeenCalledTimes(1);
        });

        it('allows backups again after a restore that failed for another reason', async () => {
            const store = newStore();
            (store as any).getNostrBackupSeed.mockImplementationOnce(() => {
                throw new Error('no seed');
            });

            await store.initializeWallets();

            expect(restoreMintsFromNostr).not.toHaveBeenCalled();
            await store.nostrBackupMints();
            expect(backupMintsToNostr).toHaveBeenCalledTimes(1);
        });

        it('keeps backups held back when the retry reaches no relay either', async () => {
            (restoreMintsFromNostr as jest.Mock).mockRejectedValue(
                new MintBackupRelaysUnreachableError()
            );
            const store = newStore();
            await store.initializeWallets();
            await store.initializeWallets();

            await store.nostrBackupMints();

            expect(restoreMintsFromNostr).toHaveBeenCalledTimes(2);
            expect(backupMintsToNostr).not.toHaveBeenCalled();
        });
    });

    describe('while the restored mints are added', () => {
        it('does not publish a backup until the restored mints are in the list', async () => {
            (restoreMintsFromNostr as jest.Mock).mockResolvedValue({
                mints: [SAVED_MINT, OTHER_MINT],
                timestamp: 1768435200
            });
            // CDK lists the mints that were added to it
            (CashuDevKit.getMintUrls as jest.Mock).mockImplementation(
                async () =>
                    (CashuDevKit.addMint as jest.Mock).mock.calls.map(
                        ([url]) => url
                    )
            );
            const firstAdd = deferred<void>();
            (CashuDevKit.addMint as jest.Mock).mockReturnValueOnce(
                firstAdd.promise
            );
            const store = newStore();
            const init = store.initializeWallets();
            await untilCalled(CashuDevKit.addMint);

            await store.nostrBackupMints();
            expect(backupMintsToNostr).not.toHaveBeenCalled();

            firstAdd.resolve();
            await init;

            await store.nostrBackupMints();
            expect(backupMintsToNostr).toHaveBeenCalledTimes(1);
            expect((backupMintsToNostr as jest.Mock).mock.calls[0][2]).toEqual([
                SAVED_MINT,
                OTHER_MINT
            ]);
        });

        it('allows backups again when a step after the answer fails', async () => {
            (restoreMintsFromNostr as jest.Mock).mockResolvedValue(null);
            (CashuDevKit.getMintUrls as jest.Mock).mockRejectedValue(
                new Error('getMintUrls failed')
            );
            const store = newStore();

            await store.initializeWallets();

            await store.nostrBackupMints();
            expect(backupMintsToNostr).toHaveBeenCalledTimes(1);
        });

        it('keeps backups held back when no relay answered and a later step fails', async () => {
            (restoreMintsFromNostr as jest.Mock).mockRejectedValue(
                new MintBackupRelaysUnreachableError()
            );
            (CashuDevKit.getMintUrls as jest.Mock).mockRejectedValue(
                new Error('getMintUrls failed')
            );
            const store = newStore();

            await store.initializeWallets();

            await store.nostrBackupMints();
            expect(backupMintsToNostr).not.toHaveBeenCalled();
        });
    });

    describe('on a first start', () => {
        it('does not publish a backup while CDK starts', async () => {
            (restoreMintsFromNostr as jest.Mock).mockResolvedValue(null);
            const cdkStarted = deferred<boolean>();
            const store = newStore();
            const s: any = store;
            s.initializeCDK = jest.fn(() => cdkStarted.promise);
            const init = store.initializeWallets();
            await untilCalled(s.initializeCDK);

            await store.nostrBackupMints();
            expect(backupMintsToNostr).not.toHaveBeenCalled();
            expect(restoreMintsFromNostr).not.toHaveBeenCalled();

            cdkStarted.resolve(true);
            await init;

            await store.nostrBackupMints();
            expect(backupMintsToNostr).toHaveBeenCalledTimes(1);
        });

        it('keeps backups held back when CDK does not start', async () => {
            const store = newStore();
            (store as any).initializeCDK = jest.fn().mockResolvedValue(false);

            await store.initializeWallets();

            expect(restoreMintsFromNostr).not.toHaveBeenCalled();
            await store.nostrBackupMints();
            expect(backupMintsToNostr).not.toHaveBeenCalled();
        });
    });

    it('allows a backup at once when a mint list is stored', async () => {
        (restoreMintsFromNostr as jest.Mock).mockRejectedValueOnce(
            new MintBackupRelaysUnreachableError()
        );
        const store = newStore();
        await store.initializeWallets();

        // The list is stored by the time of the next start
        (Storage.getItem as jest.Mock).mockImplementation(async (key) =>
            key === MINT_URLS_KEY ? '[]' : null
        );
        const s: any = store;
        let publishedDuringInit = 0;
        s.initializeCDK = jest.fn(async () => {
            await store.nostrBackupMints();
            publishedDuringInit = (backupMintsToNostr as jest.Mock).mock.calls
                .length;
            return true;
        });
        await store.initializeWallets();

        expect(publishedDuringInit).toBe(1);
        expect(restoreMintsFromNostr).toHaveBeenCalledTimes(1);
    });

    it('stores the empty mint list when a relay answered with no backup', async () => {
        (restoreMintsFromNostr as jest.Mock).mockResolvedValue(null);
        const store = newStore();

        await store.initializeWallets();

        expect(storedMintLists()).toEqual(['[]']);
        await store.nostrBackupMints();
        expect(backupMintsToNostr).toHaveBeenCalled();
    });

    it('does not ask the relays when a mint list is stored', async () => {
        (Storage.getItem as jest.Mock).mockImplementation(async (key) =>
            key === MINT_URLS_KEY ? '[]' : null
        );

        await newStore().initializeWallets();

        expect(restoreMintsFromNostr).not.toHaveBeenCalled();
    });

    // Adding or removing a mint stores the mint list, which alone used to
    // end the restore
    describe('when a mint is added before a relay could be reached', () => {
        const PENDING_KEY = 'lnd-cashu-nostrMintRestorePending';
        let storage: Map<string, string>;
        let cdkMints: Set<string>;

        beforeEach(() => {
            storage = new Map();
            (Storage.getItem as jest.Mock).mockImplementation(
                async (key: string) => storage.get(key) ?? null
            );
            (Storage.setItem as jest.Mock).mockImplementation(
                async (key: string, value: string) => {
                    storage.set(key, value);
                    return true;
                }
            );
            (Storage.removeItem as jest.Mock).mockImplementation(
                async (key: string) => {
                    storage.delete(key);
                    return true;
                }
            );
            // CDK keeps its mints across starts
            cdkMints = new Set();
            (CashuDevKit.getMintUrls as jest.Mock).mockImplementation(
                async () => [...cdkMints]
            );
            (CashuDevKit.addMint as jest.Mock).mockImplementation(
                async (url: string) => {
                    cdkMints.add(url);
                }
            );
        });

        // First start with no relay reachable, then the user adds a mint
        const addMintWhileUnreachable = async () => {
            (restoreMintsFromNostr as jest.Mock).mockRejectedValueOnce(
                new MintBackupRelaysUnreachableError()
            );
            const store = newStore();
            await store.initializeWallets();
            await store.addMint(OTHER_MINT);
            expect(storage.get(MINT_URLS_KEY)).toEqual(
                JSON.stringify([OTHER_MINT])
            );
        };

        it('asks the relays again at the next start and keeps the added mint', async () => {
            await addMintWhileUnreachable();

            (restoreMintsFromNostr as jest.Mock).mockResolvedValue({
                mints: [SAVED_MINT],
                timestamp: 1768435200
            });
            const store = newStore();
            await store.initializeWallets();

            expect(restoreMintsFromNostr).toHaveBeenCalledTimes(2);
            expect(CashuDevKit.addMint).toHaveBeenCalledWith(SAVED_MINT);
            expect(store.mintUrls).toEqual([OTHER_MINT, SAVED_MINT]);
            expect(storage.get(MINT_URLS_KEY)).toEqual(
                JSON.stringify([OTHER_MINT, SAVED_MINT])
            );
            await store.nostrBackupMints();
            expect((backupMintsToNostr as jest.Mock).mock.calls[0][2]).toEqual([
                OTHER_MINT,
                SAVED_MINT
            ]);
        });

        it('does not publish a backup at the next start while no relay can be reached', async () => {
            await addMintWhileUnreachable();

            (restoreMintsFromNostr as jest.Mock).mockRejectedValueOnce(
                new MintBackupRelaysUnreachableError()
            );
            const store = newStore();
            await store.initializeWallets();
            await store.nostrBackupMints();

            expect(restoreMintsFromNostr).toHaveBeenCalledTimes(2);
            expect(backupMintsToNostr).not.toHaveBeenCalled();
            expect(storage.get(PENDING_KEY)).toEqual('true');
        });

        it('stops asking once a relay has answered', async () => {
            await addMintWhileUnreachable();
            expect(storage.get(PENDING_KEY)).toEqual('true');

            (restoreMintsFromNostr as jest.Mock).mockResolvedValue(null);
            const store = newStore();
            await store.initializeWallets();

            expect(storage.has(PENDING_KEY)).toBe(false);
            expect(store.mintUrls).toEqual([OTHER_MINT]);
            expect(storage.get(MINT_URLS_KEY)).toEqual(
                JSON.stringify([OTHER_MINT])
            );

            await newStore().initializeWallets();
            expect(restoreMintsFromNostr).toHaveBeenCalledTimes(2);
        });

        it('keeps asking when the restore fails for another reason', async () => {
            await addMintWhileUnreachable();

            const store = newStore();
            (store as any).getNostrBackupSeed.mockImplementationOnce(() => {
                throw new Error('no seed');
            });
            await store.initializeWallets();
            expect(storage.get(PENDING_KEY)).toEqual('true');

            (restoreMintsFromNostr as jest.Mock).mockResolvedValue(null);
            await newStore().initializeWallets();
            expect(restoreMintsFromNostr).toHaveBeenCalledTimes(2);
        });

        it('is forgotten when the Cashu data is deleted', async () => {
            await addMintWhileUnreachable();
            expect(storage.get(PENDING_KEY)).toEqual('true');

            const store = newStore();
            // No empty backup publish, so no 10 s race timer
            (store as any).getNostrBackupSeed = jest.fn(() => null);
            await store.deleteCashuData();

            expect(storage.has(PENDING_KEY)).toBe(false);
            await newStore().initializeWallets();
            expect(restoreMintsFromNostr).toHaveBeenCalledTimes(1);
        });
    });
});
