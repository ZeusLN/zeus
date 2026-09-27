jest.mock('../stores/Stores', () => ({
    notesStore: { notes: {} }
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('./LSPStore', () => ({ LSPS_ORDERS_KEY: 'lsps-orders' }));
jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(undefined)
    }
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        getPayments: jest.fn(),
        getInvoices: jest.fn(),
        getTransactions: jest.fn(),
        supportsOnchainSends: jest.fn(() => true),
        supportsCashuWallet: jest.fn(() => false)
    }
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));

import ActivityStore, {
    RECENT_ACTIVITY_COUNT,
    RECENT_ACTIVITY_FETCH_LIMIT
} from './ActivityStore';
import BackendUtils from '../utils/BackendUtils';

const mocked = BackendUtils as jest.Mocked<any>;

const PREIMAGE = 'ab'.repeat(32);

const payment = (hash: string, creation_date: number, extra = {}) => ({
    payment_hash: hash,
    payment_preimage: PREIMAGE,
    value_sat: '1000',
    creation_date: String(creation_date),
    ...extra
});
const failedPayment = (hash: string, creation_date: number) =>
    payment(hash, creation_date, {
        payment_preimage: '',
        status: 'FAILED',
        failure_reason: 'FAILURE_REASON_NO_ROUTE'
    });
const invoice = (hash: string, creation_date: number) => ({
    r_hash: hash,
    value: '2000',
    settled: true,
    state: 'SETTLED',
    creation_date: String(creation_date)
});
const transaction = (hash: string, time_stamp: number) => ({
    tx_hash: hash,
    amount: '3000',
    time_stamp: String(time_stamp),
    num_confirmations: 3
});

const newStore = () => {
    const paymentsStore: any = {
        payments: [],
        channelsStore: { nodes: {} }
    };
    const swapStore: any = {
        swaps: [],
        fetchAndUpdateSwaps: jest.fn().mockResolvedValue(undefined)
    };
    const store = new ActivityStore(
        { settings: {} } as any,
        paymentsStore,
        { invoices: [] } as any,
        { transactions: [] } as any,
        {} as any,
        swapStore,
        {} as any
    );
    return { store, paymentsStore, swapStore };
};

const serve = ({
    payments = [] as any[],
    invoices = [] as any[],
    transactions = [] as any[]
}) => {
    mocked.getPayments.mockResolvedValue({ payments });
    mocked.getInvoices.mockResolvedValue({ invoices });
    mocked.getTransactions.mockResolvedValue({ transactions });
};

const hashes = (items: any[]) =>
    items.map((item: any) => item.payment_hash || item.r_hash || item.tx_hash);

beforeEach(() => {
    jest.clearAllMocks();
    mocked.supportsOnchainSends.mockReturnValue(true);
});

describe('ActivityStore.getRecentActivity', () => {
    it('merges the newest items across sources in timestamp order', async () => {
        serve({
            payments: [payment('p1', 100), payment('p2', 500)],
            invoices: [invoice('i1', 300), invoice('i2', 600)],
            transactions: [transaction('t1', 200), transaction('t2', 400)]
        });
        const { store } = newStore();

        const recent = await store.getRecentActivity();

        expect(hashes(recent)).toEqual(['i2', 'p2', 't2', 'i1']);
        expect(recent).toHaveLength(RECENT_ACTIVITY_COUNT);
        expect(store.recentActivity).toEqual(recent);
        expect(store.recentActivityLoading).toBe(false);
        expect(store.recentActivityError).toBe(false);
    });

    it('requests a short page from each source', async () => {
        serve({});
        const { store, swapStore } = newStore();

        await store.getRecentActivity();

        expect(mocked.getPayments).toHaveBeenCalledWith({
            maxPayments: RECENT_ACTIVITY_FETCH_LIMIT
        });
        expect(mocked.getInvoices).toHaveBeenCalledWith({
            limit: RECENT_ACTIVITY_FETCH_LIMIT
        });
        expect(mocked.getTransactions).toHaveBeenCalledWith({
            max_transactions: RECENT_ACTIVITY_FETCH_LIMIT
        });
        expect(swapStore.fetchAndUpdateSwaps).toHaveBeenCalled();
    });

    it('honors a custom count', async () => {
        serve({
            payments: [payment('p1', 100), payment('p2', 200)],
            invoices: [invoice('i1', 300)]
        });
        const { store } = newStore();

        const recent = await store.getRecentActivity(undefined, 2);

        expect(hashes(recent)).toEqual(['i1', 'p2']);
    });

    it('hides failed payments like the default Activity filters', async () => {
        serve({
            payments: [failedPayment('failed', 900), payment('ok', 100)]
        });
        const { store } = newStore();

        const recent = await store.getRecentActivity();

        expect(hashes(recent)).toEqual(['ok']);
    });

    it('skips on-chain transactions on backends without on-chain sends', async () => {
        mocked.supportsOnchainSends.mockReturnValue(false);
        serve({
            payments: [payment('p1', 100)],
            transactions: [transaction('t1', 200)]
        });
        const { store } = newStore();

        const recent = await store.getRecentActivity();

        expect(mocked.getTransactions).not.toHaveBeenCalled();
        expect(hashes(recent)).toEqual(['p1']);
    });

    it('keeps the other sources and flags the error when one source fails', async () => {
        serve({ invoices: [invoice('i1', 300)] });
        mocked.getPayments.mockRejectedValue(new Error('offline'));
        const { store } = newStore();

        const recent = await store.getRecentActivity();

        expect(hashes(recent)).toEqual(['i1']);
        expect(store.recentActivityError).toBe(true);
        expect(store.recentActivityLoading).toBe(false);
    });

    it('treats a backend without the method (call() returns false) as empty', async () => {
        serve({ invoices: [invoice('i1', 300)] });
        mocked.getPayments.mockResolvedValue(false);
        const { store } = newStore();

        const recent = await store.getRecentActivity();

        expect(hashes(recent)).toEqual(['i1']);
        expect(store.recentActivityError).toBe(false);
    });

    it('leaves the Activity view lists untouched', async () => {
        serve({ payments: [payment('p1', 100)] });
        const { store, paymentsStore } = newStore();
        const existing = [{ id: 'kept' }] as any;
        store.activity = existing;
        store.filteredActivity = existing;

        await store.getRecentActivity();

        expect(store.activity).toEqual([{ id: 'kept' }]);
        expect(store.filteredActivity).toEqual([{ id: 'kept' }]);
        expect(paymentsStore.payments).toEqual([]);
    });

    it('does not let a slower, older call overwrite a newer one', async () => {
        const { store } = newStore();
        let releaseFirst: (value: any) => void = () => {};
        mocked.getPayments
            .mockImplementationOnce(
                () => new Promise((resolve) => (releaseFirst = resolve))
            )
            .mockResolvedValueOnce({ payments: [payment('new', 200)] });
        mocked.getInvoices.mockResolvedValue({ invoices: [] });
        mocked.getTransactions.mockResolvedValue({ transactions: [] });

        const first = store.getRecentActivity();
        await store.getRecentActivity();
        releaseFirst({ payments: [payment('old', 100)] });
        await first;

        expect(hashes(store.recentActivity)).toEqual(['new']);
    });
});
