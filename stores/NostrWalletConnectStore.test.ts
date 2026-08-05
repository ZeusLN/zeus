jest.mock('../stores/Stores', () => ({}));

jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        supportsNodeInfo: () => false,
        supportsCashuWallet: () => false
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
import NWCConnection, { BudgetRenewalType } from '../models/NWCConnection';
import NostrWalletConnectStore, {
    NWC_CLIENT_KEYS
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
