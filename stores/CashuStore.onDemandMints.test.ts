const mockConnectivity = {
    isOffline: false,
    start: jest.fn(),
    stop: jest.fn(),
    onReconnect: jest.fn()
};
jest.mock('./Stores', () => ({
    get activityStore() {
        return { getSortedActivity: jest.fn() };
    },
    get connectivityStore() {
        return mockConnectivity;
    }
}));
jest.mock('./SettingsStore', () => ({
    DEFAULT_NOSTR_RELAYS: ['wss://relay.one']
}));
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
    backupMintsToNostr: jest.fn(),
    restoreMintsFromNostr: jest.fn().mockResolvedValue(null)
}));
jest.mock('../utils/MigrationUtils', () => ({
    migrateLegacyCashuKeysToNodeDir: jest.fn().mockResolvedValue(undefined),
    migrateCashuSeedVersion: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {}
}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
// The pass under test is started by hand, not from checkPendingItems
jest.mock('../utils/SchedulingUtils', () => ({ runWhenIdle: jest.fn() }));
jest.mock('../NavigationService', () => ({}));
jest.mock('../cashu-cdk', () => ({
    isAvailable: jest.fn(() => true),
    initializeWallet: jest.fn().mockResolvedValue(undefined),
    addMint: jest.fn().mockResolvedValue(undefined),
    removeMint: jest.fn().mockResolvedValue(undefined),
    getMintUrls: jest.fn().mockResolvedValue([]),
    getBalances: jest.fn().mockResolvedValue({}),
    getTotalBalance: jest.fn().mockResolvedValue(0),
    listTransactions: jest.fn().mockResolvedValue([]),
    createMintQuote: jest.fn().mockResolvedValue({}),
    recoverIncompleteSagas: jest.fn(),
    recoverOnDemandMint: jest.fn()
}));
jest.mock('../storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    getRawItem: jest.fn().mockResolvedValue(null),
    KEY_PREFIX: 'zeus:'
}));

import CashuStore from './CashuStore';
import CashuDevKit from '../cashu-cdk';
import Storage from '../storage';

const cdk = CashuDevKit as unknown as Record<string, jest.Mock>;

const APPROVED = 'https://approved.mint';
// The source mint of a token swept to Lightning: in CDK's wallet list, but
// the user never added it
const SWEEP = 'https://sweep.mint';
const SWEEP_2 = 'https://sweep-two.mint';

const report = (counts: Partial<Record<string, number>> = {}) => ({
    recovered: 0,
    compensated: 0,
    skipped: 0,
    failed: 0,
    ...counts
});
const removed = { report: report(), removed: true, balance: 0 };

describe('CashuStore mints that are in CDK but not in the mint list', () => {
    let stored: Map<string, string>;
    let store: CashuStore;
    let sync: jest.SpyInstance;
    let mockNow: number;

    // Loads a wallet whose saved list holds APPROVED and whose CDK database
    // also holds onDemand
    const load = async (onDemand: string[] = [SWEEP]) => {
        stored.set('node1-cashu-mintUrls', JSON.stringify([APPROVED]));
        cdk.getMintUrls.mockResolvedValue([APPROVED, ...onDemand]);
        await store.initializeWallets();
        sync.mockClear();
    };
    const recoverLater = async () => {
        mockNow += 61 * 1000;
        await store.recoverIncompleteSagas();
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockNow = 1_000_000;
        mockConnectivity.isOffline = false;
        cdk.getMintUrls.mockResolvedValue([]);
        cdk.recoverIncompleteSagas.mockResolvedValue(report());
        cdk.recoverOnDemandMint.mockResolvedValue(removed);
        stored = new Map();
        (Storage.getItem as jest.Mock).mockImplementation(
            async (key: string) => stored.get(key) ?? false
        );
        (Storage.setItem as jest.Mock).mockImplementation(
            async (key: string, value: any) => {
                stored.set(
                    key,
                    typeof value === 'string' ? value : JSON.stringify(value)
                );
            }
        );
        (Storage.removeItem as jest.Mock).mockImplementation(
            async (key: string) => {
                stored.delete(key);
            }
        );
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

        store = new CashuStore(
            {
                implementation: 'ldk-node',
                ldkNodeDir: 'node1',
                ldkMnemonic: `${'abandon '.repeat(11)}about`,
                settings: {}
            } as any,
            {} as any,
            { channels: [] } as any,
            {} as any
        );
        jest.spyOn(store, 'initializeWallet').mockResolvedValue(
            undefined as any
        );
        jest.spyOn(store, 'fetchMintInfo').mockResolvedValue(undefined as any);
        sync = jest
            .spyOn(store, 'syncCDKBalances')
            .mockResolvedValue(undefined as any);
        jest.spyOn(store, 'reconcilePendingMelts').mockResolvedValue();
        jest.spyOn(store, 'nostrBackupMints').mockResolvedValue(
            undefined as any
        );
        jest.spyOn(store, 'setSelectedMint').mockResolvedValue(
            undefined as any
        );
    });

    afterEach(() => jest.restoreAllMocks());

    it('does not remove the mint while the wallet loads', async () => {
        await load();

        expect(cdk.removeMint).not.toHaveBeenCalled();
        expect(cdk.recoverOnDemandMint).not.toHaveBeenCalled();
        expect(store.mintUrls).toEqual([APPROVED]);
    });

    it('recovers a mint with an incomplete saga before it is removed', async () => {
        await load();
        cdk.recoverOnDemandMint.mockResolvedValue({
            ...removed,
            report: report({ recovered: 1 })
        });

        await store.recoverIncompleteSagas();

        // The wrapper recovers, then removes: the store never removes the
        // mint itself
        expect(cdk.recoverOnDemandMint).toHaveBeenCalledTimes(1);
        expect(cdk.recoverOnDemandMint.mock.calls[0][0]).toBe(SWEEP);
        expect(cdk.removeMint).not.toHaveBeenCalled();
        // The mints in the list are only recovered
        expect(cdk.recoverIncompleteSagas.mock.calls).toEqual([[APPROVED]]);
        expect(sync).toHaveBeenCalledWith(true);

        await recoverLater();
        expect(cdk.recoverOnDemandMint).toHaveBeenCalledTimes(1);
    });

    it.each([
        [
            'skipped',
            async () => ({ report: report({ skipped: 1 }), removed: false })
        ],
        [
            'failed',
            async () => ({ report: report({ failed: 1 }), removed: false })
        ],
        [
            'thrown',
            async () => {
                throw new Error('database is locked');
            }
        ]
    ])(
        'keeps a mint whose recovery ended %s, and tries again on the next load',
        async (_name, outcome) => {
            await load();
            cdk.recoverOnDemandMint.mockImplementation(outcome);

            for (let i = 0; i < 5; i++) {
                await recoverLater();
            }
            // Three attempts per load, like the mints in the list
            expect(cdk.recoverOnDemandMint).toHaveBeenCalledTimes(3);
            expect(cdk.removeMint).not.toHaveBeenCalled();
            expect(sync).not.toHaveBeenCalled();

            store.reset();
            await load();
            await store.recoverIncompleteSagas();
            expect(cdk.recoverOnDemandMint).toHaveBeenCalledTimes(4);
            expect(cdk.recoverOnDemandMint.mock.calls[3][0]).toBe(SWEEP);
        }
    );

    it('keeps a mint with a balance and stops asking about it', async () => {
        await load();
        cdk.recoverOnDemandMint.mockResolvedValue({
            report: report(),
            removed: false,
            balance: 100
        });

        for (let i = 0; i < 3; i++) {
            await recoverLater();
        }

        expect(cdk.recoverOnDemandMint).toHaveBeenCalledTimes(1);
        expect(cdk.removeMint).not.toHaveBeenCalled();
        expect(sync).not.toHaveBeenCalled();
    });

    it('still removes a mint with no sagas and no balance', async () => {
        await load([SWEEP, SWEEP_2]);

        await store.recoverIncompleteSagas();

        expect(
            cdk.recoverOnDemandMint.mock.calls.map(([mintUrl]) => mintUrl)
        ).toEqual([SWEEP, SWEEP_2]);
        // The mint's zero balance leaves the balance map
        expect(sync).toHaveBeenCalledWith(true);
    });

    it('adds a removed mint to CDK again before its next use', async () => {
        await load();
        await store.createMintQuoteCDK(SWEEP, 1);
        await store.createMintQuoteCDK(SWEEP, 1);
        expect(cdk.addMint).toHaveBeenCalledTimes(1);

        await store.recoverIncompleteSagas();
        await store.createMintQuoteCDK(SWEEP, 1);

        expect(cdk.addMint).toHaveBeenCalledTimes(2);
    });

    it('tries a mint again when it could not be removed yet', async () => {
        await load();
        cdk.recoverOnDemandMint
            // An operation was in flight on the mint
            .mockResolvedValueOnce(null)
            // One started while the mint recovered
            .mockResolvedValueOnce({
                report: report(),
                removed: false,
                balance: 0
            })
            // The balance could not be read
            .mockResolvedValueOnce({ report: report(), removed: false });

        for (let i = 0; i < 6; i++) {
            await recoverLater();
        }

        // The busy run does not use up one of the three attempts
        expect(cdk.recoverOnDemandMint).toHaveBeenCalledTimes(4);
    });

    describe('allows the removal', () => {
        const canRemove = async () => {
            let allowed!: () => boolean;
            let settle!: (value: unknown) => void;
            cdk.recoverOnDemandMint.mockImplementation(
                (_mintUrl: string, check: () => boolean) => {
                    allowed = check;
                    return new Promise((resolve) => {
                        settle = resolve;
                    });
                }
            );
            const run = store.recoverIncompleteSagas();
            await Promise.resolve();
            return { allowed: () => allowed(), settle, run };
        };

        it('while the mint is still not in the list', async () => {
            await load();
            const { allowed, settle, run } = await canRemove();

            expect(allowed()).toBe(true);
            settle(removed);
            await run;
        });

        it('not once the user starts adding the mint', async () => {
            await load();
            const { allowed, settle, run } = await canRemove();
            let finishAdd!: () => void;
            cdk.addMint.mockReturnValue(
                new Promise<void>((resolve) => {
                    finishAdd = resolve;
                })
            );

            // CDK spells the host in lower case
            const adding = store.addMint('https://SWEEP.mint/');
            expect(allowed()).toBe(false);

            cdk.getMintUrls.mockResolvedValue([APPROVED, SWEEP]);
            finishAdd();
            await adding;
            expect(store.mintUrls).toEqual([APPROVED, SWEEP]);
            expect(allowed()).toBe(false);
            settle({ report: report(), removed: false, balance: 0 });
            await run;
        });

        it('not for a mint that is in the list by now', async () => {
            await load();
            const { allowed, settle, run } = await canRemove();

            store.mintUrls = [APPROVED, 'https://SWEEP.mint'];
            expect(allowed()).toBe(false);
            settle({ report: report(), removed: false, balance: 0 });
            await run;
        });

        it('not after the wallet changed', async () => {
            await load();
            const { allowed, settle, run } = await canRemove();

            store.reset();
            // The next wallet has the same mint in CDK, also unlisted
            await load();
            expect(allowed()).toBe(false);

            settle(removed);
            await run;
            // Nothing was recorded for the next wallet
            cdk.recoverOnDemandMint.mockResolvedValue(removed);
            await store.recoverIncompleteSagas();
            expect(cdk.recoverOnDemandMint).toHaveBeenCalledTimes(2);
            expect(sync).toHaveBeenCalledTimes(1);
        });
    });

    it('recovers a mint the user added like any mint in the list', async () => {
        await load();
        cdk.getMintUrls.mockResolvedValue([APPROVED, SWEEP]);
        await store.addMint(SWEEP);

        await store.recoverIncompleteSagas();

        expect(cdk.recoverOnDemandMint).not.toHaveBeenCalled();
        expect(cdk.recoverIncompleteSagas.mock.calls).toEqual([
            [APPROVED],
            [SWEEP]
        ]);
    });

    it('forgets the mints of the wallet that was closed', async () => {
        await load();
        store.reset();
        store.cdkInitialized = true;

        await store.recoverIncompleteSagas();

        expect(cdk.recoverOnDemandMint).not.toHaveBeenCalled();
    });

    it('leaves the mints alone offline', async () => {
        await load();
        mockConnectivity.isOffline = true;

        await store.recoverIncompleteSagas();

        expect(cdk.recoverOnDemandMint).not.toHaveBeenCalled();
    });

    it('lists the balances held at mints that are not in the list', async () => {
        await load([SWEEP, SWEEP_2]);
        store.mintUrls = ['https://Approved.Mint/Path'];
        store.mintBalances = {
            'https://approved.mint/Path': 473,
            [SWEEP]: 100,
            [SWEEP_2]: 0,
            // Another mint on the same host: paths are case-sensitive
            'https://approved.mint/path': 5
        };

        expect(store.unlistedMintBalances).toEqual([
            { mintUrl: SWEEP, balance: 100 },
            { mintUrl: 'https://approved.mint/path', balance: 5 }
        ]);
    });
});
