jest.mock('../stores/Stores');

jest.mock('../utils/LocaleUtils');

jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        supportsNodeInfo: jest.fn(),
        supportsCashuWallet: jest.fn(),
        supportsMessageSigning: jest.fn(),
        decodePaymentRequest: jest.fn()
    }
}));

jest.mock('../utils/IOSAudioKeepAliveUtils', () => ({
    __esModule: true,
    default: {
        isAvailable: () => false,
        arm: jest.fn(),
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

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn()
    }
}));

jest.mock('@getalby/sdk', () => ({
    NWCWalletService: jest.fn(),
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    NWCWalletService,
    NWCWalletServiceKeyPair,
    NWCWalletServiceRequestHandler
} from '@getalby/sdk';
import Storage from '../storage';
import BackendUtils from '../utils/BackendUtils';
import NWCConnection, { BudgetRenewalType } from '../models/NWCConnection';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import CashuPayment from '../models/CashuPayment';
import Base64Utils from '../utils/Base64Utils';
import NostrConnectUtils, { Nip47ErrorCode } from '../utils/NostrConnectUtils';
import NostrWalletConnectStore, {
    NWC_CLIENT_KEYS,
    NWC_CONNECTIONS_KEY,
    NWC_LUD16_ENABLED,
    NWC_SERVICE_KEYS,
    RELAY_RELEASE_GRACE_MS
} from './NostrWalletConnectStore';

const hex64 = (c: string) => c.repeat(64);
const SERVICE_PRIV = hex64('1');
const SERVICE_PUB = hex64('2');
const NODE_PUBKEY = 'test-node-pubkey';
const OLD_RELAY = 'wss://relay.old.example';
const NEW_RELAY = 'wss://relay.new.example';
const THIRD_RELAY = 'wss://relay.third.example';
const WALLET_BALANCE_SATS = 1_000_000;
// Covers the service start delay and the pacing between subscriptions.
const SERVICE_START_MS = 10_000;

const UNAUTHORIZED = {
    result: undefined,
    error: {
        code: 'UNAUTHORIZED',
        message: 'stores.NostrWalletConnectStore.error.connectionNotFound'
    }
};
const RATE_LIMITED = {
    result: undefined,
    error: {
        code: 'RATE_LIMITED',
        message: 'stores.NostrWalletConnectStore.error.connectionUpdating'
    }
};

// Drains a generous number of microtask turns so an in-progress async call
// has a chance to run every step up to its next real (mocked) await point,
// without pinning the test to the exact number of internal awaits.
async function flushMicrotasks(turns = 20) {
    for (let i = 0; i < turns; i++) {
        await Promise.resolve();
    }
}

// Advances fake timers until `work` settles, for code paths that sleep
// (publish retries, the 500 ms wait after publishing to a new relay).
async function settle<T>(work: Promise<T>, maxMs = 30_000): Promise<T> {
    let done = false;
    work.then(
        () => (done = true),
        () => (done = true)
    );
    for (let elapsed = 0; !done && elapsed < maxMs; elapsed += 100) {
        await jest.advanceTimersByTimeAsync(100);
    }
    return work;
}

function silence(method: 'error' | 'warn') {
    jest.spyOn(console, method).mockImplementation(() => {});
}

// A point where a collaborator call waits until the test releases it.
// `entered` resolves once the store has reached it.
interface Hold<T = void> {
    entered: Promise<void>;
    release: (value: T) => void;
    fail: (error: Error) => void;
    wait: () => Promise<T>;
}

function createHold<T = void>(): Hold<T> {
    let markEntered: () => void = () => undefined;
    const entered = new Promise<void>((resolve) => (markEntered = resolve));
    let release: (value: T) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    const released = new Promise<T>((resolve, reject) => {
        release = resolve;
        fail = reject;
    });
    return {
        entered,
        release,
        fail,
        wait: () => {
            markEntered();
            return released;
        }
    };
}

// Holds the next call to `fn` until the test releases it with a value.
function holdNextCall<T>(fn: jest.Mock): Hold<T> {
    const hold = createHold<T>();
    fn.mockImplementationOnce(() => hold.wait());
    return hold;
}

// In-memory keychain behind the Storage mock. getItem returns false for a
// missing key, as storage/index.ts does.
const storedItems = new Map<string, string>();
const writeHolds = new Map<string, Hold[]>();
const writeFailures = new Map<string, { once: boolean }>();

function installStorage() {
    storedItems.clear();
    writeHolds.clear();
    writeFailures.clear();
    (Storage.getItem as jest.Mock).mockImplementation(async (key: string) =>
        storedItems.has(key) ? storedItems.get(key) : false
    );
    (Storage.setItem as jest.Mock).mockImplementation(
        async (key: string, value: string) => {
            const hold = writeHolds.get(key)?.shift();
            if (hold) await hold.wait();
            const failure = writeFailures.get(key);
            if (failure) {
                if (failure.once) writeFailures.delete(key);
                throw new Error('storage write failed');
            }
            storedItems.set(key, value);
        }
    );
    (Storage.removeItem as jest.Mock).mockImplementation(
        async (key: string) => {
            storedItems.delete(key);
        }
    );
}

function holdNextWrite(key: string): Hold {
    const hold = createHold();
    writeHolds.set(key, [...(writeHolds.get(key) ?? []), hold]);
    return hold;
}

function failWrites(key: string, { once = false } = {}) {
    writeFailures.set(key, { once });
}

function storedClientKeys(): Record<string, string> {
    return JSON.parse(storedItems.get(NWC_CLIENT_KEYS) ?? '{}');
}

function persistedConnections(): any[] {
    return JSON.parse(storedItems.get(NWC_CONNECTIONS_KEY) ?? '[]');
}

function connectionWrites(): number {
    return (Storage.setItem as jest.Mock).mock.calls.filter(
        ([key]) => key === NWC_CONNECTIONS_KEY
    ).length;
}

// Stand-in for the SDK's per-relay NWCWalletService. It records the
// handlers the store subscribes per client pubkey, so tests can send
// requests the way a paired NIP-47 client would.
interface FakeRelay {
    relayUrl: string;
    connected: boolean;
    handlers: Map<string, NWCWalletServiceRequestHandler>;
    subscribeHolds: Hold[];
    failSubscribe: boolean;
    failPublish: boolean;
    close: jest.Mock;
    publishWalletServiceInfoEvent: jest.Mock;
    subscribe: jest.Mock;
    holdNextSubscribe: () => Hold;
}

const relays = new Map<string, FakeRelay>();

function createFakeRelay(relayUrl: string): FakeRelay {
    const relay: FakeRelay = {
        relayUrl,
        connected: true,
        handlers: new Map(),
        subscribeHolds: [],
        failSubscribe: false,
        failPublish: false,
        close: jest.fn(() => {
            relay.connected = false;
        }),
        publishWalletServiceInfoEvent: jest.fn(async () => {
            if (relay.failPublish) throw new Error('publish failed');
        }),
        subscribe: jest.fn(
            async (
                keypair: { clientPubkey: string },
                handler: NWCWalletServiceRequestHandler
            ) => {
                const hold = relay.subscribeHolds.shift();
                if (hold) await hold.wait();
                if (relay.failSubscribe) throw new Error('subscribe failed');
                relay.handlers.set(keypair.clientPubkey, handler);
                return () => {
                    if (relay.handlers.get(keypair.clientPubkey) === handler) {
                        relay.handlers.delete(keypair.clientPubkey);
                    }
                };
            }
        ),
        holdNextSubscribe: () => {
            const hold = createHold();
            relay.subscribeHolds.push(hold);
            return hold;
        }
    };
    return relay;
}

// Returns the fake for `relayUrl`, creating it if the store has not yet,
// so a test can configure a relay before the store connects to it.
function relayFor(relayUrl: string): FakeRelay {
    const existing = relays.get(relayUrl);
    if (existing?.connected) return existing;
    const relay = createFakeRelay(relayUrl);
    relays.set(relayUrl, relay);
    return relay;
}

function isSubscribed(connection: NWCConnection): boolean {
    return !!relays.get(connection.relayUrl)?.handlers.has(connection.pubkey);
}

// The handler the store registered for this connection, captured now. A
// request sent through it after the store unsubscribes models an event
// the SDK had already received.
function clientFor(
    connection: NWCConnection
): Required<NWCWalletServiceRequestHandler> {
    const handler = relays
        .get(connection.relayUrl)
        ?.handlers.get(connection.pubkey);
    if (!handler) {
        throw new Error(
            `${connection.name} has no live subscription on ${connection.relayUrl}`
        );
    }
    return handler as Required<NWCWalletServiceRequestHandler>;
}

function installCollaboratorDefaults() {
    relays.clear();
    installStorage();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (BackendUtils.supportsNodeInfo as jest.Mock).mockReturnValue(false);
    (BackendUtils.supportsCashuWallet as jest.Mock).mockReturnValue(false);
    (BackendUtils.supportsMessageSigning as jest.Mock).mockReturnValue(true);
    (NWCWalletService as unknown as jest.Mock).mockImplementation(
        ({ relayUrls }: { relayUrls: string[] }) => relayFor(relayUrls[0])
    );
    (NWCWalletServiceKeyPair as unknown as jest.Mock).mockImplementation(
        (walletSecret: string, clientPubkey: string) => ({
            walletSecret,
            clientPubkey
        })
    );
}

function createCollaborators(overrides: Record<string, any> = {}) {
    return {
        settingsStore: {
            connecting: false,
            implementation: 'lnd',
            settings: {
                locale: 'en',
                ecash: { enableCashu: false },
                lightningAddress: { enabled: false }
            }
        } as any,
        balanceStore: {
            getLightningBalance: jest
                .fn()
                .mockResolvedValue({ lightningBalance: WALLET_BALANCE_SATS })
        } as any,
        nodeInfoStore: {
            nodeInfo: { nodeId: NODE_PUBKEY },
            getNodeInfo: jest.fn()
        } as any,
        transactionsStore: {} as any,
        cashuStore: {} as any,
        invoicesStore: { invoices: [] } as any,
        messageSignStore: {} as any,
        lightningAddressStore: {} as any,
        modalStore: {} as any,
        paymentsStore: {
            payments: [],
            getPayments: jest.fn().mockResolvedValue([])
        } as any,
        ...overrides
    };
}

function createStore(overrides: Record<string, any> = {}) {
    const collaborators = createCollaborators(overrides);
    const store = new NostrWalletConnectStore(
        collaborators.settingsStore,
        collaborators.balanceStore,
        collaborators.nodeInfoStore,
        collaborators.transactionsStore,
        collaborators.cashuStore,
        collaborators.invoicesStore,
        collaborators.messageSignStore,
        collaborators.lightningAddressStore,
        collaborators.modalStore,
        collaborators.paymentsStore
    );
    return { store, ...collaborators };
}

function connectionData(overrides: Record<string, unknown> = {}): any {
    return {
        id: 'conn-1',
        name: 'Test App',
        pubkey: hex64('a'),
        relayUrl: OLD_RELAY,
        permissions: [],
        createdAt: new Date('2024-01-01T00:00:00Z'),
        totalSpendSats: 0,
        nodePubkey: NODE_PUBKEY,
        implementation: 'lnd',
        activity: [],
        ...overrides
    };
}

function addConnection(
    store: NostrWalletConnectStore,
    overrides: Record<string, unknown> = {}
): NWCConnection {
    const connection = new NWCConnection(connectionData(overrides));
    store.connections = [connection, ...store.connections];
    return connection;
}

// Starts the service the way the app does: wallet service keys,
// connections and client keys are read from storage, initializeService
// publishes to each relay, and every active connection is subscribed.
// Mock call records are cleared afterwards so tests count only their own.
async function startService(
    connections: Record<string, unknown>[] = [{}],
    overrides: Record<string, any> = {}
) {
    const data = connections.map((connection, i) =>
        connectionData({
            id: `conn-${i + 1}`,
            name: `App ${i + 1}`,
            pubkey: hex64(String.fromCharCode(97 + i)),
            permissions: ['get_info', 'get_balance'],
            ...connection
        })
    );
    storedItems.set(
        NWC_SERVICE_KEYS,
        JSON.stringify({ privateKey: SERVICE_PRIV, publicKey: SERVICE_PUB })
    );
    storedItems.set(NWC_CONNECTIONS_KEY, JSON.stringify(data));
    storedItems.set(
        NWC_CLIENT_KEYS,
        JSON.stringify(
            Object.fromEntries(
                data.map((connection, i) => [
                    connection.pubkey,
                    hex64(String(i + 3))
                ])
            )
        )
    );

    const harness = createStore(overrides);
    await harness.store.initializeService();
    await jest.advanceTimersByTimeAsync(SERVICE_START_MS);
    expect(harness.store.isInitialized).toBe(true);
    jest.clearAllMocks();

    return { ...harness, connections: [...harness.store.connections] };
}

beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    installCollaboratorDefaults();
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('NostrWalletConnectStore relay rotation', () => {
    it('rotates keys, preserves identity, and moves the subscription to the new relay', async () => {
        const createdAt = new Date('2024-01-01T00:00:00Z');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const {
            store,
            connections: [connection]
        } = await startService([
            {
                createdAt,
                expiresAt,
                maxAmountSats: 5000,
                totalSpendSats: 42,
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
            }
        ]);
        const oldPubkey = connection.pubkey;

        const result = await settle(
            store.updateConnection(connection.id, {
                relayUrl: NEW_RELAY,
                expiresAt,
                maxAmountSats: 5000,
                budgetRenewal: BudgetRenewalType.Never
            })
        );

        expect(result.success).toBe(true);
        expect(result.nostrUrl).toEqual(expect.stringContaining(NEW_RELAY));
        expect(connection).toMatchObject({
            id: 'conn-1',
            relayUrl: NEW_RELAY,
            createdAt,
            expiresAt,
            totalSpendSats: 42,
            maxAmountSats: 5000
        });
        expect(connection.pubkey).not.toBe(oldPubkey);
        expect(connection.activity).toHaveLength(1);
        expect(storedClientKeys()).toEqual({
            [connection.pubkey]: expect.any(String)
        });
        expect(persistedConnections()).toEqual([
            expect.objectContaining({
                id: 'conn-1',
                relayUrl: NEW_RELAY,
                pubkey: connection.pubkey
            })
        ]);
        expect(
            relayFor(NEW_RELAY).publishWalletServiceInfoEvent
        ).toHaveBeenCalled();
        expect(isSubscribed(connection)).toBe(true);
        expect(relays.get(OLD_RELAY)!.handlers.has(oldPubkey)).toBe(false);
    });

    it('leaves the connection on its old relay when storing the new key fails, so a retry can rotate', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const oldPubkey = connection.pubkey;
        silence('error');
        failWrites(NWC_CLIENT_KEYS, { once: true });

        const failed = await settle(
            store.updateConnection(connection.id, { relayUrl: NEW_RELAY })
        );

        expect(failed).toEqual({ success: false });
        expect(connection.relayUrl).toBe(OLD_RELAY);
        expect(connection.pubkey).toBe(oldPubkey);
        expect(isSubscribed(connection)).toBe(true);
        expect(relays.has(NEW_RELAY)).toBe(false);

        const retried = await settle(
            store.updateConnection(connection.id, { relayUrl: NEW_RELAY })
        );

        expect(retried.success).toBe(true);
        expect(retried.nostrUrl).toEqual(expect.stringContaining(NEW_RELAY));
        expect(connection.relayUrl).toBe(NEW_RELAY);
        expect(connection.pubkey).not.toBe(oldPubkey);
    });

    it('still returns the pairing URL when saving the rotated connection fails', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const oldPubkey = connection.pubkey;
        silence('error');
        silence('warn');
        failWrites(NWC_CONNECTIONS_KEY);

        const result = await settle(
            store.updateConnection(connection.id, { relayUrl: NEW_RELAY })
        );

        expect(result.success).toBe(true);
        expect(result.nostrUrl).toEqual(expect.stringContaining(NEW_RELAY));
        expect(connection.pubkey).not.toBe(oldPubkey);
        expect(storedClientKeys()).toEqual({
            [connection.pubkey]: expect.any(String)
        });
        expect(isSubscribed(connection)).toBe(true);
    });

    it('still returns the pairing URL when subscribing on the new relay fails', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const oldPubkey = connection.pubkey;
        silence('error');
        relayFor(NEW_RELAY).failSubscribe = true;

        const result = await settle(
            store.updateConnection(connection.id, { relayUrl: NEW_RELAY })
        );

        expect(result.success).toBe(true);
        expect(result.nostrUrl).toEqual(expect.stringContaining(NEW_RELAY));
        expect(connection.pubkey).not.toBe(oldPubkey);
        expect(storedClientKeys()).toEqual({
            [connection.pubkey]: expect.any(String)
        });
        expect(isSubscribed(connection)).toBe(false);
    });

    it('does not rotate keys on non-relay edits', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const pubkeyBefore = connection.pubkey;
        const keysBefore = storedClientKeys();

        const result = await store.updateConnection(connection.id, {
            name: 'Renamed App',
            maxAmountSats: 2500
        });
        await jest.advanceTimersByTimeAsync(1000);

        expect(result).toEqual({ success: true });
        expect(connection.name).toBe('Renamed App');
        expect(connection.maxAmountSats).toBe(2500);
        expect(connection.pubkey).toBe(pubkeyBefore);
        expect(connection.relayUrl).toBe(OLD_RELAY);
        expect(storedClientKeys()).toEqual(keysBefore);
        expect(persistedConnections()[0]).toMatchObject({
            name: 'Renamed App',
            maxAmountSats: 2500
        });
        expect(isSubscribed(connection)).toBe(true);
    });

    it('succeeds when publishing wallet service info to the new relay fails', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const oldPubkey = connection.pubkey;
        silence('warn');
        relayFor(NEW_RELAY).failPublish = true;

        const result = await settle(
            store.updateConnection(connection.id, { relayUrl: NEW_RELAY })
        );

        expect(result.success).toBe(true);
        expect(result.nostrUrl).toEqual(expect.stringContaining(NEW_RELAY));
        expect(connection.relayUrl).toBe(NEW_RELAY);
        expect(connection.pubkey).not.toBe(oldPubkey);
        expect(
            relayFor(NEW_RELAY).publishWalletServiceInfoEvent
        ).toHaveBeenCalledTimes(3);
        expect(isSubscribed(connection)).toBe(true);
    });

    it('reuses the service another connection already has on the new relay', async () => {
        const {
            store,
            connections: [connection, other]
        } = await startService([{}, { relayUrl: NEW_RELAY }]);

        const result = await store.updateConnection(connection.id, {
            relayUrl: NEW_RELAY
        });

        expect(result.success).toBe(true);
        expect(NWCWalletService).not.toHaveBeenCalled();
        expect(
            relayFor(NEW_RELAY).publishWalletServiceInfoEvent
        ).not.toHaveBeenCalled();
        expect(isSubscribed(connection)).toBe(true);
        expect(isSubscribed(other)).toBe(true);
    });

    it.each([
        ['adds', 'true', true],
        ['leaves out', 'false', false]
    ])(
        '%s the lightning address in the rotated pairing URL when lud16 is %s',
        async (_verb, lud16Setting, included) => {
            storedItems.set(NWC_LUD16_ENABLED, lud16Setting);
            const {
                store,
                connections: [connection]
            } = await startService([{}], {
                settingsStore: {
                    connecting: false,
                    implementation: 'lnd',
                    settings: {
                        locale: 'en',
                        ecash: { enableCashu: false },
                        lightningAddress: { enabled: true }
                    }
                },
                lightningAddressStore: { lightningAddress: 'zeus@example.com' }
            });

            const result = await settle(
                store.updateConnection(connection.id, { relayUrl: NEW_RELAY })
            );

            expect(result.nostrUrl!.includes('&lud16=zeus@example.com')).toBe(
                included
            );
        }
    );
});

describe('NostrWalletConnectStore request gate', () => {
    it('answers INTERNAL_ERROR and keeps the subscription while wallet identity is unknown', async () => {
        const {
            nodeInfoStore,
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        nodeInfoStore.nodeInfo = {};

        const response = await client.getInfo();

        expect(response).toEqual({
            result: undefined,
            error: {
                code: 'INTERNAL_ERROR',
                message:
                    'stores.NostrWalletConnectStore.error.walletIdentityUnavailable'
            }
        });
        expect(isSubscribed(connection)).toBe(true);
    });

    it('answers UNAUTHORIZED and unsubscribes when the connection belongs to another wallet', async () => {
        const {
            nodeInfoStore,
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        nodeInfoStore.nodeInfo = { nodeId: 'another-node-pubkey' };

        const response = await client.getInfo();

        expect(response).toEqual(UNAUTHORIZED);
        expect(isSubscribed(connection)).toBe(false);
    });

    it('answers RESTRICTED and unsubscribes once the connection has expired', async () => {
        const {
            balanceStore,
            connections: [connection]
        } = await startService([{ expiresAt: new Date(Date.now() + 60_000) }]);
        const client = clientFor(connection);
        jest.setSystemTime(Date.now() + 120_000);
        expect(connection.isExpired).toBe(true);

        const response = await client.getBalance();

        expect(response).toEqual({
            result: undefined,
            error: {
                code: 'RESTRICTED',
                message:
                    'views.Settings.NostrWalletConnect.error.connectionExpired'
            }
        });
        expect(isSubscribed(connection)).toBe(false);
        expect(connection.lastUsed).toBeUndefined();
        expect(balanceStore.getLightningBalance).not.toHaveBeenCalled();
    });

    it('runs the handler and saves the first use of an active connection', async () => {
        const {
            connections: [connection]
        } = await startService([{ expiresAt: new Date(Date.now() + 60_000) }]);

        const response = await clientFor(connection).getBalance();

        expect(response).toEqual({
            result: { balance: WALLET_BALANCE_SATS * 1000 },
            error: undefined
        });
        expect(connection.lastUsed).toBeInstanceOf(Date);
        expect(persistedConnections()[0].lastUsed).toEqual(
            connection.lastUsed!.toISOString()
        );
    });

    it.each([
        [
            'RATE_LIMITED',
            'an update',
            RATE_LIMITED,
            (store: NostrWalletConnectStore, id: string) =>
                store.updateConnection(id, { name: 'Renamed App' })
        ],
        [
            'UNAUTHORIZED',
            'a delete',
            UNAUTHORIZED,
            (store: NostrWalletConnectStore, id: string) =>
                store.deleteConnection(id)
        ],
        [
            'UNAUTHORIZED',
            'a relay change',
            UNAUTHORIZED,
            (store: NostrWalletConnectStore, id: string) =>
                store.updateConnection(id, { relayUrl: NEW_RELAY })
        ]
    ])(
        'answers %s without running the handler when %s starts while the first use is saved',
        async (_code, _mutation, expected, startMutation) => {
            const {
                store,
                balanceStore,
                connections: [connection]
            } = await startService();
            const client = clientFor(connection);
            const firstUseSave = holdNextWrite(NWC_CONNECTIONS_KEY);

            const response = client.getBalance();
            await firstUseSave.entered;
            const mutation = startMutation(store, connection.id);
            await flushMicrotasks();
            firstUseSave.release();

            expect(await response).toEqual(expected);
            expect(balanceStore.getLightningBalance).not.toHaveBeenCalled();
            await settle<unknown>(mutation);
        }
    );
});

describe('NostrWalletConnectStore concurrent connection changes', () => {
    it('answers UNAUTHORIZED, not RATE_LIMITED, while a relay change is in progress', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        const newRelaySubscribe = relayFor(NEW_RELAY).holdNextSubscribe();

        const rotation = store.updateConnection(connection.id, {
            relayUrl: NEW_RELAY
        });
        await settle(newRelaySubscribe.entered);

        expect(await client.getBalance()).toEqual(UNAUTHORIZED);

        newRelaySubscribe.release();
        await settle(rotation);

        expect((await clientFor(connection).getBalance()).error).toBe(
            undefined
        );
    });

    it('keeps a delete guarded after an overlapping update finishes', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        const updateSubscribe = relayFor(OLD_RELAY).holdNextSubscribe();
        const update = store.updateConnection(connection.id, {
            name: 'Renamed App'
        });
        await settle(updateSubscribe.entered);
        const keyWrite = holdNextWrite(NWC_CLIENT_KEYS);
        const deletion = store.deleteConnection(connection.id);
        await settle(keyWrite.entered);

        updateSubscribe.release();
        await settle(update);

        expect(await client.getBalance()).toEqual(UNAUTHORIZED);

        keyWrite.release();
        await settle(deletion);
        expect(store.connections).toHaveLength(0);
    });

    it('keeps a delete guarded while an update that started after it runs and finishes', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        const keyWrite = holdNextWrite(NWC_CLIENT_KEYS);
        const deletion = store.deleteConnection(connection.id);
        await settle(keyWrite.entered);
        const updateSubscribe = relayFor(OLD_RELAY).holdNextSubscribe();
        const update = store.updateConnection(connection.id, {
            name: 'Renamed App'
        });
        await settle(updateSubscribe.entered);

        expect(await client.getBalance()).toEqual(UNAUTHORIZED);

        updateSubscribe.release();
        await settle(update);

        expect(await client.getBalance()).toEqual(UNAUTHORIZED);

        keyWrite.release();
        await settle(deletion);
    });

    it('keeps a relay change guarded while an update that started after it runs and finishes', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        const rotationSubscribe = relayFor(NEW_RELAY).holdNextSubscribe();
        const rotation = store.updateConnection(connection.id, {
            relayUrl: NEW_RELAY
        });
        await settle(rotationSubscribe.entered);
        const updateSubscribe = relayFor(NEW_RELAY).holdNextSubscribe();
        const update = store.updateConnection(connection.id, {
            name: 'Renamed App'
        });
        await settle(updateSubscribe.entered);

        expect(await client.getBalance()).toEqual(UNAUTHORIZED);

        updateSubscribe.release();
        await settle(update);

        expect(await client.getBalance()).toEqual(UNAUTHORIZED);

        rotationSubscribe.release();
        await settle(rotation);

        expect((await clientFor(connection).getBalance()).error).toBe(
            undefined
        );
    });

    it('keeps a second relay change guarded after the first one finishes', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        const firstSubscribe = relayFor(NEW_RELAY).holdNextSubscribe();
        const firstRotation = store.updateConnection(connection.id, {
            relayUrl: NEW_RELAY
        });
        await settle(firstSubscribe.entered);
        const secondSubscribe = relayFor(THIRD_RELAY).holdNextSubscribe();
        const secondRotation = store.updateConnection(connection.id, {
            relayUrl: THIRD_RELAY
        });
        await settle(secondSubscribe.entered);

        firstSubscribe.release();
        await settle(firstRotation);

        // The second rotation has not rebound the pubkey or deleted the
        // old key yet, so its window must stay closed.
        expect(await client.getBalance()).toEqual(UNAUTHORIZED);

        secondSubscribe.release();
        await settle(secondRotation);

        expect(connection.relayUrl).toBe(THIRD_RELAY);
        expect((await clientFor(connection).getBalance()).error).toBe(
            undefined
        );
    });

    it('keeps a second update guarded after the first one finishes', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        const firstSubscribe = relayFor(OLD_RELAY).holdNextSubscribe();
        const firstUpdate = store.updateConnection(connection.id, {
            name: 'First'
        });
        await settle(firstSubscribe.entered);
        const secondSubscribe = relayFor(OLD_RELAY).holdNextSubscribe();
        const secondUpdate = store.updateConnection(connection.id, {
            name: 'Second'
        });
        await settle(secondSubscribe.entered);

        firstSubscribe.release();
        await settle(firstUpdate);

        expect(await client.getBalance()).toEqual(RATE_LIMITED);

        secondSubscribe.release();
        await settle(secondUpdate);

        expect((await client.getBalance()).error).toBeUndefined();
    });

    it('answers UNAUTHORIZED when a delete starts while an update is still running', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        const updateSubscribe = relayFor(OLD_RELAY).holdNextSubscribe();
        const update = store.updateConnection(connection.id, {
            name: 'Renamed App'
        });
        await settle(updateSubscribe.entered);
        const keyWrite = holdNextWrite(NWC_CLIENT_KEYS);
        const deletion = store.deleteConnection(connection.id);
        await settle(keyWrite.entered);

        expect(await client.getBalance()).toEqual(UNAUTHORIZED);

        updateSubscribe.release();
        keyWrite.release();
        await settle(Promise.all([update, deletion]));
    });

    it('keeps an update guarded after an overlapping delete finishes and the connection is regenerated', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const keyWrite = holdNextWrite(NWC_CLIENT_KEYS);
        const deletion = store.deleteConnection(connection.id);
        await settle(keyWrite.entered);
        const updateSubscribe = relayFor(OLD_RELAY).holdNextSubscribe();
        const update = store.updateConnection(connection.id, {
            name: 'Renamed App'
        });
        await settle(updateSubscribe.entered);

        keyWrite.release();
        await settle(deletion);
        // Regenerating a connection deletes it and creates it again with
        // the same id (NWCConnectionDetails), so the running update's
        // guard still applies to the new record.
        await settle(
            store.createConnection({
                id: connection.id,
                name: 'Regenerated App',
                relayUrl: OLD_RELAY,
                permissions: ['get_balance']
            })
        );
        const regenerated = store.connections[0];

        expect(await clientFor(regenerated).getBalance()).toEqual(RATE_LIMITED);

        updateSubscribe.release();
        await settle(update);
    });

    it('keeps an update guarded after an overlapping delete fails to save', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        silence('error');
        const updateSubscribe = relayFor(OLD_RELAY).holdNextSubscribe();
        const update = store.updateConnection(connection.id, {
            name: 'Renamed App'
        });
        await settle(updateSubscribe.entered);
        failWrites(NWC_CONNECTIONS_KEY, { once: true });

        await expect(
            settle(store.deleteConnection(connection.id))
        ).rejects.toThrow('storage write failed');

        // The failed save left the connection in storage, so it is back
        // after a reload while the update is still running.
        await store.loadConnections();
        expect(store.connections).toHaveLength(1);
        expect(await client.getBalance()).toEqual(RATE_LIMITED);

        updateSubscribe.release();
        await settle(update);
    });

    it('lets an in-flight request finish before a delete removes the connection', async () => {
        const {
            store,
            balanceStore,
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        const balanceCall = holdNextCall<{ lightningBalance: number }>(
            balanceStore.getLightningBalance
        );
        const inFlight = client.getBalance();
        await settle(balanceCall.entered);

        let deleted = false;
        const deletion = store.deleteConnection(connection.id).then(() => {
            deleted = true;
        });
        await flushMicrotasks();

        expect(deleted).toBe(false);
        expect(store.connections).toHaveLength(1);
        expect(store.waitingForInFlightHandlers).toBe(true);
        expect(await client.getBalance()).toEqual(UNAUTHORIZED);

        balanceCall.release({ lightningBalance: 5000 });

        expect(await inFlight).toEqual({
            result: { balance: 5_000_000 },
            error: undefined
        });
        await settle(deletion);
        expect(deleted).toBe(true);
        expect(store.connections).toHaveLength(0);
        expect(store.waitingForInFlightHandlers).toBe(false);
    });

    it('lets an in-flight request finish before an update changes the budget', async () => {
        const {
            store,
            balanceStore,
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        const balanceCall = holdNextCall<{ lightningBalance: number }>(
            balanceStore.getLightningBalance
        );
        const inFlight = client.getBalance();
        await settle(balanceCall.entered);

        let updated = false;
        const update = store
            .updateConnection(connection.id, { maxAmountSats: 5000 })
            .then((result) => {
                updated = result.success;
            });
        await flushMicrotasks();

        expect(updated).toBe(false);
        expect(connection.maxAmountSats).toBeUndefined();
        expect(await client.getBalance()).toEqual(RATE_LIMITED);

        balanceCall.release({ lightningBalance: 7000 });

        expect(await inFlight).toEqual({
            result: { balance: 7_000_000 },
            error: undefined
        });
        await settle(update);
        expect(updated).toBe(true);
        expect(connection.maxAmountSats).toBe(5000);
    });
});

describe('NostrWalletConnectStore relay release', () => {
    // A request that is still running when its connection expires: the
    // next request drops the subscription, but the first one stays in
    // flight, which is the only way to be in flight while unsubscribed.
    async function expireWhileInFlight(
        connection: NWCConnection,
        hold: Hold<any>
    ) {
        const client = clientFor(connection);
        const inFlight = client.getBalance();
        await settle(hold.entered);
        jest.setSystemTime(Date.now() + 120_000);
        expect((await client.getBalance()).error?.code).toBe('RESTRICTED');
        expect(isSubscribed(connection)).toBe(false);
        // Wrapped so the caller's await does not wait for the request.
        return { inFlight };
    }

    it('closes the old relay a grace period after a relay change leaves it unused, and reopens it on the way back', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const oldRelay = relayFor(OLD_RELAY);

        await settle(
            store.updateConnection(connection.id, { relayUrl: NEW_RELAY }),
            1000
        );

        expect(oldRelay.close).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(RELAY_RELEASE_GRACE_MS);
        expect(oldRelay.close).toHaveBeenCalled();
        expect(relayFor(NEW_RELAY).close).not.toHaveBeenCalled();

        // Releasing the relay must also forget its service and published
        // state, or rotating back would reuse the closed service and skip
        // publishing wallet service info.
        jest.clearAllMocks();
        const result = await settle(
            store.updateConnection(connection.id, { relayUrl: OLD_RELAY })
        );

        expect(result.success).toBe(true);
        expect(NWCWalletService).toHaveBeenCalledWith({
            relayUrls: [OLD_RELAY]
        });
        const reopened = relays.get(OLD_RELAY)!;
        expect(reopened).not.toBe(oldRelay);
        expect(reopened.publishWalletServiceInfoEvent).toHaveBeenCalled();
        expect(oldRelay.publishWalletServiceInfoEvent).not.toHaveBeenCalled();
        expect(reopened.handlers.has(connection.pubkey)).toBe(true);
    });

    it('keeps the old relay open when another connection still uses it', async () => {
        const {
            store,
            connections: [connection, other]
        } = await startService([{}, {}]);
        const oldRelay = relayFor(OLD_RELAY);

        await settle(
            store.updateConnection(connection.id, { relayUrl: NEW_RELAY })
        );
        await jest.advanceTimersByTimeAsync(RELAY_RELEASE_GRACE_MS);

        expect(oldRelay.close).not.toHaveBeenCalled();
        expect((await clientFor(other).getBalance()).error).toBeUndefined();
    });

    it('closes the relay a grace period after deleting the last subscribed connection on it', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const relay = relayFor(OLD_RELAY);

        await store.deleteConnection(connection.id);

        expect(store.connections).toHaveLength(0);
        expect(persistedConnections()).toEqual([]);
        expect(storedClientKeys()).toEqual({});
        expect(isSubscribed(connection)).toBe(false);
        await jest.advanceTimersByTimeAsync(RELAY_RELEASE_GRACE_MS - 1);
        expect(relay.close).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);
        expect(relay.close).toHaveBeenCalled();
    });

    it('closes the relay at once when deleting a connection that is no longer subscribed', async () => {
        const {
            store,
            connections: [connection]
        } = await startService([{ expiresAt: new Date(Date.now() + 60_000) }]);
        const relay = relayFor(OLD_RELAY);
        jest.setSystemTime(Date.now() + 120_000);
        await clientFor(connection).getBalance();
        expect(isSubscribed(connection)).toBe(false);

        await store.deleteConnection(connection.id);

        expect(relay.close).toHaveBeenCalled();
    });

    it('defers closing the relay when a delete waited for an in-flight request', async () => {
        const {
            store,
            balanceStore,
            connections: [connection]
        } = await startService([{ expiresAt: new Date(Date.now() + 60_000) }]);
        const relay = relayFor(OLD_RELAY);
        const balanceCall = holdNextCall<{ lightningBalance: number }>(
            balanceStore.getLightningBalance
        );
        const { inFlight } = await expireWhileInFlight(connection, balanceCall);

        const deletion = store.deleteConnection(connection.id);
        await flushMicrotasks();
        balanceCall.release({ lightningBalance: 5000 });
        await inFlight;
        await deletion;

        expect(relay.close).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(RELAY_RELEASE_GRACE_MS);
        expect(relay.close).toHaveBeenCalled();
    });

    it('defers closing the old relay when a relay change waited for an in-flight request', async () => {
        const {
            store,
            balanceStore,
            connections: [connection]
        } = await startService([{ expiresAt: new Date(Date.now() + 60_000) }]);
        const oldRelay = relayFor(OLD_RELAY);
        const balanceCall = holdNextCall<{ lightningBalance: number }>(
            balanceStore.getLightningBalance
        );
        const { inFlight } = await expireWhileInFlight(connection, balanceCall);

        const rotation = store.updateConnection(connection.id, {
            relayUrl: NEW_RELAY,
            expiresAt: new Date(Date.now() + 60_000)
        });
        await flushMicrotasks();
        balanceCall.release({ lightningBalance: 5000 });
        await inFlight;
        const result = await settle(rotation, 1000);

        expect(result.success).toBe(true);
        expect(oldRelay.close).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(RELAY_RELEASE_GRACE_MS);
        expect(oldRelay.close).toHaveBeenCalled();
    });

    it('closes the old relay at once after a relay change on a connection that is no longer subscribed', async () => {
        const {
            store,
            connections: [connection]
        } = await startService([{ expiresAt: new Date(Date.now() + 60_000) }]);
        const oldRelay = relayFor(OLD_RELAY);
        jest.setSystemTime(Date.now() + 120_000);
        await clientFor(connection).getBalance();

        const result = await settle(
            store.updateConnection(connection.id, {
                relayUrl: NEW_RELAY,
                expiresAt: new Date(Date.now() + 60_000)
            })
        );

        expect(result.success).toBe(true);
        expect(oldRelay.close).toHaveBeenCalled();
    });

    it('deletes an expired connection whose relay the service never opened', async () => {
        const { store } = await startService([
            {},
            {
                relayUrl: THIRD_RELAY,
                expiresAt: new Date('2020-01-01T00:00:00Z')
            }
        ]);

        await store.deleteConnection('conn-2');

        expect(store.connections.map((c) => c.id)).toEqual(['conn-1']);
        expect(relays.has(THIRD_RELAY)).toBe(false);
        expect(relayFor(OLD_RELAY).close).not.toHaveBeenCalled();
    });
});

describe('NostrWalletConnectStore pay_invoice activity upsert', () => {
    const normalizedInvoice = 'lnbc1normalized';
    const uppercaseInvoice = 'LNBC1NORMALIZED';
    const paymentHash = 'abc123paymenthash';

    beforeEach(() => {
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
        const { store } = createStore();
        const connection = addConnection(store, {
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
        const { store } = createStore();
        const connection = addConnection(store, {
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
        const { store } = createStore();
        const createdAt = new Date('2024-06-01T12:00:00Z');
        const connection = addConnection(store, {
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
        const { store } = createStore();
        const connection = addConnection(store, {
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
        const { store } = createStore();
        const connection = addConnection(store, {
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
        const { store } = createStore();
        const connection = addConnection(store, {
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
        const { store } = createStore();
        const connection = addConnection(store, {
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

    it('upsertPayInvoiceActivity never demotes pending to failed', () => {
        const { store } = createStore();
        const connection = addConnection(store, {
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

        const applied = (store as any).upsertPayInvoiceActivity(connection, {
            id: normalizedInvoice,
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'failed',
            satAmount: 100,
            error: 'payment is in transition'
        });

        expect(applied).toBe(false);
        expect(connection.activity[0].status).toBe('pending');
        expect(connection.pendingSpendSats).toBe(100);
    });

    it('recordFailedPayment stores timeout errors as locale keys', async () => {
        const { store } = createStore();
        const connection = addConnection(store);

        await (store as any).recordFailedPayment({
            rawInvoice: normalizedInvoice,
            connection,
            amountSats: 100,
            payment_source: 'lightning',
            errorMessage: 'payment timed out waiting for preimage'
        });

        expect(connection.activity[0].error).toBe(
            'views.SendingLightning.paymentTimedOut'
        );
    });
});

describe('NostrWalletConnectStore connection data scoping', () => {
    const WALLET_ONLY_HASH = hex64('f');
    const CONNECTION_HASH = hex64('e');
    const CONNECTION_INVOICE = 'lnbc1connection-only';

    function buildScopedStore() {
        return createStore({
            paymentsStore: {
                getPayments: jest.fn().mockResolvedValue(undefined),
                payments: [
                    {
                        paymentHash: WALLET_ONLY_HASH,
                        getAmount: '1000',
                        getPaymentRequest: 'lnbc1wallet-payment',
                        getTimestamp: 1_700_000_000
                    }
                ]
            },
            invoicesStore: {
                getInvoices: jest.fn().mockResolvedValue(undefined),
                invoices: [
                    {
                        getRHash: WALLET_ONLY_HASH,
                        getAmount: '2000',
                        getPaymentRequest: 'lnbc1wallet-invoice',
                        getCreationDate: 1_700_000_000
                    }
                ]
            },
            transactionsStore: {
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
            }
        });
    }

    function seedReadOnlyConnection(
        store: NostrWalletConnectStore,
        overrides: Record<string, unknown> = {}
    ) {
        return addConnection(store, {
            id: 'conn-readonly',
            name: 'Read Only App',
            permissions: ['lookup_invoice', 'list_transactions'],
            ...overrides
        });
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
    it('does not count expired pending make_invoice toward the outstanding cap', () => {
        const { store } = createStore();
        const connection = addConnection(store, {
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
        const { store } = createStore({ invoicesStore: { invoices } });
        const connection = addConnection(store, {
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
        const { store } = createStore();
        const connection = addConnection(store, {
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
        const { store } = createStore();
        const connection = addConnection(store);
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
        const { store } = createStore();
        const connection = addConnection(store);

        (store as any).recordMakeInvoiceRateLimitTimestamp(connection.id);

        expect(
            (store as any).makeInvoiceTimestampsByConnection.get(connection.id)
        ).toHaveLength(1);
    });

    it('rate limits when the per-window timestamp cap is reached', () => {
        const { store } = createStore();
        const connection = addConnection(store);
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
    it('never prunes unresolved pay_invoice entries when trimming the activity log', () => {
        const { store } = createStore();
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
        const connection = addConnection(store, { activity });
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

    it('never prunes timeout-failed pay_invoice entries awaiting reconcile', () => {
        const { store } = createStore();
        const oldest = new Date('2024-01-01T00:00:00Z');
        const activity = [
            {
                id: 'lnbc-timeout-failed-pay',
                type: 'pay_invoice' as const,
                payment_source: 'lightning' as const,
                status: 'failed' as const,
                satAmount: 1000,
                error: 'views.SendingLightning.paymentTimedOut',
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
        const connection = addConnection(store, { activity });
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
            connection.activity.find((a) => a.id === 'lnbc-timeout-failed-pay')
        ).toBeDefined();
    });

    it('stops pruning when every activity entry is still pending', () => {
        const { store } = createStore();
        const connection = addConnection(store, {
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
        const { store } = createStore();
        const connection = addConnection(store, {
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

describe('NostrWalletConnectStore timeout-failed pay_invoice reconcile', () => {
    function storeWithNodePayments(payments: Payment[]) {
        return createStore({
            paymentsStore: {
                payments,
                getPayments: jest.fn(async () => payments)
            }
        });
    }

    function timeoutFailedActivity(
        invoice: string,
        overrides: Record<string, unknown> = {}
    ) {
        return {
            id: invoice,
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'failed',
            satAmount: 10000,
            error: 'views.SendingLightning.paymentTimedOut',
            createdAt: new Date(Date.now() - 60_000),
            ...overrides
        };
    }

    const staleCreatedAt = () =>
        new Date(
            Date.now() -
                NostrConnectUtils.UNRESOLVED_PAY_INVOICE_MAX_AGE_MS -
                1000
        );

    it('debits a timeout-failed pay_invoice once the node later shows settlement', async () => {
        const invoice = 'lnbc1timeout-missed-debit';
        const paymentHash = hex64('e');
        const { store } = storeWithNodePayments([
            new Payment({
                payment_request: invoice,
                payment_hash: paymentHash,
                status: 'SUCCEEDED',
                value_sat: 10000,
                fee_sat: '50',
                payment_preimage: hex64('9')
            })
        ]);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [timeoutFailedActivity(invoice, { paymentHash })]
        });

        expect(connection.canSpend(10000)).toBe(true);

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(connection.activity[0].status).toBe('success');
        expect(connection.activity[0].isBudgetDebited).toBe(true);
        expect(connection.totalSpendSats).toBe(10050);
        expect(connection.canSpend(1)).toBe(false);
    });

    it('promotes a timeout-failed pay_invoice to pending when the node still shows in-flight', async () => {
        const invoice = 'lnbc1timeout-still-inflight';
        const paymentHash = hex64('f');
        const { store } = storeWithNodePayments([
            new Payment({
                payment_request: invoice,
                payment_hash: paymentHash,
                status: 'IN_FLIGHT',
                payment_preimage: hex64('0')
            })
        ]);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [timeoutFailedActivity(invoice, { paymentHash })]
        });

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(connection.activity[0].status).toBe('pending');
        expect(connection.pendingSpendSats).toBe(10000);
        expect(connection.totalSpendSats).toBe(0);
        expect(connection.canSpend(1)).toBe(false);
    });

    it('does not promote a CLN-shaped failed sendpay to pending', async () => {
        const invoice = 'lnbc1cln-failed-shape';
        const paymentHash = hex64('8');
        const { store } = storeWithNodePayments([
            new Payment({
                payment_request: invoice,
                payment_hash: paymentHash,
                status: 'failed',
                payment_preimage: hex64('0')
            })
        ]);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [timeoutFailedActivity(invoice, { paymentHash })]
        });

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(connection.activity[0].status).toBe('failed');
        expect(connection.pendingSpendSats).toBe(0);
        expect(connection.canSpend(10000)).toBe(true);
    });

    it('keeps the hold when CLN lists a pending retry after a failed attempt', async () => {
        const invoice = 'lnbc1cln-retry-after-failure';
        const paymentHash = hex64('7');
        // CLN lists one entry per pay/xpay call, oldest first
        const clnAttempt = (status: string) =>
            new Payment({
                bolt11: invoice,
                payment_hash: paymentHash,
                status
            });
        const { store } = storeWithNodePayments([
            clnAttempt('failed'),
            clnAttempt('pending')
        ]);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [timeoutFailedActivity(invoice, { paymentHash })]
        });

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(connection.activity[0].status).toBe('pending');
        expect(connection.pendingSpendSats).toBe(10000);
        expect(connection.canSpend(1)).toBe(false);
    });

    it('keeps the hold when lnd lists a failed attempt next to a retry in flight', async () => {
        const invoice = 'lnbc1lnd-retry-in-flight';
        const paymentHash = hex64('6');
        const { store } = storeWithNodePayments([
            new Payment({
                payment_request: invoice,
                payment_hash: paymentHash,
                status: 'IN_FLIGHT',
                failure_reason: 'FAILURE_REASON_NONE',
                payment_preimage: hex64('0'),
                htlcs: [{ status: 'FAILED' }, { status: 'IN_FLIGHT' }]
            })
        ]);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [timeoutFailedActivity(invoice, { paymentHash })]
        });

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(connection.activity[0].status).toBe('pending');
        expect(connection.pendingSpendSats).toBe(10000);
        expect(connection.canSpend(1)).toBe(false);
    });

    it('does not debit a genuine route failure that never settled', async () => {
        const { store } = storeWithNodePayments([]);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [
                timeoutFailedActivity('lnbc1genuine-fail', {
                    error: 'route not found'
                })
            ]
        });

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(connection.activity[0].status).toBe('failed');
        expect(connection.totalSpendSats).toBe(0);
        expect(connection.canSpend(10000)).toBe(true);
    });

    it('overwrites the timeout error once the node confirms failure', async () => {
        const invoice = 'lnbc1timeout-confirmed-fail';
        const paymentHash = hex64('a');
        const { store } = storeWithNodePayments([
            new Payment({
                payment_request: invoice,
                payment_hash: paymentHash,
                status: 'FAILED',
                failure_reason: 'FAILURE_REASON_NO_ROUTE',
                value_sat: 10000
            })
        ]);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [timeoutFailedActivity(invoice, { paymentHash })]
        });

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(connection.activity[0].status).toBe('failed');
        expect(connection.activity[0].error).toBe('error.failureReasonNoRoute');
        expect(
            NostrConnectUtils.isPaymentTimedOutMessage(
                connection.activity[0].error
            )
        ).toBe(false);
    });

    it('saves and refreshes the budget once across repeated reconciles of a node-confirmed failure', async () => {
        const invoice = 'lnbc1timeout-churn';
        const paymentHash = hex64('b');
        const { store, balanceStore } = storeWithNodePayments([
            new Payment({
                payment_request: invoice,
                payment_hash: paymentHash,
                status: 'FAILED',
                failure_reason: 'FAILURE_REASON_NO_ROUTE',
                value_sat: 10000
            })
        ]);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [timeoutFailedActivity(invoice, { paymentHash })]
        });

        const changed = [];
        for (let i = 0; i < 3; i++) {
            changed.push(
                await (store as any).reconcilePendingPayInvoiceActivities(
                    connection
                )
            );
            await jest.advanceTimersByTimeAsync(1000);
        }

        expect(changed).toEqual([true, false, false]);
        expect(connectionWrites()).toBe(1);
        expect(balanceStore.getLightningBalance).toHaveBeenCalledTimes(1);
    });

    it('debits a stale hold when the node lists settlement instead of abandoning', async () => {
        const invoice = 'lnbc1stale-settled-probe';
        const paymentHash = hex64('1');
        const { store } = storeWithNodePayments([
            new Payment({
                payment_request: invoice,
                payment_hash: paymentHash,
                status: 'SUCCEEDED',
                value_sat: 10000,
                fee_sat: '50',
                payment_preimage: hex64('2')
            })
        ]);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [
                timeoutFailedActivity(invoice, {
                    paymentHash,
                    createdAt: staleCreatedAt()
                })
            ]
        });

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(connection.activity[0].status).toBe('success');
        expect(connection.activity[0].isBudgetDebited).toBe(true);
        expect(connection.totalSpendSats).toBe(10050);
        expect(connection.activity[0].error).toBeUndefined();
    });

    it('keeps a stale hold when the node still lists the payment in-flight', async () => {
        const invoice = 'lnbc1stale-inflight-probe';
        const paymentHash = hex64('3');
        const { store } = storeWithNodePayments([
            new Payment({
                payment_request: invoice,
                payment_hash: paymentHash,
                status: 'IN_FLIGHT',
                payment_preimage: hex64('0')
            })
        ]);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [
                timeoutFailedActivity(invoice, {
                    paymentHash,
                    createdAt: staleCreatedAt()
                })
            ]
        });

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(connection.activity[0].status).toBe('pending');
        expect(
            connection.isUnresolvedPayInvoiceActivity(connection.activity[0])
        ).toBe(true);
        expect(connection.activity[0].error).toBeUndefined();
        expect(connection.pendingSpendSats).toBe(10000);
        expect(connection.totalSpendSats).toBe(0);
    });

    it('abandons a permanent pending hold when the node never lists the payment', async () => {
        const { store } = storeWithNodePayments([]);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [
                {
                    id: 'lnbc1permanent-pending-hold',
                    type: 'pay_invoice',
                    payment_source: 'lightning',
                    status: 'pending',
                    satAmount: 10000,
                    createdAt: staleCreatedAt()
                }
            ]
        });

        expect(connection.pendingSpendSats).toBe(10000);
        expect(
            connection.isUnresolvedPayInvoiceActivity(connection.activity[0])
        ).toBe(true);

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(connection.activity[0].status).toBe('failed');
        expect(connection.activity[0].error).toBe('error.paymentFailed');
        expect(
            connection.isUnresolvedPayInvoiceActivity(connection.activity[0])
        ).toBe(false);
        expect(connection.pendingSpendSats).toBe(0);
        expect(connection.canSpend(10000)).toBe(true);
    });

    it('abandons a permanent timeout-failed hold when the node never lists the payment', async () => {
        const { store } = storeWithNodePayments([]);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [
                timeoutFailedActivity('lnbc1permanent-timeout-hold', {
                    createdAt: staleCreatedAt()
                })
            ]
        });

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(connection.activity[0].status).toBe('failed');
        expect(connection.activity[0].error).toBe('error.paymentFailed');
        expect(
            connection.isUnresolvedPayInvoiceActivity(connection.activity[0])
        ).toBe(false);
        expect(connection.canSpend(10000)).toBe(true);
    });

    it('does not abandon a recent unresolved hold with no node listing', async () => {
        const { store } = storeWithNodePayments([]);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [
                {
                    id: 'lnbc1recent-hold',
                    type: 'pay_invoice',
                    payment_source: 'lightning',
                    status: 'pending',
                    satAmount: 10000,
                    createdAt: new Date(Date.now() - 60_000)
                }
            ]
        });

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(connection.activity[0].status).toBe('pending');
        expect(
            connection.isUnresolvedPayInvoiceActivity(connection.activity[0])
        ).toBe(true);
        expect(connection.pendingSpendSats).toBe(10000);
    });
});

describe('NostrWalletConnectStore handleLightningPayInvoice replay guard', () => {
    const invoice = 'lnbc1replay-guard';
    const paymentHash = hex64('c');

    beforeEach(() => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            timestamp: String(Math.floor(Date.now() / 1000) - 60),
            expiry: '3600'
        });
        jest.spyOn(NostrConnectUtils, 'decodeInvoiceTags').mockResolvedValue({
            paymentRequest: invoice,
            paymentHash,
            descriptionHash: '',
            description: '',
            amount: 5000,
            expiryTime: 0,
            createdAt: 0,
            isExpired: false,
            network: 'bitcoin'
        });
        jest.spyOn(
            NostrConnectUtils,
            'resolvePayInvoiceAmount'
        ).mockResolvedValue({ amountSats: 5000, zeroAmountInvoice: false });
    });

    function buildHandlerStore(nodePayments: Payment[] = []) {
        return createStore({
            transactionsStore: {
                reset: jest.fn(),
                sendPayment: jest.fn(),
                payment_hash: null,
                payment_preimage: null,
                payment_fee: 0,
                status: null,
                isIncomplete: null,
                error: false,
                payment_error: null,
                loading: false
            },
            balanceStore: {
                getLightningBalance: jest
                    .fn()
                    .mockResolvedValue({ lightningBalance: 100000 })
            },
            paymentsStore: {
                payments: nodePayments,
                getPayments: jest.fn().mockResolvedValue(nodePayments)
            }
        });
    }

    it('refuses to replay pay_invoice while a pending hold exists', async () => {
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, {
            maxAmountSats: 100000,
            activity: [
                {
                    id: invoice,
                    type: 'pay_invoice',
                    payment_source: 'lightning',
                    status: 'pending',
                    satAmount: 5000,
                    paymentHash,
                    createdAt: new Date(Date.now() - 60_000)
                }
            ]
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice }
        );

        expect(transactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(response.error).toBeUndefined();
        expect(response.result?.preimage).toBe('');
        expect(connection.activity[0].status).toBe('pending');
        expect(connection.pendingSpendSats).toBe(5000);
    });

    it('finalizes and debits when the store errors but the node lists settlement', async () => {
        const settled = new Payment({
            payment_request: invoice,
            payment_hash: paymentHash,
            status: 'SUCCEEDED',
            value_sat: 5000,
            fee_sat: '10',
            payment_preimage: hex64('d')
        });
        const { store, transactionsStore } = buildHandlerStore([settled]);
        Object.assign(transactionsStore, {
            payment_hash: paymentHash,
            payment_error: 'views.SendingLightning.paymentTimedOut',
            loading: false,
            status: 'FAILED',
            isIncomplete: true
        });
        const connection = addConnection(store, { maxAmountSats: 100000 });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice }
        );

        expect(transactionsStore.sendPayment).toHaveBeenCalled();
        expect(response.error).toBeUndefined();
        expect(response.result?.preimage).toBe(hex64('d'));
        expect(connection.activity[0].status).toBe('success');
        expect(connection.activity[0].isBudgetDebited).toBe(true);
        expect(connection.totalSpendSats).toBe(5010);
    });
});

describe('NostrWalletConnectStore handleLightningPayInvoice zero-amount invoices', () => {
    const invoice = 'lnbc1zero-amount';
    const paymentHash = hex64('e');

    // exercise the real amount resolver: only the decoded invoice varies
    const mockInvoiceAmount = (sats: number, num_msat?: string) => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            timestamp: String(Math.floor(Date.now() / 1000) - 60),
            expiry: '3600',
            ...(sats > 0 && { num_satoshis: String(sats) }),
            ...(num_msat && { num_msat })
        });
        jest.spyOn(NostrConnectUtils, 'decodeInvoiceTags').mockResolvedValue({
            paymentRequest: invoice,
            paymentHash,
            descriptionHash: '',
            description: '',
            amount: sats,
            expiryTime: 0,
            createdAt: 0,
            isExpired: false,
            network: 'bitcoin'
        });
    };

    beforeEach(() => mockInvoiceAmount(0));

    afterEach(() => jest.restoreAllMocks());

    function buildHandlerStore(nodePayments: Payment[] = []) {
        return createStore({
            transactionsStore: {
                reset: jest.fn(),
                sendPayment: jest.fn(),
                payment_hash: paymentHash,
                payment_preimage: hex64('f'),
                payment_fee: 0,
                status: 'SUCCEEDED',
                isIncomplete: false,
                error: false,
                payment_error: null,
                loading: false
            },
            balanceStore: {
                getLightningBalance: jest
                    .fn()
                    .mockResolvedValue({ lightningBalance: 100000 })
            },
            paymentsStore: {
                payments: nodePayments,
                getPayments: jest.fn().mockResolvedValue(nodePayments)
            }
        });
    }

    it('pays a zero-amount invoice with the requested amount and debits it', async () => {
        mockInvoiceAmount(0);
        const settled = new Payment({
            payment_request: invoice,
            payment_hash: paymentHash,
            status: 'SUCCEEDED',
            value_sat: 7000,
            fee_sat: '3',
            payment_preimage: hex64('f')
        });
        const { store, transactionsStore } = buildHandlerStore([settled]);
        const connection = addConnection(store, { maxAmountSats: 100000 });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice, amount: 7_000_000 }
        );

        expect(transactionsStore.sendPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                payment_request: invoice,
                amount: '7000'
            })
        );
        expect(response.error).toBeUndefined();
        expect(connection.activity[0].satAmount).toBe(7000);
        expect(connection.totalSpendSats).toBe(7003);
    });

    it('rejects a zero-amount invoice when no amount was requested', async () => {
        mockInvoiceAmount(0);
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, { maxAmountSats: 100000 });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice }
        );

        expect(transactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(response.result).toBeUndefined();
        expect(response.error?.code).toBe(Nip47ErrorCode.INVALID_INVOICE);
    });

    it.each([0, -1000, 1500, Number.NaN, Number.POSITIVE_INFINITY])(
        'rejects an unusable requested amount (%p msat)',
        async (amount) => {
            mockInvoiceAmount(0);
            const { store, transactionsStore } = buildHandlerStore();
            const connection = addConnection(store, { maxAmountSats: 100000 });

            const response = await (store as any).handleLightningPayInvoice(
                connection,
                { invoice, amount }
            );

            expect(transactionsStore.sendPayment).not.toHaveBeenCalled();
            expect(response.error?.code).toBe(Nip47ErrorCode.INVALID_INVOICE);
        }
    );

    it('enforces the connection budget on the requested amount', async () => {
        mockInvoiceAmount(0);
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, { maxAmountSats: 5000 });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice, amount: 7_000_000 }
        );

        expect(transactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(response.result).toBeUndefined();
        expect(response.error?.code).toBe(Nip47ErrorCode.INSUFFICIENT_BALANCE);
    });

    it('checks the node balance against the requested amount', async () => {
        mockInvoiceAmount(0);
        const { store, transactionsStore } = buildHandlerStore();
        (store as any).balanceStore.getLightningBalance = jest
            .fn()
            .mockResolvedValue({ lightningBalance: 1000 });
        const connection = addConnection(store, { maxAmountSats: 100000 });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice, amount: 7_000_000 }
        );

        expect(transactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(response.error?.code).toBe(Nip47ErrorCode.INSUFFICIENT_BALANCE);
    });

    it('ignores the requested amount when the invoice has one', async () => {
        mockInvoiceAmount(5000);
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, { maxAmountSats: 100000 });

        await (store as any).handleLightningPayInvoice(connection, {
            invoice,
            amount: 90_000_000
        });

        const call = (transactionsStore.sendPayment as jest.Mock).mock
            .calls[0][0];
        expect(call.payment_request).toBe(invoice);
        expect(call.amount).toBeUndefined();
    });

    it('treats a sub-sat invoice as having an amount', async () => {
        mockInvoiceAmount(0, '500');
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, { maxAmountSats: 100000 });

        await (store as any).handleLightningPayInvoice(connection, {
            invoice,
            amount: 7_000_000
        });

        const call = (transactionsStore.sendPayment as jest.Mock).mock
            .calls[0][0];
        expect(call.amount).toBeUndefined();
    });

    it('records the requested amount when the payment is still in transit', async () => {
        mockInvoiceAmount(0);
        jest.spyOn(
            NostrConnectUtils,
            'resolveLightningPaymentInTransit'
        ).mockReturnValue({ inTransit: true } as any);
        const { store } = buildHandlerStore();
        const connection = addConnection(store, { maxAmountSats: 100000 });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice, amount: 7_000_000 }
        );

        expect(response.error).toBeUndefined();
        expect(response.result?.preimage).toBe('');
        expect(connection.activity[0].status).toBe('pending');
        expect(connection.activity[0].satAmount).toBe(7000);
        expect(connection.pendingSpendSats).toBe(7000);
    });

    it('debits what was paid when the invoice was already settled by the wallet', async () => {
        mockInvoiceAmount(0);
        const alreadyPaid = new Payment({
            payment_request: invoice,
            payment_hash: paymentHash,
            status: 'SUCCEEDED',
            value_sat: 3000,
            fee_sat: '2',
            payment_preimage: hex64('f')
        });
        const { store, transactionsStore } = buildHandlerStore([alreadyPaid]);
        // the send itself failed: the invoice had been paid already
        Object.assign(transactionsStore, {
            payment_preimage: null,
            payment_error: 'invoice is already paid',
            status: 'FAILED',
            isIncomplete: true
        });
        const connection = addConnection(store, { maxAmountSats: 100000 });

        await (store as any).handleLightningPayInvoice(connection, {
            invoice,
            amount: 7_000_000
        });

        expect(connection.activity[0].satAmount).toBe(3000);
        expect(connection.totalSpendSats).toBe(3002);
    });
});

describe('NostrWalletConnectStore sign_message', () => {
    function buildStore(signMessage: jest.Mock) {
        return createStore({ messageSignStore: { signMessage } }).store;
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
    const payWith = async (cashuInvoice: any, payments: any[] = []) => {
        const { store } = createStore({
            cashuStore: {
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
                payLnInvoiceFromEcash: jest
                    .fn()
                    .mockResolvedValue(cashuInvoice),
                isProperlyConfigured: () => true,
                payments
            }
        });
        // isCashuConfigured is a computed, so satisfy its inputs rather
        // than trying to redefine it
        store.cashuEnabled = true;
        const connection = addConnection(store);
        const response = await (store as any).handleCashuPayInvoice(
            connection,
            { invoice }
        );
        return { response, connection };
    };

    beforeEach(() => {
        jest.spyOn(
            NostrConnectUtils,
            'getPayInvoiceAmountSats'
        ).mockResolvedValue(100);
        jest.spyOn(NostrConnectUtils, 'decodeInvoiceTags').mockResolvedValue({
            paymentRequest: invoice,
            paymentHash: hex64('5'),
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
            'notifyOutgoingNwcPayment'
        ).mockImplementation(() => undefined);
    });

    it('returns the melt preimage and debits the amount plus fee', async () => {
        const { response, connection } = await payWith({
            isFailed: false,
            getPreimage: preimage,
            getPaymentRequest: invoice,
            getFee: 1
        });

        expect(response.result.preimage).toBe(preimage);
        expect(connection.totalSpendSats).toBe(101);
        expect(connection.activity[0]).toMatchObject({
            id: invoice,
            status: 'success',
            payment_source: 'cashu',
            isBudgetDebited: true
        });
    });

    it('never returns the invoice as the preimage', async () => {
        // Regression: this used to fall back to getPaymentRequest, handing
        // NIP-47 clients a bolt11 string as proof of payment.
        const { response } = await payWith({
            isFailed: false,
            getPreimage: '',
            getPaymentRequest: invoice,
            getFee: 1
        });

        expect(response.result.preimage).not.toBe(invoice);
        expect(response.result.preimage).toBe('');
    });

    it('falls back to the payments-list preimage, as the lightning leg does', async () => {
        const { response } = await payWith(
            {
                isFailed: false,
                getPreimage: '',
                getPaymentRequest: invoice,
                getFee: 1
            },
            [
                new CashuPayment({
                    payment_request: invoice,
                    payment_preimage: preimage,
                    fee: 1
                })
            ]
        );

        expect(response.result.preimage).toBe(preimage);
    });
});
