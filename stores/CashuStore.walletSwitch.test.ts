jest.mock('./Stores', () => ({
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
jest.mock('../utils/NostrMintBackup', () => ({}));
jest.mock('../utils/MigrationUtils', () => ({
    __esModule: true,
    default: {
        migrateLegacyCashuKeysToNodeDir: jest.fn().mockResolvedValue(undefined),
        migrateCashuSeedVersion: jest.fn().mockResolvedValue(undefined)
    }
}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
jest.mock('../NavigationService', () => ({}));

// The native CDK module keeps one wallet open at a time: initializeWallet
// opens that mnemonic's database and every later call acts on whichever
// database is open when it arrives
type Database = { mints: string[]; received: string[] };
const mockCdk = {
    databases: {} as Record<string, Database>,
    openMnemonic: '',
    // The first receive() waits on the mint until the test releases it
    answerFirstClaim: undefined as (() => void) | undefined,
    // Claims of these tokens fail as already spent
    spentTokens: [] as string[]
};
const mockOpenDatabase = () => mockCdk.databases[mockCdk.openMnemonic];
jest.mock('../cashu-cdk', () => ({
    isAvailable: () => true,
    initializeWallet: async (mnemonic: string) => {
        mockCdk.databases[mnemonic] ??= { mints: [], received: [] };
        mockCdk.openMnemonic = mnemonic;
    },
    addMint: async (mintUrl: string) => {
        const { mints } = mockOpenDatabase();
        if (!mints.includes(mintUrl)) mints.push(mintUrl);
    },
    removeMint: async () => {},
    getMintUrls: async () => [...mockOpenDatabase().mints],
    receive: async (encodedToken: string) => {
        const database = mockOpenDatabase();
        if (!mockCdk.answerFirstClaim) {
            await new Promise<void>((resolve) => {
                mockCdk.answerFirstClaim = resolve;
            });
        }
        if (mockCdk.spentTokens.includes(encodedToken)) {
            throw new Error('Token already spent');
        }
        database.received.push(encodedToken);
        return 100;
    },
    restore: async () => 0,
    getBalances: async () => ({}),
    getTotalBalance: async () => 0,
    listTransactions: async () => []
}));

const mockKeychain: Record<string, string> = {};
jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => mockKeychain[key] ?? false),
        setItem: jest.fn(async (key: string, value: any) => {
            mockKeychain[key] =
                typeof value === 'string' ? value : JSON.stringify(value);
            return true;
        }),
        removeItem: jest.fn(async (key: string) => {
            delete mockKeychain[key];
        })
    },
    getRawItem: jest.fn(),
    removeRawItem: jest.fn(),
    KEY_PREFIX: 'zeus:'
}));

import CashuStore from './CashuStore';

// BIP-39 test vectors, never real wallets
const SEED_A = `${'abandon '.repeat(11)}about`;
const SEED_B =
    'legal winner thank year wave sausage worth useful legal winner thank yellow';

// An embedded wallet as initializeWallets() finds it in the keychain, with
// the tokens claimTokenOffline() queued while the phone had no network
const storeWallet = (
    lndDir: string,
    seed: string,
    mint: string,
    queuedTokens: string[]
) => {
    mockKeychain[`${lndDir}-cashu-seed-phrase`] = JSON.stringify(
        seed.split(' ')
    );
    mockKeychain[`${lndDir}-cashu-seed-version`] = 'v2-bip39';
    mockKeychain[`${lndDir}-cashu-mintUrls`] = JSON.stringify([mint]);
    mockKeychain[`${lndDir}-cashu-selectedMintUrl`] = mint;
    mockKeychain[`${lndDir}-cashu-offline-pending-tokens`] = JSON.stringify(
        queuedTokens.map((encodedToken) => ({
            mint,
            unit: 'sat',
            proofs: [
                { amount: 100, id: '00ad', secret: encodedToken, C: '02' }
            ],
            encodedToken,
            received: true,
            pendingClaim: true
        }))
    );
};

const storedTokens = (key: string) =>
    JSON.parse(mockKeychain[key] || '[]').map(
        (token: any) => token.encodedToken
    );

describe('CashuStore offline-token sweep across a wallet switch', () => {
    let settingsStore: any;
    let store: CashuStore;
    let sweeps: jest.SpyInstance;

    // What Wallet.fetchDataCore() does when the user selects wallet B:
    // SettingsStore has already loaded B's node, then the store is reset
    const switchToWalletB = () => {
        settingsStore.lndDir = 'walletB';
        store.reset();
    };

    beforeEach(async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        Object.keys(mockKeychain).forEach((key) => delete mockKeychain[key]);
        mockCdk.databases = {};
        mockCdk.openMnemonic = '';
        mockCdk.answerFirstClaim = undefined;
        mockCdk.spentTokens = [];

        storeWallet('walletA', SEED_A, 'https://mint-a.example', [
            'token-1-for-wallet-A',
            'token-2-for-wallet-A'
        ]);
        storeWallet('walletB', SEED_B, 'https://mint-b.example', [
            'token-for-wallet-B'
        ]);

        settingsStore = {
            implementation: 'embedded-lnd',
            lndDir: 'walletA',
            settings: { ecash: { enableCashu: true } },
            updateSettingsGroup: jest.fn()
        };
        store = new CashuStore(
            settingsStore,
            {} as any,
            { channels: [] } as any,
            {} as any
        );
        sweeps = jest.spyOn(store, 'sweepOfflinePendingTokens');
        // the background mint-info fetch arms a timer that would outlive
        // the test
        jest.spyOn(store, 'fetchMintInfo').mockResolvedValue(null);

        // Start on wallet A; its sweep runs until A's first claim, which
        // then waits on the mint
        await store.initializeWallets();
        await new Promise(setImmediate);
        expect(mockCdk.openMnemonic).toBe(SEED_A);
        expect(mockCdk.answerFirstClaim).toBeDefined();
    });

    afterEach(() => jest.restoreAllMocks());

    it("leaves wallet B's stored offline queue alone", async () => {
        switchToWalletB();

        // A's first claim returns while B's node is still starting
        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;

        expect(storedTokens('walletB-cashu-offline-pending-tokens')).toEqual([
            'token-for-wallet-B'
        ]);
    });

    it("does not claim wallet A's tokens into wallet B's CDK database", async () => {
        switchToWalletB();
        await store.initializeWallets();
        // B's own sweep claims B's token
        await sweeps.mock.results[1].value;
        expect(mockCdk.openMnemonic).toBe(SEED_B);

        // A's first claim returns only now
        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;

        expect(mockCdk.databases[SEED_B].received).toEqual([
            'token-for-wallet-B'
        ]);
        expect(mockCdk.databases[SEED_A].received).toEqual([
            'token-1-for-wallet-A'
        ]);
        expect(store.offlinePendingTokens).toEqual([]);
    });

    it("updates wallet A's stored queues with what its sweep got done", async () => {
        switchToWalletB();

        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;

        // The claimed token leaves A's queue, the unclaimed one stays
        expect(storedTokens('walletA-cashu-offline-pending-tokens')).toEqual([
            'token-2-for-wallet-A'
        ]);
    });

    it("keeps tokens added to wallet A's stored queue after its sweep started", async () => {
        const queued = JSON.parse(
            mockKeychain['walletA-cashu-offline-pending-tokens']
        );
        mockKeychain['walletA-cashu-offline-pending-tokens'] = JSON.stringify([
            ...queued,
            { ...queued[0], encodedToken: 'token-3-for-wallet-A' }
        ]);
        switchToWalletB();

        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;

        expect(storedTokens('walletA-cashu-offline-pending-tokens')).toEqual([
            'token-2-for-wallet-A',
            'token-3-for-wallet-A'
        ]);
    });

    it("files tokens the mint reported spent under wallet A's spent list", async () => {
        mockCdk.spentTokens = ['token-1-for-wallet-A'];
        mockKeychain['walletA-cashu-offline-spent-tokens'] = JSON.stringify([
            { encodedToken: 'token-0-for-wallet-A', spent: true }
        ]);
        switchToWalletB();

        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;

        expect(storedTokens('walletA-cashu-offline-pending-tokens')).toEqual([
            'token-2-for-wallet-A'
        ]);
        expect(storedTokens('walletA-cashu-offline-spent-tokens')).toEqual([
            'token-0-for-wallet-A',
            'token-1-for-wallet-A'
        ]);
        // Nothing of A's reaches the store, which now belongs to B
        expect(store.offlineSpentTokens).toEqual([]);
        expect(store.showOfflineSpentAlert).toBe(false);
    });
});
