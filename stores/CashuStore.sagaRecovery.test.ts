const mockConnectivity = { isOffline: false, stop: jest.fn() };
const mockActivityStore = { getSortedActivity: jest.fn() };
jest.mock('./Stores', () => ({
    get activityStore() {
        return mockActivityStore;
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
jest.mock('../utils/NostrMintBackup', () => ({}));
jest.mock('../utils/MigrationUtils', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils');
jest.mock('../NavigationService', () => ({}));
jest.mock('../cashu-cdk', () => ({
    __esModule: true,
    default: {
        isAvailable: jest.fn(() => true),
        recoverIncompleteSagas: jest.fn()
    }
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() },
    getRawItem: jest.fn(),
    removeRawItem: jest.fn(),
    KEY_PREFIX: 'zeus:'
}));

import CashuStore from './CashuStore';
import CashuDevKit from '../cashu-cdk';
import * as SchedulingUtils from '../utils/SchedulingUtils';

const recover = CashuDevKit.recoverIncompleteSagas as jest.Mock;

const A = 'https://a.mint';
const B = 'https://b.mint';
const report = (counts: Partial<Record<string, number>> = {}) => ({
    recovered: 0,
    compensated: 0,
    skipped: 0,
    failed: 0,
    ...counts
});

const newStore = (mints: string[] = [A, B]) => {
    const store = new CashuStore(
        { implementation: 'lnd', lndDir: 'node1', settings: {} } as any,
        {} as any,
        {} as any,
        {} as any
    );
    store.cdkInitialized = true;
    store.mintUrls = mints;
    const sync = jest.spyOn(store, 'syncCDKBalances').mockResolvedValue();
    const reconcile = jest
        .spyOn(store, 'reconcilePendingMelts')
        .mockResolvedValue();
    return { store, sync, reconcile };
};

// Each check is a minute after the last, so retries are not held back by
// the spacing between attempts
let mockNow = 0;
const recoverLater = async (store: CashuStore) => {
    mockNow += 61 * 1000;
    await store.recoverIncompleteSagas();
};

describe('CashuStore.recoverIncompleteSagas', () => {
    beforeEach(() => {
        mockNow = 1_000_000;
        jest.clearAllMocks();
        mockConnectivity.isOffline = false;
        recover.mockResolvedValue(report());
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
    });

    afterEach(() => jest.restoreAllMocks());

    it('recovers every mint once per wallet load', async () => {
        const { store, sync } = newStore();

        await store.recoverIncompleteSagas();
        expect(recover.mock.calls).toEqual([[A], [B]]);

        await store.recoverIncompleteSagas();
        expect(recover).toHaveBeenCalledTimes(2);
        // Nothing was resumed or rolled back
        expect(sync).not.toHaveBeenCalled();

        store.reset();
        store.cdkInitialized = true;
        store.mintUrls = [A];
        await store.recoverIncompleteSagas();
        expect(recover).toHaveBeenCalledTimes(3);
    });

    it('refreshes balances, melts and activity after a change', async () => {
        const { store, sync, reconcile } = newStore();
        recover
            .mockResolvedValueOnce(report({ compensated: 1 }))
            .mockResolvedValueOnce(report({ skipped: 1 }));

        await store.recoverIncompleteSagas();

        expect(sync).toHaveBeenCalledWith(true);
        expect(reconcile).toHaveBeenCalledTimes(1);
        expect(mockActivityStore.getSortedActivity).toHaveBeenCalled();
    });

    it('does not count a run skipped for an operation in flight', async () => {
        const { store } = newStore([A]);
        recover
            .mockResolvedValue(report({ failed: 1 }))
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);

        for (let i = 0; i < 8; i++) {
            await recoverLater(store);
        }
        // Three busy runs, then three counted attempts
        expect(recover).toHaveBeenCalledTimes(6);
    });

    it('tries a mint again when an operation was in flight', async () => {
        const { store } = newStore([A]);
        recover.mockResolvedValueOnce(null);

        for (let i = 0; i < 5; i++) {
            await recoverLater(store);
        }
        // The busy result is retried, then the mint is done
        expect(recover).toHaveBeenCalledTimes(2);
    });

    it('retries a mint that threw or left failed or skipped sagas, up to three times', async () => {
        const C = 'https://c.mint';
        const { store } = newStore([A, B, C]);
        recover.mockImplementation(async (mintUrl: string) => {
            if (mintUrl === A) throw new Error('database is locked');
            // An unreachable mint: CDK skips every saga
            if (mintUrl === B) return report({ skipped: 1 });
            return report({ failed: 1 });
        });

        for (let i = 0; i < 5; i++) {
            await recoverLater(store);
        }

        for (const mint of [A, B, C]) {
            expect(recover.mock.calls.filter(([m]) => m === mint)).toHaveLength(
                3
            );
        }
    });

    it('waits a minute between attempts on a mint', async () => {
        const { store } = newStore([A]);
        recover.mockResolvedValue(report({ skipped: 1 }));

        await store.recoverIncompleteSagas();
        mockNow += 59 * 1000;
        await store.recoverIncompleteSagas();
        expect(recover).toHaveBeenCalledTimes(1);

        mockNow += 1000;
        await store.recoverIncompleteSagas();
        expect(recover).toHaveBeenCalledTimes(2);
    });

    it('stops retrying once a skipped saga settles', async () => {
        const { store } = newStore([A]);
        recover
            .mockResolvedValueOnce(report({ skipped: 1 }))
            .mockResolvedValueOnce(report({ compensated: 1 }));

        for (let i = 0; i < 4; i++) {
            await recoverLater(store);
        }
        expect(recover).toHaveBeenCalledTimes(2);
    });

    it('does nothing offline or before CDK is initialized', async () => {
        const { store } = newStore();
        mockConnectivity.isOffline = true;
        await store.recoverIncompleteSagas();

        mockConnectivity.isOffline = false;
        store.cdkInitialized = false;
        await store.recoverIncompleteSagas();

        expect(recover).not.toHaveBeenCalled();
    });

    it('runs from checkPendingItems without holding up the other checks', async () => {
        let task: (() => unknown) | undefined;
        jest.spyOn(SchedulingUtils, 'runWhenIdle').mockImplementation((t) => {
            task = t;
            return () => {};
        });
        const { store, reconcile } = newStore([A]);
        recover.mockReturnValue(new Promise(() => {}));

        await store.checkPendingItems();
        await task!();

        expect(recover).toHaveBeenCalledWith(A);
        expect(reconcile).toHaveBeenCalledTimes(1);
    });
});
