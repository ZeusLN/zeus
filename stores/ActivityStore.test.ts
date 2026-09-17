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

const activityItem = (timestamp: number) => ({
    getTimestamp: timestamp,
    getDate: new Date(timestamp * 1000)
});

describe('ActivityStore scoped LND fetches', () => {
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
        expect(paymentsStore.payments).toEqual([canonicalPayment]);
        expect(invoicesStore.invoices).toEqual([canonicalInvoice]);
        expect(store.activity).toEqual([scopedInvoice, scopedPayment]);
    });

    it('loads node information before a version-gated date request', async () => {
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

        expect(nodeInfoStore.getNodeInfo).toHaveBeenCalledTimes(1);
    });
});
