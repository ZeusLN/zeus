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
    spentTokens: [] as string[],
    // Claims of these tokens fail with a mint error that is neither
    // already spent nor a network error
    failTokens: [] as string[],
    // The first claim of each of these tokens waits until the test answers
    // it through heldClaims
    holdTokens: [] as string[],
    heldClaims: {} as Record<string, () => void>,
    // addMint() of this mint waits until the test releases it
    holdMint: '',
    answerAddMint: undefined as (() => void) | undefined,
    // Runs once when the next getBalances() call arrives
    onGetBalances: undefined as (() => void) | undefined
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
        if (mintUrl === mockCdk.holdMint && !mockCdk.answerAddMint) {
            await new Promise<void>((resolve) => {
                mockCdk.answerAddMint = resolve;
            });
        }
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
        if (mockCdk.holdTokens.includes(encodedToken)) {
            mockCdk.holdTokens = mockCdk.holdTokens.filter(
                (token) => token !== encodedToken
            );
            await new Promise<void>((resolve) => {
                mockCdk.heldClaims[encodedToken] = resolve;
            });
        }
        if (mockCdk.spentTokens.includes(encodedToken)) {
            throw new Error('Token already spent');
        }
        if (mockCdk.failTokens.includes(encodedToken)) {
            throw new Error('Mint returned an unknown error');
        }
        database.received.push(encodedToken);
        return 100;
    },
    restore: async () => 0,
    getBalances: async () => {
        const onGetBalances = mockCdk.onGetBalances;
        mockCdk.onGetBalances = undefined;
        onGetBalances?.();
        return {};
    },
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

import { Alert } from 'react-native';

import Storage from '../storage';
import CashuStore from './CashuStore';
import { connectivityStore } from './Stores';
import CashuToken from '../models/CashuToken';

// BIP-39 test vectors, never real wallets
const SEED_A = `${'abandon '.repeat(11)}about`;
const SEED_B =
    'legal winner thank year wave sausage worth useful legal winner thank yellow';

// An embedded wallet as initializeWallets() finds it in the keychain, with
// the tokens claimTokenOffline() queued while the phone had no network.
// tokenMints gives single tokens a mint other than tokenMint
const storeWallet = (
    lndDir: string,
    seed: string,
    mint: string,
    queuedTokens: string[],
    tokenMint = mint,
    tokenMints: Record<string, string> = {}
) => {
    mockKeychain[`${lndDir}-cashu-seed-phrase`] = JSON.stringify(
        seed.split(' ')
    );
    mockKeychain[`${lndDir}-cashu-seed-version`] = 'v2-bip39';
    mockKeychain[`${lndDir}-cashu-mintUrls`] = JSON.stringify([mint]);
    mockKeychain[`${lndDir}-cashu-selectedMintUrl`] = mint;
    mockKeychain[`${lndDir}-cashu-offline-pending-tokens`] = JSON.stringify(
        queuedTokens.map((encodedToken) => ({
            mint: tokenMints[encodedToken] ?? tokenMint,
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

let settingsStore: any;
let store: CashuStore;
let sweeps: jest.SpyInstance;

// What Wallet.fetchDataCore() does when the user selects wallet B:
// SettingsStore has already loaded B's node, then the store is reset
const switchToWalletB = () => {
    settingsStore.lndDir = 'walletB';
    store.reset();
};

// Wallet B is stored with one queued token; queue wallet A's tokens and
// open the store on wallet A, which starts A's sweep. With newMint, A's
// tokens come from a mint A has not added, and adding it waits until the
// test calls answerAddMint
const startOnWalletA = async (
    queuedTokens: string[],
    newMint?: string,
    tokenMints?: Record<string, string>
) => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    Object.keys(mockKeychain).forEach((key) => delete mockKeychain[key]);
    mockCdk.databases = {};
    mockCdk.openMnemonic = '';
    mockCdk.answerFirstClaim = undefined;
    mockCdk.spentTokens = [];
    mockCdk.failTokens = [];
    mockCdk.holdTokens = [];
    mockCdk.heldClaims = {};
    mockCdk.holdMint = newMint ?? '';
    mockCdk.answerAddMint = undefined;
    mockCdk.onGetBalances = undefined;

    storeWallet(
        'walletA',
        SEED_A,
        'https://mint-a.example',
        queuedTokens,
        newMint,
        tokenMints
    );
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

    await store.initializeWallets();
    await new Promise(setImmediate);
    expect(mockCdk.openMnemonic).toBe(SEED_A);
};

afterEach(() => jest.restoreAllMocks());

describe('CashuStore offline-token sweep across a wallet switch', () => {
    beforeEach(async () => {
        // A's sweep runs until A's first claim, which then waits on the mint
        await startOnWalletA(['token-1-for-wallet-A', 'token-2-for-wallet-A']);
        expect(mockCdk.answerFirstClaim).toBeDefined();
    });

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

    it("keeps a token whose claim failed in wallet A's stored queue", async () => {
        mockCdk.failTokens = ['token-1-for-wallet-A'];
        switchToWalletB();

        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;

        // A's next sweep retries the failed token
        expect(storedTokens('walletA-cashu-offline-pending-tokens')).toEqual([
            'token-1-for-wallet-A',
            'token-2-for-wallet-A'
        ]);
    });

    it("keeps wallet A's spent list when the switch comes during the final write", async () => {
        mockCdk.spentTokens = ['token-1-for-wallet-A'];
        // A's spent list as initializeWallets() loaded it
        store.offlineSpentTokens = [
            new CashuToken({
                encodedToken: 'token-0-for-wallet-A',
                spent: true
            } as any)
        ];
        // A's sweep has finished claiming when B is selected, while it
        // writes A's pending queue
        const setItem = jest.mocked(Storage.setItem);
        const write = setItem.getMockImplementation()!;
        setItem.mockImplementation(async (key: string, value: any) => {
            if (key === 'walletA-cashu-offline-pending-tokens') {
                setItem.mockImplementation(write);
                switchToWalletB();
            }
            return write(key, value);
        });

        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;

        expect(storedTokens('walletA-cashu-offline-spent-tokens')).toEqual([
            'token-0-for-wallet-A',
            'token-1-for-wallet-A'
        ]);
    });

    it("shows wallet A's claim summary when no switch comes", async () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;

        expect(alert).toHaveBeenCalledWith(
            'cashu.offlinePending.claimedTitle',
            '2 cashu.offlinePending.claimedMessage'
        );
    });

    it("does not show wallet A's claim summary in wallet B when the switch comes during the final write", async () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const setItem = jest.mocked(Storage.setItem);
        const write = setItem.getMockImplementation()!;
        setItem.mockImplementation(async (key: string, value: any) => {
            if (key === 'walletA-cashu-offline-pending-tokens') {
                setItem.mockImplementation(write);
                switchToWalletB();
            }
            return write(key, value);
        });

        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;

        expect(storedTokens('walletA-cashu-offline-pending-tokens')).toEqual(
            []
        );
        expect(alert).not.toHaveBeenCalled();
    });

    it("does not show wallet A's claim summary in wallet B when the switch comes during the balance sync", async () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        // B is selected during the balance sync that follows the final
        // write of A's pending queue
        const setItem = jest.mocked(Storage.setItem);
        const write = setItem.getMockImplementation()!;
        setItem.mockImplementation(async (key: string, value: any) => {
            if (key === 'walletA-cashu-offline-pending-tokens') {
                setItem.mockImplementation(write);
                mockCdk.onGetBalances = switchToWalletB;
            }
            return write(key, value);
        });

        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;

        expect(storedTokens('walletA-cashu-offline-pending-tokens')).toEqual(
            []
        );
        expect(alert).not.toHaveBeenCalled();
    });

    it("keeps wallet B's sweep the only one running after wallet A's stopped sweep ends", async () => {
        mockCdk.holdTokens = ['token-for-wallet-B'];
        switchToWalletB();
        await store.initializeWallets();
        await new Promise(setImmediate);
        expect(mockCdk.heldClaims['token-for-wallet-B']).toBeDefined();

        // A's stopped sweep ends while B's sweep waits on its claim
        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;

        // Another trigger, such as a reconnect, must not start a second
        // sweep that submits B's token again
        await store.sweepOfflinePendingTokens();
        mockCdk.heldClaims['token-for-wallet-B']();
        await sweeps.mock.results[1].value;

        expect(mockCdk.databases[SEED_B].received).toEqual([
            'token-for-wallet-B'
        ]);
    });
});

describe('CashuStore offline-token sweep across a wallet switch during addMint', () => {
    const MINT_C = 'https://mint-c.example';

    beforeEach(async () => {
        // A's sweep waits in addMint() instead of the claim
        await startOnWalletA(['token-from-mint-C'], MINT_C);
        expect(mockCdk.answerAddMint).toBeDefined();
        // Claims are answered at once in these tests
        mockCdk.answerFirstClaim = () => {};
    });

    it("does not claim wallet A's token into wallet B's CDK database", async () => {
        switchToWalletB();
        await store.initializeWallets();
        await sweeps.mock.results[1].value;
        expect(mockCdk.openMnemonic).toBe(SEED_B);

        mockCdk.answerAddMint!();
        await sweeps.mock.results[0].value;

        expect(mockCdk.databases[SEED_B].received).toEqual([
            'token-for-wallet-B'
        ]);
        expect(mockCdk.databases[SEED_A].received).toEqual([]);
        expect(storedTokens('walletA-cashu-offline-pending-tokens')).toEqual([
            'token-from-mint-C'
        ]);
    });

    it("does not count wallet A's addMint as added for wallet B", async () => {
        switchToWalletB();
        await store.initializeWallets();
        await sweeps.mock.results[1].value;

        mockCdk.answerAddMint!();
        await sweeps.mock.results[0].value;

        await store.receiveTokenCDK(
            'token-from-mint-C-for-B',
            undefined,
            MINT_C
        );
        expect(mockCdk.databases[SEED_B].mints).toContain(MINT_C);
    });
});

describe('CashuStore offline-token sweep across a wallet switch with a second mint', () => {
    const MINT_C = 'https://mint-c.example';

    beforeEach(async () => {
        // A's second token comes from a mint A has not added
        await startOnWalletA(
            ['token-1-for-wallet-A', 'token-from-mint-C'],
            undefined,
            { 'token-from-mint-C': MINT_C }
        );
        expect(mockCdk.answerFirstClaim).toBeDefined();
    });

    it("does not add wallet A's next mint to wallet B's CDK database", async () => {
        switchToWalletB();
        await store.initializeWallets();
        await sweeps.mock.results[1].value;
        expect(mockCdk.openMnemonic).toBe(SEED_B);

        // A's first claim returns after B's database is open
        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;

        expect(mockCdk.databases[SEED_B].mints).toEqual([
            'https://mint-b.example'
        ]);
        expect(storedTokens('walletA-cashu-offline-pending-tokens')).toEqual([
            'token-from-mint-C'
        ]);
    });
});

describe('CashuStore offline-token sweep started during a wallet switch', () => {
    beforeEach(async () => {
        // Wallet A opens offline, so its sweep waits for a reconnect
        connectivityStore.isOffline = true;
        await startOnWalletA(['token-1-for-wallet-A', 'token-2-for-wallet-A']);
        connectivityStore.isOffline = false;
        // Claims are answered at once in these tests
        mockCdk.answerFirstClaim = () => {};
    });

    it("leaves both wallets' stored queues alone", async () => {
        // SettingsStore has loaded wallet B's node, and the reconnect
        // timer fires before Wallet.fetchDataCore() resets the store
        settingsStore.lndDir = 'walletB';
        await store.sweepOfflinePendingTokens();

        expect(storedTokens('walletB-cashu-offline-pending-tokens')).toEqual([
            'token-for-wallet-B'
        ]);
        // A's tokens wait for A's next sweep
        expect(storedTokens('walletA-cashu-offline-pending-tokens')).toEqual([
            'token-1-for-wallet-A',
            'token-2-for-wallet-A'
        ]);
        expect(mockCdk.databases[SEED_A].received).toEqual([]);
    });
});
