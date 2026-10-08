jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(undefined)
    }
}));
jest.mock('../stores/Stores', () => ({ notesStore: {} }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (value: string) => value
}));
jest.mock('./LSPStore', () => ({ LSPS_ORDERS_KEY: 'lsps-orders' }));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        isLNDBased: jest.fn(() => true),
        supportsOnchainSends: jest.fn(() => false),
        supportsCashuWallet: jest.fn(() => false)
    }
}));
jest.mock('../utils/ActivityFilterUtils', () => ({
    __esModule: true,
    default: {
        filterActivities: jest.fn((activity) => activity)
    }
}));

import ActivityStore, { DEFAULT_FILTERS } from './ActivityStore';
import BackendUtils from '../utils/BackendUtils';

const activityItem = (timestamp: number) => ({
    getTimestamp: timestamp,
    getDate: new Date(timestamp * 1000)
});

describe('ActivityStore scoped LND fetches', () => {
    beforeEach(() => {
        (BackendUtils.isLNDBased as jest.Mock).mockReturnValue(true);
    });

    it('keeps date-scoped results out of the shared invoice and payment stores', async () => {
        const canonicalPayment = activityItem(1);
        const canonicalInvoice = activityItem(2);
        const scopedPayment = activityItem(3);
        const scopedInvoice = activityItem(4);
        const paymentsStore = {
            payments: [canonicalPayment],
            getPayments: jest.fn(),
            fetchPayments: jest.fn().mockResolvedValue([scopedPayment])
        };
        const invoicesStore = {
            invoices: [canonicalInvoice],
            getInvoices: jest.fn(),
            fetchInvoices: jest.fn().mockResolvedValue({
                invoices: [scopedInvoice],
                count: 1
            })
        };
        const store = new ActivityStore(
            { implementation: 'lnd', settings: {} } as any,
            paymentsStore as any,
            invoicesStore as any,
            { transactions: [] } as any,
            { checkPendingItems: jest.fn() } as any,
            { swaps: [], fetchAndUpdateSwaps: jest.fn() } as any,
            { nodeInfo: { version: '0.20.0-beta' } } as any
        );
        const startDate = new Date(2024, 4, 10);
        const endDate = new Date(2024, 4, 12);

        await store.getActivityAndFilter(undefined, {
            ...DEFAULT_FILTERS,
            startDate,
            endDate
        });

        expect(paymentsStore.fetchPayments).toHaveBeenCalledWith(
            expect.objectContaining({
                creationDateStart: expect.any(Number),
                creationDateEnd: expect.any(Number)
            })
        );
        expect(invoicesStore.fetchInvoices).toHaveBeenCalledWith({
            creationDateEnd: expect.any(Number)
        });
        expect(paymentsStore.getPayments).toHaveBeenCalledTimes(1);
        expect(invoicesStore.getInvoices).toHaveBeenCalledTimes(1);
        expect(paymentsStore.payments).toEqual([canonicalPayment]);
        expect(invoicesStore.invoices).toEqual([canonicalInvoice]);
        expect(store.activity).toEqual([scopedInvoice, scopedPayment]);
    });

    it('does not refresh global node information for a date request', async () => {
        const nodeInfoStore = {
            nodeInfo: {},
            getNodeInfo: jest.fn().mockImplementation(async () => {
                nodeInfoStore.nodeInfo = { version: '0.20.0-beta' };
            })
        };
        const store = new ActivityStore(
            { implementation: 'lnd', settings: {} } as any,
            {
                payments: [],
                getPayments: jest.fn(),
                fetchPayments: jest.fn().mockResolvedValue([])
            } as any,
            {
                invoices: [],
                getInvoices: jest.fn(),
                fetchInvoices: jest
                    .fn()
                    .mockResolvedValue({ invoices: [], count: 0 })
            } as any,
            { transactions: [] } as any,
            { checkPendingItems: jest.fn() } as any,
            { swaps: [], fetchAndUpdateSwaps: jest.fn() } as any,
            nodeInfoStore as any
        );

        await store.getActivityAndFilter(undefined, {
            ...DEFAULT_FILTERS,
            endDate: new Date(2024, 4, 12)
        });

        expect(nodeInfoStore.getNodeInfo).not.toHaveBeenCalled();
    });

    it('clears node-scoped activity before starting a new wallet fetch', async () => {
        const store = new ActivityStore(
            { implementation: 'lnd', settings: {} } as any,
            {
                payments: [],
                getPayments: jest.fn(),
                fetchPayments: jest
                    .fn()
                    .mockRejectedValue(new Error('wallet unavailable'))
            } as any,
            {
                invoices: [],
                getInvoices: jest.fn(),
                fetchInvoices: jest.fn()
            } as any,
            { transactions: [] } as any,
            { checkPendingItems: jest.fn() } as any,
            { swaps: [], fetchAndUpdateSwaps: jest.fn() } as any,
            { nodeInfo: { version: '0.20.0-beta' } } as any
        );
        (store as any).activityPayments = [activityItem(1)];
        (store as any).activityInvoices = [activityItem(2)];

        await expect(
            store.getActivityAndFilter(undefined, {
                ...DEFAULT_FILTERS,
                startDate: new Date(2024, 4, 10)
            })
        ).rejects.toThrow('wallet unavailable');

        expect((store as any).activityPayments).toBeUndefined();
        expect((store as any).activityInvoices).toBeUndefined();
    });

    it('refreshes canonical invoices as well as scoped LNC activity', async () => {
        const canonicalInvoice = activityItem(2);
        const scopedInvoice = activityItem(4);
        const invoicesStore = {
            invoices: [] as any[],
            getInvoices: jest.fn().mockImplementation(async () => {
                invoicesStore.invoices = [canonicalInvoice];
                return invoicesStore.invoices;
            }),
            fetchInvoices: jest.fn().mockResolvedValue({
                invoices: [scopedInvoice],
                count: 1
            })
        };
        const store = new ActivityStore(
            { implementation: 'lightning-node-connect', settings: {} } as any,
            { payments: [] } as any,
            invoicesStore as any,
            { transactions: [] } as any,
            { checkPendingItems: jest.fn() } as any,
            { swaps: [] } as any,
            { nodeInfo: { version: '0.20.0-beta' } } as any
        );
        store.filters = {
            ...DEFAULT_FILTERS,
            endDate: new Date(2024, 4, 12)
        };

        await store.updateInvoices(undefined);

        expect(invoicesStore.getInvoices).toHaveBeenCalledTimes(1);
        expect(invoicesStore.fetchInvoices).toHaveBeenCalledWith({
            creationDateEnd: expect.any(Number)
        });
        expect(invoicesStore.invoices).toEqual([canonicalInvoice]);
        expect(store.activity).toEqual([scopedInvoice]);
    });

    it('keeps non-LND activity unscoped and bound to canonical stores', async () => {
        (BackendUtils.isLNDBased as jest.Mock).mockReturnValue(false);
        const initialPayment = activityItem(1);
        const initialInvoice = activityItem(2);
        const refreshedPayment = activityItem(3);
        const refreshedInvoice = activityItem(4);
        const paymentsStore = {
            payments: [initialPayment],
            getPayments: jest.fn(),
            fetchPayments: jest.fn()
        };
        const invoicesStore = {
            invoices: [initialInvoice],
            getInvoices: jest.fn(),
            fetchInvoices: jest.fn()
        };
        const store = new ActivityStore(
            { implementation: 'cln-rest', settings: {} } as any,
            paymentsStore as any,
            invoicesStore as any,
            { transactions: [] } as any,
            { checkPendingItems: jest.fn() } as any,
            { swaps: [], fetchAndUpdateSwaps: jest.fn() } as any,
            { nodeInfo: {} } as any
        );

        await store.getActivityAndFilter(undefined, {
            ...DEFAULT_FILTERS,
            startDate: new Date(2024, 4, 10),
            endDate: new Date(2024, 4, 12)
        });

        expect(paymentsStore.fetchPayments).not.toHaveBeenCalled();
        expect(invoicesStore.fetchInvoices).not.toHaveBeenCalled();
        expect(paymentsStore.getPayments).toHaveBeenCalledTimes(1);
        expect(invoicesStore.getInvoices).toHaveBeenCalledTimes(1);

        paymentsStore.payments = [refreshedPayment];
        invoicesStore.invoices = [refreshedInvoice];

        expect(await store.getSortedActivity()).toEqual([
            refreshedInvoice,
            refreshedPayment
        ]);
    });
});
