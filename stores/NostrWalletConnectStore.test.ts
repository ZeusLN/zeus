jest.mock('../stores/Stores', () => ({}));

jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        supportsNodeInfo: () => false,
        supportsCashuWallet: () => false,
        supportsMessageSigning: jest.fn(() => true)
    }
}));

jest.mock('../utils/IOSAudioKeepAliveUtils', () => ({
    __esModule: true,
    default: {
        isAvailable: () => false,
        start: jest.fn(),
        stop: jest.fn(),
        disarm: jest.fn(),
        onInterrupted: jest.fn(),
        onInterruptionEnded: jest.fn(),
        onRouteChanged: jest.fn(),
        onStatusUpdate: jest.fn(),
        onSuspended: jest.fn()
    }
}));

jest.mock('react-native-notifications', () => ({
    Notifications: {
        postLocalNotification: jest.fn()
    }
}));

jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@getalby/sdk', () => ({
    NWCWalletService: jest.fn().mockImplementation(() => ({
        connected: true,
        close: jest.fn(),
        publishWalletServiceInfoEvent: jest.fn().mockResolvedValue(undefined)
    })),
    NWCWalletServiceKeyPair: jest.fn()
}));

jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
    }
}));

import Storage from '../storage';
import BackendUtils from '../utils/BackendUtils';
import NWCConnection, { BudgetRenewalType } from '../models/NWCConnection';
import Invoice from '../models/Invoice';
import Base64Utils from '../utils/Base64Utils';
import NostrConnectUtils, { Nip47ErrorCode } from '../utils/NostrConnectUtils';
import NostrWalletConnectStore, {
    NWC_CLIENT_KEYS,
    RELAY_RELEASE_GRACE_MS
} from './NostrWalletConnectStore';

const hex64 = (c: string) => c.repeat(64);
const OLD_PUBKEY = hex64('a');
const OLD_PRIVKEY = hex64('b');
const OTHER_PUBKEY = hex64('c');
const SERVICE_PRIV = hex64('1');
const SERVICE_PUB = hex64('2');
const NODE_PUBKEY = 'test-node-pubkey';
const OLD_RELAY = 'wss://relay.old.example';
const NEW_RELAY = 'wss://relay.new.example';

describe('NostrWalletConnectStore relay rotation', () => {
    let clientKeys: Record<string, string>;

    beforeEach(() => {
        jest.clearAllMocks();
        clientKeys = { [OLD_PUBKEY]: OLD_PRIVKEY };

        (Storage.getItem as jest.Mock).mockImplementation(
            async (key: string) => {
                if (key === NWC_CLIENT_KEYS) {
                    return JSON.stringify(clientKeys);
                }
                return false;
            }
        );
        (Storage.setItem as jest.Mock).mockImplementation(
            async (key: string, value: string) => {
                if (key === NWC_CLIENT_KEYS) {
                    clientKeys = JSON.parse(value);
                }
            }
        );
    });

    function buildStore(options?: { publishNewRelay?: boolean }) {
        const publishNewRelay = options?.publishNewRelay !== false;
        const settingsStore: any = {
            connecting: false,
            implementation: 'lnd',
            settings: {
                locale: 'en',
                ecash: { enableCashu: false },
                lightningAddress: { enabled: false }
            }
        };
        const store = new NostrWalletConnectStore(
            settingsStore,
            {} as any,
            {
                nodeInfo: { nodeId: NODE_PUBKEY },
                getNodeInfo: jest.fn()
            } as any,
            {} as any,
            { invoices: [] } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any
        );

        (store as any).walletServiceKeys = {
            privateKey: SERVICE_PRIV,
            publicKey: SERVICE_PUB
        };
        (store as any).lud16Enabled = false;
        (store as any).nwcWalletServices.set(OLD_RELAY, {
            connected: true,
            close: jest.fn()
        });
        (store as any).nwcWalletServices.set(NEW_RELAY, {
            connected: true,
            close: jest.fn()
        });
        (store as any).publishedRelays.add(OLD_RELAY);
        if (publishNewRelay) {
            (store as any).publishedRelays.add(NEW_RELAY);
        }

        jest.spyOn(
            store as any,
            'unsubscribeFromConnection'
        ).mockImplementation(() => undefined);
        jest.spyOn(store as any, 'subscribeToConnection').mockResolvedValue(
            undefined
        );
        jest.spyOn(store as any, 'saveConnections').mockResolvedValue(
            undefined
        );
        jest.spyOn(store as any, 'scheduleSave').mockImplementation(
            () => undefined
        );

        return store;
    }

    function seedConnection(
        store: NostrWalletConnectStore,
        overrides: Record<string, unknown> = {}
    ) {
        const connection = new NWCConnection({
            id: 'conn-1',
            name: 'Test App',
            pubkey: OLD_PUBKEY,
            relayUrl: OLD_RELAY,
            permissions: [],
            createdAt: new Date('2024-01-01T00:00:00Z'),
            totalSpendSats: 42,
            nodePubkey: NODE_PUBKEY,
            implementation: 'lnd',
            activity: [],
            ...overrides
        } as any);
        store.connections = [connection, ...store.connections];
        return connection;
    }

    it('rotates keys, preserves identity, and drops the unused old relay', async () => {
        const store = buildStore();
        const createdAt = new Date('2024-01-01T00:00:00Z');
        const expiresAt = new Date('2025-06-15T12:00:00Z');
        const connection = seedConnection(store, {
            createdAt,
            expiresAt,
            maxAmountSats: 5000,
            budgetRenewal: BudgetRenewalType.Never,
            lastBudgetReset: new Date('2024-03-01T00:00:00Z'),
            activity: [
                {
                    id: 'lnbc1activity',
                    type: 'pay_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    satAmount: 21
                }
            ]
        });
        const oldService = (store as any).nwcWalletServices.get(OLD_RELAY);

        const result = await store.updateConnection(connection.id, {
            relayUrl: NEW_RELAY,
            expiresAt,
            maxAmountSats: 5000,
            budgetRenewal: BudgetRenewalType.Never
        });

        expect(result.success).toBe(true);
        expect(result.nostrUrl).toEqual(expect.stringContaining(NEW_RELAY));
        expect(connection.id).toBe('conn-1');
        expect(connection.relayUrl).toBe(NEW_RELAY);
        expect(connection.pubkey).not.toBe(OLD_PUBKEY);
        expect(connection.createdAt).toEqual(createdAt);
        expect(connection.expiresAt).toEqual(expiresAt);
        expect(connection.totalSpendSats).toBe(42);
        expect(connection.maxAmountSats).toBe(5000);
        expect(connection.activity).toHaveLength(1);
        expect(clientKeys[OLD_PUBKEY]).toBeUndefined();
        expect(clientKeys[connection.pubkey]).toEqual(expect.any(String));
        expect(oldService.close).toHaveBeenCalled();
        expect((store as any).nwcWalletServices.has(OLD_RELAY)).toBe(false);
        expect((store as any).publishedRelays.has(OLD_RELAY)).toBe(false);
    });

    it('leaves relayUrl unchanged when storing the new key fails so retry can rotate', async () => {
        const store = buildStore();
        const connection = seedConnection(store);
        const consoleError = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        try {
            (Storage.setItem as jest.Mock).mockImplementation(async () => {
                throw new Error('storage write failed');
            });

            const result = await store.updateConnection(connection.id, {
                relayUrl: NEW_RELAY
            });

            expect(result.success).toBe(false);
            expect(result.nostrUrl).toBeUndefined();
            expect(connection.relayUrl).toBe(OLD_RELAY);
            expect(connection.pubkey).toBe(OLD_PUBKEY);
        } finally {
            consoleError.mockRestore();
        }
    });

    it('still returns the pairing URL if subscribe/save fails after durable rotation', async () => {
        const store = buildStore();
        const connection = seedConnection(store);
        const consoleWarn = jest
            .spyOn(console, 'warn')
            .mockImplementation(() => {});

        try {
            (store as any).subscribeToConnection.mockRejectedValue(
                new Error('subscribe failed')
            );

            const result = await store.updateConnection(connection.id, {
                relayUrl: NEW_RELAY
            });

            expect(result.success).toBe(true);
            expect(result.nostrUrl).toEqual(expect.stringContaining(NEW_RELAY));
            expect(connection.pubkey).not.toBe(OLD_PUBKEY);
            expect(clientKeys[OLD_PUBKEY]).toBeUndefined();
            expect(clientKeys[connection.pubkey]).toEqual(expect.any(String));
        } finally {
            consoleWarn.mockRestore();
        }
    });

    it('does not rotate keys on non-relay edits', async () => {
        const store = buildStore();
        const connection = seedConnection(store);
        const pubkeyBefore = connection.pubkey;

        const result = await store.updateConnection(connection.id, {
            name: 'Renamed App',
            maxAmountSats: 2500
        });

        expect(result).toEqual({ success: true });
        expect(connection.name).toBe('Renamed App');
        expect(connection.maxAmountSats).toBe(2500);
        expect(connection.pubkey).toBe(pubkeyBefore);
        expect(connection.relayUrl).toBe(OLD_RELAY);
        expect(clientKeys).toEqual({ [OLD_PUBKEY]: OLD_PRIVKEY });
    });

    it('keeps the old relay service when another connection still uses it', async () => {
        const store = buildStore();
        const connection = seedConnection(store);
        seedConnection(store, {
            id: 'conn-2',
            name: 'Other App',
            pubkey: OTHER_PUBKEY,
            relayUrl: OLD_RELAY
        });
        const oldService = (store as any).nwcWalletServices.get(OLD_RELAY);

        await store.updateConnection(connection.id, { relayUrl: NEW_RELAY });

        expect(oldService.close).not.toHaveBeenCalled();
        expect((store as any).nwcWalletServices.has(OLD_RELAY)).toBe(true);
        expect((store as any).publishedRelays.has(OLD_RELAY)).toBe(true);
    });

    it('releases an unused relay service when deleting the last connection on it', async () => {
        const store = buildStore();
        const connection = seedConnection(store);
        const oldService = (store as any).nwcWalletServices.get(OLD_RELAY);

        await store.deleteConnection(connection.id);

        expect(oldService.close).toHaveBeenCalled();
        expect((store as any).nwcWalletServices.has(OLD_RELAY)).toBe(false);
        expect((store as any).publishedRelays.has(OLD_RELAY)).toBe(false);
        expect(store.connections).toHaveLength(0);
        expect(clientKeys[OLD_PUBKEY]).toBeUndefined();
    });

    it('succeeds when publishing wallet service info to the new relay fails', async () => {
        const store = buildStore({ publishNewRelay: false });
        const connection = seedConnection(store);
        const consoleWarn = jest
            .spyOn(console, 'warn')
            .mockImplementation(() => {});

        try {
            jest.spyOn(
                store as any,
                'publishWalletServiceInfoWithRetry'
            ).mockRejectedValue(new Error('publish failed'));

            const result = await store.updateConnection(connection.id, {
                relayUrl: NEW_RELAY
            });

            expect(result.success).toBe(true);
            expect(result.nostrUrl).toEqual(expect.stringContaining(NEW_RELAY));
            expect(connection.relayUrl).toBe(NEW_RELAY);
            expect(connection.pubkey).not.toBe(OLD_PUBKEY);
        } finally {
            consoleWarn.mockRestore();
        }
    });
});

function buildPayInvoiceTestStore() {
    const settingsStore: any = {
        connecting: false,
        implementation: 'lnd',
        settings: {
            locale: 'en',
            ecash: { enableCashu: false },
            lightningAddress: { enabled: false }
        }
    };
    const store = new NostrWalletConnectStore(
        settingsStore,
        {} as any,
        {
            nodeInfo: { nodeId: NODE_PUBKEY },
            getNodeInfo: jest.fn()
        } as any,
        {} as any,
        { invoices: [] } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any
    );

    jest.spyOn(store as any, 'findAndUpdateConnection').mockImplementation(
        () => undefined
    );
    jest.spyOn(store as any, 'scheduleMaxBudgetRefresh').mockImplementation(
        () => undefined
    );

    return store;
}

function seedPayInvoiceConnection(
    store: NostrWalletConnectStore,
    overrides: Record<string, unknown> = {}
) {
    const connection = new NWCConnection({
        id: 'conn-pay',
        name: 'Pay Test App',
        pubkey: OLD_PUBKEY,
        relayUrl: OLD_RELAY,
        permissions: [],
        createdAt: new Date('2024-01-01T00:00:00Z'),
        totalSpendSats: 0,
        nodePubkey: NODE_PUBKEY,
        implementation: 'lnd',
        activity: [],
        ...overrides
    } as any);
    store.connections = [connection];
    return connection;
}

describe('NostrWalletConnectStore pay_invoice activity upsert', () => {
    const normalizedInvoice = 'lnbc1normalized';
    const uppercaseInvoice = 'LNBC1NORMALIZED';
    const paymentHash = 'abc123paymenthash';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(NostrConnectUtils, 'decodeInvoiceTags').mockResolvedValue({
            paymentRequest: normalizedInvoice,
            paymentHash,
            descriptionHash: '',
            description: '',
            amount: 100,
            expiryTime: 0,
            createdAt: 0,
            isExpired: false,
            network: 'bitcoin'
        });
        jest.spyOn(
            NostrConnectUtils,
            'notifyOutgoingNwcPaymentFailed'
        ).mockImplementation(() => undefined);
        jest.spyOn(
            NostrConnectUtils,
            'notifyOutgoingNwcPayment'
        ).mockImplementation(() => undefined);
    });

    it('upsertPayInvoiceActivity never demotes success to failed', () => {
        const store = buildPayInvoiceTestStore();
        const connection = seedPayInvoiceConnection(store, {
            activity: [
                {
                    id: normalizedInvoice,
                    type: 'pay_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    satAmount: 100,
                    isBudgetDebited: true
                }
            ]
        });

        const applied = (store as any).upsertPayInvoiceActivity(connection, {
            id: normalizedInvoice,
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'failed',
            satAmount: 100,
            error: 'payment timed out'
        });

        expect(applied).toBe(false);
        expect(connection.activity).toHaveLength(1);
        expect(connection.activity[0].status).toBe('success');
    });

    it('upsertPayInvoiceActivity keeps isBudgetDebited sticky across merges', () => {
        const store = buildPayInvoiceTestStore();
        const connection = seedPayInvoiceConnection(store, {
            activity: [
                {
                    id: normalizedInvoice,
                    type: 'pay_invoice',
                    payment_source: 'lightning',
                    status: 'pending',
                    satAmount: 100,
                    isBudgetDebited: true
                }
            ]
        });

        (store as any).upsertPayInvoiceActivity(connection, {
            id: normalizedInvoice,
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'success',
            satAmount: 100
        });

        expect(connection.activity[0].isBudgetDebited).toBe(true);
    });

    it('upsertPayInvoiceActivity preserves createdAt on merge', () => {
        const store = buildPayInvoiceTestStore();
        const createdAt = new Date('2024-06-01T12:00:00Z');
        const connection = seedPayInvoiceConnection(store, {
            activity: [
                {
                    id: normalizedInvoice,
                    type: 'pay_invoice',
                    payment_source: 'lightning',
                    status: 'pending',
                    satAmount: 100,
                    createdAt
                }
            ]
        });

        (store as any).upsertPayInvoiceActivity(connection, {
            id: normalizedInvoice,
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'success',
            satAmount: 100,
            createdAt: new Date('2024-06-02T00:00:00Z')
        });

        expect(connection.activity[0].createdAt).toEqual(createdAt);
    });

    it('upsertPayInvoiceActivity clears error when promoting to success', () => {
        const store = buildPayInvoiceTestStore();
        const connection = seedPayInvoiceConnection(store, {
            activity: [
                {
                    id: normalizedInvoice,
                    type: 'pay_invoice',
                    payment_source: 'lightning',
                    status: 'failed',
                    satAmount: 100,
                    error: 'first attempt failed'
                }
            ]
        });

        (store as any).upsertPayInvoiceActivity(connection, {
            id: normalizedInvoice,
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'success',
            satAmount: 100
        });

        expect(connection.activity[0].status).toBe('success');
        expect(connection.activity[0].error).toBeUndefined();
    });

    it('upsertPayInvoiceActivity merges by paymentHash when ids differ', () => {
        const store = buildPayInvoiceTestStore();
        const connection = seedPayInvoiceConnection(store, {
            activity: [
                {
                    id: normalizedInvoice,
                    type: 'pay_invoice',
                    payment_source: 'lightning',
                    status: 'pending',
                    satAmount: 100,
                    paymentHash
                }
            ]
        });

        (store as any).upsertPayInvoiceActivity(connection, {
            id: uppercaseInvoice,
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'success',
            satAmount: 100,
            paymentHash
        });

        expect(connection.activity).toHaveLength(1);
        expect(connection.activity[0].status).toBe('success');
        expect(connection.activity[0].id).toBe(uppercaseInvoice);
    });

    it('finalizePayment normalizes invoice id and does not double-debit', async () => {
        const store = buildPayInvoiceTestStore();
        const connection = seedPayInvoiceConnection(store, {
            totalSpendSats: 100,
            activity: [
                {
                    id: normalizedInvoice,
                    type: 'pay_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    satAmount: 100,
                    isBudgetDebited: true,
                    paymentHash
                }
            ]
        });

        await (store as any).finalizePayment({
            rawInvoice: uppercaseInvoice,
            type: 'pay_invoice',
            payment_source: 'lightning',
            decoded: null,
            connection,
            amountSats: 100,
            feeSats: 0,
            paymentHash
        });

        expect(connection.activity).toHaveLength(1);
        expect(connection.totalSpendSats).toBe(100);
        expect(NostrConnectUtils.decodeInvoiceTags).toHaveBeenCalledWith(
            uppercaseInvoice
        );
    });

    it('recordFailedPayment skips notification when success blocks demote', async () => {
        const store = buildPayInvoiceTestStore();
        const connection = seedPayInvoiceConnection(store, {
            activity: [
                {
                    id: normalizedInvoice,
                    type: 'pay_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    satAmount: 100,
                    isBudgetDebited: true
                }
            ]
        });

        await (store as any).recordFailedPayment({
            rawInvoice: normalizedInvoice,
            connection,
            amountSats: 100,
            payment_source: 'lightning',
            errorMessage: 'payment timed out'
        });

        expect(
            NostrConnectUtils.notifyOutgoingNwcPaymentFailed
        ).not.toHaveBeenCalled();
        expect(connection.activity[0].status).toBe('success');
    });
});

describe('NostrWalletConnectStore connection data scoping', () => {
    const WALLET_ONLY_HASH = hex64('f');
    const CONNECTION_HASH = hex64('e');
    const CONNECTION_INVOICE = 'lnbc1connection-only';

    function buildScopedStore() {
        const paymentsStore = {
            getPayments: jest.fn().mockResolvedValue(undefined),
            payments: [
                {
                    paymentHash: WALLET_ONLY_HASH,
                    getAmount: '1000',
                    getPaymentRequest: 'lnbc1wallet-payment',
                    getTimestamp: 1_700_000_000
                }
            ]
        };
        const invoicesStore = {
            getInvoices: jest.fn().mockResolvedValue(undefined),
            invoices: [
                {
                    getRHash: WALLET_ONLY_HASH,
                    getAmount: '2000',
                    getPaymentRequest: 'lnbc1wallet-invoice',
                    getCreationDate: 1_700_000_000
                }
            ]
        };
        const transactionsStore = {
            getTransactions: jest.fn().mockResolvedValue(undefined),
            transactions: [
                {
                    tx_hash: 'onchain-wallet-tx',
                    amount: 50_000,
                    dest_addresses: ['bcrt1qsecretaddress'],
                    raw_tx_hex: 'deadbeef',
                    time_stamp: 1_700_000_000,
                    num_confirmations: 1
                }
            ]
        };
        const settingsStore: any = {
            connecting: false,
            implementation: 'lnd',
            settings: {
                locale: 'en',
                ecash: { enableCashu: false },
                lightningAddress: { enabled: false }
            }
        };
        const store = new NostrWalletConnectStore(
            settingsStore,
            {} as any,
            {
                nodeInfo: { nodeId: NODE_PUBKEY },
                getNodeInfo: jest.fn()
            } as any,
            transactionsStore as any,
            {} as any,
            invoicesStore as any,
            {} as any,
            {} as any,
            {} as any,
            paymentsStore as any
        );

        jest.spyOn(store as any, 'scheduleSave').mockImplementation(
            () => undefined
        );
        jest.spyOn(
            store as any,
            'reconcilePendingPayInvoiceActivities'
        ).mockResolvedValue(false);

        return { store, paymentsStore, invoicesStore, transactionsStore };
    }

    function seedReadOnlyConnection(
        store: NostrWalletConnectStore,
        overrides: Record<string, unknown> = {}
    ) {
        const connection = new NWCConnection({
            id: 'conn-readonly',
            name: 'Read Only App',
            pubkey: OLD_PUBKEY,
            relayUrl: OLD_RELAY,
            permissions: ['lookup_invoice', 'list_transactions'],
            createdAt: new Date('2024-01-01T00:00:00Z'),
            totalSpendSats: 0,
            nodePubkey: NODE_PUBKEY,
            implementation: 'lnd',
            activity: [],
            ...overrides
        } as any);
        store.connections = [connection];
        return connection;
    }

    it('list_transactions returns only the connection activity for read-only connections', async () => {
        const { store, paymentsStore, invoicesStore, transactionsStore } =
            buildScopedStore();
        const connection = seedReadOnlyConnection(store, {
            activity: [
                {
                    id: CONNECTION_INVOICE,
                    type: 'make_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    satAmount: 50,
                    paymentHash: CONNECTION_HASH
                }
            ]
        });

        const response = await (store as any).handleListTransactions(
            connection,
            {}
        );

        expect(response.error).toBeUndefined();
        expect(response.result?.transactions).toHaveLength(1);
        expect(response.result?.transactions[0].payment_hash).toBe(
            CONNECTION_HASH
        );
        expect(paymentsStore.getPayments).not.toHaveBeenCalled();
        expect(invoicesStore.getInvoices).not.toHaveBeenCalled();
        expect(transactionsStore.getTransactions).not.toHaveBeenCalled();
    });

    it('lookup_invoice rejects hashes outside the connection activity', async () => {
        const { store } = buildScopedStore();
        const connection = seedReadOnlyConnection(store);

        const response = await (store as any).handleLookupInvoice(connection, {
            payment_hash: WALLET_ONLY_HASH
        });

        expect(response.result).toBeUndefined();
        expect(response.error?.code).toBe('NOT_FOUND');
    });

    it('lookup_invoice returns invoices recorded on the connection', async () => {
        const { store } = buildScopedStore();
        const connection = seedReadOnlyConnection(store, {
            activity: [
                {
                    id: CONNECTION_INVOICE,
                    type: 'make_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    satAmount: 50,
                    paymentHash: CONNECTION_HASH
                }
            ]
        });

        const response = await (store as any).handleLookupInvoice(connection, {
            payment_hash: CONNECTION_HASH
        });

        expect(response.error).toBeUndefined();
        expect(response.result?.payment_hash).toBe(CONNECTION_HASH);
        expect(response.result?.type).toBe('incoming');
    });

    it('lookup_invoice includes preimage for a settled make_invoice', async () => {
        const PREIMAGE = hex64('a');
        const { store } = buildScopedStore();
        const settledInvoice = new Invoice({
            r_hash: Base64Utils.hexToBase64(CONNECTION_HASH),
            payment_request: CONNECTION_INVOICE,
            creation_date: String(1_700_000_000),
            expiry: String(3600),
            value: '1000',
            settled: true,
            settle_date: String(1_700_000_500),
            r_preimage: Base64Utils.hexToBase64(PREIMAGE)
        });
        const connection = seedReadOnlyConnection(store, {
            activity: [
                {
                    id: CONNECTION_INVOICE,
                    type: 'make_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    satAmount: 50,
                    paymentHash: CONNECTION_HASH,
                    invoice: settledInvoice
                }
            ]
        });

        const response = await (store as any).handleLookupInvoice(connection, {
            payment_hash: CONNECTION_HASH
        });

        expect(response.error).toBeUndefined();
        expect(response.result?.preimage).toBe(PREIMAGE);
        expect(response.result?.state).toBe('settled');
    });

    it('lookup_invoice includes preimage after invoice rehydration from storage', async () => {
        const PREIMAGE = hex64('a');
        const { store } = buildScopedStore();
        const connection = seedReadOnlyConnection(store, {
            activity: [
                {
                    id: CONNECTION_INVOICE,
                    type: 'make_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    satAmount: 50,
                    paymentHash: CONNECTION_HASH,
                    preimage: PREIMAGE,
                    invoice: {
                        r_hash: Base64Utils.hexToBase64(CONNECTION_HASH),
                        payment_request: CONNECTION_INVOICE,
                        creation_date: String(1_700_000_000),
                        expiry: String(3600),
                        value: '1000',
                        settled: true,
                        settle_date: String(1_700_000_500)
                    }
                }
            ]
        });

        const response = await (store as any).handleLookupInvoice(connection, {
            payment_hash: CONNECTION_HASH
        });

        expect(response.error).toBeUndefined();
        expect(response.result?.preimage).toBe(PREIMAGE);
        expect(response.result?.state).toBe('settled');
    });
});

describe('NostrWalletConnectStore connection expiry enforcement', () => {
    function buildStore() {
        const settingsStore: any = {
            connecting: false,
            implementation: 'lnd',
            settings: {
                locale: 'en',
                ecash: { enableCashu: false },
                lightningAddress: { enabled: false }
            }
        };
        const store = new NostrWalletConnectStore(
            settingsStore,
            {} as any,
            {
                nodeInfo: { nodeId: NODE_PUBKEY },
                getNodeInfo: jest.fn()
            } as any,
            {} as any,
            { invoices: [] } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any
        );

        (store as any).walletServiceKeys = {
            privateKey: SERVICE_PRIV,
            publicKey: SERVICE_PUB
        };
        jest.spyOn(store as any, 'scheduleSave').mockImplementation(
            () => undefined
        );
        jest.spyOn(store as any, 'saveConnections').mockResolvedValue(
            undefined
        );

        return store;
    }

    function seedConnection(
        store: NostrWalletConnectStore,
        overrides: Record<string, unknown> = {}
    ) {
        const connection = new NWCConnection({
            id: 'conn-expiry',
            name: 'Expired App',
            pubkey: OLD_PUBKEY,
            relayUrl: OLD_RELAY,
            permissions: ['get_info', 'get_balance', 'make_invoice'],
            createdAt: new Date('2024-01-01T00:00:00Z'),
            totalSpendSats: 0,
            nodePubkey: NODE_PUBKEY,
            implementation: 'lnd',
            activity: [],
            ...overrides
        } as any);
        store.connections = [connection];
        return connection;
    }

    it('returns INTERNAL_ERROR without unsubscribing when wallet identity is unknown', async () => {
        const store = buildStore();
        (store as any).nodeInfoStore.nodeInfo = {};
        const connection = seedConnection(store);

        const unsub = jest.fn();
        (store as any).activeSubscriptions.set(connection.id, unsub);

        const response = await (store as any).withGlobalHandler(
            connection.id,
            async () => ({
                result: { should: 'not-run' },
                error: undefined
            })
        );

        expect(response).toEqual({
            result: undefined,
            error: {
                code: 'INTERNAL_ERROR',
                message:
                    'stores.NostrWalletConnectStore.error.walletIdentityUnavailable'
            }
        });
        expect(unsub).not.toHaveBeenCalled();
        expect((store as any).activeSubscriptions.has(connection.id)).toBe(
            true
        );
    });

    it('rejects and unsubscribes when the connection record is missing', async () => {
        const store = buildStore();
        store.connections = [];

        const connectionId = 'conn-missing';
        const unsub = jest.fn();
        (store as any).activeSubscriptions.set(connectionId, unsub);

        const response = await (store as any).withGlobalHandler(
            connectionId,
            async () => ({
                result: { should: 'not-run' },
                error: undefined
            })
        );

        expect(response).toEqual({
            result: undefined,
            error: {
                code: 'UNAUTHORIZED',
                message:
                    'stores.NostrWalletConnectStore.error.connectionNotFound'
            }
        });
        expect(unsub).toHaveBeenCalled();
        expect((store as any).activeSubscriptions.has(connectionId)).toBe(
            false
        );
    });

    it('rejects every NWC method once the connection has expired', async () => {
        const store = buildStore();
        const connection = seedConnection(store, {
            expiresAt: new Date('2020-01-01T00:00:00Z')
        });
        expect(connection.isExpired).toBe(true);

        const unsub = jest.fn();
        (store as any).activeSubscriptions.set(connection.id, unsub);

        const response = await (store as any).withGlobalHandler(
            connection.id,
            async () => ({
                result: { should: 'not-run' },
                error: undefined
            })
        );

        expect(response).toEqual({
            result: undefined,
            error: {
                code: 'RESTRICTED',
                message:
                    'views.Settings.NostrWalletConnect.error.connectionExpired'
            }
        });
        expect(unsub).toHaveBeenCalled();
        expect((store as any).activeSubscriptions.has(connection.id)).toBe(
            false
        );
        expect(connection.lastUsed).toBeUndefined();
    });

    it('allows non-expired connections through withGlobalHandler', async () => {
        const store = buildStore();
        const connection = seedConnection(store, {
            expiresAt: new Date(Date.now() + 60_000)
        });

        const response = await (store as any).withGlobalHandler(
            connection.id,
            async () => ({
                result: { ok: true },
                error: undefined
            })
        );

        expect(response).toEqual({
            result: { ok: true },
            error: undefined
        });
        expect(connection.lastUsed).toBeInstanceOf(Date);
    });

    it('returns UNAUTHORIZED instead of throwing when the connection is deleted before handler entry', async () => {
        const store = buildStore();
        const connection = seedConnection(store, {
            expiresAt: new Date(Date.now() + 60_000)
        });

        jest.spyOn(store as any, 'markConnectionUsed').mockImplementation(
            async () => {
                store.connections = [];
                return false;
            }
        );

        const response = await (store as any).withGlobalHandler(
            connection.id,
            async () => ({
                result: { should: 'not-run' },
                error: undefined
            })
        );

        expect(response).toEqual({
            result: undefined,
            error: {
                code: 'UNAUTHORIZED',
                message:
                    'stores.NostrWalletConnectStore.error.connectionNotFound'
            }
        });
    });

    it('lets an in-flight handler finish before deleteConnection removes the record', async () => {
        const store = buildStore();
        const connection = seedConnection(store, {
            expiresAt: new Date(Date.now() + 60_000)
        });

        let releaseHandler: (value: { result: { ok: boolean } }) => void = () =>
            undefined;
        let enteredHandler = false;
        const handlerDone = (store as any).withGlobalHandler(
            connection.id,
            () =>
                new Promise((resolve) => {
                    enteredHandler = true;
                    releaseHandler = resolve;
                })
        );

        await new Promise((resolve) => setImmediate(resolve));
        expect(enteredHandler).toBe(true);

        let deleted = false;
        const deleteDone = store.deleteConnection(connection.id).then(() => {
            deleted = true;
        });

        await new Promise((resolve) => setImmediate(resolve));
        expect(deleted).toBe(false);
        expect(store.connections).toHaveLength(1);

        const lateResponse = await (store as any).withGlobalHandler(
            connection.id,
            async () => ({
                result: { should: 'not-run' },
                error: undefined
            })
        );
        expect(lateResponse.error?.code).toBe('UNAUTHORIZED');

        releaseHandler({ result: { ok: true } });
        await handlerDone;
        await deleteDone;

        expect(deleted).toBe(true);
        expect(store.connections).toHaveLength(0);
    });

    it('defers relay release when delete awaited in-flight handlers', async () => {
        jest.useFakeTimers();
        const store = buildStore();
        const connection = seedConnection(store, {
            expiresAt: new Date(Date.now() + 60_000)
        });
        (store as any).nwcWalletServices.set(OLD_RELAY, { close: jest.fn() });

        let releaseHandler: (value: { result: { ok: boolean } }) => void = () =>
            undefined;
        const handlerDone = (store as any).withGlobalHandler(
            connection.id,
            () =>
                new Promise((resolve) => {
                    releaseHandler = resolve;
                })
        );

        await Promise.resolve();

        const releaseSpy = jest.spyOn(
            store as any,
            'releaseUnusedRelayService'
        );
        const deleteDone = store.deleteConnection(connection.id);

        await Promise.resolve();
        expect(releaseSpy).not.toHaveBeenCalled();

        releaseHandler({ result: { ok: true } });
        await handlerDone;
        await deleteDone;

        expect(releaseSpy).not.toHaveBeenCalled();

        jest.advanceTimersByTime(RELAY_RELEASE_GRACE_MS - 1);
        expect(releaseSpy).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(releaseSpy).toHaveBeenCalledWith(OLD_RELAY);

        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('defers relay release when delete follows a subscribed connection even without in-flight handlers', async () => {
        jest.useFakeTimers();
        const store = buildStore();
        const connection = seedConnection(store, {
            expiresAt: new Date(Date.now() + 60_000)
        });
        (store as any).nwcWalletServices.set(OLD_RELAY, { close: jest.fn() });
        (store as any).activeSubscriptions.set(connection.id, jest.fn());

        await (store as any).withGlobalHandler(connection.id, async () => ({
            result: { ok: true },
            error: undefined
        }));

        jest.spyOn(store as any, 'unsubscribeFromConnection').mockRestore();

        const releaseSpy = jest.spyOn(
            store as any,
            'releaseUnusedRelayService'
        );
        await store.deleteConnection(connection.id);

        expect(releaseSpy).not.toHaveBeenCalled();

        jest.advanceTimersByTime(RELAY_RELEASE_GRACE_MS);
        expect(releaseSpy).toHaveBeenCalledWith(OLD_RELAY);

        jest.clearAllTimers();
        jest.useRealTimers();
    });
});

function buildMakeInvoiceTestStore(invoices: Invoice[] = []) {
    const settingsStore: any = {
        connecting: false,
        implementation: 'lnd',
        settings: {
            locale: 'en',
            ecash: { enableCashu: false },
            lightningAddress: { enabled: false }
        }
    };
    const store = new NostrWalletConnectStore(
        settingsStore,
        {} as any,
        {
            nodeInfo: { nodeId: NODE_PUBKEY },
            getNodeInfo: jest.fn()
        } as any,
        {} as any,
        {} as any,
        { invoices } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any
    );

    return store;
}

function seedMakeInvoiceConnection(
    store: NostrWalletConnectStore,
    overrides: Record<string, unknown> = {}
) {
    const connection = new NWCConnection({
        id: 'conn-make',
        name: 'Make Invoice Test App',
        pubkey: OLD_PUBKEY,
        relayUrl: OLD_RELAY,
        permissions: [],
        createdAt: new Date('2024-01-01T00:00:00Z'),
        totalSpendSats: 0,
        nodePubkey: NODE_PUBKEY,
        implementation: 'lnd',
        activity: [],
        ...overrides
    } as any);
    store.connections = [connection];
    return connection;
}

function makePendingMakeInvoiceActivity(
    id: string,
    expiresAt: Date,
    overrides: Record<string, unknown> = {}
) {
    return {
        id,
        type: 'make_invoice' as const,
        payment_source: 'lightning' as const,
        status: 'pending' as const,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        expiresAt,
        ...overrides
    };
}

describe('NostrWalletConnectStore make_invoice limits', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not count expired pending make_invoice toward the outstanding cap', () => {
        const store = buildMakeInvoiceTestStore();
        const connection = seedMakeInvoiceConnection(store, {
            activity: Array.from({ length: 10 }, (_, i) =>
                makePendingMakeInvoiceActivity(
                    `lnbc-expired-${i}`,
                    new Date('2020-01-01T00:00:00Z')
                )
            )
        });

        const result = (store as any).checkMakeInvoiceLimits(connection);

        expect(result).toBeNull();
    });

    it('does not count paid pending make_invoice toward the outstanding cap', () => {
        const paymentRequests = Array.from(
            { length: 10 },
            (_, i) => `lnbc-paid-${i}`
        );
        const invoices = paymentRequests.map(
            (paymentRequest) =>
                new Invoice({
                    payment_request: paymentRequest,
                    state: 'settled'
                })
        );
        const store = buildMakeInvoiceTestStore(invoices);
        const connection = seedMakeInvoiceConnection(store, {
            activity: paymentRequests.map((id) =>
                makePendingMakeInvoiceActivity(
                    id,
                    new Date('2099-01-01T00:00:00Z')
                )
            )
        });

        const result = (store as any).checkMakeInvoiceLimits(connection);

        expect(result).toBeNull();
    });

    it('rate limits when active pending make_invoice count reaches the cap', () => {
        const store = buildMakeInvoiceTestStore();
        const connection = seedMakeInvoiceConnection(store, {
            activity: Array.from({ length: 10 }, (_, i) =>
                makePendingMakeInvoiceActivity(
                    `lnbc-active-${i}`,
                    new Date('2099-01-01T00:00:00Z')
                )
            )
        });

        const result = (store as any).checkMakeInvoiceLimits(connection);

        expect(result?.error?.code).toBe(Nip47ErrorCode.RATE_LIMITED);
    });

    it('does not advance the per-window rate limit during limit checks alone', () => {
        const store = buildMakeInvoiceTestStore();
        const connection = seedMakeInvoiceConnection(store);
        const now = Date.now();
        (store as any).makeInvoiceTimestampsByConnection.set(
            connection.id,
            Array.from({ length: 4 }, () => now)
        );

        for (let i = 0; i < 3; i++) {
            expect(
                (store as any).checkMakeInvoiceLimits(connection)
            ).toBeNull();
        }

        expect(
            (store as any).makeInvoiceTimestampsByConnection.get(connection.id)
        ).toHaveLength(4);
    });

    it('records a rate-limit timestamp only after a successful make_invoice', () => {
        const store = buildMakeInvoiceTestStore();
        const connection = seedMakeInvoiceConnection(store);

        (store as any).recordMakeInvoiceRateLimitTimestamp(connection.id);

        expect(
            (store as any).makeInvoiceTimestampsByConnection.get(connection.id)
        ).toHaveLength(1);
    });

    it('rate limits when the per-window timestamp cap is reached', () => {
        const store = buildMakeInvoiceTestStore();
        const connection = seedMakeInvoiceConnection(store);
        const now = Date.now();
        (store as any).makeInvoiceTimestampsByConnection.set(
            connection.id,
            Array.from({ length: 5 }, () => now)
        );

        const result = (store as any).checkMakeInvoiceLimits(connection);

        expect(result?.error?.code).toBe(Nip47ErrorCode.RATE_LIMITED);
    });
});

describe('NostrWalletConnectStore activity prune', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('never prunes pending pay_invoice entries when trimming the activity log', () => {
        const store = buildPayInvoiceTestStore();
        const oldest = new Date('2024-01-01T00:00:00Z');
        const activity = [
            {
                id: 'lnbc-pending-pay',
                type: 'pay_invoice' as const,
                payment_source: 'lightning' as const,
                status: 'pending' as const,
                satAmount: 1000,
                createdAt: oldest
            },
            ...Array.from({ length: 99 }, (_, i) => ({
                id: `lnbc-make-${i}`,
                type: 'make_invoice' as const,
                payment_source: 'lightning' as const,
                status: 'success' as const,
                createdAt: new Date(oldest.getTime() + (i + 1) * 1000)
            }))
        ];
        const connection = seedPayInvoiceConnection(store, { activity });
        connection.activity.push({
            id: 'lnbc-make-new',
            type: 'make_invoice',
            payment_source: 'lightning',
            status: 'success',
            createdAt: new Date('2024-06-01T00:00:00Z')
        });

        (store as any).pruneConnectionActivity(connection);

        expect(connection.activity).toHaveLength(100);
        expect(
            connection.activity.find((a) => a.id === 'lnbc-pending-pay')
        ).toBeDefined();
        expect(
            connection.activity.find((a) => a.id === 'lnbc-make-0')
        ).toBeUndefined();
        expect(connection.pendingSpendSats).toBe(1000);
    });

    it('stops pruning when every activity entry is still pending', () => {
        const store = buildPayInvoiceTestStore();
        const connection = seedPayInvoiceConnection(store, {
            activity: Array.from({ length: 101 }, (_, i) => ({
                id: `lnbc-pending-${i}`,
                type: 'pay_invoice' as const,
                payment_source: 'lightning' as const,
                status: 'pending' as const,
                satAmount: 1,
                createdAt: new Date(2024, 0, 1, 0, 0, i)
            }))
        });

        (store as any).pruneConnectionActivity(connection);

        expect(connection.activity).toHaveLength(101);
    });

    it('prunes expired pending make_invoice entries past the cap', () => {
        const store = buildMakeInvoiceTestStore();
        const connection = seedMakeInvoiceConnection(store, {
            activity: Array.from({ length: 150 }, (_, i) =>
                makePendingMakeInvoiceActivity(
                    `lnbc-expired-${i}`,
                    new Date('2020-01-01T00:00:00Z'),
                    { createdAt: new Date(2024, 0, 1, 0, 0, i) }
                )
            )
        });
        // the outstanding cap never trips, so the client keeps creating:
        expect((store as any).checkMakeInvoiceLimits(connection)).toBeNull();
        (store as any).pruneConnectionActivity(connection);
        expect(connection.activity.length).toBeLessThanOrEqual(100);
    });
});

describe('NostrWalletConnectStore sign_message', () => {
    afterEach(() => {
        (BackendUtils.supportsMessageSigning as jest.Mock).mockReturnValue(
            true
        );
    });

    function buildStore(signMessage: jest.Mock) {
        const settingsStore: any = {
            connecting: false,
            implementation: 'lnd',
            settings: {
                locale: 'en',
                ecash: { enableCashu: false },
                lightningAddress: { enabled: false }
            }
        };
        const store = new NostrWalletConnectStore(
            settingsStore,
            {} as any,
            {
                nodeInfo: { nodeId: NODE_PUBKEY },
                getNodeInfo: jest.fn()
            } as any,
            {} as any,
            { invoices: [] } as any,
            {} as any,
            { signMessage } as any,
            {} as any,
            {} as any,
            {} as any
        );
        return store;
    }

    it('rejects a missing or empty message without signing', async () => {
        const signMessage = jest.fn();
        const store = buildStore(signMessage);

        const missing = await (store as any).handleSignMessage({});
        const empty = await (store as any).handleSignMessage({
            message: ''
        });

        expect(signMessage).not.toHaveBeenCalled();
        expect(missing).toEqual({
            result: undefined,
            error: {
                code: 'OTHER',
                message:
                    'stores.NostrWalletConnectStore.error.invalidSignMessage'
            }
        });
        expect(empty.error.code).toBe('OTHER');
    });

    it('signs a valid message with the node identity key', async () => {
        const signMessage = jest.fn().mockResolvedValue('zbase-signature');
        const store = buildStore(signMessage);

        const response = await (store as any).handleSignMessage({
            message: 'lnurl-auth-challenge'
        });

        expect(signMessage).toHaveBeenCalledWith(
            'lnurl-auth-challenge',
            'lightning'
        );
        expect(response).toEqual({
            result: {
                message: 'lnurl-auth-challenge',
                signature: 'zbase-signature'
            },
            error: undefined
        });
    });

    it('omits sign_message from get_info when the backend cannot sign', async () => {
        (BackendUtils.supportsMessageSigning as jest.Mock).mockReturnValue(
            false
        );
        const store = buildStore(jest.fn());
        const connection = {
            permissions: ['get_info', 'sign_message'],
            displayName: 'Test App'
        };

        const response = await (store as any).handleGetInfo(connection);

        expect(response.result.methods).toEqual(['get_info']);
    });
});

describe('NostrWalletConnectStore cashu pay_invoice preimage', () => {
    const invoice = 'lnbc1cashupreimagetest';
    const preimage = 'a'.repeat(64);

    // Drives handleCashuPayInvoice past its guards to the response shape.
    // The melt has already succeeded by that point, so only the fields the
    // response is built from need to be real.
    const buildCashuStore = (
        cashuInvoice: any,
        payments: any[] = []
    ): NostrWalletConnectStore => {
        const store = buildPayInvoiceTestStore();
        (store as any).cashuStore = {
            selectedMintUrl: 'https://mint.example',
            totalBalanceSats: 100_000,
            paymentError: false,
            paymentErrorMsg: '',
            payReq: new Invoice({
                payment_request: invoice,
                num_satoshis: '100'
            } as any),
            getPayReqError: null,
            getPayReq: jest.fn().mockResolvedValue(undefined),
            payLnInvoiceFromEcash: jest.fn().mockResolvedValue(cashuInvoice),
            isProperlyConfigured: () => true,
            payments
        };
        // isCashuConfigured is a computed, so satisfy its inputs rather
        // than trying to redefine it
        store.cashuEnabled = true;
        jest.spyOn(store as any, 'finalizePayment').mockResolvedValue(
            undefined
        );
        return store;
    };

    const payWith = async (cashuInvoice: any, payments: any[] = []) => {
        const store = buildCashuStore(cashuInvoice, payments);
        const connection = seedPayInvoiceConnection(store);
        return (store as any).handleCashuPayInvoice(connection, { invoice });
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(
            NostrConnectUtils,
            'getPayInvoiceAmountSats'
        ).mockResolvedValue(100);
    });

    it('returns the melt preimage when there is one', async () => {
        const response = await payWith({
            isFailed: false,
            getPreimage: preimage,
            getPaymentRequest: invoice,
            getFee: 1
        });

        expect(response.result.preimage).toBe(preimage);
    });

    it('never returns the invoice as the preimage', async () => {
        // Regression: this used to fall back to getPaymentRequest, handing
        // NIP-47 clients a bolt11 string as proof of payment.
        const response = await payWith({
            isFailed: false,
            getPreimage: '',
            getPaymentRequest: invoice,
            getFee: 1
        });

        expect(response.result.preimage).not.toBe(invoice);
        expect(response.result.preimage).toBe('');
    });

    it('falls back to the payments-list preimage, as the lightning leg does', async () => {
        const response = await payWith(
            {
                isFailed: false,
                getPreimage: '',
                getPaymentRequest: invoice,
                getFee: 1
            },
            [{ getPaymentRequest: invoice, getPreimage: preimage, getFee: 1 }]
        );

        expect(response.result.preimage).toBe(preimage);
    });
});
