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
        supportsOnchainReceiving: jest.fn(() => false),
        supportsOnchainSends: jest.fn(() => false),
        supportsCashuWallet: jest.fn(() => false),
        supportsLSPS1native: jest.fn(() => false),
        supportsLSPScustomMessage: jest.fn(() => false),
        supportsLSPS1rest: jest.fn(() => false),
        supportsLSPS7native: jest.fn(() => false),
        supportsAMP: jest.fn(() => false),
        supportsLightningAddress: jest.fn(() => false),
        supportsKeysend: jest.fn(() => false),
        supportsCircularRebalancing: jest.fn(() => false)
    }
}));
jest.mock('../utils/ActivityFilterUtils', () => ({
    __esModule: true,
    default: {
        filterActivities: jest.fn((activity) => activity)
    }
}));

import Storage from '../storage';
import ActivityStore, { DEFAULT_FILTERS } from './ActivityStore';
import BackendUtils from '../utils/BackendUtils';
import ActivityFilterUtils from '../utils/ActivityFilterUtils';
import { getSupportedActivityFilters } from '../utils/ActivityFilterSupportUtils';

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

describe('ActivityStore effective filters', () => {
    const filterActivities = ActivityFilterUtils.filterActivities as jest.Mock;

    const storeFor = ({
        testnet = false,
        lightningAddressEnabled = false,
        cashuEnabled = false
    }: {
        testnet?: boolean;
        lightningAddressEnabled?: boolean;
        cashuEnabled?: boolean;
    } = {}) =>
        new ActivityStore(
            {
                implementation: 'ldk-node',
                settings: {
                    lightningAddress: { enabled: lightningAddressEnabled },
                    ecash: { enableCashu: cashuEnabled }
                }
            } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            { nodeInfo: {}, testnet } as any
        );

    const setBackend = (flags: Record<string, boolean>) => {
        Object.keys(BackendUtils).forEach((key) =>
            ((BackendUtils as any)[key] as jest.Mock).mockReturnValue(
                !!flags[key]
            )
        );
    };

    const appliedFilters = () => filterActivities.mock.calls.slice(-1)[0][1];

    beforeEach(() => filterActivities.mockClear());

    // setBackend overrides every capability. Put back the defaults of the
    // mock at the top of the file (an LND node), so a test added after this
    // block does not run as another kind of node.
    afterEach(() => setBackend({ isLNDBased: true }));

    it('turns every filter in the support map on by default', () => {
        // resetting a hidden filter to its default must never hide activity
        setBackend({});
        const supported = getSupportedActivityFilters({
            testnet: false,
            lightningAddressEnabled: false,
            cashuEnabled: false
        });

        Object.keys(supported).forEach((key) =>
            expect((DEFAULT_FILTERS as any)[key]).toBe(true)
        );
    });

    it('turns every other value that is reset on in the defaults', () => {
        // neutralizeUnsupportedFilters also writes these
        const all = (record: Record<string, boolean>) =>
            Object.values(record).every((value) => value === true);

        expect(DEFAULT_FILTERS.submarine).toBe(true);
        expect(DEFAULT_FILTERS.reverse).toBe(true);
        expect(all(DEFAULT_FILTERS.swapFilter.submarine)).toBe(true);
        expect(all(DEFAULT_FILTERS.swapFilter.reverse)).toBe(true);
        expect(all(DEFAULT_FILTERS.lsps1State)).toBe(true);
        expect(all(DEFAULT_FILTERS.lsps7State)).toBe(true);
    });

    it('does not filter by a hidden toggle saved under another node', async () => {
        setBackend({ supportsKeysend: true });
        const store = storeFor();

        await store.setFilters({
            ...DEFAULT_FILTERS,
            circularRebalance: false
        });

        expect(appliedFilters().circularRebalance).toBe(true);
    });

    it('keeps the saved filters and stores them as they are', async () => {
        setBackend({});
        const store = storeFor();

        await store.setFilters({
            ...DEFAULT_FILTERS,
            circularRebalance: false
        });

        expect(store.filters.circularRebalance).toBe(false);
        expect(Storage.setItem).toHaveBeenLastCalledWith(
            'zeus-activity-filters-v2',
            expect.objectContaining({ circularRebalance: false })
        );
    });

    it('still filters by a toggle the node supports', async () => {
        setBackend({ supportsKeysend: true });
        const store = storeFor();

        await store.setFilters({ ...DEFAULT_FILTERS, keysend: false });

        expect(appliedFilters().keysend).toBe(false);
    });

    it('does not filter by the swap filters on testnet', async () => {
        setBackend({});
        const store = storeFor({ testnet: true });

        await store.setFilters({
            ...DEFAULT_FILTERS,
            swaps: false,
            submarine: false,
            reverse: false
        });

        expect(appliedFilters().swaps).toBe(true);
        expect(appliedFilters().submarine).toBe(true);
        expect(appliedFilters().reverse).toBe(true);
    });

    it('still filters by the swap filters on mainnet', async () => {
        setBackend({});
        const store = storeFor({ testnet: false });

        await store.setFilters({
            ...DEFAULT_FILTERS,
            swaps: false,
            submarine: false,
            reverse: false
        });

        expect(appliedFilters().swaps).toBe(false);
        expect(appliedFilters().submarine).toBe(false);
        expect(appliedFilters().reverse).toBe(false);
    });

    it('does not filter by LSPS orders on a node without LSPS', async () => {
        setBackend({});
        const store = storeFor();

        const lsps1Off = Object.fromEntries(
            Object.keys(DEFAULT_FILTERS.lsps1State).map((state) => [
                state,
                false
            ])
        ) as typeof DEFAULT_FILTERS.lsps1State;

        await store.setFilters({
            ...DEFAULT_FILTERS,
            lsps1: false,
            lsps1State: lsps1Off
        });

        expect(appliedFilters().lsps1).toBe(true);
        expect(appliedFilters().lsps1State).toEqual(DEFAULT_FILTERS.lsps1State);
    });

    it('does not filter by ZEUS Pay when the toggle is hidden', async () => {
        setBackend({ supportsLightningAddress: true });
        const hidden = storeFor({ lightningAddressEnabled: false });
        await hidden.setFilters({ ...DEFAULT_FILTERS, zeusPay: false });
        expect(appliedFilters().zeusPay).toBe(true);

        const shown = storeFor({ lightningAddressEnabled: true });
        await shown.setFilters({ ...DEFAULT_FILTERS, zeusPay: false });
        expect(appliedFilters().zeusPay).toBe(false);
    });

    it('does not filter by Cashu when ecash is off in the settings', async () => {
        setBackend({ supportsCashuWallet: true });
        const off = storeFor({ cashuEnabled: false });
        await off.setFilters({ ...DEFAULT_FILTERS, cashu: false });
        expect(appliedFilters().cashu).toBe(true);

        const on = storeFor({ cashuEnabled: true });
        await on.setFilters({ ...DEFAULT_FILTERS, cashu: false });
        expect(appliedFilters().cashu).toBe(false);
    });

    it('does not filter by on-chain activity on a node that cannot send on-chain', async () => {
        setBackend({ supportsOnchainReceiving: true });
        const store = storeFor();

        await store.setFilters({
            ...DEFAULT_FILTERS,
            onChain: false,
            unconfirmed: false
        });

        expect(appliedFilters().onChain).toBe(true);
        expect(appliedFilters().unconfirmed).toBe(true);
    });

    it('keeps the In transit and Failed filters on a node that is not LND', async () => {
        setBackend({});
        const store = storeFor();

        await store.setFilters({
            ...DEFAULT_FILTERS,
            inTransit: true,
            isFailed: true
        });

        expect(appliedFilters().inTransit).toBe(true);
        expect(appliedFilters().isFailed).toBe(true);
    });

    it('reports the defaults for the filter indicators when only hidden toggles differ', async () => {
        setBackend({});
        const store = storeFor();

        await store.setFilters({
            ...DEFAULT_FILTERS,
            circularRebalance: false
        });

        expect(store.getEffectiveFilters()).toEqual(DEFAULT_FILTERS);
    });
});
