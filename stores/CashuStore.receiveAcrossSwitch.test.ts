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
        migrateCashuSeedVersion: jest.fn().mockResolvedValue(undefined)
    }
}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
jest.mock('../NavigationService', () => ({}));

// Models the Android module: initializeWallet opens a new handle on the
// mnemonic's database file and destroys the previous handle. A call keeps
// the handle that was open when it arrived, and fails once that handle is
// destroyed. The mint swaps a token's inputs when it answers the receive,
// before the wallet stores the new proofs
type DatabaseFile = { mints: string[]; received: string[] };
type Handle = { file: DatabaseFile; destroyed: boolean };
const DESTROYED =
    'UnexpectedUniFFICallbackError(reason: "java.lang.IllegalStateException: WalletSqliteDatabase object has already been destroyed")';
const mockCdk = {
    files: {} as Record<string, DatabaseFile>,
    open: undefined as Handle | undefined,
    openMnemonic: '',
    // Tokens whose inputs the mint has swapped
    swappedAtMint: [] as string[],
    // Each receive waits on the mint until the test answers it
    heldClaims: [] as Array<() => void>,
    // addMint() of this mint waits until the test answers it
    holdMint: '',
    answerAddMint: undefined as (() => void) | undefined
};
const mockHandle = () => {
    if (!mockCdk.open) throw new Error('Wallet not initialized');
    return mockCdk.open;
};
jest.mock('../cashu-cdk', () => ({
    isAvailable: () => true,
    initializeWallet: async (mnemonic: string) => {
        mockCdk.files[mnemonic] ??= { mints: [], received: [] };
        const previous = mockCdk.open;
        mockCdk.open = { file: mockCdk.files[mnemonic], destroyed: false };
        mockCdk.openMnemonic = mnemonic;
        if (previous) previous.destroyed = true;
    },
    addMint: async (mintUrl: string) => {
        const handle = mockHandle();
        if (mintUrl === mockCdk.holdMint) {
            await new Promise<void>((resolve) => {
                mockCdk.answerAddMint = resolve;
            });
        }
        if (handle.destroyed) throw new Error(DESTROYED);
        if (!handle.file.mints.includes(mintUrl)) {
            handle.file.mints.push(mintUrl);
        }
    },
    removeMint: async () => {},
    getMintUrls: async () => [...mockHandle().file.mints],
    receive: async (encodedToken: string) => {
        const handle = mockHandle();
        if (mockCdk.swappedAtMint.includes(encodedToken)) {
            throw new Error('Token already spent');
        }
        await new Promise<void>((resolve) => {
            mockCdk.heldClaims.push(resolve);
        });
        mockCdk.swappedAtMint.push(encodedToken);
        if (handle.destroyed) throw new Error(DESTROYED);
        handle.file.received.push(encodedToken);
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
const MINT = 'https://mint.example';
const NEW_MINT = 'https://new-mint.example';

const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
};

// A wallet as initializeWallets() finds it in the keychain, with tokens
// claimTokenOffline() queued while the phone had no network
const storeWallet = (lndDir: string, seed: string, queuedTokens: string[]) => {
    mockKeychain[`${lndDir}-cashu-seed-phrase`] = JSON.stringify(
        seed.split(' ')
    );
    mockKeychain[`${lndDir}-cashu-seed-version`] = 'v2-bip39';
    mockKeychain[`${lndDir}-cashu-mintUrls`] = JSON.stringify([MINT]);
    mockKeychain[`${lndDir}-cashu-selectedMintUrl`] = MINT;
    mockKeychain[`${lndDir}-cashu-offline-pending-tokens`] = JSON.stringify(
        queuedTokens.map((encodedToken) => ({
            mint: MINT,
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

let settingsStore: any;
let store: CashuStore;

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    Object.keys(mockKeychain).forEach((key) => delete mockKeychain[key]);
    mockCdk.files = {};
    mockCdk.open = undefined;
    mockCdk.openMnemonic = '';
    mockCdk.swappedAtMint = [];
    mockCdk.heldClaims = [];
    mockCdk.holdMint = '';
    mockCdk.answerAddMint = undefined;

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
    // the background mint-info fetch arms a timer that would outlive
    // the test
    jest.spyOn(store, 'fetchMintInfo').mockResolvedValue(null);
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

// Open the CDK wallet of a seed the way initializeWallets() does
const openCDK = (seed: string) => {
    store.seedPhrase = seed.split(' ');
    return store.initializeCDK();
};

// What Wallet.fetchDataCore() does when the user selects wallet B
const startSwitchToWalletB = () => {
    settingsStore.lndDir = 'walletB';
    store.reset();
    return openCDK(SEED_B);
};

describe('CashuStore receive in flight at a wallet switch', () => {
    it('stores the proofs in the wallet the receive started on', async () => {
        await openCDK(SEED_A);
        const claim = store.receiveTokenCDK('token-A', undefined, MINT);
        await flush();
        expect(mockCdk.heldClaims).toHaveLength(1);

        const opening = startSwitchToWalletB();
        await flush();
        // Wallet A's database stays open while the mint has the swap
        expect(mockCdk.openMnemonic).toBe(SEED_A);

        mockCdk.heldClaims[0]();
        await expect(claim).resolves.toBe(100);
        await expect(opening).resolves.toBe(true);

        expect(mockCdk.swappedAtMint).toEqual(['token-A']);
        expect(mockCdk.files[SEED_A].received).toEqual(['token-A']);
        expect(mockCdk.files[SEED_B].received).toEqual([]);
        expect(mockCdk.openMnemonic).toBe(SEED_B);
        expect(store.cdkInitialized).toBe(true);
    });

    it("waits for a receive still adding the token's mint", async () => {
        await openCDK(SEED_A);
        mockCdk.holdMint = NEW_MINT;
        const claim = store.receiveTokenCDK('token-A', undefined, NEW_MINT);
        await flush();
        expect(mockCdk.answerAddMint).toBeDefined();

        const opening = startSwitchToWalletB();
        await flush();
        expect(mockCdk.openMnemonic).toBe(SEED_A);

        mockCdk.answerAddMint!();
        await flush();
        expect(mockCdk.heldClaims).toHaveLength(1);
        expect(mockCdk.openMnemonic).toBe(SEED_A);

        mockCdk.heldClaims[0]();
        await expect(claim).resolves.toBe(100);
        await expect(opening).resolves.toBe(true);

        expect(mockCdk.files[SEED_A].mints).toContain(NEW_MINT);
        expect(mockCdk.files[SEED_A].received).toEqual(['token-A']);
        expect(mockCdk.files[SEED_B].received).toEqual([]);
    });

    it("keeps an offline token's proofs when the sweep claiming it is cut off by a switch", async () => {
        storeWallet('walletA', SEED_A, ['token-for-wallet-A']);
        storeWallet('walletB', SEED_B, []);
        await store.initializeWallets();
        await flush();
        // A's sweep is waiting on the mint
        expect(mockCdk.heldClaims).toHaveLength(1);

        settingsStore.lndDir = 'walletB';
        store.reset();
        const openingB = store.initializeWallets();
        await flush();
        expect(mockCdk.openMnemonic).toBe(SEED_A);

        mockCdk.heldClaims[0]();
        await openingB;

        expect(mockCdk.swappedAtMint).toEqual(['token-for-wallet-A']);
        expect(mockCdk.files[SEED_A].received).toEqual(['token-for-wallet-A']);
        expect(mockCdk.openMnemonic).toBe(SEED_B);
    });

    it('opens the next wallet once the wait limit passes', async () => {
        jest.useFakeTimers();
        await openCDK(SEED_A);
        const claim = store.receiveTokenCDK('token-A', undefined, MINT);
        await flush();
        expect(mockCdk.heldClaims).toHaveLength(1);

        const opening = startSwitchToWalletB();
        await jest.advanceTimersByTimeAsync(29999);
        expect(mockCdk.openMnemonic).toBe(SEED_A);

        await jest.advanceTimersByTimeAsync(1);
        await expect(opening).resolves.toBe(true);
        expect(mockCdk.openMnemonic).toBe(SEED_B);

        // A mint that answers after the limit finds A's database destroyed,
        // the case the wait exists to avoid
        mockCdk.heldClaims[0]();
        await expect(claim).rejects.toThrow('already been destroyed');
    });

    it('opens the wallet at once when no receive is in flight', async () => {
        jest.useFakeTimers();
        await openCDK(SEED_A);
        const claim = store.receiveTokenCDK('token-A', undefined, MINT);
        await flush();
        mockCdk.heldClaims[0]();
        await expect(claim).resolves.toBe(100);

        await expect(startSwitchToWalletB()).resolves.toBe(true);
        expect(mockCdk.openMnemonic).toBe(SEED_B);
    });
});
