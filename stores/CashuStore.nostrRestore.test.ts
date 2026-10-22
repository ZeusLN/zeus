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
        migrateLegacyCashuKeysToNodeDir: jest.fn().mockResolvedValue(undefined),
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
    restore: jest.fn().mockResolvedValue(0)
}));
jest.mock('../storage', () => ({
    setItem: jest.fn().mockResolvedValue(true),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(true),
    getRawItem: jest.fn(),
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
});
