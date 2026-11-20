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

// Models the native modules: every call uses the wallet handle that is open
// when the call arrives, and takes at least one turn of the event loop.
// initializeWallet opens a new handle on the mnemonic's database file. On
// Android it then destroys the previous handle, and a call still running on
// it fails. On iOS the previous handle stays alive for calls running on it
type DatabaseFile = { mints: string[]; received: string[] };
type Handle = { file: DatabaseFile; mnemonic: string; destroyed: boolean };
const DESTROYED =
    'UnexpectedUniFFICallbackError(reason: "java.lang.IllegalStateException: WalletSqliteDatabase object has already been destroyed")';
const mockCdk = {
    destroysPreviousHandle: true,
    files: {} as Record<string, DatabaseFile>,
    open: undefined as Handle | undefined,
    // Tokens whose inputs the mint has swapped
    swappedAtMint: [] as string[],
    // Each receive waits on the mint until the test answers it
    heldClaims: [] as Array<() => void>,
    // addMint() of this mint waits until the test answers it
    holdMint: '',
    answerAddMint: undefined as (() => void) | undefined,
    // The next createMeltQuote() waits until the test answers it
    holdMeltQuote: false,
    answerMeltQuote: undefined as (() => void) | undefined,
    meltQuotes: [] as Array<{ wallet: string; bolt11: string }>,
    melts: [] as Array<{ wallet: string; quote: string }>
};
const mockHandle = () => {
    if (!mockCdk.open) throw new Error('Wallet not initialized');
    return mockCdk.open;
};
const mockNativeCall = () =>
    new Promise<void>((resolve) => setImmediate(resolve));
jest.mock('../cashu-cdk', () => ({
    isAvailable: () => true,
    initializeWallet: async (mnemonic: string) => {
        await mockNativeCall();
        mockCdk.files[mnemonic] ??= { mints: [], received: [] };
        const previous = mockCdk.open;
        mockCdk.open = {
            file: mockCdk.files[mnemonic],
            mnemonic,
            destroyed: false
        };
        if (previous && mockCdk.destroysPreviousHandle) {
            previous.destroyed = true;
        }
    },
    addMint: async (mintUrl: string) => {
        const handle = mockHandle();
        if (mintUrl === mockCdk.holdMint) {
            await new Promise<void>((resolve) => {
                mockCdk.answerAddMint = resolve;
            });
        } else {
            await mockNativeCall();
        }
        if (handle.destroyed) throw new Error(DESTROYED);
        if (!handle.file.mints.includes(mintUrl)) {
            handle.file.mints.push(mintUrl);
        }
    },
    removeMint: async () => {},
    getMintUrls: async () => [...mockHandle().file.mints],
    isValidToken: async () => true,
    getMintKeysets: async () => {
        mockHandle();
        await mockNativeCall();
        return [];
    },
    getUnspentProofs: async () => [],
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
    createMeltQuote: async (_mintUrl: string, bolt11: string) => {
        const handle = mockHandle();
        if (mockCdk.holdMeltQuote) {
            mockCdk.holdMeltQuote = false;
            await new Promise<void>((resolve) => {
                mockCdk.answerMeltQuote = resolve;
            });
        } else {
            await mockNativeCall();
        }
        if (handle.destroyed) throw new Error(DESTROYED);
        mockCdk.meltQuotes.push({ wallet: handle.mnemonic, bolt11 });
        return {
            id: `quote-${mockCdk.meltQuotes.length}`,
            amount: 98,
            fee_reserve: 2,
            expiry: 0,
            state: 'UNPAID'
        };
    },
    melt: async (_mintUrl: string, quote: string) => {
        const handle = mockHandle();
        await mockNativeCall();
        if (handle.destroyed) throw new Error(DESTROYED);
        mockCdk.melts.push({ wallet: handle.mnemonic, quote });
        return { state: 'PAID', preimage: '', amount: 98, fee_paid: 0 };
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

import CashuToken from '../models/CashuToken';
import CashuStore from './CashuStore';

// BIP-39 test vectors, never real wallets
const SEED_A = `${'abandon '.repeat(11)}about`;
const SEED_B =
    'legal winner thank year wave sausage worth useful legal winner thank yellow';
const MINT = 'https://mint.example';
const NEW_MINT = 'https://new-mint.example';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const ticks = async (count = 10) => {
    for (let i = 0; i < count; i++) await tick();
};
const until = async (condition: () => boolean) => {
    for (let i = 0; i < 50 && !condition(); i++) await tick();
    expect(condition()).toBe(true);
};

const makeDecoded = () =>
    new CashuToken({
        mint: MINT,
        unit: 'sat',
        proofs: [
            { amount: 100, secret: 'plain-secret', id: '009a1f293253e41e' }
        ]
    });

let settingsStore: any;
let invoicesStore: any;
let store: CashuStore;

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    Object.keys(mockKeychain).forEach((key) => delete mockKeychain[key]);
    mockCdk.destroysPreviousHandle = true;
    mockCdk.files = {};
    mockCdk.open = undefined;
    mockCdk.swappedAtMint = [];
    mockCdk.heldClaims = [];
    mockCdk.holdMint = '';
    mockCdk.answerAddMint = undefined;
    mockCdk.holdMeltQuote = false;
    mockCdk.answerMeltQuote = undefined;
    mockCdk.meltQuotes = [];
    mockCdk.melts = [];

    settingsStore = {
        implementation: 'embedded-lnd',
        lndDir: 'walletA',
        settings: { ecash: { enableCashu: true } },
        updateSettingsGroup: jest.fn()
    };
    // The invoice comes from the node that is running when it is asked for
    invoicesStore = {
        createInvoice: jest.fn(async ({ value }: { value: string }) => {
            const node = settingsStore.lndDir;
            await mockNativeCall();
            return { paymentRequest: `invoice-${node}-${value}` };
        })
    };
    store = new CashuStore(
        settingsStore,
        invoicesStore,
        { channels: [] } as any,
        {} as any
    );
    // payment proof has its own tests in CashuStore.test.ts
    (store as any).isOwnInvoicePaid = jest.fn().mockResolvedValue(true);
    // the background mint-info fetch arms a timer that would outlive
    // the test
    jest.spyOn(store, 'fetchMintInfo').mockResolvedValue(null);
});

afterEach(() => {
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

describe('CashuStore self-custody claim across a wallet switch', () => {
    it("does not melt the next wallet's ecash when the switch came during the receive", async () => {
        await openCDK(SEED_A);
        const claim = store.claimToken('token-A', makeDecoded(), true);
        await until(() => mockCdk.heldClaims.length === 1);

        const opening = startSwitchToWalletB();
        await ticks();
        // Wallet B waits for wallet A's receive
        expect(mockCdk.open!.mnemonic).toBe(SEED_A);

        mockCdk.heldClaims[0]();
        const result = await claim;
        await expect(opening).resolves.toBe(true);
        await ticks();

        expect(mockCdk.files[SEED_A].received).toEqual(['token-A']);
        expect(mockCdk.melts).toEqual([]);
        // No invoice was asked of wallet B's node
        expect(invoicesStore.createInvoice).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            success: true,
            errorMessage: '',
            warningMessage: 'stores.CashuStore.claimedButNotSwept'
        });
    });

    it('does not claim the token into the next wallet when the switch came before the receive', async () => {
        // iOS: wallet A's melt quote request outlives the switch
        mockCdk.destroysPreviousHandle = false;
        await openCDK(SEED_A);
        mockCdk.holdMeltQuote = true;
        const claim = store.claimToken('token-A', makeDecoded(), true);
        await until(() => mockCdk.answerMeltQuote !== undefined);

        // No receive is in flight, so wallet B opens at once
        await expect(startSwitchToWalletB()).resolves.toBe(true);
        expect(mockCdk.open!.mnemonic).toBe(SEED_B);

        mockCdk.answerMeltQuote!();
        await ticks();
        mockCdk.heldClaims.forEach((answer) => answer());
        const result = await claim;

        expect(mockCdk.swappedAtMint).toEqual([]);
        expect(mockCdk.files[SEED_B].received).toEqual([]);
        expect(mockCdk.melts).toEqual([]);
        expect(result.success).toBe(false);
    });
});

describe('CashuStore receive in flight at a wallet switch on iOS', () => {
    it("reaches the wallet it started on when the switch came while the token's mint was being added", async () => {
        // The previous handle stays alive, but the receive call itself has
        // not reached the native module when the switch starts
        mockCdk.destroysPreviousHandle = false;
        await openCDK(SEED_A);
        mockCdk.holdMint = NEW_MINT;
        const claim = store.receiveTokenCDK('token-A', undefined, NEW_MINT);
        await until(() => mockCdk.answerAddMint !== undefined);

        const opening = startSwitchToWalletB();
        await ticks();

        mockCdk.answerAddMint!();
        await until(() => mockCdk.heldClaims.length === 1);
        mockCdk.heldClaims[0]();
        await claim;
        await expect(opening).resolves.toBe(true);

        expect(mockCdk.files[SEED_A].received).toEqual(['token-A']);
        expect(mockCdk.files[SEED_B].received).toEqual([]);
    });
});
