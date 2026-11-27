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
    // addMint() of this mint waits until the test answers or fails it
    holdMint: '',
    answerAddMint: undefined as (() => void) | undefined,
    failAddMint: undefined as ((error: Error) => void) | undefined,
    // Runs once when the next getBalances() call arrives
    onGetBalances: undefined as (() => void) | undefined,
    // Every receive() call in the order it reached the mint, and the tokens
    // the mint has redeemed: a second claim of one fails as already spent
    submitted: [] as string[],
    redeemed: [] as string[]
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
            await new Promise<void>((resolve, reject) => {
                mockCdk.answerAddMint = resolve;
                mockCdk.failAddMint = reject;
            });
        }
        if (!mints.includes(mintUrl)) mints.push(mintUrl);
    },
    removeMint: async () => {},
    getMintUrls: async () => [...mockOpenDatabase().mints],
    receive: async (encodedToken: string) => {
        const database = mockOpenDatabase();
        mockCdk.submitted.push(encodedToken);
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
        if (
            mockCdk.spentTokens.includes(encodedToken) ||
            mockCdk.redeemed.includes(encodedToken)
        ) {
            throw new Error('Token already spent');
        }
        if (mockCdk.failTokens.includes(encodedToken)) {
            throw new Error('Mint returned an unknown error');
        }
        mockCdk.redeemed.push(encodedToken);
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
    mockCdk.failAddMint = undefined;
    mockCdk.onGetBalances = undefined;
    mockCdk.submitted = [];
    mockCdk.redeemed = [];

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
        // B's initializeCDK waits for A's claim before it opens B's database
        const openB = store.initializeWallets();
        await new Promise(setImmediate);
        expect(mockCdk.openMnemonic).toBe(SEED_A);

        // A's first claim returns while B's node is starting
        mockCdk.answerFirstClaim!();
        await openB;
        // B's own sweep claims B's token
        await sweeps.mock.results[1].value;
        expect(mockCdk.openMnemonic).toBe(SEED_B);
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
        // A's stopped sweep holds at its final write of A's queue, after
        // its claim has returned. B's initializeCDK waits only for the claim
        const setItem = jest.mocked(Storage.setItem);
        const write = setItem.getMockImplementation()!;
        let finishWriteA: () => void = () => {};
        const writeAHeld = new Promise<void>((resolve) => {
            finishWriteA = resolve;
        });
        setItem.mockImplementation(async (key: string, value: any) => {
            if (key === 'walletA-cashu-offline-pending-tokens') {
                setItem.mockImplementation(write);
                await writeAHeld;
            }
            return write(key, value);
        });
        switchToWalletB();
        const openB = store.initializeWallets();
        await new Promise(setImmediate);
        mockCdk.answerFirstClaim!();
        await openB;
        await new Promise(setImmediate);
        expect(mockCdk.heldClaims['token-for-wallet-B']).toBeDefined();

        // A's stopped sweep ends while B's sweep waits on its claim
        finishWriteA();
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

    it("does not mark wallet B's mint unreachable when wallet A's addMint fails", async () => {
        // Wallet B has added the mint wallet A's sweep is adding
        mockKeychain['walletB-cashu-mintUrls'] = JSON.stringify([
            'https://mint-b.example',
            MINT_C
        ]);
        switchToWalletB();
        await store.initializeWallets();
        await sweeps.mock.results[1].value;
        expect(store.cashuWallets[MINT_C].errorConnecting).toBe(false);

        mockCdk.failAddMint!(
            new Error('WalletSqliteDatabase object has already been destroyed')
        );
        await sweeps.mock.results[0].value;

        expect(store.cashuWallets[MINT_C].errorConnecting).toBe(false);
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
        // B's initializeCDK waits for A's first claim before it opens B's
        // database. A's sweep then goes on to the next mint
        const openB = store.initializeWallets();
        await new Promise(setImmediate);
        mockCdk.answerFirstClaim!();
        await openB;
        await sweeps.mock.results[1].value;
        expect(mockCdk.openMnemonic).toBe(SEED_B);
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

// Wallet.fetchDataCore() also resets the store when the selected wallet
// connects again, and initializeWallets() then loads the stored queue, which
// still holds the token whose claim is at the mint (#5579)
describe('CashuStore offline-token sweep across a reconnect of the same wallet', () => {
    const PENDING = 'walletA-cashu-offline-pending-tokens';
    const SPENT = 'walletA-cashu-offline-spent-tokens';
    const encoded = (tokens: CashuToken[]) =>
        tokens.map((token) => token.encodedToken);

    const reconnectWalletA = async () => {
        store.reset();
        await store.initializeWallets();
        await new Promise(setImmediate);
    };

    beforeEach(async () => {
        await startOnWalletA(['token-1-for-wallet-A', 'token-2-for-wallet-A']);
        expect(mockCdk.answerFirstClaim).toBeDefined();
    });

    it('submits each token once', async () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        await reconnectWalletA();

        // The new sweep waits for the claim the first one has at the mint
        expect(sweeps).toHaveBeenCalledTimes(2);
        expect(mockCdk.submitted).toEqual(['token-1-for-wallet-A']);
        expect((store as any).isSweeping).toBe(true);
        // A third trigger, such as a network reconnect, starts nothing
        await store.sweepOfflinePendingTokens();

        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;
        await sweeps.mock.results[1].value;

        expect(mockCdk.submitted).toEqual([
            'token-1-for-wallet-A',
            'token-2-for-wallet-A'
        ]);
        expect(mockCdk.databases[SEED_A].received).toEqual([
            'token-1-for-wallet-A',
            'token-2-for-wallet-A'
        ]);
        expect(store.offlinePendingTokens).toEqual([]);
        expect(store.offlinePendingBalance).toBe(0);
        expect(store.offlineSpentTokens).toEqual([]);
        expect(store.showOfflineSpentAlert).toBe(false);
        expect(storedTokens(PENDING)).toEqual([]);
        expect(storedTokens(SPENT)).toEqual([]);
        // The summary counts the one token the second sweep claimed
        expect(alert).toHaveBeenCalledTimes(1);
        expect(alert.mock.calls[0][1]).toBe(
            '1 cashu.offlinePending.claimedMessage'
        );
        expect((store as any).isSweeping).toBe(false);
        expect((store as any).offlineSweeps.size).toBe(0);
    });

    it('shows a token the sender spent once, from the list the first sweep stored', async () => {
        mockCdk.spentTokens = ['token-1-for-wallet-A'];
        mockCdk.holdTokens = ['token-2-for-wallet-A'];
        await reconnectWalletA();
        // the reconnect loaded the queue before the first sweep filed it
        expect(encoded(store.offlinePendingTokens)).toEqual([
            'token-1-for-wallet-A',
            'token-2-for-wallet-A'
        ]);
        expect(store.offlinePendingBalance).toBe(200);

        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;
        await new Promise(setImmediate);
        // The second sweep is claiming what the first one left
        expect(mockCdk.heldClaims['token-2-for-wallet-A']).toBeDefined();
        expect(encoded(store.offlinePendingTokens)).toEqual([
            'token-2-for-wallet-A'
        ]);
        expect(store.offlinePendingBalance).toBe(100);
        mockCdk.heldClaims['token-2-for-wallet-A']();
        await sweeps.mock.results[1].value;

        expect(mockCdk.submitted).toEqual([
            'token-1-for-wallet-A',
            'token-2-for-wallet-A'
        ]);
        expect(encoded(store.offlineSpentTokens)).toEqual([
            'token-1-for-wallet-A'
        ]);
        expect(storedTokens(SPENT)).toEqual(['token-1-for-wallet-A']);
        expect(store.offlinePendingTokens).toEqual([]);
        expect(store.offlinePendingBalance).toBe(0);
    });

    it('leaves the queue alone when another wallet is selected while it waits', async () => {
        await reconnectWalletA();
        switchToWalletB();

        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;
        await sweeps.mock.results[1].value;

        expect(mockCdk.submitted).toEqual(['token-1-for-wallet-A']);
        expect(storedTokens(PENDING)).toEqual(['token-2-for-wallet-A']);
        // wallet B's lists, which its own connect has not loaded yet
        expect(store.offlinePendingTokens).toEqual([]);
        expect((store as any).isSweeping).toBe(false);
    });

    it('leaves the queue alone when another wallet is selected while it reads the stored queue', async () => {
        await reconnectWalletA();
        const getItem = Storage.getItem as jest.Mock;
        const read = getItem.getMockImplementation()!;
        getItem.mockImplementation(async (key: string) => {
            const value = await read(key);
            if (key === SPENT) {
                getItem.mockImplementation(read);
                switchToWalletB();
            }
            return value;
        });

        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;
        await sweeps.mock.results[1].value;

        expect(mockCdk.submitted).toEqual(['token-1-for-wallet-A']);
        expect(storedTokens(PENDING)).toEqual(['token-2-for-wallet-A']);
        expect(store.offlinePendingTokens).toEqual([]);
        expect(store.offlineSpentTokens).toEqual([]);
    });

    it('waits for the second sweep after the first one has ended', async () => {
        mockCdk.holdTokens = ['token-2-for-wallet-A'];
        await reconnectWalletA();
        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;
        await new Promise(setImmediate);
        expect(mockCdk.heldClaims['token-2-for-wallet-A']).toBeDefined();

        // The wallet reconnects again during the second sweep's claim
        await reconnectWalletA();
        expect(sweeps).toHaveBeenCalledTimes(3);
        expect(mockCdk.submitted).toEqual([
            'token-1-for-wallet-A',
            'token-2-for-wallet-A'
        ]);

        mockCdk.heldClaims['token-2-for-wallet-A']();
        await Promise.all(sweeps.mock.results.map((result) => result.value));

        expect(mockCdk.submitted).toEqual([
            'token-1-for-wallet-A',
            'token-2-for-wallet-A'
        ]);
        expect(store.offlineSpentTokens).toEqual([]);
        expect(storedTokens(PENDING)).toEqual([]);
        expect((store as any).offlineSweeps.size).toBe(0);
    });

    it('claims the rest of the queue after a second reconnect', async () => {
        await reconnectWalletA();
        await reconnectWalletA();
        expect(sweeps).toHaveBeenCalledTimes(3);

        mockCdk.answerFirstClaim!();
        await Promise.all(sweeps.mock.results.map((result) => result.value));

        expect(mockCdk.submitted).toEqual([
            'token-1-for-wallet-A',
            'token-2-for-wallet-A'
        ]);
        expect(storedTokens(PENDING)).toEqual([]);
        expect(store.offlinePendingTokens).toEqual([]);
        expect((store as any).isSweeping).toBe(false);
    });

    describe('when the mint does not answer the stopped claim', () => {
        beforeEach(() => {
            jest.useFakeTimers({
                doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask']
            });
            jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        });
        afterEach(() => jest.useRealTimers());

        it('claims the stored queue after 30 s', async () => {
            await reconnectWalletA();
            await jest.advanceTimersByTimeAsync(29999);
            expect(mockCdk.submitted).toEqual(['token-1-for-wallet-A']);
            expect((store as any).isSweeping).toBe(true);

            // The first claim is still at the mint, so its token is sent
            // again, as before #5579
            await jest.advanceTimersByTimeAsync(1);
            await sweeps.mock.results[1].value;

            expect(mockCdk.submitted).toEqual([
                'token-1-for-wallet-A',
                'token-1-for-wallet-A',
                'token-2-for-wallet-A'
            ]);
            expect(storedTokens(PENDING)).toEqual([]);
            expect(store.offlinePendingTokens).toEqual([]);
            expect((store as any).isSweeping).toBe(false);
        });

        it('clears its timer when the claim is answered in time', async () => {
            const setTimer = jest.spyOn(global, 'setTimeout');
            const clearTimer = jest.spyOn(global, 'clearTimeout');
            await reconnectWalletA();
            const waits = setTimer.mock.calls
                .map((call, i) => ({ call, i }))
                .filter(({ call }) => call[1] === 30000);
            expect(waits).toHaveLength(1);
            const waitTimer = setTimer.mock.results[waits[0].i].value;

            mockCdk.answerFirstClaim!();
            await sweeps.mock.results[0].value;
            await sweeps.mock.results[1].value;

            expect(mockCdk.submitted).toEqual([
                'token-1-for-wallet-A',
                'token-2-for-wallet-A'
            ]);
            expect(clearTimer).toHaveBeenCalledWith(waitTimer);
        });
    });

    it('clears isSweeping when reading the stored queue fails', async () => {
        await reconnectWalletA();
        const getItem = Storage.getItem as jest.Mock;
        const read = getItem.getMockImplementation()!;
        let pendingReads = 0;
        getItem.mockImplementation(async (key: string) => {
            // The first read is the stopped sweep recording its claim, the
            // second the new sweep reloading the queue
            if (key === PENDING && ++pendingReads === 2) {
                throw new Error('keychain read failed');
            }
            return read(key);
        });

        mockCdk.answerFirstClaim!();
        await sweeps.mock.results[0].value;
        await expect(sweeps.mock.results[1].value).rejects.toThrow(
            'keychain read failed'
        );

        expect(mockCdk.submitted).toEqual(['token-1-for-wallet-A']);
        expect((store as any).isSweeping).toBe(false);
        expect((store as any).offlineSweeps.size).toBe(0);
    });
});
