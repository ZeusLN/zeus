jest.mock('../stores/Stores');

jest.mock('../utils/LocaleUtils');

jest.mock('react-native-blob-util', () => ({}));
// CashuStore is loaded for the Cashu make_invoice tests; these keep its
// native and settings imports out of the test
jest.mock('./SettingsStore', () => ({
    DEFAULT_NOSTR_RELAYS: ['wss://relay.one']
}));
jest.mock('@nostr-dev-kit/ndk', () => ({
    __esModule: true,
    default: jest.fn()
}));
jest.mock('../cashu-cdk', () => ({
    __esModule: true,
    default: { isAvailable: jest.fn(() => true) }
}));
jest.mock('../utils/NostrUtils', () => ({}));
jest.mock('../utils/NostrMintBackup', () => ({}));
jest.mock('../utils/MigrationUtils', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../NavigationService', () => ({}));
jest.mock('../ldknode/LdkNodeInjection', () => ({}));

jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        supportsNodeInfo: jest.fn(),
        supportsCashuWallet: jest.fn(),
        supportsMessageSigning: jest.fn(),
        supportsCustomFeeLimit: jest.fn(),
        supportsPaymentLookup: jest.fn(),
        lookupPayment: jest.fn(),
        decodePaymentRequest: jest.fn(),
        createInvoice: jest.fn(),
        supportsFlowLSP: jest.fn(() => false),
        supportsOnchainReceiving: jest.fn(() => false)
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

import { LNURLAUTH_CANONICAL_PHRASE } from '../utils/LnurlAuthUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { autorun } from 'mobx';
import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import {
    finalizeEvent,
    generateSecretKey,
    getPublicKey,
    nip04,
    nip44
} from 'nostr-tools';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
    NWCWalletService,
    NWCWalletServiceKeyPair,
    NWCWalletServiceRequestHandler
} from '@getalby/sdk';
import Storage from '../storage';
import BackendUtils from '../utils/BackendUtils';
import NWCConnection, { BudgetRenewalType } from '../models/NWCConnection';
import CashuInvoice from '../models/CashuInvoice';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import CashuPayment from '../models/CashuPayment';
import Base64Utils from '../utils/Base64Utils';
import NostrConnectUtils, { Nip47ErrorCode } from '../utils/NostrConnectUtils';
import InvoicesStore from './InvoicesStore';
import CashuStore from './CashuStore';
import NostrWalletConnectStore, {
    NWC_CLIENT_KEYS,
    NWC_CONNECTIONS_KEY,
    NWC_PROCESSED_EVENTS_KEY,
    NWC_LUD16_ENABLED,
    NWC_PERSISTENT_SERVICE_ENABLED,
    NWC_SERVICE_KEYS,
    MAX_IN_FLIGHT_HANDLER_MS,
    NWC_REQUEST_MARKS_KEY,
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
// MAX_RELAY_ATTEMPTS in the store: tries per relay subscribe
const MAX_RELAY_ATTEMPTS = 5;

const PAY_RESTRICTED = {
    result: undefined,
    error: {
        code: 'RESTRICTED',
        message: 'stores.NostrWalletConnectStore.error.payInvoiceNotPermitted'
    }
};

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
// requests the way a paired NIP-47 client would. `live` keeps every
// subscription per client pubkey that has not been unsubscribed: the SDK
// keeps each one open, so more than one means every request on that
// pubkey is handled more than once.
interface FakeRelay {
    relayUrl: string;
    connected: boolean;
    handlers: Map<string, NWCWalletServiceRequestHandler>;
    live: Map<string, NWCWalletServiceRequestHandler[]>;
    // the filter each connection subscribed with
    filters: Map<string, unknown>;
    subscribeHolds: Hold[];
    failSubscribe: boolean;
    failPublish: boolean;
    close: jest.Mock;
    publishWalletServiceInfoEvent: jest.Mock;
    publishNotification: jest.Mock;
    subscribe: jest.Mock;
    holdNextSubscribe: () => Hold;
}

const relays = new Map<string, FakeRelay>();

function createFakeRelay(relayUrl: string): FakeRelay {
    const relay: FakeRelay = {
        relayUrl,
        connected: true,
        handlers: new Map(),
        live: new Map(),
        filters: new Map(),
        subscribeHolds: [],
        failSubscribe: false,
        failPublish: false,
        close: jest.fn(() => {
            relay.connected = false;
        }),
        publishWalletServiceInfoEvent: jest.fn(async () => {
            if (relay.failPublish) throw new Error('publish failed');
        }),
        publishNotification: jest.fn(async () => {}),
        subscribe: jest.fn(
            async (
                keypair: { clientPubkey: string },
                handler: NWCWalletServiceRequestHandler,
                filter?: unknown
            ) => {
                relay.filters.set(keypair.clientPubkey, filter);
                const hold = relay.subscribeHolds.shift();
                if (hold) await hold.wait();
                if (relay.failSubscribe) throw new Error('subscribe failed');
                const pubkey = keypair.clientPubkey;
                relay.handlers.set(pubkey, handler);
                relay.live.set(pubkey, [
                    ...(relay.live.get(pubkey) ?? []),
                    handler
                ]);
                return () => {
                    const live = (relay.live.get(pubkey) ?? []).filter(
                        (h) => h !== handler
                    );
                    relay.live.set(pubkey, live);
                    if (relay.handlers.get(pubkey) === handler) {
                        if (live.length) {
                            relay.handlers.set(pubkey, live[live.length - 1]);
                        } else {
                            relay.handlers.delete(pubkey);
                        }
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

function liveSubscriptions(connection: NWCConnection): number {
    return (
        relays.get(connection.relayUrl)?.live.get(connection.pubkey)?.length ??
        0
    );
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
    (BackendUtils.supportsCustomFeeLimit as jest.Mock).mockReturnValue(true);
    (BackendUtils.supportsPaymentLookup as jest.Mock).mockReturnValue(false);
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

// SettingsStore's connection guard fails once connectionSeq moves on, as
// it does on a wallet switch or reconnect, and once the selected index
// changes unless ignoreSelectedNode is passed.
function withConnectionGuard(settingsStore: any) {
    settingsStore.connectionSeq ??= 0;
    settingsStore.getConnectionGuard ??= ({
        ignoreSelectedNode = false
    } = {}) => {
        const seq = settingsStore.connectionSeq;
        const { selectedNode } = settingsStore.settings;
        return () =>
            settingsStore.connectionSeq === seq &&
            (ignoreSelectedNode ||
                settingsStore.settings.selectedNode === selectedNode);
    };
    return settingsStore;
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
    withConnectionGuard(collaborators.settingsStore);
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

// Stores the wallet service keys, connections and client keys that
// initializeService reads
function seedStoredService(connections: Record<string, unknown>[] = [{}]) {
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
}

// Starts the service the way the app does: wallet service keys,
// connections and client keys are read from storage, initializeService
// publishes to each relay, and every active connection is subscribed.
// Mock call records are cleared afterwards so tests count only their own.
async function startService(
    connections: Record<string, unknown>[] = [{}],
    overrides: Record<string, any> = {}
) {
    seedStoredService(connections);
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

    it('answers RESTRICTED once the connection has expired while a screen observes it', async () => {
        const {
            store,
            balanceStore,
            connections: [connection]
        } = await startService([{ expiresAt: new Date(Date.now() + 60_000) }]);
        const client = clientFor(connection);
        // NWCConnectionsList reads isExpired in render while mounted
        const dispose = autorun(() =>
            store.connections.map((c) => c.isExpired)
        );
        jest.setSystemTime(Date.now() + 120_000);

        const response = await client.getBalance();
        dispose();

        expect(response).toEqual({
            result: undefined,
            error: {
                code: 'RESTRICTED',
                message:
                    'views.Settings.NostrWalletConnect.error.connectionExpired'
            }
        });
        expect(isSubscribed(connection)).toBe(false);
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
        // A permission change, so the update opens its own subscription
        // instead of waiting for the rotation's
        const update = store.updateConnection(connection.id, {
            name: 'Renamed App',
            permissions: ['get_info', 'get_balance', 'make_invoice']
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
        // A permission change, so the second update opens its own
        // subscription instead of waiting for the first one's
        const secondUpdate = store.updateConnection(connection.id, {
            name: 'Second',
            permissions: ['get_info', 'get_balance', 'make_invoice']
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

// The wallet screen calls initializeService after connecting and again on
// every AppState 'active', so a second call can land while the first runs.
describe('NostrWalletConnectStore overlapping initializeService calls', () => {
    it('runs once and subscribes once when a second call starts while the first is running', async () => {
        seedStoredService();
        const { store } = createStore();
        const relay = relayFor(OLD_RELAY);
        const publish = holdNextCall<void>(relay.publishWalletServiceInfoEvent);

        const first = store.initializeService();
        await publish.entered;
        let secondDone = false;
        const second = store.initializeService().then(() => {
            secondDone = true;
        });
        await flushMicrotasks();
        // The second call waits for the run in flight
        expect(secondDone).toBe(false);

        publish.release();
        await settle(Promise.all([first, second]));
        await jest.advanceTimersByTimeAsync(SERVICE_START_MS);

        expect(store.isInitialized).toBe(true);
        expect(NWCWalletService).toHaveBeenCalledTimes(1);
        expect(relay.publishWalletServiceInfoEvent).toHaveBeenCalledTimes(1);
        expect(relay.subscribe).toHaveBeenCalledTimes(1);
    });

    it('does nothing when called after the service has started', async () => {
        const { store } = await startService();
        const relay = relayFor(OLD_RELAY);

        await store.initializeService();
        await jest.advanceTimersByTimeAsync(SERVICE_START_MS);

        expect(store.isInitialized).toBe(true);
        expect(NWCWalletService).not.toHaveBeenCalled();
        expect(relay.publishWalletServiceInfoEvent).not.toHaveBeenCalled();
        expect(relay.subscribe).not.toHaveBeenCalled();
    });

    it('starts again when called after a reset', async () => {
        const { store, connections } = await startService();

        await store.reset(true);
        expect(isSubscribed(connections[0])).toBe(false);
        await store.initializeService();
        await jest.advanceTimersByTimeAsync(SERVICE_START_MS);

        expect(store.isInitialized).toBe(true);
        expect(NWCWalletService).toHaveBeenCalledTimes(1);
        expect(isSubscribed(connections[0])).toBe(true);
    });

    it('starts a new run when called after a reset during the first run', async () => {
        seedStoredService();
        const { store } = createStore();
        const relay = relayFor(OLD_RELAY);
        const publish = holdNextCall<void>(relay.publishWalletServiceInfoEvent);

        const first = store.initializeService();
        await publish.entered;
        await store.reset(true);
        // Waiting on the run the reset interrupted would skip loading the
        // service keys and relays again
        await settle(store.initializeService());

        expect(NWCWalletService).toHaveBeenCalledTimes(2);
        // reset() leaves the relay connected, so both runs publish through
        // the same fake
        expect(relay.publishWalletServiceInfoEvent).toHaveBeenCalledTimes(2);
        expect(store.isInitialized).toBe(true);

        publish.release();
        await settle(first);
    });

    it('starts a new run after a run that found no connections', async () => {
        const { store } = createStore();
        await store.initializeService();
        seedStoredService();
        await settle(store.initializeService());
        await jest.advanceTimersByTimeAsync(SERVICE_START_MS);
        expect(NWCWalletService).toHaveBeenCalledTimes(1);
        expect(store.isInitialized).toBe(true);
    });

    it('waits on the new run when the run a reset interrupted finishes first', async () => {
        seedStoredService();
        const { store } = createStore();
        // reset() leaves the relay connected, so both runs publish through
        // the same fake
        const relay = relayFor(OLD_RELAY);
        const firstPublish = holdNextCall<void>(
            relay.publishWalletServiceInfoEvent
        );
        const first = store.initializeService();
        await firstPublish.entered;
        await store.reset(true);

        const secondPublish = holdNextCall<void>(
            relay.publishWalletServiceInfoEvent
        );
        const second = store.initializeService();
        await secondPublish.entered;
        firstPublish.release();
        await settle(first);
        // The interrupted run ends without starting the service
        expect(store.isInitialized).toBe(false);

        const connectionReads = () =>
            (Storage.getItem as jest.Mock).mock.calls.filter(
                ([key]) => key === NWC_CONNECTIONS_KEY
            ).length;
        const readsBefore = connectionReads();
        const third = store.initializeService();
        await flushMicrotasks();
        // The third call waits on the second run instead of starting one
        expect(connectionReads()).toBe(readsBefore);

        secondPublish.release();
        await settle(Promise.all([second, third]));
        expect(store.isInitialized).toBe(true);
    });
});

describe('NostrWalletConnectStore overlapping subscribes', () => {
    const subscribe = (store: NostrWalletConnectStore, c: NWCConnection) =>
        (store as any).subscribeToConnection(c) as Promise<void>;

    it('leaves one live subscription when two subscribes overlap', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const relay = relayFor(OLD_RELAY);
        const firstSubscribe = relay.holdNextSubscribe();

        const first = subscribe(store, connection);
        await settle(firstSubscribe.entered);
        const second = subscribe(store, connection);
        await flushMicrotasks();
        firstSubscribe.release();
        await settle(Promise.all([first, second]));

        expect(liveSubscriptions(connection)).toBe(1);
        expect((await clientFor(connection).getBalance()).error).toBe(
            undefined
        );

        await settle(store.deleteConnection(connection.id));
        expect(liveSubscriptions(connection)).toBe(0);
    });

    it('keeps the in-flight subscription when an overlapping subscribe for the same configuration would fail', async () => {
        silence('error');
        const {
            store,
            connections: [connection]
        } = await startService();
        const relay = relayFor(OLD_RELAY);
        const firstSubscribe = relay.holdNextSubscribe();

        const first = subscribe(store, connection);
        await settle(firstSubscribe.entered);
        // Any relay subscribe made from here on fails, except the held
        // first one, which goes through
        relay.failSubscribe = true;
        const second = subscribe(store, connection);
        await flushMicrotasks();
        relay.failSubscribe = false;
        firstSubscribe.release();
        await flushMicrotasks();
        relay.failSubscribe = true;
        await settle(Promise.all([first, second]));

        expect(liveSubscriptions(connection)).toBe(1);
        expect((store as any).activeSubscriptions.has(connection.id)).toBe(
            true
        );
        // The second subscribe waited for the first instead of opening its own
        expect(relay.subscribe).toHaveBeenCalledTimes(1);
        relay.failSubscribe = false;
        expect((await clientFor(connection).getBalance()).error).toBe(
            undefined
        );
    });

    it('joins the in-flight subscription after a reload replaced the connection object', async () => {
        silence('error');
        const {
            store,
            connections: [connection]
        } = await startService();
        const relay = relayFor(OLD_RELAY);
        const firstSubscribe = relay.holdNextSubscribe();

        const first = subscribe(store, connection);
        await settle(firstSubscribe.entered);
        // The connections list reloads on focus, which builds new objects
        await settle(store.loadConnections());
        const reloaded = store.connections[0];
        expect(reloaded).not.toBe(connection);
        relay.failSubscribe = true;
        const second = subscribe(store, reloaded);
        await flushMicrotasks();
        relay.failSubscribe = false;
        firstSubscribe.release();
        await flushMicrotasks();
        relay.failSubscribe = true;
        await settle(Promise.all([first, second]));

        expect(liveSubscriptions(connection)).toBe(1);
        expect((store as any).activeSubscriptions.has(connection.id)).toBe(
            true
        );
        expect(relay.subscribe).toHaveBeenCalledTimes(1);
    });

    it('subscribes once more for the waiting callers when the in-flight subscribe fails', async () => {
        silence('error');
        const {
            store,
            connections: [connection]
        } = await startService();
        const relay = relayFor(OLD_RELAY);
        const firstSubscribe = relay.holdNextSubscribe();
        // The first subscribe uses up all its retries on these failures,
        // then the relay recovers
        let failuresLeft = MAX_RELAY_ATTEMPTS;
        Object.defineProperty(relay, 'failSubscribe', {
            get: () => failuresLeft-- > 0,
            set: () => {}
        });

        const first = subscribe(store, connection);
        await settle(firstSubscribe.entered);
        const second = subscribe(store, connection);
        const third = subscribe(store, connection);
        await flushMicrotasks();
        firstSubscribe.release();
        await settle(Promise.all([first, second, third]));

        expect(liveSubscriptions(connection)).toBe(1);
        expect((store as any).activeSubscriptions.has(connection.id)).toBe(
            true
        );
        // One retry for both waiters, not one each
        expect(relay.subscribe).toHaveBeenCalledTimes(MAX_RELAY_ATTEMPTS + 1);
        expect((await clientFor(connection).getBalance()).error).toBe(
            undefined
        );
    });

    it('stops after one shared retry when the relay does not recover', async () => {
        silence('error');
        const {
            store,
            connections: [connection]
        } = await startService();
        const relay = relayFor(OLD_RELAY);
        const firstSubscribe = relay.holdNextSubscribe();
        relay.failSubscribe = true;

        const first = subscribe(store, connection);
        await settle(firstSubscribe.entered);
        const second = subscribe(store, connection);
        const third = subscribe(store, connection);
        await flushMicrotasks();
        firstSubscribe.release();
        await settle(Promise.all([first, second, third]));

        // The first attempt and one retry shared by both waiters
        expect(relay.subscribe).toHaveBeenCalledTimes(2 * MAX_RELAY_ATTEMPTS);
        expect(liveSubscriptions(connection)).toBe(0);
        expect((store as any).activeSubscriptions.has(connection.id)).toBe(
            false
        );
    });

    it('drops an older in-flight subscribe once an update resubscribes with new permissions', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const staleSubscribe = relayFor(OLD_RELAY).holdNextSubscribe();

        const stale = subscribe(store, connection);
        await settle(staleSubscribe.entered);
        await settle(
            store.updateConnection(connection.id, {
                permissions: ['get_info', 'get_balance', 'make_invoice']
            })
        );
        staleSubscribe.release();
        await settle(stale);

        expect(liveSubscriptions(connection)).toBe(1);
        expect(clientFor(connection).makeInvoice).toEqual(expect.any(Function));
    });

    it('leaves no live subscription when reset runs while a subscribe is in flight', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const pendingSubscribe = relayFor(OLD_RELAY).holdNextSubscribe();

        const pending = subscribe(store, connection);
        await settle(pendingSubscribe.entered);
        await settle(store.reset(true));
        pendingSubscribe.release();
        await settle(pending);

        expect(liveSubscriptions(connection)).toBe(0);
    });

    it('leaves no live subscription when the connection is deleted while a subscribe is in flight', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const pendingSubscribe = relayFor(OLD_RELAY).holdNextSubscribe();

        const pending = subscribe(store, connection);
        await settle(pendingSubscribe.entered);
        await settle(store.deleteConnection(connection.id));
        pendingSubscribe.release();
        await settle(pending);

        expect(store.connections).toHaveLength(0);
        expect(liveSubscriptions(connection)).toBe(0);
    });

    it('drops a subscribe that resolves while a delete is pending', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const pendingSubscribe = relayFor(OLD_RELAY).holdNextSubscribe();
        (store as any).pushPendingMutation(connection.id, 'delete');

        const pending = subscribe(store, connection);
        await settle(pendingSubscribe.entered);
        pendingSubscribe.release();
        await settle(pending);

        expect((store as any).activeSubscriptions.has(connection.id)).toBe(
            false
        );
        expect(liveSubscriptions(connection)).toBe(0);
        (store as any).popPendingMutation(connection.id, 'delete');
    });

    it('keeps a subscribe that resolves while wallet identity is unknown', async () => {
        const {
            store,
            nodeInfoStore,
            connections: [connection]
        } = await startService();
        const pendingSubscribe = relayFor(OLD_RELAY).holdNextSubscribe();

        const pending = subscribe(store, connection);
        await settle(pendingSubscribe.entered);
        // A failed getNodeInfo leaves nodeInfo empty
        nodeInfoStore.nodeInfo = {};
        pendingSubscribe.release();
        await settle(pending);

        expect((store as any).activeSubscriptions.has(connection.id)).toBe(
            true
        );
        expect(liveSubscriptions(connection)).toBe(1);
    });

    it('replaces the live subscription on a later resubscribe', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const relay = relayFor(OLD_RELAY);
        const previous = clientFor(connection);

        await settle(subscribe(store, connection));

        expect(relay.subscribe).toHaveBeenCalledTimes(1);
        expect(liveSubscriptions(connection)).toBe(1);
        expect(clientFor(connection)).not.toBe(previous);
        expect((await clientFor(connection).getBalance()).error).toBe(
            undefined
        );
    });
});

// The edit screen always sends budgetRenewal, and maxAmountSats as the new
// budget or as undefined when the budget is removed.
describe('NostrWalletConnectStore updateConnection budget transitions', () => {
    const never = BudgetRenewalType.Never;

    it('resets the spend counter when an unlimited connection gains a budget', async () => {
        const { store } = createStore();
        const connection = addConnection(store, {
            budgetRenewal: never,
            totalSpendSats: 400
        });
        expect(connection.hasBudgetLimit).toBe(false);

        const result = await store.updateConnection(connection.id, {
            maxAmountSats: 5000,
            budgetRenewal: never
        });

        expect(result.success).toBe(true);
        expect(connection.maxAmountSats).toBe(5000);
        expect(connection.totalSpendSats).toBe(0);
        expect(connection.lastBudgetReset).toBeInstanceOf(Date);
    });

    it('clears the spend counter when the budget is removed', async () => {
        const { store } = createStore();
        const connection = addConnection(store, {
            maxAmountSats: 5000,
            budgetRenewal: never,
            totalSpendSats: 400,
            lastBudgetReset: new Date('2024-01-01T00:00:00Z')
        });

        const result = await store.updateConnection(connection.id, {
            maxAmountSats: undefined,
            budgetRenewal: never
        });

        expect(result.success).toBe(true);
        expect(connection.hasBudgetLimit).toBe(false);
        expect(connection.totalSpendSats).toBe(0);
        expect(connection.lastBudgetReset).toBeUndefined();
    });

    it('keeps the spend counter when an update omits maxAmountSats', async () => {
        const { store } = createStore();
        const connection = addConnection(store, {
            maxAmountSats: 5000,
            budgetRenewal: never,
            totalSpendSats: 400
        });

        const result = await store.updateConnection(connection.id, {
            name: 'Renamed App'
        });

        expect(result.success).toBe(true);
        expect(connection.name).toBe('Renamed App');
        expect(connection.maxAmountSats).toBe(5000);
        expect(connection.totalSpendSats).toBe(400);
    });

    it('keeps the spend counter when only the budget amount changes', async () => {
        const { store } = createStore();
        const connection = addConnection(store, {
            maxAmountSats: 5000,
            budgetRenewal: never,
            totalSpendSats: 400
        });

        await store.updateConnection(connection.id, {
            maxAmountSats: 8000,
            budgetRenewal: never
        });

        expect(connection.maxAmountSats).toBe(8000);
        expect(connection.totalSpendSats).toBe(400);
    });

    it('resets the spend counter when the renewal period changes', async () => {
        const { store } = createStore();
        const connection = addConnection(store, {
            maxAmountSats: 5000,
            budgetRenewal: never,
            totalSpendSats: 400
        });

        await store.updateConnection(connection.id, {
            maxAmountSats: 5000,
            budgetRenewal: BudgetRenewalType.Daily
        });

        expect(connection.budgetRenewal).toBe(BudgetRenewalType.Daily);
        expect(connection.totalSpendSats).toBe(0);
    });

    it('keeps the spend counter when the renewal period changes without a budget', async () => {
        const { store } = createStore();
        const connection = addConnection(store, {
            budgetRenewal: never,
            totalSpendSats: 400
        });

        await store.updateConnection(connection.id, {
            maxAmountSats: undefined,
            budgetRenewal: BudgetRenewalType.Daily
        });

        expect(connection.budgetRenewal).toBe(BudgetRenewalType.Daily);
        expect(connection.totalSpendSats).toBe(400);
        expect(connection.lastBudgetReset).toBeUndefined();
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

    it('closes every relay after unsubscribing when a reset tears the service down', async () => {
        const {
            store,
            connections: [first, second]
        } = await startService([{}, { relayUrl: NEW_RELAY }]);
        const oldRelay = relayFor(OLD_RELAY);
        const newRelay = relayFor(NEW_RELAY);
        const subscribedAtClose: number[] = [];
        for (const relay of [oldRelay, newRelay]) {
            relay.close.mockImplementation(() => {
                subscribedAtClose.push(relay.handlers.size);
                relay.connected = false;
            });
        }

        await store.reset(true);

        expect((store as any).nwcWalletServices.size).toBe(0);
        expect(isSubscribed(first)).toBe(false);
        expect(isSubscribed(second)).toBe(false);
        await jest.advanceTimersByTimeAsync(RELAY_RELEASE_GRACE_MS - 1);
        expect(oldRelay.close).not.toHaveBeenCalled();
        expect(newRelay.close).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);
        expect(oldRelay.close).toHaveBeenCalledTimes(1);
        expect(newRelay.close).toHaveBeenCalledTimes(1);
        expect(subscribedAtClose).toEqual([0, 0]);
    });

    it('keeps a relay open after a reset until a request in flight has replied', async () => {
        const {
            store,
            balanceStore,
            connections: [connection]
        } = await startService();
        const relay = relayFor(OLD_RELAY);
        const balanceCall = holdNextCall<{ lightningBalance: number }>(
            balanceStore.getLightningBalance
        );
        const inFlight = clientFor(connection).getBalance();
        await settle(balanceCall.entered);

        await store.reset(true);
        await jest.advanceTimersByTimeAsync(RELAY_RELEASE_GRACE_MS * 2);

        expect(relay.close).not.toHaveBeenCalled();
        balanceCall.release({ lightningBalance: 5000 });
        expect((await inFlight).error).toBeUndefined();
        await jest.advanceTimersByTimeAsync(RELAY_RELEASE_GRACE_MS - 1);
        expect(relay.close).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);
        expect(relay.close).toHaveBeenCalledTimes(1);
    });

    it('closes the relays after a reset once a request in flight has run for the longest a request can take', async () => {
        const {
            store,
            balanceStore,
            connections: [connection]
        } = await startService();
        const relay = relayFor(OLD_RELAY);
        const balanceCall = holdNextCall<{ lightningBalance: number }>(
            balanceStore.getLightningBalance
        );
        const inFlight = clientFor(connection).getBalance();
        await settle(balanceCall.entered);

        await store.reset(true);
        await jest.advanceTimersByTimeAsync(
            MAX_IN_FLIGHT_HANDLER_MS + RELAY_RELEASE_GRACE_MS - 1
        );
        expect(relay.close).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);
        expect(relay.close).toHaveBeenCalledTimes(1);

        balanceCall.release({ lightningBalance: 5000 });
        await inFlight;
    });

    it('leaves the relays a restart opens alone when it closes the ones a reset dropped', async () => {
        // The SDK builds a new service, with its own pool, on every start
        (NWCWalletService as unknown as jest.Mock).mockImplementation(
            ({ relayUrls }: { relayUrls: string[] }) => {
                const relay = createFakeRelay(relayUrls[0]);
                relays.set(relayUrls[0], relay);
                return relay;
            }
        );
        const {
            store,
            balanceStore,
            connections: [connection]
        } = await startService();
        const droppedRelay = relayFor(OLD_RELAY);
        const balanceCall = holdNextCall<{ lightningBalance: number }>(
            balanceStore.getLightningBalance
        );
        const inFlight = clientFor(connection).getBalance();
        await settle(balanceCall.entered);

        await store.reset(true);
        await store.initializeService();
        await jest.advanceTimersByTimeAsync(SERVICE_START_MS);
        const restartedRelay = relays.get(OLD_RELAY)!;
        balanceCall.release({ lightningBalance: 5000 });
        await inFlight;
        await jest.advanceTimersByTimeAsync(RELAY_RELEASE_GRACE_MS);

        expect(restartedRelay).not.toBe(droppedRelay);
        expect(droppedRelay.close).toHaveBeenCalledTimes(1);
        expect(restartedRelay.close).not.toHaveBeenCalled();
        expect(isSubscribed(connection)).toBe(true);
        expect(
            (await clientFor(connection).getBalance()).error
        ).toBeUndefined();
    });

    it('closes the remaining relays when one fails to close on reset', async () => {
        silence('warn');
        const { store } = await startService([{}, { relayUrl: NEW_RELAY }]);
        const oldRelay = relayFor(OLD_RELAY);
        const newRelay = relayFor(NEW_RELAY);
        oldRelay.close.mockImplementation(() => {
            throw new Error('close failed');
        });

        await store.reset(true);
        await jest.advanceTimersByTimeAsync(RELAY_RELEASE_GRACE_MS);

        expect(oldRelay.close).toHaveBeenCalled();
        expect(newRelay.close).toHaveBeenCalled();
        expect((store as any).nwcWalletServices.size).toBe(0);
    });

    it('closes and clears every relay when unsubscribing fails on reset', async () => {
        const { store } = await startService([{}, { relayUrl: NEW_RELAY }]);
        const oldRelay = relayFor(OLD_RELAY);
        const newRelay = relayFor(NEW_RELAY);
        jest.spyOn(
            store as any,
            'unsubscribeFromAllConnections'
        ).mockImplementation(async () => {
            // A release scheduled while the unsubscribe runs must not
            // survive the reset and close a relay the next start opens
            (store as any).scheduleReleaseUnusedRelayService(OLD_RELAY);
            throw new Error('unsubscribe failed');
        });

        await expect(store.reset(true)).rejects.toThrow('unsubscribe failed');
        // Check before the timers run: a release that fires also removes
        // itself from the map
        expect((store as any).scheduledRelayReleases.size).toBe(0);
        await jest.advanceTimersByTimeAsync(RELAY_RELEASE_GRACE_MS);

        expect(oldRelay.close).toHaveBeenCalledTimes(1);
        expect(newRelay.close).toHaveBeenCalledTimes(1);
        expect((store as any).nwcWalletServices.size).toBe(0);
        expect((store as any).publishedRelays.size).toBe(0);
        expect((store as any).scheduledRelayReleases.size).toBe(0);
    });

    it('keeps the relays open when a reset keeps the service attached', async () => {
        const {
            store,
            connections: [first, second]
        } = await startService([{}, { relayUrl: NEW_RELAY }]);
        const oldRelay = relayFor(OLD_RELAY);
        const newRelay = relayFor(NEW_RELAY);

        // AppState 'inactive' on iOS with active connections
        await store.reset();
        await jest.advanceTimersByTimeAsync(RELAY_RELEASE_GRACE_MS);

        expect(oldRelay.close).not.toHaveBeenCalled();
        expect(newRelay.close).not.toHaveBeenCalled();
        expect((store as any).nwcWalletServices.size).toBe(2);
        expect(isSubscribed(first)).toBe(true);
        expect(isSubscribed(second)).toBe(true);
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

describe('NostrWalletConnectStore payment notifications', () => {
    const invoice = 'lnbc1notify-sent';
    const paymentHash = hex64('d');

    function settledPayment(status = 'SUCCEEDED', preimage = hex64('9')) {
        return new Payment({
            payment_request: invoice,
            payment_hash: paymentHash,
            status,
            value_sat: 10000,
            fee_sat: '50',
            payment_preimage: preimage
        });
    }

    function pendingPayInvoice(overrides: Record<string, unknown> = {}) {
        return {
            id: invoice,
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 10000,
            paymentHash,
            createdAt: new Date(Date.now() - 60_000),
            ...overrides
        };
    }

    async function startWithPayment(payment: Payment) {
        const started = await startService([{ maxAmountSats: 10000 }], {
            paymentsStore: {
                payments: [payment],
                getPayments: jest.fn(async () => [payment])
            }
        });
        const connection = started.connections[0];
        connection.activity = [pendingPayInvoice()] as any;
        return { ...started, connection };
    }

    it('publishes payment_sent through the SDK when a pending payment settles', async () => {
        const { store, connection } = await startWithPayment(settledPayment());
        const relay = relays.get(connection.relayUrl)!;

        await (store as any).reconcilePendingPayInvoiceActivities(connection);
        await jest.advanceTimersByTimeAsync(0);

        expect(connection.activity[0].status).toBe('success');
        expect(relay.publishNotification).toHaveBeenCalledTimes(1);
        const [keypair, notification] = relay.publishNotification.mock.calls[0];
        expect(keypair).toEqual({
            walletSecret: SERVICE_PRIV,
            clientPubkey: connection.pubkey
        });
        expect(notification.notification_type).toBe('payment_sent');
        expect(notification.notification).toMatchObject({
            type: 'outgoing',
            state: 'settled',
            payment_hash: paymentHash
        });
    });

    it('does not publish while the payment is still in flight', async () => {
        const { store, connection } = await startWithPayment(
            settledPayment('IN_FLIGHT', hex64('0'))
        );
        const relay = relays.get(connection.relayUrl)!;

        await (store as any).reconcilePendingPayInvoiceActivities(connection);
        await jest.advanceTimersByTimeAsync(0);

        expect(connection.activity[0].status).toBe('pending');
        expect(relay.publishNotification).not.toHaveBeenCalled();
    });

    it('does not publish for a payment that was already settled', async () => {
        const { store, connection } = await startWithPayment(settledPayment());
        const relay = relays.get(connection.relayUrl)!;

        await (store as any).reconcilePendingPayInvoiceActivities(connection);
        await (store as any).reconcilePendingPayInvoiceActivities(connection);
        await jest.advanceTimersByTimeAsync(0);

        expect(relay.publishNotification).toHaveBeenCalledTimes(1);
    });

    describe('make_invoice and finalizePayment', () => {
        const incomingHash = hex64('b');
        const incomingInvoice = 'lnbc1notify-received';
        const PREIMAGE = hex64('7');

        const lightningInvoice = (overrides: Record<string, unknown> = {}) =>
            new Invoice({
                r_hash: Base64Utils.hexToBase64(incomingHash),
                payment_request: incomingInvoice,
                creation_date: String(Math.floor(Date.now() / 1000) - 60),
                expiry: '3600',
                value: '1000',
                ...overrides
            });

        const pendingMakeInvoice = (invoice = lightningInvoice()) => ({
            id: invoice.getPaymentRequest,
            type: 'make_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 1000,
            paymentHash: incomingHash,
            invoice,
            createdAt: new Date(Date.now() - 60_000)
        });

        async function startWithInvoice(invoice = lightningInvoice()) {
            const started = await startService([{}]);
            const connection = started.connections[0];
            connection.activity = [pendingMakeInvoice(invoice)] as any;
            return {
                ...started,
                connection,
                activity: connection.activity[0],
                relay: relays.get(connection.relayUrl)!
            };
        }

        const settleOnNode = () => {
            jest.spyOn(
                NostrConnectUtils,
                'lookupInvoicePaidFromNode'
            ).mockResolvedValue(true);
            jest.spyOn(
                NostrWalletConnectStore.prototype as any,
                'refreshLightningInvoiceFromNode'
            ).mockResolvedValue(
                lightningInvoice({
                    settled: true,
                    settle_date: String(Math.floor(Date.now() / 1000)),
                    r_preimage: Base64Utils.hexToBase64(PREIMAGE)
                })
            );
        };

        beforeEach(() => {
            jest.spyOn(
                NostrConnectUtils,
                'decodeInvoiceTags'
            ).mockResolvedValue({
                paymentRequest: invoice,
                paymentHash,
                descriptionHash: '',
                description: '',
                amount: 10000,
                expiryTime: 0,
                createdAt: 0,
                isExpired: false,
                network: 'bitcoin'
            });
        });

        // loadConnections runs on every focus of the connections list
        it('settles the stored row once when the connections reload during list_transactions', async () => {
            const { store, connection, relay } = await startWithInvoice();
            settleOnNode();
            const lookup = holdNextCall<boolean>(
                NostrConnectUtils.lookupInvoicePaidFromNode as jest.Mock
            );
            await store.saveConnections();

            const listing = (store as any).handleListTransactions(
                connection,
                {}
            );
            await lookup.entered;
            await store.loadConnections();
            const [reloaded] = store.connections;
            expect(reloaded).not.toBe(connection);
            lookup.release(true);
            const first = await listing;

            expect(first.result.transactions[0].state).toBe('settled');
            expect(reloaded.activity[0].status).toBe('success');
            await jest.advanceTimersByTimeAsync(1000);
            expect(persistedConnections()[0].activity[0].status).toBe(
                'success'
            );

            const second = await (store as any).handleListTransactions(
                reloaded,
                {}
            );
            await jest.advanceTimersByTimeAsync(0);

            expect(second.result.transactions[0].state).toBe('settled');
            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
        });

        it('answers lookup_invoice from the stored row when the connections reload during the check', async () => {
            const { store, connection, activity, relay } =
                await startWithInvoice();
            settleOnNode();
            const lookup = holdNextCall<boolean>(
                NostrConnectUtils.lookupInvoicePaidFromNode as jest.Mock
            );
            await store.saveConnections();

            const response = (store as any).handleLookupInvoice(connection, {
                invoice: activity.id
            });
            await lookup.entered;
            await store.loadConnections();
            const [reloaded] = store.connections;
            lookup.release(true);

            expect((await response).result.state).toBe('settled');
            expect(reloaded.activity[0].status).toBe('success');
            await jest.advanceTimersByTimeAsync(0);
            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
        });

        it('settles the stored row once when the connections reload during getActivities', async () => {
            const { store, connection, relay } = await startWithInvoice();
            settleOnNode();
            const lookup = holdNextCall<boolean>(
                NostrConnectUtils.lookupInvoicePaidFromNode as jest.Mock
            );
            await store.saveConnections();

            const activities = store.getActivities(connection.id);
            await lookup.entered;
            await store.loadConnections();
            const [reloaded] = store.connections;
            expect(reloaded).not.toBe(connection);
            lookup.release(true);
            await activities;
            await jest.advanceTimersByTimeAsync(1000);

            expect(reloaded.activity[0].status).toBe('success');
            expect(persistedConnections()[0].activity[0].status).toBe(
                'success'
            );
            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
        });

        it('publishes payment_received when a pending invoice settles', async () => {
            const { store, connection, activity, relay } =
                await startWithInvoice();
            settleOnNode();

            await (store as any).reconcilePendingLightningMakeInvoice(
                connection,
                activity
            );
            await jest.advanceTimersByTimeAsync(0);

            expect(activity.status).toBe('success');
            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
            const [, notification] = relay.publishNotification.mock.calls[0];
            expect(notification.notification_type).toBe('payment_received');
            expect(notification.notification).toMatchObject({
                type: 'incoming',
                state: 'settled',
                payment_hash: incomingHash,
                preimage: PREIMAGE
            });
        });

        it('publishes nothing while the invoice is still open', async () => {
            const { store, connection, activity, relay } =
                await startWithInvoice();
            jest.spyOn(
                NostrConnectUtils,
                'lookupInvoicePaidFromNode'
            ).mockResolvedValue(false);

            await (store as any).reconcilePendingLightningMakeInvoice(
                connection,
                activity
            );
            await jest.advanceTimersByTimeAsync(0);

            expect(activity.status).toBe('pending');
            expect(relay.publishNotification).not.toHaveBeenCalled();
        });

        it('publishes nothing when the invoice expired', async () => {
            const { store, connection, activity, relay } =
                await startWithInvoice(
                    lightningInvoice({
                        payment_request:
                            'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr'
                    })
                );
            jest.spyOn(
                NostrConnectUtils,
                'lookupInvoicePaidFromNode'
            ).mockResolvedValue(false);

            await (store as any).reconcilePendingLightningMakeInvoice(
                connection,
                activity
            );
            await jest.advanceTimersByTimeAsync(0);

            expect(activity.status).toBe('expired');
            expect(relay.publishNotification).not.toHaveBeenCalled();
        });

        it('publishes payment_received when opening an invoice that was paid', async () => {
            const { store, activity, relay } = await startWithInvoice();
            settleOnNode();

            await store.refreshActivityInvoiceForNavigation(activity);
            await store.refreshActivityInvoiceForNavigation(activity);
            await jest.advanceTimersByTimeAsync(0);

            expect(activity.status).toBe('success');
            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
        });

        it('publishes payment_received once for overlapping reconciles', async () => {
            const { store, connection, activity, relay } =
                await startWithInvoice();
            settleOnNode();

            await Promise.all([
                (store as any).reconcilePendingLightningMakeInvoice(
                    connection,
                    activity
                ),
                (store as any).reconcilePendingLightningMakeInvoice(
                    connection,
                    activity
                )
            ]);
            await jest.advanceTimersByTimeAsync(0);

            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
        });

        it('publishes payment_received once when the activity screen loads alongside two lookup_invoice calls', async () => {
            const { store, connection, relay } = await startWithInvoice();
            settleOnNode();

            await Promise.all([
                store.getActivities(connection.id),
                (store as any).handleLookupInvoice(connection, {
                    payment_hash: incomingHash
                }),
                (store as any).handleLookupInvoice(connection, {
                    payment_hash: incomingHash
                })
            ]);
            await jest.advanceTimersByTimeAsync(0);

            expect(connection.activity[0].status).toBe('success');
            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
        });

        it('publishes payment_received once when list_transactions settles an invoice', async () => {
            const { store, connection, relay } = await startWithInvoice();
            settleOnNode();

            const response = await (store as any).handleListTransactions(
                connection,
                {}
            );
            await jest.advanceTimersByTimeAsync(0);

            expect(response.result.transactions[0].state).toBe('settled');
            expect(connection.activity[0].status).toBe('success');
            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
            const [, notification] = relay.publishNotification.mock.calls[0];
            expect(notification.notification_type).toBe('payment_received');
        });

        it('publishes payment_received once when list_transactions and the activity screen settle the same invoice together', async () => {
            const { store, connection, relay } = await startWithInvoice();
            settleOnNode();

            await Promise.all([
                (store as any).handleListTransactions(connection, {}),
                store.getActivities(connection.id),
                (store as any).handleListTransactions(connection, {})
            ]);
            await jest.advanceTimersByTimeAsync(0);

            expect(connection.activity[0].status).toBe('success');
            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
        });

        it('answers lookup_invoice on a pending pay_invoice from the stored row when the connections reload during the check', async () => {
            const payment = settledPayment();
            let release: (value: any) => void = () => {};
            const gate = new Promise((resolve) => (release = resolve));
            const started = await startService([{ maxAmountSats: 100000 }], {
                paymentsStore: {
                    payments: [payment],
                    getPayments: jest.fn(() => gate)
                }
            });
            const { store } = started;
            const connection = started.connections[0];
            connection.activity = [pendingPayInvoice()] as any;
            await store.saveConnections();

            const response = (store as any).handleLookupInvoice(connection, {
                payment_hash: paymentHash
            });
            await jest.advanceTimersByTimeAsync(0);
            await store.loadConnections();
            const [reloaded] = store.connections;
            expect(reloaded).not.toBe(connection);
            release([payment]);

            const answer = await response;
            expect(answer.error).toBeUndefined();
            expect(answer.result.state).toBe('settled');
            expect(answer.result.preimage).toBe(hex64('9'));
            expect(reloaded.activity[0].status).toBe('success');
        });

        it('publishes payment_sent once and debits once when finalizePayment lands during a reconcile', async () => {
            const payment = settledPayment();
            let release: (value: any) => void = () => {};
            const gate = new Promise((resolve) => (release = resolve));
            const started = await startService([{ maxAmountSats: 100000 }], {
                paymentsStore: {
                    payments: [payment],
                    getPayments: jest.fn(() => gate)
                }
            });
            const connection = started.connections[0];
            connection.activity = [pendingPayInvoice()] as any;
            const relay = relays.get(connection.relayUrl)!;

            const reconcile = (
                started.store as any
            ).reconcilePendingPayInvoiceActivities(connection);
            await (started.store as any).finalizePayment({
                rawInvoice: invoice,
                type: 'pay_invoice',
                payment_source: 'lightning',
                decoded: payment,
                connection,
                amountSats: 10000,
                feeSats: 50,
                paymentHash
            });
            release([payment]);
            await reconcile;
            await jest.advanceTimersByTimeAsync(0);

            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
            expect(connection.totalSpendSats).toBe(10050);
        });

        it('keeps a settled invoice settled when an expiry check resolves after it', async () => {
            const { store, connection, activity, relay } =
                await startWithInvoice(
                    lightningInvoice({
                        payment_request:
                            'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr'
                    })
                );
            let release: (v: boolean) => void = () => {};
            jest.spyOn(
                NostrConnectUtils,
                'lookupInvoicePaidFromNode'
            ).mockReturnValue(new Promise((r) => (release = r)));

            const reconcile = (
                store as any
            ).reconcilePendingLightningMakeInvoice(connection, activity);
            (store as any).settleMakeInvoice(connection, activity, () => {
                activity.status = 'success';
            });
            release(false);
            await reconcile;
            await jest.advanceTimersByTimeAsync(0);

            expect(activity.status).toBe('success');
            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
        });

        describe('Cashu invoices', () => {
            const MINT = 'https://mint.example';
            const cashuRequest = 'lnbc1notify-cashu';

            const cashuInvoice = (paid = false) =>
                new CashuInvoice({
                    quote: 'quote-1',
                    request: cashuRequest,
                    state: paid ? 'PAID' : 'UNPAID',
                    paid,
                    mintUrl: MINT,
                    expiry: Math.floor(Date.now() / 1000) + 3600
                } as any);

            async function startWithCashuInvoice() {
                const cashuStore = new CashuStore(
                    {
                        implementation: 'lnd',
                        lndDir: 'node1',
                        settings: {}
                    } as any,
                    {} as any,
                    {} as any,
                    {} as any
                );
                cashuStore.mintUrls = [MINT];
                cashuStore.selectedMintUrl = MINT;
                cashuStore.cashuWallets = {
                    [MINT]: {
                        walletId: MINT,
                        pubkey: '',
                        errorConnecting: false
                    }
                } as any;
                cashuStore.invoices = [];
                const started = await startService([{}], { cashuStore });
                started.store.cashuEnabled = true;
                const connection = started.connections[0];
                connection.activity = [
                    {
                        id: cashuRequest,
                        type: 'make_invoice',
                        payment_source: 'cashu',
                        status: 'pending',
                        satAmount: 1000,
                        invoice: cashuInvoice(),
                        createdAt: new Date(Date.now() - 60_000)
                    }
                ] as any;
                return {
                    ...started,
                    cashuStore,
                    connection,
                    activity: connection.activity[0],
                    relay: relays.get(connection.relayUrl)!
                };
            }

            // loadConnections runs on every focus of the connections list
            it('settles the stored row once when the connections reload during list_transactions', async () => {
                const { store, cashuStore, connection, relay } =
                    await startWithCashuInvoice();
                const check = jest.spyOn(cashuStore, 'checkInvoicePaid');
                const mint = holdNextCall<any>(check as unknown as jest.Mock);
                await store.saveConnections();

                const listing = (store as any).handleListTransactions(
                    connection,
                    {}
                );
                await mint.entered;
                await store.loadConnections();
                const [reloaded] = store.connections;
                expect(reloaded).not.toBe(connection);
                mint.release({
                    isPaid: true,
                    amtSat: '1000',
                    updatedInvoice: cashuInvoice(true)
                });
                const first = await listing;

                expect(first.result.transactions[0].state).toBe('settled');
                expect(reloaded.activity[0].status).toBe('success');
                await jest.advanceTimersByTimeAsync(1000);
                expect(persistedConnections()[0].activity[0].status).toBe(
                    'success'
                );

                const second = await (store as any).handleListTransactions(
                    reloaded,
                    {}
                );
                await jest.advanceTimersByTimeAsync(0);

                expect(second.result.transactions[0].state).toBe('settled');
                expect(check).toHaveBeenCalledTimes(1);
                expect(relay.publishNotification).toHaveBeenCalledTimes(1);
            });

            it('publishes payment_received once when a pending Cashu invoice settles', async () => {
                const { store, cashuStore, connection, activity, relay } =
                    await startWithCashuInvoice();
                jest.spyOn(cashuStore, 'checkInvoicePaid').mockResolvedValue({
                    isPaid: true,
                    amtSat: '1000',
                    updatedInvoice: cashuInvoice(true)
                } as any);

                await Promise.all([
                    (store as any).reconcilePendingCashuMakeInvoice(
                        connection,
                        activity
                    ),
                    (store as any).reconcilePendingCashuMakeInvoice(
                        connection,
                        activity
                    )
                ]);
                await jest.advanceTimersByTimeAsync(0);

                expect(activity.status).toBe('success');
                expect(relay.publishNotification).toHaveBeenCalledTimes(1);
                expect(relay.publishNotification).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.objectContaining({
                        notification_type: 'payment_received',
                        notification: expect.objectContaining({
                            type: 'incoming',
                            state: 'settled'
                        })
                    })
                );
            });

            it('stores the paid invoice on a settled activity that still holds the unpaid one, without notifying', async () => {
                const { store, cashuStore, activity, relay } =
                    await startWithCashuInvoice();
                activity.status = 'success';
                cashuStore.invoices = [cashuInvoice(true)];

                const returned =
                    await store.refreshActivityInvoiceForNavigation(activity);
                await jest.advanceTimersByTimeAsync(0);

                expect((returned as CashuInvoice).isPaid).toBe(true);
                expect((activity.invoice as CashuInvoice).isPaid).toBe(true);
                expect(relay.publishNotification).not.toHaveBeenCalled();
            });

            it('keeps a settled Cashu invoice settled when an expiry check resolves after it', async () => {
                const { store, cashuStore, connection, activity, relay } =
                    await startWithCashuInvoice();
                // expiry is read from the decoded BOLT11, so this needs a
                // real expired invoice (the BOLT11 spec example, 2017)
                activity.invoice = new CashuInvoice({
                    quote: 'quote-1',
                    request:
                        'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp',
                    state: 'UNPAID',
                    paid: false,
                    mintUrl: MINT,
                    expiry: 1496314718
                } as any);
                let release: (v: any) => void = () => {};
                jest.spyOn(cashuStore, 'checkInvoicePaid').mockReturnValue(
                    new Promise((r) => (release = r)) as any
                );

                const reconcile = (
                    store as any
                ).reconcilePendingCashuMakeInvoice(connection, activity);
                (store as any).settleMakeInvoice(connection, activity, () => {
                    activity.status = 'success';
                });
                release({ isPaid: false });
                await reconcile;
                await jest.advanceTimersByTimeAsync(0);

                expect(activity.status).toBe('success');
                expect(relay.publishNotification).toHaveBeenCalledTimes(1);
            });

            it('publishes nothing while a Cashu invoice is still unpaid', async () => {
                const { store, cashuStore, connection, activity, relay } =
                    await startWithCashuInvoice();
                jest.spyOn(cashuStore, 'checkInvoicePaid').mockResolvedValue({
                    isPaid: false
                } as any);

                await (store as any).reconcilePendingCashuMakeInvoice(
                    connection,
                    activity
                );
                await jest.advanceTimersByTimeAsync(0);

                expect(activity.status).toBe('pending');
                expect(relay.publishNotification).not.toHaveBeenCalled();
            });

            it('publishes payment_received once when opening a paid Cashu invoice', async () => {
                const { store, cashuStore, activity, relay } =
                    await startWithCashuInvoice();
                cashuStore.invoices = [cashuInvoice(true)];

                await store.refreshActivityInvoiceForNavigation(activity);
                await store.refreshActivityInvoiceForNavigation(activity);
                await jest.advanceTimersByTimeAsync(0);

                expect(activity.status).toBe('success');
                expect(relay.publishNotification).toHaveBeenCalledTimes(1);
            });
        });

        it('publishes payment_sent once when finalizePayment follows a reconcile of the same payment', async () => {
            const payment = settledPayment();
            const { store, connection } = await startWithPayment(payment);
            const relay = relays.get(connection.relayUrl)!;

            await (store as any).reconcilePendingPayInvoiceActivities(
                connection
            );
            await (store as any).finalizePayment({
                rawInvoice: invoice,
                type: 'pay_invoice',
                payment_source: 'lightning',
                decoded: payment,
                connection,
                amountSats: 10000,
                feeSats: 50,
                paymentHash
            });
            await jest.advanceTimersByTimeAsync(0);

            expect(connection.activity[0].status).toBe('success');
            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
        });

        it('publishes payment_sent when finalizePayment records a new payment', async () => {
            const { store, connections } = await startService([
                { maxAmountSats: 10000 }
            ]);
            const connection = connections[0];
            const relay = relays.get(connection.relayUrl)!;

            await (store as any).finalizePayment({
                rawInvoice: invoice,
                type: 'pay_invoice',
                payment_source: 'lightning',
                decoded: settledPayment(),
                connection,
                amountSats: 10000,
                feeSats: 50,
                paymentHash
            });
            await jest.advanceTimersByTimeAsync(0);

            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
            expect(relay.publishNotification.mock.calls[0][1]).toMatchObject({
                notification_type: 'payment_sent'
            });
        });

        it('publishes the pay_invoice row when a make_invoice row has the same id', async () => {
            const { store, connections } = await startService([
                { maxAmountSats: 10000 }
            ]);
            const connection = connections[0];
            const relay = relays.get(connection.relayUrl)!;
            connection.activity = [
                {
                    id: invoice,
                    type: 'make_invoice',
                    payment_source: 'lightning',
                    status: 'success',
                    satAmount: 10000,
                    paymentHash,
                    createdAt: new Date()
                }
            ] as any;

            await (store as any).finalizePayment({
                rawInvoice: invoice,
                type: 'pay_invoice',
                payment_source: 'lightning',
                decoded: settledPayment(),
                connection,
                amountSats: 10000,
                feeSats: 50,
                paymentHash
            });
            await jest.advanceTimersByTimeAsync(0);

            expect(relay.publishNotification).toHaveBeenCalledTimes(1);
            expect(relay.publishNotification.mock.calls[0][1]).toMatchObject({
                notification_type: 'payment_sent',
                notification: { type: 'outgoing', fees_paid: 50000 }
            });
        });
    });

    it('does not publish for a zero-amount activity', async () => {
        const { store, connection } = await startWithPayment(settledPayment());
        const relay = relays.get(connection.relayUrl)!;
        connection.activity[0].satAmount = 0;

        await (store as any).notifyConnection(
            connection,
            'payment_sent',
            connection.activity[0]
        );

        expect(relay.publishNotification).not.toHaveBeenCalled();
    });

    it('only warns when the relay service or wallet keys are missing', async () => {
        const { store, connection } = await startWithPayment(settledPayment());
        const relay = relays.get(connection.relayUrl)!;
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        (store as any).nwcWalletServices.delete(connection.relayUrl);
        await (store as any).notifyConnection(
            connection,
            'payment_sent',
            connection.activity[0]
        );
        expect(warn).toHaveBeenCalledTimes(1);

        (store as any).nwcWalletServices.set(connection.relayUrl, relay);
        (store as any).walletServiceKeys = null;
        await (store as any).notifyConnection(
            connection,
            'payment_sent',
            connection.activity[0]
        );

        expect(warn).toHaveBeenCalledTimes(2);
        expect(relay.publishNotification).not.toHaveBeenCalled();
    });

    it('keeps the payment state when publishing the notification fails', async () => {
        const { store, connection } = await startWithPayment(settledPayment());
        const relay = relays.get(connection.relayUrl)!;
        relay.publishNotification.mockRejectedValue(new Error('no relay'));
        const consoleError = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await (store as any).reconcilePendingPayInvoiceActivities(connection);
        await jest.advanceTimersByTimeAsync(0);

        expect(connection.activity[0].status).toBe('success');
        expect(connection.activity[0].isBudgetDebited).toBe(true);
        expect(relay.publishNotification).toHaveBeenCalledTimes(1);
        // logged once, by notifyConnection
        expect(consoleError).toHaveBeenCalledTimes(1);
    });
});

describe('NostrWalletConnectStore request event replay guard', () => {
    // A 64-hex event id; the first 16 characters are the part kept
    const eventId = (n: number | string) =>
        `${(typeof n === 'number' ? n.toString(16) : n).padStart(
            16,
            '0'
        )}${'a'.repeat(48)}`;
    const keyOf = (id: string) => id.slice(0, 16);

    const storedEventIds = (id = 'conn-1'): string[] | undefined =>
        JSON.parse(storedItems.get(NWC_PROCESSED_EVENTS_KEY) ?? '{}')[id];
    const seedEventIds = (ids: Record<string, string[]>) =>
        storedItems.set(NWC_PROCESSED_EVENTS_KEY, JSON.stringify(ids));

    it('claims an unseen event id and skips it when it is delivered again', async () => {
        const {
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);

        expect(await client.recordEvent(eventId(1))).toBeUndefined();
        expect(await client.recordEvent(eventId(1))).toBe('ALREADY_PROCESSED');
        expect(await client.recordEvent(eventId(2))).toBeUndefined();
        expect(storedEventIds()).toEqual([
            keyOf(eventId(1)),
            keyOf(eventId(2))
        ]);
    });

    it('saves only the first 16 characters of the id, before the request can run', async () => {
        const {
            connections: [connection]
        } = await startService();

        await clientFor(connection).recordEvent(eventId(1));

        expect(storedEventIds()).toEqual([keyOf(eventId(1))]);
        expect(storedEventIds()![0]).toHaveLength(16);
    });

    it('does not put the ids in the stored connections', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();

        await clientFor(connection).recordEvent(eventId(1));
        await store.saveConnections();

        expect(storedItems.get(NWC_CONNECTIONS_KEY)).not.toContain(
            keyOf(eventId(1))
        );
    });

    it('skips ids processed before a restart', async () => {
        seedEventIds({ 'conn-1': [keyOf(eventId(7))] });
        const {
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);

        expect(await client.recordEvent(eventId(7))).toBe('ALREADY_PROCESSED');
        expect(await client.recordEvent(eventId(8))).toBeUndefined();
    });

    it('keeps one list per connection', async () => {
        const {
            connections: [first, second]
        } = await startService([{}, {}]);

        await clientFor(first).recordEvent(eventId(1));

        expect(await clientFor(second).recordEvent(eventId(1))).toBeUndefined();
        expect(storedEventIds('conn-1')).toEqual([keyOf(eventId(1))]);
        expect(storedEventIds('conn-2')).toEqual([keyOf(eventId(1))]);
    });

    it('drops the oldest ids once the list is full', async () => {
        seedEventIds({
            'conn-1': Array.from({ length: 2000 }, (_, i) => keyOf(eventId(i)))
        });
        const {
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);

        await client.recordEvent(eventId(5000));

        expect(storedEventIds()).toHaveLength(2000);
        expect(storedEventIds()![0]).toBe(keyOf(eventId(1)));
        expect(storedEventIds()![1999]).toBe(keyOf(eventId(5000)));
        expect(await client.recordEvent(eventId(0))).toBeUndefined();
    });

    it('forgets the ids of a connection that no longer exists', async () => {
        seedEventIds({
            'conn-1': [keyOf(eventId(1))],
            deleted: [keyOf(eventId(2))]
        });

        await startService();
        await jest.advanceTimersByTimeAsync(0);

        expect(storedEventIds('deleted')).toBeUndefined();
        expect(storedEventIds('conn-1')).toEqual([keyOf(eventId(1))]);
    });

    it("keeps another wallet's ids when the connections are loaded", async () => {
        seedEventIds({
            'conn-1': [keyOf(eventId(1))],
            'conn-2': [keyOf(eventId(2))]
        });

        // conn-2 belongs to another wallet, so it is not loaded into the
        // store, but its ids must outlive every load of the current wallet
        const {
            store,
            connections: [connection]
        } = await startService([{}, { nodePubkey: 'another-node-pubkey' }]);
        await store.loadConnections();
        await jest.advanceTimersByTimeAsync(0);

        expect(store.connections.map((c) => c.id)).toEqual(['conn-1']);
        expect(storedEventIds('conn-2')).toEqual([keyOf(eventId(2))]);
        expect(storedEventIds('conn-1')).toEqual([keyOf(eventId(1))]);
        expect(await clientFor(connection).recordEvent(eventId(1))).toBe(
            'ALREADY_PROCESSED'
        );
        // the other wallet's list is still there once the wallet is current
        await store.saveConnections();
        expect(storedEventIds('conn-2')).toEqual([keyOf(eventId(2))]);
    });

    it('loads the ids again after a failed read', async () => {
        const read = (Storage.getItem as jest.Mock).getMockImplementation()!;
        let failing = true;
        (Storage.getItem as jest.Mock).mockImplementation(
            async (key: string) => {
                if (failing && key === NWC_PROCESSED_EVENTS_KEY) {
                    throw new Error('keychain read failed');
                }
                return read(key);
            }
        );
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        seedEventIds({ 'conn-1': [keyOf(eventId(7))] });
        const {
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);

        // the ids cannot be read, so the request is skipped
        expect(await client.recordEvent(eventId(1))).toBe('ALREADY_PROCESSED');

        // the read works again: the stored ids load and the request runs
        failing = false;
        expect(await client.recordEvent(eventId(1))).toBeUndefined();
        expect(await client.recordEvent(eventId(7))).toBe('ALREADY_PROCESSED');
        expect(storedEventIds()).toEqual([
            keyOf(eventId(7)),
            keyOf(eventId(1))
        ]);
    });

    it('removes the ids with the rest of the connection data', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        await clientFor(connection).recordEvent(eventId(1));

        await store.deleteAllConnectionData();

        expect(storedItems.has(NWC_PROCESSED_EVENTS_KEY)).toBe(false);
    });

    it('does not write the ids of deleted connections back after a data wipe', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        await clientFor(connection).recordEvent(eventId(1));

        await store.deleteAllConnectionData();
        const next = addConnection(store, {
            id: 'conn-2',
            pubkey: hex64('b')
        });
        await (store as any).recordNwcRequestEvent(next, eventId(2));

        expect(storedEventIds('conn-1')).toBeUndefined();
        expect(storedEventIds('conn-2')).toEqual([keyOf(eventId(2))]);
        expect(
            Object.keys(
                JSON.parse(storedItems.get(NWC_PROCESSED_EVENTS_KEY) ?? '{}')
            )
        ).toEqual(['conn-2']);
    });

    it('skips the request when the id cannot be saved, then lets a later delivery run', async () => {
        const {
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        failWrites(NWC_PROCESSED_EVENTS_KEY, { once: true });

        expect(await client.recordEvent(eventId(1))).toBe('ALREADY_PROCESSED');
        expect(await client.recordEvent(eventId(1))).toBeUndefined();
        expect(storedEventIds()).toEqual([keyOf(eventId(1))]);
    });

    it('keeps an id claimed meanwhile when another id cannot be saved', async () => {
        const {
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const write = holdNextWrite(NWC_PROCESSED_EVENTS_KEY);
        failWrites(NWC_PROCESSED_EVENTS_KEY, { once: true });

        const first = client.recordEvent(eventId(1));
        await write.entered;
        // claimed on another subscription while the first is being saved
        const second = client.recordEvent(eventId(2));
        await jest.advanceTimersByTimeAsync(0);
        write.release(undefined);

        expect(await first).toBe('ALREADY_PROCESSED');
        expect(await second).toBeUndefined();
        expect(storedEventIds()).toEqual([keyOf(eventId(2))]);
        expect(await client.recordEvent(eventId(2))).toBe('ALREADY_PROCESSED');
        expect(await client.recordEvent(eventId(1))).toBeUndefined();
    });

    it('queues one write for the claims made while another is running', async () => {
        const {
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        const write = holdNextWrite(NWC_PROCESSED_EVENTS_KEY);
        (Storage.setItem as jest.Mock).mockClear();

        const first = client.recordEvent(eventId(1));
        await write.entered;
        const burst = [2, 3, 4, 5, 6].map((i) =>
            Promise.resolve(client.recordEvent(eventId(i)))
        );
        await jest.advanceTimersByTimeAsync(0);
        write.release(undefined);

        expect(await first).toBeUndefined();
        expect(await Promise.all(burst)).toEqual([
            undefined,
            undefined,
            undefined,
            undefined,
            undefined
        ]);
        // the running write and one for the five claims behind it
        const writes = (Storage.setItem as jest.Mock).mock.calls.filter(
            ([key]) => key === NWC_PROCESSED_EVENTS_KEY
        );
        expect(writes).toHaveLength(2);
        expect(storedEventIds()).toEqual(
            [1, 2, 3, 4, 5, 6].map((i) => keyOf(eventId(i)))
        );
    });

    it('keeps an id when the connections are loaded while it is being saved', async () => {
        const {
            store,
            connections: [connection]
        } = await startService();
        const client = clientFor(connection);
        const write = holdNextWrite(NWC_PROCESSED_EVENTS_KEY);

        const first = client.recordEvent(eventId(1));
        await write.entered;
        await store.loadConnections();
        write.release(undefined);

        expect(await first).toBeUndefined();
        expect(await client.recordEvent(eventId(1))).toBe('ALREADY_PROCESSED');
        await client.recordEvent(eventId(2));
        expect(storedEventIds()).toEqual([
            keyOf(eventId(1)),
            keyOf(eventId(2))
        ]);
    });

    // The tests above call recordEvent directly. This one lets the real SDK
    // call it, to show it does so before the handler and for every
    // subscribe() call, which has its own queue.
    it('runs a request once when the SDK delivers the same signed event on two subscriptions', async () => {
        const sdk = jest.requireActual('@getalby/sdk');
        const nostrTools = jest.requireActual('nostr-tools');
        const { hexToBytes } = jest.requireActual('@noble/hashes/utils.js');
        const clientSecret = hex64('4');
        const clientPubkey = nostrTools.getPublicKey(hexToBytes(clientSecret));
        const {
            connections: [connection]
        } = await startService([{ pubkey: clientPubkey }]);
        const getBalance = jest.fn().mockResolvedValue({
            result: { balance: 1000 },
            error: undefined
        });
        const handler = {
            recordEvent: clientFor(connection).recordEvent,
            getBalance
        };

        const service = new sdk.NWCWalletService({ relayUrls: [OLD_RELAY] });
        const onevents: ((event: unknown) => Promise<void>)[] = [];
        service.pool = {
            subscribe: jest.fn((_relays, _filter, params) => {
                onevents.push(params.onevent);
                return { close: jest.fn() };
            })
        };
        service._checkConnected = jest.fn().mockResolvedValue(undefined);
        service._publishWithRetry = jest.fn().mockResolvedValue(true);
        const keypair = new sdk.NWCWalletServiceKeyPair(
            hex64('3'),
            clientPubkey
        );
        const event = nostrTools.finalizeEvent(
            {
                kind: 23194,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['p', keypair.walletPubkey]],
                content: await service.encrypt(
                    keypair,
                    JSON.stringify({ method: 'get_balance', params: {} }),
                    'nip04'
                )
            },
            hexToBytes(clientSecret)
        );

        await service.subscribe(keypair, handler);
        await service.subscribe(keypair, handler);
        await onevents[0](event);
        await onevents[1](event);
        await onevents[0](event);

        expect(getBalance).toHaveBeenCalledTimes(1);
        expect(storedEventIds()).toEqual([keyOf(event.id)]);
    });

    describe('pay_invoice retried with a new event', () => {
        const invoice = 'lnbc1already-paid';
        const paymentHash = hex64('c');
        const preimage = hex64('9');
        const invoiceTags = {
            paymentRequest: invoice,
            paymentHash,
            descriptionHash: '',
            description: '',
            amount: 5000,
            expiryTime: 0,
            createdAt: 0,
            isExpired: false,
            network: 'bitcoin'
        };

        beforeEach(() => {
            (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
                timestamp: String(Math.floor(Date.now() / 1000) - 60),
                expiry: '3600'
            });
            jest.spyOn(
                NostrConnectUtils,
                'decodeInvoiceTags'
            ).mockResolvedValue(invoiceTags);
            jest.spyOn(
                NostrConnectUtils,
                'resolvePayInvoiceAmount'
            ).mockResolvedValue({ amountSats: 5000, zeroAmountInvoice: false });
        });

        const payment = () =>
            new Payment({
                payment_request: invoice,
                payment_hash: paymentHash,
                status: 'SUCCEEDED',
                value_sat: 5000,
                fee_sat: '3',
                payment_preimage: preimage
            });

        const payCollaborators = (payments: Payment[] = []) => ({
            transactionsStore: {
                reset: jest.fn(),
                sendPaymentSilently: jest.fn().mockResolvedValue({}),
                getPaymentOutcome: jest.fn().mockReturnValue({}),
                loading: false
            },
            paymentsStore: {
                payments,
                getPayments: jest.fn().mockResolvedValue(payments)
            }
        });

        const activity = (status: string, overrides: object = {}) => ({
            id: invoice,
            type: 'pay_invoice',
            payment_source: 'lightning',
            status,
            satAmount: 5000,
            fees_paid: 3,
            paymentHash,
            ...overrides
        });

        it('returns the preimage of an invoice it paid, also after the connections are loaded again', async () => {
            const {
                store,
                transactionsStore,
                connections: [connection]
            } = await startService(
                [{ permissions: ['pay_invoice'], maxAmountSats: 100000 }],
                payCollaborators([payment()])
            );
            const client = clientFor(connection);

            const first = await client.payInvoice({ invoice });
            expect(first.result?.preimage).toBe(preimage);

            // what a restart does: the row comes back from storage
            await store.saveConnections();
            await store.loadConnections();
            const retry = await client.payInvoice({ invoice });

            expect(retry).toEqual({
                result: { preimage, fees_paid: 3000 },
                error: undefined
            });
            expect(transactionsStore.sendPaymentSilently).toHaveBeenCalledTimes(
                1
            );
        });

        it('returns the preimage of a paid Cashu invoice after the connections are loaded again', async () => {
            const cashuPayment = new CashuPayment({
                payment_request: invoice,
                payment_hash: paymentHash,
                status: 'SUCCEEDED',
                value_sat: 5000,
                fee_sat: '3',
                payment_preimage: preimage
            } as any);
            const payLnInvoiceFromEcash = jest.fn();
            const {
                store,
                connections: [connection]
            } = await startService(
                [
                    {
                        permissions: ['pay_invoice'],
                        maxAmountSats: 100000,
                        activity: [
                            activity('success', {
                                payment_source: 'cashu',
                                payment: cashuPayment
                            })
                        ]
                    }
                ],
                {
                    cashuStore: {
                        selectedMintUrl: 'https://mint.example',
                        isProperlyConfigured: () => true,
                        getPayReq: jest.fn(),
                        payLnInvoiceFromEcash
                    }
                }
            );
            store.cashuEnabled = true;
            const client = clientFor(connection);

            // what a restart does: the row comes back from storage
            await store.saveConnections();
            await store.loadConnections();
            const retry = await client.payInvoice({ invoice });

            expect(retry).toEqual({
                result: { preimage, fees_paid: 3000 },
                error: undefined
            });
            expect(payLnInvoiceFromEcash).not.toHaveBeenCalled();
        });

        it('reports no fee for a paid Cashu invoice whose fee the mint did not say, after the connections are loaded again', async () => {
            const cashuPayment = new CashuPayment({
                payment_request: invoice,
                payment_hash: paymentHash,
                status: 'SUCCEEDED',
                value_sat: 5000,
                fee_msat: 4000,
                fee_unknown: true,
                payment_preimage: preimage
            } as any);
            const payLnInvoiceFromEcash = jest.fn();
            const {
                store,
                connections: [connection]
            } = await startService(
                [
                    {
                        permissions: ['pay_invoice'],
                        maxAmountSats: 100000,
                        activity: [
                            activity('success', {
                                payment_source: 'cashu',
                                payment: cashuPayment,
                                fees_paid: 0
                            })
                        ]
                    }
                ],
                {
                    cashuStore: {
                        selectedMintUrl: 'https://mint.example',
                        isProperlyConfigured: () => true,
                        getPayReq: jest.fn(),
                        payLnInvoiceFromEcash
                    }
                }
            );
            store.cashuEnabled = true;
            const client = clientFor(connection);

            await store.saveConnections();
            await store.loadConnections();
            const retry = await client.payInvoice({ invoice });

            expect(retry).toEqual({
                result: { preimage, fees_paid: 0 },
                error: undefined
            });
            expect(payLnInvoiceFromEcash).not.toHaveBeenCalled();
        });

        it('leaves a paid invoice whose preimage is unknown to the pay handler', async () => {
            const {
                transactionsStore,
                connections: [connection]
            } = await startService(
                [
                    {
                        permissions: ['pay_invoice'],
                        maxAmountSats: 100000,
                        activity: [activity('success')]
                    }
                ],
                payCollaborators()
            );

            await clientFor(connection).payInvoice({ invoice });

            expect(transactionsStore.sendPaymentSilently).toHaveBeenCalledTimes(
                1
            );
        });

        it('pays again when the stored preimage is all zeros, also after the connections are loaded again', async () => {
            const zeros = '0'.repeat(64);
            const collaborators = payCollaborators();
            collaborators.transactionsStore.getPaymentOutcome.mockReturnValue({
                payment_preimage: zeros,
                error: true,
                status: 'FAILED',
                isIncomplete: true
            });
            const {
                store,
                transactionsStore,
                connections: [connection]
            } = await startService(
                [{ permissions: ['pay_invoice'], maxAmountSats: 100000 }],
                collaborators
            );
            const client = clientFor(connection);

            await client.payInvoice({ invoice });
            expect(transactionsStore.sendPaymentSilently).toHaveBeenCalledTimes(
                1
            );

            // what a restart does: the row comes back from storage
            await store.saveConnections();
            await store.loadConnections();
            await client.payInvoice({ invoice });

            expect(transactionsStore.sendPaymentSilently).toHaveBeenCalledTimes(
                2
            );
        });

        it('pays again when the earlier attempt failed', async () => {
            const {
                transactionsStore,
                connections: [connection]
            } = await startService(
                [
                    {
                        permissions: ['pay_invoice'],
                        maxAmountSats: 100000,
                        activity: [activity('failed')]
                    }
                ],
                payCollaborators()
            );

            await clientFor(connection).payInvoice({ invoice });

            expect(transactionsStore.sendPaymentSilently).toHaveBeenCalledTimes(
                1
            );
        });

        it('leaves an undecodable invoice to the pay handler', async () => {
            jest.spyOn(
                NostrConnectUtils,
                'decodeInvoiceTags'
            ).mockRejectedValue(new Error('bad invoice'));
            const { store, connections } = await startService([
                { permissions: ['pay_invoice'] }
            ]);

            expect(
                await (store as any).getSettledPayInvoiceResponse(
                    connections[0],
                    'not-an-invoice'
                )
            ).toBeUndefined();
        });
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

describe('NostrWalletConnectStore list_transactions pending make_invoice', () => {
    const HASH = hex64('b');
    const REQUEST = 'lnbc1list-pending';
    const PREIMAGE = hex64('7');

    const lightningInvoice = (overrides: Record<string, unknown> = {}) =>
        new Invoice({
            r_hash: Base64Utils.hexToBase64(HASH),
            payment_request: REQUEST,
            creation_date: String(Math.floor(Date.now() / 1000) - 60),
            expiry: '3600',
            value: '1000',
            ...overrides
        });

    function setup() {
        const { store } = createStore();
        const connection = addConnection(store, {
            permissions: ['make_invoice', 'list_transactions'],
            activity: [
                {
                    id: REQUEST,
                    type: 'make_invoice',
                    payment_source: 'lightning',
                    status: 'pending',
                    satAmount: 1000,
                    paymentHash: HASH,
                    invoice: lightningInvoice(),
                    createdAt: new Date(Date.now() - 60_000),
                    // recorded as a Date, as recordMakeInvoiceActivity does
                    expiresAt: new Date(Date.now() + 3_540_000)
                }
            ]
        });
        return { store, connection };
    }

    it('lists a make_invoice that was paid on the node', async () => {
        const { store, connection } = setup();
        const scheduleSave = jest
            .spyOn(store as any, 'scheduleSave')
            .mockImplementation(() => {});
        jest.spyOn(
            NostrConnectUtils,
            'lookupInvoicePaidFromNode'
        ).mockResolvedValue(true);
        jest.spyOn(
            NostrWalletConnectStore.prototype as any,
            'refreshLightningInvoiceFromNode'
        ).mockResolvedValue(
            lightningInvoice({
                settled: true,
                settle_date: String(Math.floor(Date.now() / 1000)),
                r_preimage: Base64Utils.hexToBase64(PREIMAGE)
            })
        );

        const response = await (store as any).handleListTransactions(
            connection,
            {}
        );

        expect(response.error).toBeUndefined();
        expect(response.result.transactions).toHaveLength(1);
        expect(response.result.transactions[0]).toMatchObject({
            type: 'incoming',
            state: 'settled',
            payment_hash: HASH,
            preimage: PREIMAGE
        });
        expect(response.result.total_count).toBe(1);
        expect(connection.activity[0].status).toBe('success');
        // the settled status is saved, not only held in memory
        expect(scheduleSave).toHaveBeenCalled();
    });

    it('lists an open make_invoice as pending when the app asks for unpaid invoices', async () => {
        const { store, connection } = setup();
        jest.spyOn(
            NostrConnectUtils,
            'lookupInvoicePaidFromNode'
        ).mockResolvedValue(false);

        const asked = await (store as any).handleListTransactions(connection, {
            unpaid: true
        });
        // NIP-47: unpaid is false unless the app sends it
        const byDefault = await (store as any).handleListTransactions(
            connection,
            {}
        );

        expect(asked.result.transactions).toHaveLength(1);
        expect(asked.result.transactions[0]).toMatchObject({
            type: 'incoming',
            state: 'pending',
            payment_hash: HASH
        });
        // unix seconds, not the milliseconds a Date turns into: a client
        // reads milliseconds as an expiry tens of thousands of years away
        const nowSeconds = Math.floor(Date.now() / 1000);
        expect(asked.result.transactions[0].expires_at).toBeGreaterThan(
            nowSeconds
        );
        expect(asked.result.transactions[0].expires_at).toBeLessThan(
            nowSeconds + 3600
        );
        expect(byDefault.result.transactions).toHaveLength(0);
        expect(connection.activity[0].status).toBe('pending');
    });

    it('lists an expired make_invoice as expired, with its expiry, when the app asks for unpaid invoices', async () => {
        const { store, connection } = setup();
        // "expired" is read from the decoded BOLT11, so this needs a real
        // invoice: the BOLT11 spec example, created in 2017 with a 60 second
        // expiry. creation_date and expiry match it, as they do on a real
        // node's invoice, because expires_at is built from them.
        connection.activity[0].invoice = lightningInvoice({
            payment_request:
                'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp',
            creation_date: '1496314658',
            expiry: '60'
        });
        connection.activity[0].expiresAt = new Date((1496314658 + 60) * 1000);
        jest.spyOn(
            NostrConnectUtils,
            'lookupInvoicePaidFromNode'
        ).mockResolvedValue(false);

        const asked = await (store as any).handleListTransactions(connection, {
            unpaid_incoming: true
        });
        const byDefault = await (store as any).handleListTransactions(
            connection,
            {}
        );

        expect(connection.activity[0].status).toBe('expired');
        expect(asked.result.transactions).toHaveLength(1);
        // NIP-47 lists "expired" for invoices and keeps "failed" for payments
        expect(asked.result.transactions[0]).toMatchObject({
            type: 'incoming',
            state: 'expired',
            payment_hash: HASH
        });
        expect(asked.result.transactions[0].expires_at).toBe(1496314658 + 60);
        expect(byDefault.result.transactions).toHaveLength(0);
    });

    it('lists the newest activity first and paginates from the newest', async () => {
        const { store, connection } = setup();
        jest.spyOn(
            NostrConnectUtils,
            'lookupInvoicePaidFromNode'
        ).mockResolvedValue(false);
        const now = Math.floor(Date.now() / 1000);
        const entry = (name: string, secondsAgo: number) => ({
            id: `lnbc1order-${name}`,
            type: 'make_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 1000,
            paymentHash: hex64(name),
            invoice: lightningInvoice({
                r_hash: Base64Utils.hexToBase64(hex64(name)),
                payment_request: `lnbc1order-${name}`,
                creation_date: String(now - secondsAgo)
            }),
            createdAt: new Date((now - secondsAgo) * 1000),
            expiresAt: new Date((now - secondsAgo + 3600) * 1000)
        });
        // stored out of time order, so the result cannot simply follow
        // insertion order
        connection.activity = [
            entry('2', 600),
            entry('1', 3000),
            entry('3', 60)
        ] as any;

        const all = await (store as any).handleListTransactions(connection, {
            unpaid: true
        });
        const firstPage = await (store as any).handleListTransactions(
            connection,
            { unpaid: true, limit: 1 }
        );
        const secondPage = await (store as any).handleListTransactions(
            connection,
            { unpaid: true, limit: 1, offset: 1 }
        );

        expect(
            all.result.transactions.map((tx: any) => tx.payment_hash)
        ).toEqual([hex64('3'), hex64('2'), hex64('1')]);
        expect(all.result.total_count).toBe(3);
        expect(firstPage.result.transactions[0].payment_hash).toBe(hex64('3'));
        expect(secondPage.result.transactions[0].payment_hash).toBe(hex64('2'));
    });

    it('still answers when the node cannot be reached to check an invoice', async () => {
        const { store, connection } = setup();
        // the node is asked through decodeInvoiceTags; lookupInvoicePaidFromNode
        // turns any failure into "not paid"
        jest.spyOn(NostrConnectUtils, 'decodeInvoiceTags').mockRejectedValue(
            new Error('node unreachable')
        );

        const response = await (store as any).handleListTransactions(
            connection,
            { unpaid: true }
        );

        expect(response.error).toBeUndefined();
        expect(response.result.transactions).toHaveLength(1);
        expect(response.result.transactions[0].state).toBe('pending');
        expect(connection.activity[0].status).toBe('pending');
    });

    it('settles a Lightning make_invoice stored as a plain object', async () => {
        const { store, connection } = setup();
        const plain = (invoice: Invoice) => JSON.parse(JSON.stringify(invoice));
        jest.spyOn(
            NostrConnectUtils,
            'lookupInvoicePaidFromNode'
        ).mockResolvedValue(true);
        jest.spyOn(
            NostrWalletConnectStore.prototype as any,
            'refreshLightningInvoiceFromNode'
        ).mockResolvedValue(
            lightningInvoice({
                settled: true,
                settle_date: String(Math.floor(Date.now() / 1000)),
                r_preimage: Base64Utils.hexToBase64(PREIMAGE)
            })
        );
        connection.activity[0].invoice = plain(lightningInvoice());

        const paid = await (store as any).handleListTransactions(
            connection,
            {}
        );

        expect(connection.activity[0].status).toBe('success');
        expect(paid.result.transactions[0]).toMatchObject({
            state: 'settled',
            preimage: PREIMAGE
        });
    });

    it('expires a Lightning make_invoice stored as a plain object', async () => {
        const { store, connection } = setup();
        jest.spyOn(
            NostrConnectUtils,
            'lookupInvoicePaidFromNode'
        ).mockResolvedValue(false);
        connection.activity[0].invoice = JSON.parse(
            JSON.stringify(
                lightningInvoice({
                    payment_request:
                        'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp',
                    creation_date: '1496314658',
                    expiry: '60'
                })
            )
        );

        const response = await (store as any).handleListTransactions(
            connection,
            { unpaid: true }
        );

        expect(connection.activity[0].status).toBe('expired');
        expect(response.result.transactions[0].state).toBe('expired');
    });

    describe('Cashu invoices', () => {
        const MINT = 'https://mint.example';
        const cashuRequest = 'lnbc1list-cashu';
        // The expiry is read from the decoded BOLT11: the BOLT11 spec
        // example, created in 2017 with a 60 second expiry
        const expiredRequest =
            'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp';
        // as stored: a plain object, without the CashuInvoice getters
        const storedCashuInvoice = (expired: boolean) => ({
            quote: 'quote-1',
            request: expired ? expiredRequest : cashuRequest,
            state: 'UNPAID',
            paid: false,
            mintUrl: MINT
        });

        function setupCashu({
            ageMs = 60_000,
            expired = false,
            configured = true
        }: { ageMs?: number; expired?: boolean; configured?: boolean } = {}) {
            const checkInvoicePaid = jest
                .fn()
                .mockResolvedValue({ isPaid: false });
            const { store } = createStore({
                cashuStore: {
                    isProperlyConfigured: () => configured,
                    checkInvoicePaid,
                    invoices: []
                }
            });
            store.cashuEnabled = configured;
            const connection = addConnection(store, {
                permissions: ['make_invoice', 'list_transactions'],
                activity: [
                    {
                        id: cashuRequest,
                        type: 'make_invoice',
                        payment_source: 'cashu',
                        status: 'pending',
                        satAmount: 1000,
                        invoice: storedCashuInvoice(expired),
                        createdAt: new Date(Date.now() - ageMs)
                    }
                ]
            });
            return { store, connection, checkInvoicePaid };
        }

        it('lists an expired Cashu make_invoice stored as a plain object as expired', async () => {
            const { store, connection } = setupCashu({ expired: true });

            const response = await (store as any).handleListTransactions(
                connection,
                { unpaid: true }
            );

            expect(connection.activity[0].status).toBe('expired');
            expect(response.result.transactions).toHaveLength(1);
            expect(response.result.transactions[0].state).toBe('expired');
        });

        it('looks up an expired Cashu make_invoice stored as a plain object as expired', async () => {
            const { store, connection } = setupCashu({ expired: true });

            const response = await (store as any).handleLookupInvoice(
                connection,
                { invoice: cashuRequest }
            );

            expect(response.error).toBeUndefined();
            expect(response.result.state).toBe('expired');
            expect(connection.activity[0].status).toBe('expired');
        });

        it('asks the mint about a pending invoice once it is old enough', async () => {
            const { store, connection, checkInvoicePaid } = setupCashu();

            await (store as any).handleListTransactions(connection, {});

            expect(checkInvoicePaid).toHaveBeenCalledTimes(1);
            expect(checkInvoicePaid.mock.calls[0][0]).toBe('quote-1');
        });

        it('does not ask the mint about an invoice younger than 5 seconds', async () => {
            const { store, connection, checkInvoicePaid } = setupCashu({
                ageMs: 1_000
            });

            await (store as any).handleListTransactions(connection, {});

            expect(checkInvoicePaid).not.toHaveBeenCalled();
        });

        it('asks the mint again only after 30 seconds', async () => {
            const { store, connection, checkInvoicePaid } = setupCashu();

            await (store as any).handleListTransactions(connection, {});
            await (store as any).handleListTransactions(connection, {});
            expect(checkInvoicePaid).toHaveBeenCalledTimes(1);

            await jest.advanceTimersByTimeAsync(29_000);
            await (store as any).handleListTransactions(connection, {});
            expect(checkInvoicePaid).toHaveBeenCalledTimes(1);

            await jest.advanceTimersByTimeAsync(1_000);
            await (store as any).handleListTransactions(connection, {});
            expect(checkInvoicePaid).toHaveBeenCalledTimes(2);
        });

        it('does not ask the mint when Cashu is not configured', async () => {
            const { store, connection, checkInvoicePaid } = setupCashu({
                configured: false
            });

            const response = await (store as any).handleListTransactions(
                connection,
                { unpaid: true }
            );

            expect(response.error).toBeUndefined();
            expect(checkInvoicePaid).not.toHaveBeenCalled();
            expect(response.result.transactions[0].state).toBe('pending');
        });
    });
});

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

describe('NostrWalletConnectStore make_invoice invoice isolation', () => {
    const deferred = () => {
        let resolve: (value: any) => void = () => {};
        const promise = new Promise((r) => (resolve = r));
        return { promise, resolve };
    };

    const setup = () => {
        const invoicesStore = new InvoicesStore(
            { settings: {} } as any,
            { resetFee: jest.fn(), flow_error: false } as any,
            {} as any,
            {} as any
        );
        (invoicesStore as any).getInvoices = jest.fn().mockResolvedValue([]);
        const { store } = createStore({ invoicesStore });
        const connection = addConnection(store, {
            permissions: ['make_invoice']
        });
        return { store, connection, invoicesStore };
    };

    beforeEach(() => {
        jest.spyOn(
            NostrConnectUtils,
            'decodeInvoiceTagsForMakeInvoice'
        ).mockImplementation(async (_paymentRequest, rHash) => ({
            paymentHash: rHash || '',
            descriptionHash: '',
            expiryTime: 4_000_000_000
        }));
        jest.spyOn(NostrConnectUtils, 'notifyNwcInvoiceReady').mockReturnValue(
            undefined as any
        );
    });

    it('answers overlapping make_invoice requests with their own invoices', async () => {
        const { store, connection } = setup();
        const first = deferred();
        const second = deferred();
        (BackendUtils.createInvoice as jest.Mock)
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);

        const a = (store as any).handleMakeInvoice(connection, {
            amount: 1000_000
        });
        const b = (store as any).handleMakeInvoice(connection, {
            amount: 2000_000
        });
        await flushMicrotasks();
        // both backend calls finish in the same tick
        first.resolve({ payment_request: 'lnbc-first', r_hash: 'aa' });
        second.resolve({ payment_request: 'lnbc-second', r_hash: 'bb' });

        const [responseA, responseB] = await Promise.all([a, b]);
        expect(responseA.error).toBeUndefined();
        expect(responseB.error).toBeUndefined();
        expect(responseA.result.invoice).toBe('lnbc-first');
        expect(responseB.result.invoice).toBe('lnbc-second');
    });

    it('does not replace the invoice shown on the Receive screen', async () => {
        const { store, connection, invoicesStore } = setup();
        invoicesStore.payment_request = 'lnbc-on-screen';
        (BackendUtils.createInvoice as jest.Mock).mockResolvedValue({
            payment_request: 'lnbc-nwc',
            r_hash: 'cc'
        });

        const response = await (store as any).handleMakeInvoice(connection, {
            amount: 1000_000
        });

        expect(response.result.invoice).toBe('lnbc-nwc');
        expect(invoicesStore.payment_request).toBe('lnbc-on-screen');
    });

    it('never fetches an on-chain address, even when the backend can receive on-chain', async () => {
        const { store, connection, invoicesStore } = setup();
        (BackendUtils.supportsOnchainReceiving as jest.Mock).mockReturnValue(
            true
        );
        invoicesStore.payment_request = 'lnbc-on-screen';
        invoicesStore.onChainAddress = 'bcrt1-on-screen';
        const getNewAddress = jest.fn().mockResolvedValue('bcrt1-nwc');
        (invoicesStore as any).getNewAddress = getNewAddress;
        (BackendUtils.createInvoice as jest.Mock).mockResolvedValue({
            payment_request: 'lnbc-nwc',
            r_hash: 'dd'
        });

        try {
            const response = await (store as any).handleMakeInvoice(
                connection,
                { amount: 1000_000 }
            );

            expect(response.result.invoice).toBe('lnbc-nwc');
            expect(getNewAddress).not.toHaveBeenCalled();
            expect(invoicesStore.onChainAddress).toBe('bcrt1-on-screen');
            expect(invoicesStore.payment_request).toBe('lnbc-on-screen');
        } finally {
            (
                BackendUtils.supportsOnchainReceiving as jest.Mock
            ).mockReturnValue(false);
        }
    });

    it('returns the backend error when the invoice cannot be created', async () => {
        const { store, connection, invoicesStore } = setup();
        (BackendUtils.createInvoice as jest.Mock).mockResolvedValue({
            error: true,
            message: 'node offline'
        });

        const response = await (store as any).handleMakeInvoice(connection, {
            amount: 1000_000
        });

        expect(response.error?.code).toBe(Nip47ErrorCode.INTERNAL_ERROR);
        expect(response.error?.message).toBe('node offline');
        expect(invoicesStore.error_msg).toBeFalsy();
        expect(connection.activity).toHaveLength(0);
    });
});

describe('NostrWalletConnectStore make_invoice from Cashu', () => {
    const deferred = () => {
        let resolve: (value: any) => void = () => {};
        const promise = new Promise((r) => (resolve = r));
        return { promise, resolve };
    };

    const MINT = 'https://mint.example';

    const setup = () => {
        const cashuStore = new CashuStore(
            { implementation: 'lnd', lndDir: 'node1', settings: {} } as any,
            {} as any,
            {} as any,
            {} as any
        );
        cashuStore.mintUrls = [MINT];
        cashuStore.selectedMintUrl = MINT;
        cashuStore.cashuWallets = {
            [MINT]: { walletId: MINT, pubkey: '', errorConnecting: false }
        } as any;
        cashuStore.invoices = [];
        const { store } = createStore({ cashuStore });
        // isCashuConfigured is a computed, so satisfy its inputs rather
        // than trying to redefine it
        store.cashuEnabled = true;
        const connection = addConnection(store, {
            permissions: ['make_invoice']
        });
        return { store, connection, cashuStore };
    };

    beforeEach(() => {
        jest.spyOn(
            NostrConnectUtils,
            'decodeInvoiceTagsForMakeInvoice'
        ).mockResolvedValue({
            paymentHash: '',
            descriptionHash: '',
            expiryTime: 4_000_000_000
        } as any);
        jest.spyOn(NostrConnectUtils, 'notifyNwcInvoiceReady').mockReturnValue(
            undefined as any
        );
    });

    it('answers overlapping make_invoice requests with their own invoices', async () => {
        const { store, connection, cashuStore } = setup();
        const first = deferred();
        const second = deferred();
        const createMintQuote = jest
            .fn()
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        cashuStore.createMintQuoteCDK = createMintQuote;
        const quote = (id: string, request: string) => ({
            id,
            request,
            state: 'Unpaid',
            expiry: 4_000_000_000
        });

        const a = (store as any).handleMakeInvoice(connection, {
            amount: 1000_000
        });
        const b = (store as any).handleMakeInvoice(connection, {
            amount: 2000_000
        });
        await flushMicrotasks();
        expect(createMintQuote).toHaveBeenCalledTimes(2);
        // the second request finishes first, so the first one is the
        // superseded call when its quote arrives
        second.resolve(quote('quote-second', 'lnbc-second'));
        first.resolve(quote('quote-first', 'lnbc-first'));

        const [responseA, responseB] = await Promise.all([a, b]);
        expect(responseA.error).toBeUndefined();
        expect(responseB.error).toBeUndefined();
        expect(responseA.result.invoice).toBe('lnbc-first');
        expect(responseB.result.invoice).toBe('lnbc-second');
        expect(connection.activity.map((entry) => entry.id).sort()).toEqual([
            'lnbc-first',
            'lnbc-second'
        ]);
    });

    it('list_transactions lists a Cashu invoice that was paid at the mint', async () => {
        const { store, connection, cashuStore } = setup();
        const request = 'lnbc1list-pending-cashu';
        const cashuInvoice = (paid: boolean) =>
            new CashuInvoice({
                quote: 'quote-list',
                request,
                state: paid ? 'PAID' : 'UNPAID',
                paid,
                mintUrl: MINT,
                expiry: Math.floor(Date.now() / 1000) + 3600
            } as any);
        connection.activity = [
            {
                id: request,
                type: 'make_invoice',
                payment_source: 'cashu',
                status: 'pending',
                satAmount: 1000,
                invoice: cashuInvoice(false),
                createdAt: new Date(Date.now() - 60_000)
            }
        ] as any;
        const checkInvoicePaid = jest
            .spyOn(cashuStore, 'checkInvoicePaid')
            .mockResolvedValue({
                isPaid: true,
                amtSat: '1000',
                updatedInvoice: cashuInvoice(true)
            } as any);

        const response = await (store as any).handleListTransactions(
            connection,
            {}
        );

        expect(checkInvoicePaid).toHaveBeenCalledTimes(1);
        expect(response.error).toBeUndefined();
        expect(response.result.transactions).toHaveLength(1);
        expect(response.result.transactions[0]).toMatchObject({
            type: 'incoming',
            state: 'settled'
        });
        expect(connection.activity[0].status).toBe('success');
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

    // The connections list reloads the connections on every focus, which
    // replaces the stored objects
    it('debits the stored connection when a reload lands while the node payments are fetched', async () => {
        const invoice = 'lnbc1timeout-reload-during-fetch';
        const paymentHash = hex64('5');
        const paymentsStore = {
            payments: [] as Payment[],
            getPayments: jest.fn(async () => [])
        };
        const {
            store,
            connections: [connection]
        } = await startService(
            [
                {
                    maxAmountSats: 20000,
                    activity: [timeoutFailedActivity(invoice, { paymentHash })]
                }
            ],
            { paymentsStore }
        );
        // Let the next reconcile fetch from the node again
        (store as any).lastPendingPaymentStatusFetchByConnection.clear();
        const fetched = holdNextCall<Payment[]>(paymentsStore.getPayments);

        const reconcile = (store as any).reconcilePendingPayInvoiceActivities(
            connection
        );
        await fetched.entered;
        await store.loadConnections();
        const [reloaded] = store.connections;
        expect(reloaded).not.toBe(connection);
        paymentsStore.payments = [
            new Payment({
                payment_request: invoice,
                payment_hash: paymentHash,
                status: 'SUCCEEDED',
                value_sat: 10000,
                fee_sat: '50',
                payment_preimage: hex64('9')
            })
        ];
        fetched.release(paymentsStore.payments);
        expect(await reconcile).toBe(true);

        expect(store.connections[0]).toBe(reloaded);
        expect(reloaded.activity[0].status).toBe('success');
        expect(reloaded.totalSpendSats).toBe(10050);
        await jest.advanceTimersByTimeAsync(1000);
        expect(persistedConnections()[0].totalSpendSats).toBe(10050);
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

    it('keeps the hold when a payment listed as failed still has an HTLC in flight', async () => {
        // matches both isListedPaymentFailed (FAILED status) and
        // isListedPaymentInTransit (open HTLC), so this only holds if in
        // transit is checked first
        const invoice = 'lnbc1lnd-failed-htlc-out';
        const paymentHash = hex64('7');
        const { store } = storeWithNodePayments([
            new Payment({
                payment_request: invoice,
                payment_hash: paymentHash,
                status: 'FAILED',
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

    it('keeps an unlisted hold after its invoice has expired', async () => {
        const { store } = storeWithNodePayments([]);
        const hour = 60 * 60 * 1000;
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [
                {
                    id: 'lnbc1expired-invoice-hold',
                    type: 'pay_invoice',
                    payment_source: 'lightning',
                    status: 'pending',
                    satAmount: 10000,
                    createdAt: new Date(Date.now() - 25 * hour),
                    expiresAt: new Date(Date.now() - 25 * hour + 600_000)
                }
            ]
        });

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(connection.activity[0].status).toBe('pending');
        expect(connection.pendingSpendSats).toBe(10000);
        expect(connection.canSpend(1)).toBe(false);
    });
});

describe('NostrWalletConnectStore targeted pending payment lookup', () => {
    const invoice = 'lnbc1targeted-lookup';
    const paymentHash = hex64('d');

    const pendingActivity = (overrides: Record<string, unknown> = {}) => ({
        id: invoice,
        type: 'pay_invoice',
        payment_source: 'lightning',
        status: 'pending',
        satAmount: 10000,
        paymentHash,
        createdAt: new Date(Date.now() - 60_000),
        ...overrides
    });

    const seedPending = (
        store: NostrWalletConnectStore,
        activityOverrides: Record<string, unknown> = {}
    ) =>
        addConnection(store, {
            maxAmountSats: 10000,
            activity: [pendingActivity(activityOverrides)]
        });

    beforeEach(() => {
        (BackendUtils.supportsPaymentLookup as jest.Mock).mockReturnValue(true);
    });

    it('settles a pending pay_invoice via lookupPayment without fetching the payment list', async () => {
        const { store, paymentsStore } = createStore();
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            payment_hash: paymentHash,
            status: 'SUCCEEDED',
            value_sat: 10000,
            fee_sat: '50',
            payment_preimage: hex64('9')
        });
        const connection = seedPending(store);

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        // a short track probe: an in-flight payment holds LND REST's
        // track request open past list_transactions' 10s client timeout
        expect(BackendUtils.lookupPayment).toHaveBeenCalledWith({
            payment_hash: paymentHash,
            trackTimeoutMs: 2000
        });
        expect(paymentsStore.getPayments).not.toHaveBeenCalled();
        expect(connection.activity[0].status).toBe('success');
        expect(connection.activity[0].isBudgetDebited).toBe(true);
        expect(connection.totalSpendSats).toBe(10050);
    });

    it('falls back to the payment list scan when the backend has no lookup', async () => {
        const { store, paymentsStore } = createStore();
        (BackendUtils.supportsPaymentLookup as jest.Mock).mockReturnValue(
            false
        );
        const connection = seedPending(store);

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(BackendUtils.lookupPayment).not.toHaveBeenCalled();
        expect(paymentsStore.getPayments).toHaveBeenCalled();
        expect(connection.activity[0].status).toBe('pending');
    });

    it('falls back to the payment list scan when a pending activity lacks a payment hash', async () => {
        const { store, paymentsStore } = createStore();
        const connection = seedPending(store, { paymentHash: undefined });

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(BackendUtils.lookupPayment).not.toHaveBeenCalled();
        expect(paymentsStore.getPayments).toHaveBeenCalled();
    });

    it('falls back to the payment list scan when a lookup fails', async () => {
        const { store, paymentsStore } = createStore();
        (BackendUtils.lookupPayment as jest.Mock).mockRejectedValue(
            new Error('node unreachable')
        );
        const connection = seedPending(store);

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(paymentsStore.getPayments).toHaveBeenCalled();
        expect(connection.activity[0].status).toBe('pending');
    });

    it('leaves a recent pending hold untouched when the node has no record', async () => {
        const { store, paymentsStore } = createStore();
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue(null);
        const connection = seedPending(store);

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(paymentsStore.getPayments).not.toHaveBeenCalled();
        expect(connection.activity[0].status).toBe('pending');
        expect(connection.pendingSpendSats).toBe(10000);
    });

    it('looks up each unique hash once for duplicate pending activities', async () => {
        const { store } = createStore();
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue(null);
        const connection = addConnection(store, {
            maxAmountSats: 10000,
            activity: [
                pendingActivity({ satAmount: 5000 }),
                pendingActivity({ id: `${invoice}-retry`, satAmount: 5000 })
            ]
        });

        await (store as any).reconcilePendingPayInvoiceActivities(connection);

        expect(BackendUtils.lookupPayment).toHaveBeenCalledTimes(1);
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
                sendPaymentSilently: jest.fn().mockResolvedValue({}),
                getPaymentOutcome: jest.fn().mockReturnValue({}),
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
            permissions: ['pay_invoice'],
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
            { invoice },
            () => true
        );

        expect(transactionsStore.sendPaymentSilently).not.toHaveBeenCalled();
        expect(response.error).toBeUndefined();
        expect(response.result?.preimage).toBe('');
        expect(connection.activity[0].status).toBe('pending');
        expect(connection.pendingSpendSats).toBe(5000);
    });

    it('finalizes and debits when the payment errors but the node lists settlement', async () => {
        const settled = new Payment({
            payment_request: invoice,
            payment_hash: paymentHash,
            status: 'SUCCEEDED',
            value_sat: 5000,
            fee_sat: '10',
            payment_preimage: hex64('d')
        });
        const { store, transactionsStore } = buildHandlerStore([settled]);
        transactionsStore.getPaymentOutcome.mockReturnValue({
            payment_hash: paymentHash,
            payment_error: 'views.SendingLightning.paymentTimedOut',
            status: 'FAILED',
            isIncomplete: true
        });
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice },
            () => true
        );

        expect(transactionsStore.sendPaymentSilently).toHaveBeenCalled();
        expect(response.error).toBeUndefined();
        expect(response.result?.preimage).toBe(hex64('d'));
        expect(connection.activity[0].status).toBe('success');
        expect(connection.activity[0].isBudgetDebited).toBe(true);
        expect(connection.totalSpendSats).toBe(5010);
    });

    it("answers with its own payment's result, not the shared store's", async () => {
        const { store, transactionsStore } = buildHandlerStore();
        // a payment the user made from the wallet UI meanwhile
        Object.assign(transactionsStore, {
            payment_hash: hex64('a'),
            payment_preimage: hex64('b'),
            payment_fee: '7',
            status: 'SUCCEEDED',
            isIncomplete: false
        });
        transactionsStore.getPaymentOutcome.mockReturnValue({
            payment_hash: paymentHash,
            payment_preimage: hex64('d'),
            payment_fee: '10',
            status: 'SUCCEEDED',
            isIncomplete: false
        });
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice },
            () => true
        );

        expect(response.result?.preimage).toBe(hex64('d'));
        expect(connection.activity[0].paymentHash).toBe(paymentHash);
        expect(connection.totalSpendSats).toBe(5010);
        expect(transactionsStore.sendPaymentSilently).toHaveBeenCalledWith({
            payment_request: invoice,
            amount: undefined,
            max_parts: '1',
            fee_limit_sat: 1000,
            timeout_seconds: 120
        });
        // the user's payment screen is left alone
        expect(transactionsStore.reset).not.toHaveBeenCalled();
        expect(transactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(transactionsStore.payment_preimage).toBe(hex64('b'));
    });

    it('records its payment as pending while it is held, whatever the shared store shows', async () => {
        jest.useFakeTimers();
        try {
            const { store, transactionsStore } = buildHandlerStore();
            // the payment stays out for the whole wait
            transactionsStore.sendPaymentSilently.mockReturnValue(
                new Promise(() => {})
            );
            const connection = addConnection(store, {
                permissions: ['pay_invoice'],
                maxAmountSats: 100000
            });

            let settled = false;
            const pendingResponse = (store as any)
                .handleLightningPayInvoice(connection, { invoice }, () => true)
                .finally(() => {
                    settled = true;
                });
            await jest.advanceTimersByTimeAsync(10_000);

            // a payment the user made from the wallet UI settles meanwhile
            Object.assign(transactionsStore, {
                loading: false,
                payment_hash: hex64('a'),
                payment_preimage: hex64('b'),
                payment_fee: '7',
                status: 'SUCCEEDED',
                isIncomplete: false
            });

            // the request waits out the 125 s ceiling
            await jest.advanceTimersByTimeAsync(114_999);
            expect(settled).toBe(false);
            await jest.advanceTimersByTimeAsync(1);
            expect(settled).toBe(true);
            const response = await pendingResponse;

            expect(response.error).toBeUndefined();
            expect(response.result).toEqual({ preimage: '', fees_paid: 0 });
            expect(connection.activity[0].status).toBe('pending');
            expect(connection.activity[0].paymentHash).toBe(paymentHash);
            // the amount plus the 1000 sat fee cap held while pending
            expect(connection.pendingSpendSats).toBe(6000);
            expect(connection.totalSpendSats).toBe(0);
        } finally {
            jest.useRealTimers();
        }
    });

    it('fails the request when its own payment is rejected', async () => {
        const { store, transactionsStore } = buildHandlerStore();
        Object.assign(transactionsStore, {
            payment_hash: hex64('a'),
            payment_preimage: hex64('b'),
            status: 'SUCCEEDED'
        });
        transactionsStore.sendPaymentSilently.mockRejectedValue(
            new Error('no route')
        );
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice },
            () => true
        );

        expect(response.result).toBeUndefined();
        expect(response.error?.code).toBe(Nip47ErrorCode.FAILED_TO_PAY_INVOICE);
        expect(response.error?.message).toBe('no route');
        expect(connection.activity[0].status).toBe('failed');
        expect(connection.activity[0].error).toBe('no route');
        expect(connection.totalSpendSats).toBe(0);
    });
});

// Backend calls go to whichever wallet is active when they are made, so a
// pay request that outlives a wallet switch must not read the balance of,
// or pay from, the wallet switched to.
describe('NostrWalletConnectStore pay_invoice across a wallet switch', () => {
    const invoice = 'lnbc1wallet-switch';
    const invoiceTags = {
        paymentRequest: invoice,
        paymentHash: hex64('c'),
        descriptionHash: '',
        description: '',
        amount: 5000,
        expiryTime: 0,
        createdAt: 0,
        isExpired: false,
        network: 'bitcoin'
    };

    beforeEach(() => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            timestamp: String(Math.floor(Date.now() / 1000) - 60),
            expiry: '3600'
        });
        jest.spyOn(NostrConnectUtils, 'decodeInvoiceTags').mockResolvedValue(
            invoiceTags
        );
        jest.spyOn(
            NostrConnectUtils,
            'resolvePayInvoiceAmount'
        ).mockResolvedValue({ amountSats: 5000, zeroAmountInvoice: false });
    });

    const payCollaborators = () => ({
        transactionsStore: {
            reset: jest.fn(),
            sendPaymentSilently: jest.fn().mockResolvedValue({}),
            getPaymentOutcome: jest.fn().mockReturnValue({}),
            loading: false
        },
        paymentsStore: {
            payments: [],
            getPayments: jest.fn().mockResolvedValue([])
        }
    });

    const SWITCHED = {
        result: undefined,
        error: {
            code: 'INTERNAL_ERROR',
            message:
                'stores.NostrWalletConnectStore.error.walletIdentityUnavailable'
        }
    };

    it('does not pay when the wallet is switched while the invoice is decoded', async () => {
        const { store, settingsStore, balanceStore, transactionsStore } =
            createStore(payCollaborators());
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });
        (BackendUtils.decodePaymentRequest as jest.Mock).mockImplementation(
            async () => {
                settingsStore.connectionSeq++;
                return {};
            }
        );

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice },
            settingsStore.getConnectionGuard()
        );

        expect(response).toEqual(SWITCHED);
        expect(balanceStore.getLightningBalance).not.toHaveBeenCalled();
        expect(transactionsStore.sendPaymentSilently).not.toHaveBeenCalled();
        expect(connection.activity).toEqual([]);
    });

    it('does not pay when the wallet is switched while the balance is read', async () => {
        const { store, settingsStore, balanceStore, transactionsStore } =
            createStore(payCollaborators());
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });
        balanceStore.getLightningBalance.mockImplementation(async () => {
            settingsStore.connectionSeq++;
            return { lightningBalance: 100000 };
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice },
            settingsStore.getConnectionGuard()
        );

        expect(response).toEqual(SWITCHED);
        expect(transactionsStore.sendPaymentSilently).not.toHaveBeenCalled();
    });

    // The reconcile would read the newly selected wallet's payments, which
    // do not list this connection's payment, and release its hold
    it('does not reconcile a pending payment when the wallet is switched while the invoice is decoded', async () => {
        const { store, settingsStore, paymentsStore } = createStore(
            payCollaborators()
        );
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000,
            activity: [
                {
                    id: 'lnbc1earlier',
                    type: 'pay_invoice',
                    payment_source: 'lightning',
                    status: 'pending',
                    satAmount: 1000,
                    createdAt: new Date(
                        Date.now() -
                            NostrConnectUtils.UNRESOLVED_PAY_INVOICE_MAX_AGE_MS -
                            1000
                    )
                }
            ]
        });
        (BackendUtils.decodePaymentRequest as jest.Mock).mockImplementation(
            async () => {
                settingsStore.connectionSeq++;
                return {};
            }
        );

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice },
            settingsStore.getConnectionGuard()
        );

        expect(response).toEqual(SWITCHED);
        expect(paymentsStore.getPayments).not.toHaveBeenCalled();
        expect(connection.activity[0].status).toBe('pending');
        expect(connection.pendingSpendSats).toBe(1000);
    });

    it('does not read the balance when the wallet is switched while the invoice tags are decoded', async () => {
        const { store, settingsStore, balanceStore, transactionsStore } =
            createStore(payCollaborators());
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });
        jest.spyOn(NostrConnectUtils, 'decodeInvoiceTags').mockImplementation(
            async () => {
                settingsStore.connectionSeq++;
                return invoiceTags;
            }
        );

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice },
            settingsStore.getConnectionGuard()
        );

        expect(response).toEqual(SWITCHED);
        expect(balanceStore.getLightningBalance).not.toHaveBeenCalled();
        expect(transactionsStore.sendPaymentSilently).not.toHaveBeenCalled();
    });

    it('does not pay when the connection no longer belongs to the active wallet', async () => {
        const { store, settingsStore, nodeInfoStore, transactionsStore } =
            createStore(payCollaborators());
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });
        nodeInfoStore.nodeInfo = { nodeId: 'another-node-pubkey' };

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice },
            settingsStore.getConnectionGuard()
        );

        expect(response).toEqual(SWITCHED);
        expect(transactionsStore.sendPaymentSilently).not.toHaveBeenCalled();
    });

    it('does not run a request queued behind another payment after a switch', async () => {
        const {
            settingsStore,
            transactionsStore,
            connections: [connection]
        } = await startService(
            [{ permissions: ['pay_invoice'], maxAmountSats: 100000 }],
            payCollaborators()
        );
        const client = clientFor(connection);
        const firstPayment = holdNextCall<any>(
            transactionsStore.sendPaymentSilently
        );

        const first = client.payInvoice({ invoice });
        await firstPayment.entered;
        const queued = client.payInvoice({ invoice: 'lnbc1queued' });
        await flushMicrotasks();
        settingsStore.connectionSeq++;
        firstPayment.release({});
        await first;

        expect(await queued).toEqual(SWITCHED);
        expect(BackendUtils.decodePaymentRequest).not.toHaveBeenCalledWith([
            'lnbc1queued'
        ]);
        expect(transactionsStore.sendPaymentSilently).toHaveBeenCalledTimes(1);
    });

    describe('when the wallet list changes', () => {
        const wallet = (host: string) => ({
            implementation: 'lnd',
            host,
            port: '8080'
        });
        const [W0, W1, W2, W3] = ['w0', 'w1', 'w2', 'w3'].map((name) =>
            wallet(`${name}.example`)
        );

        // Subscribed while W2, the third of three wallets, is selected
        const startOnW2 = () => {
            const { settingsStore } = createCollaborators();
            settingsStore.settings = {
                ...settingsStore.settings,
                nodes: [W0, W1, W2],
                selectedNode: 2
            };
            const collaborators = payCollaborators();
            collaborators.transactionsStore.getPaymentOutcome.mockReturnValue({
                payment_preimage: 'aa'.repeat(32),
                payment_fee: 3
            });
            return startService(
                [{ permissions: ['pay_invoice'], maxAmountSats: 100000 }],
                { ...collaborators, settingsStore }
            );
        };

        // Deleting an inactive wallet changes only the settings: no
        // reconnect and no resubscribe
        const replaceWallets = (
            settingsStore: any,
            nodes: object[],
            selectedNode: number
        ) => {
            settingsStore.settings = {
                ...settingsStore.settings,
                nodes,
                selectedNode
            };
        };

        it('pays after a wallet listed above the selected one is deleted', async () => {
            const {
                settingsStore,
                transactionsStore,
                connections: [connection]
            } = await startOnW2();
            replaceWallets(settingsStore, [W1, W2], 1);

            const response = await clientFor(connection).payInvoice({
                invoice
            });

            expect(response.error).toBeUndefined();
            expect(transactionsStore.sendPaymentSilently).toHaveBeenCalledTimes(
                1
            );
        });

        it('does not pay when another wallet is selected without a reconnect', async () => {
            const {
                settingsStore,
                transactionsStore,
                connections: [connection]
            } = await startOnW2();
            replaceWallets(settingsStore, [W0, W1, W2], 0);

            const response = await clientFor(connection).payInvoice({
                invoice
            });

            expect(response).toEqual(SWITCHED);
            expect(
                transactionsStore.sendPaymentSilently
            ).not.toHaveBeenCalled();
        });

        it('does not pay when another wallet takes the selected index', async () => {
            const {
                settingsStore,
                transactionsStore,
                connections: [connection]
            } = await startOnW2();
            replaceWallets(settingsStore, [W0, W1, W3], 2);

            const response = await clientFor(connection).payInvoice({
                invoice
            });

            expect(response).toEqual(SWITCHED);
            expect(
                transactionsStore.sendPaymentSilently
            ).not.toHaveBeenCalled();
        });
    });

    // The connections list reloads the connections on every focus, which
    // replaces the stored objects without resubscribing
    it('pays and debits the stored connection after the connections are reloaded', async () => {
        const collaborators = payCollaborators();
        collaborators.transactionsStore.getPaymentOutcome.mockReturnValue({
            payment_preimage: 'aa'.repeat(32),
            payment_fee: 3
        });
        const {
            store,
            transactionsStore,
            connections: [subscribed]
        } = await startService(
            [{ permissions: ['pay_invoice'], maxAmountSats: 100000 }],
            collaborators
        );
        await store.loadConnections();
        const [reloaded] = store.connections;
        expect(reloaded).not.toBe(subscribed);

        const response = await clientFor(subscribed).payInvoice({ invoice });

        expect(response.error).toBeUndefined();
        expect(transactionsStore.sendPaymentSilently).toHaveBeenCalledTimes(1);
        expect(reloaded.totalSpendSats).toBe(5003);
        expect(reloaded.activity).toHaveLength(1);
        expect(subscribed.activity).toEqual([]);
    });

    describe('other requests after the connections are reloaded', () => {
        const BUDGET_SATS = 100000;
        const PAID_SATS = 5003;

        beforeEach(() => {
            jest.spyOn(
                NostrConnectUtils,
                'decodeInvoiceTagsForMakeInvoice'
            ).mockResolvedValue({
                paymentHash: hex64('d'),
                descriptionHash: '',
                expiryTime: 4_000_000_000
            });
        });

        // Subscribes, reloads the connections (as the connections list
        // does on focus), then pays through the subscribed handler
        const payAfterReload = async (
            permissions: string[],
            overrides: Record<string, any> = {}
        ) => {
            const collaborators = payCollaborators();
            collaborators.transactionsStore.getPaymentOutcome.mockReturnValue({
                payment_preimage: 'aa'.repeat(32),
                payment_fee: 3
            });
            const harness = await startService(
                [{ permissions, maxAmountSats: BUDGET_SATS }],
                {
                    ...collaborators,
                    invoicesStore: {
                        invoices: [],
                        createUnifiedInvoice: jest.fn().mockResolvedValue({
                            paymentRequest: 'lnbc1made-after-reload',
                            rHash: hex64('d')
                        }),
                        getInvoices: jest.fn().mockResolvedValue([])
                    },
                    ...overrides
                }
            );
            const [subscribed] = harness.connections;
            await harness.store.loadConnections();
            const [reloaded] = harness.store.connections;
            expect(reloaded).not.toBe(subscribed);

            const paid = await clientFor(subscribed).payInvoice({ invoice });
            expect(paid.error).toBeUndefined();
            expect(reloaded.totalSpendSats).toBe(PAID_SATS);

            return { ...harness, subscribed, reloaded };
        };

        it('keeps the pay debit when make_invoice records its activity', async () => {
            const { store, subscribed, reloaded } = await payAfterReload([
                'pay_invoice',
                'make_invoice'
            ]);

            const made = await clientFor(subscribed).makeInvoice({
                amount: 1000_000
            });

            expect(made.error).toBeUndefined();
            expect(store.connections[0] === reloaded).toBe(true);
            expect(reloaded.totalSpendSats).toBe(PAID_SATS);
            expect(reloaded.activity.map((a) => a.type)).toEqual([
                'pay_invoice',
                'make_invoice'
            ]);

            await jest.advanceTimersByTimeAsync(1000);
            const [persisted] = persistedConnections();
            expect(persisted.totalSpendSats).toBe(PAID_SATS);
            expect(persisted.activity).toHaveLength(2);

            // as after an app restart
            await store.loadConnections();
            expect(store.connections[0].totalSpendSats).toBe(PAID_SATS);
        });

        it('records make_invoice on the stored connection when a reload lands while the invoice is created', async () => {
            const { store, subscribed, invoicesStore } = await payAfterReload([
                'pay_invoice',
                'make_invoice'
            ]);
            await jest.advanceTimersByTimeAsync(1000);
            const created = holdNextCall(invoicesStore.createUnifiedInvoice);

            const making = clientFor(subscribed).makeInvoice({
                amount: 1000_000
            });
            await created.entered;
            const [beforeReload] = store.connections;
            await store.loadConnections();
            const [reloadedAgain] = store.connections;
            expect(reloadedAgain).not.toBe(beforeReload);
            created.release({
                paymentRequest: 'lnbc1made-after-reload',
                rHash: hex64('d')
            });
            const made = await making;

            expect(made.error).toBeUndefined();
            expect(store.connections[0] === reloadedAgain).toBe(true);
            expect(reloadedAgain.totalSpendSats).toBe(PAID_SATS);
            expect(reloadedAgain.activity.map((a) => a.type)).toEqual([
                'pay_invoice',
                'make_invoice'
            ]);
        });

        it('debits the stored connection when a reload lands while the payment is sent', async () => {
            const { store, subscribed, transactionsStore } =
                await payAfterReload(['pay_invoice']);
            await jest.advanceTimersByTimeAsync(1000);
            const sent = holdNextCall(transactionsStore.sendPaymentSilently);
            (
                NostrConnectUtils.decodeInvoiceTags as jest.Mock
            ).mockResolvedValue({
                paymentRequest: 'lnbc1second-payment',
                paymentHash: hex64('e'),
                descriptionHash: '',
                description: '',
                amount: 5000,
                expiryTime: 0,
                createdAt: 0,
                isExpired: false,
                network: 'bitcoin'
            });

            const paying = clientFor(subscribed).payInvoice({
                invoice: 'lnbc1second-payment'
            });
            await sent.entered;
            await store.loadConnections();
            const [reloadedAgain] = store.connections;
            sent.release({});
            const paid = await paying;

            expect(paid.error).toBeUndefined();
            expect(store.connections[0] === reloadedAgain).toBe(true);
            expect(reloadedAgain.totalSpendSats).toBe(2 * PAID_SATS);
            expect(reloadedAgain.activity).toHaveLength(2);
        });

        // Pays a second invoice and reloads the connections while the
        // request waits on `hold`. `editStored` changes the stored copy
        // the reload reads.
        const reloadWhilePaying = async (
            hold: (harness: any) => jest.Mock,
            editStored: (stored: any) => any = (stored) => stored
        ) => {
            const harness = await payAfterReload(['pay_invoice']);
            const { store, subscribed } = harness;
            await jest.advanceTimersByTimeAsync(1000);
            (
                NostrConnectUtils.decodeInvoiceTags as jest.Mock
            ).mockResolvedValue({
                paymentRequest: 'lnbc1second-payment',
                paymentHash: hex64('e'),
                descriptionHash: '',
                description: '',
                amount: 5000,
                expiryTime: 0,
                createdAt: 0,
                isExpired: false,
                network: 'bitcoin'
            });
            const held = hold(harness);
            const waiting = createHold<any>();
            held.mockImplementationOnce(async (...args: any[]) => {
                await waiting.wait();
                return held.getMockImplementation()!(...args);
            });
            const sendsBefore =
                harness.transactionsStore.sendPaymentSilently.mock.calls.length;

            const paying = clientFor(subscribed).payInvoice({
                invoice: 'lnbc1second-payment'
            });
            await settle(waiting.entered);
            storedItems.set(
                NWC_CONNECTIONS_KEY,
                JSON.stringify(persistedConnections().map(editStored))
            );
            await store.loadConnections();
            const [reloadedAgain] = store.connections;
            waiting.release(undefined);
            const paid = await settle(paying);
            const sends =
                harness.transactionsStore.sendPaymentSilently.mock.calls
                    .length - sendsBefore;

            return { ...harness, paid, reloadedAgain, sends };
        };

        it('pays when a reload lands while the invoice is decoded', async () => {
            const { store, paid, reloadedAgain, sends } =
                await reloadWhilePaying(
                    () => BackendUtils.decodePaymentRequest as jest.Mock
                );

            expect(paid.error).toBeUndefined();
            expect(sends).toBe(1);
            expect(store.connections[0]).toBe(reloadedAgain);
            expect(reloadedAgain.totalSpendSats).toBe(2 * PAID_SATS);
        });

        it('pays when a reload lands while the balance is read', async () => {
            const { store, paid, reloadedAgain, sends } =
                await reloadWhilePaying(
                    ({ balanceStore }) => balanceStore.getLightningBalance
                );

            expect(paid.error).toBeUndefined();
            expect(sends).toBe(1);
            expect(store.connections[0]).toBe(reloadedAgain);
            expect(reloadedAgain.totalSpendSats).toBe(2 * PAID_SATS);
        });

        it('does not pay when the reloaded connection no longer has pay_invoice', async () => {
            const { paid, reloadedAgain, sends } = await reloadWhilePaying(
                ({ balanceStore }) => balanceStore.getLightningBalance,
                (stored) => ({ ...stored, permissions: ['get_balance'] })
            );

            expect(paid).toEqual(PAY_RESTRICTED);
            expect(sends).toBe(0);
            expect(reloadedAgain.totalSpendSats).toBe(PAID_SATS);
        });

        it('does not pay when the reloaded connection has another client pubkey', async () => {
            const { paid, reloadedAgain, sends } = await reloadWhilePaying(
                ({ balanceStore }) => balanceStore.getLightningBalance,
                (stored) => ({ ...stored, pubkey: hex64('f') })
            );

            expect(paid).toEqual(UNAUTHORIZED);
            expect(sends).toBe(0);
            expect(reloadedAgain.totalSpendSats).toBe(PAID_SATS);
        });

        it('does not pay when the reloaded connection belongs to another node', async () => {
            const { paid, sends } = await reloadWhilePaying(
                ({ balanceStore }) => balanceStore.getLightningBalance,
                (stored) => ({ ...stored, nodePubkey: 'another-node' })
            );

            expect(paid.error).toBeDefined();
            expect(sends).toBe(0);
        });

        it('reports the budget left after the pay debit from get_balance', async () => {
            const { subscribed } = await payAfterReload([
                'pay_invoice',
                'get_balance'
            ]);

            const balance = await clientFor(subscribed).getBalance();

            expect(balance).toEqual({
                result: { balance: (BUDGET_SATS - PAID_SATS) * 1000 },
                error: undefined
            });
        });

        it('finds the payment made after the reload with lookup_invoice', async () => {
            const { subscribed } = await payAfterReload([
                'pay_invoice',
                'lookup_invoice'
            ]);

            const found = await clientFor(subscribed).lookupInvoice({
                payment_hash: hex64('c')
            });

            expect(found.error).toBeUndefined();
            expect(found.result?.payment_hash).toBe(hex64('c'));
        });

        it('lists the payment made after the reload with list_transactions', async () => {
            const { subscribed } = await payAfterReload([
                'pay_invoice',
                'list_transactions'
            ]);

            const listed = await clientFor(subscribed).listTransactions({});

            expect(listed.error).toBeUndefined();
            expect(listed.result?.transactions).toHaveLength(1);
            expect(listed.result?.transactions[0].payment_hash).toBe(
                hex64('c')
            );
        });

        it('applies an edit to the stored connection when a reload lands while it waits for a request', async () => {
            const { store, subscribed, invoicesStore } = await payAfterReload([
                'pay_invoice',
                'make_invoice'
            ]);
            await jest.advanceTimersByTimeAsync(1000);
            const created = holdNextCall(invoicesStore.createUnifiedInvoice);
            const making = clientFor(subscribed).makeInvoice({
                amount: 1000_000
            });
            await created.entered;

            const updating = store.updateConnection(subscribed.id, {
                name: 'Renamed'
            });
            await flushMicrotasks();
            await store.loadConnections();
            const [reloadedAgain] = store.connections;
            created.release({
                paymentRequest: 'lnbc1made-after-reload',
                rHash: hex64('d')
            });
            await making;
            const updated = await updating;

            expect(updated.success).toBe(true);
            expect(store.connections[0] === reloadedAgain).toBe(true);
            expect(reloadedAgain.name).toBe('Renamed');
            expect(reloadedAgain.totalSpendSats).toBe(PAID_SATS);
            expect(reloadedAgain.activity).toHaveLength(2);

            await jest.advanceTimersByTimeAsync(1000);
            const [persisted] = persistedConnections();
            expect(persisted.name).toBe('Renamed');
            expect(persisted.totalSpendSats).toBe(PAID_SATS);
        });

        it('keeps the pay debit when list_transactions settles an earlier payment', async () => {
            const earlier = 'lnbc1settled-while-offline';
            const collaborators = payCollaborators();
            collaborators.transactionsStore.getPaymentOutcome.mockReturnValue({
                payment_preimage: 'aa'.repeat(32),
                payment_fee: 3
            });
            const { store, connections, paymentsStore } = await startService(
                [
                    {
                        permissions: ['pay_invoice', 'list_transactions'],
                        maxAmountSats: BUDGET_SATS,
                        activity: [
                            {
                                id: earlier,
                                type: 'pay_invoice',
                                payment_source: 'lightning',
                                status: 'failed',
                                satAmount: 1000,
                                paymentHash: hex64('f'),
                                error: 'views.SendingLightning.paymentTimedOut',
                                createdAt: new Date(Date.now() - 60_000)
                            }
                        ]
                    }
                ],
                collaborators
            );
            const [subscribed] = connections;
            await store.loadConnections();
            const [reloaded] = store.connections;
            await clientFor(subscribed).payInvoice({ invoice });
            expect(reloaded.totalSpendSats).toBe(PAID_SATS);
            // the node now lists the earlier payment as settled
            paymentsStore.payments = [
                new Payment({
                    payment_request: earlier,
                    payment_hash: hex64('f'),
                    status: 'SUCCEEDED',
                    value_sat: 1000,
                    fee_sat: '0',
                    payment_preimage: hex64('9')
                })
            ];

            const listed = await clientFor(subscribed).listTransactions({});

            expect(listed.error).toBeUndefined();
            expect(store.connections[0] === reloaded).toBe(true);
            expect(reloaded.totalSpendSats).toBe(PAID_SATS + 1000);
            expect(
                reloaded.activity.find((a) => a.id === earlier)?.status
            ).toBe('success');
        });
    });

    it('does not melt ecash when the wallet is switched before the request starts', async () => {
        const payLnInvoiceFromEcash = jest.fn();
        const { store, settingsStore } = createStore({
            cashuStore: {
                selectedMintUrl: 'https://mint.example',
                isProperlyConfigured: () => true,
                getPayReq: jest.fn(),
                payLnInvoiceFromEcash
            }
        });
        store.cashuEnabled = true;
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });
        const isCurrent = settingsStore.getConnectionGuard();
        settingsStore.connectionSeq++;

        const response = await (store as any).handleCashuPayInvoice(
            connection,
            { invoice },
            isCurrent
        );

        expect(response).toEqual(SWITCHED);
        expect(payLnInvoiceFromEcash).not.toHaveBeenCalled();
    });

    it('does not melt ecash when the wallet is switched while the invoice is decoded', async () => {
        jest.spyOn(
            NostrConnectUtils,
            'getPayInvoiceAmountSats'
        ).mockResolvedValue(5000);
        const payLnInvoiceFromEcash = jest.fn();
        const { store, settingsStore, cashuStore } = createStore({
            cashuStore: {
                selectedMintUrl: 'https://mint.example',
                isProperlyConfigured: () => true,
                totalBalanceSats: 100_000,
                paymentRequest: invoice,
                payReq: new Invoice({
                    payment_request: invoice,
                    num_satoshis: '5000'
                } as any),
                getPayReqError: null,
                getPayReq: jest.fn(),
                payLnInvoiceFromEcash
            }
        });
        cashuStore.getPayReq.mockImplementation(async () => {
            settingsStore.connectionSeq++;
        });
        store.cashuEnabled = true;
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });

        const response = await (store as any).handleCashuPayInvoice(
            connection,
            { invoice },
            settingsStore.getConnectionGuard()
        );

        expect(cashuStore.getPayReq).toHaveBeenCalledWith(invoice);
        expect(response).toEqual(SWITCHED);
        expect(payLnInvoiceFromEcash).not.toHaveBeenCalled();
    });

    describe('and a connection delete or update', () => {
        // Starts one payment and holds it at the node, then queues a second
        // request on the same connection behind it
        const queueBehindPayment = async () => {
            const harness = await startService(
                [{ permissions: ['pay_invoice'], maxAmountSats: 100000 }],
                payCollaborators()
            );
            const [connection] = harness.connections;
            const client = clientFor(connection);
            const firstPayment = holdNextCall<any>(
                harness.transactionsStore.sendPaymentSilently
            );
            const first = client.payInvoice({ invoice });
            await firstPayment.entered;
            const queued = client.payInvoice({ invoice: 'lnbc1queued' });
            await flushMicrotasks();
            return { ...harness, connection, firstPayment, first, queued };
        };

        it('does not run a queued request when the connection is deleted', async () => {
            const {
                store,
                transactionsStore,
                connection,
                firstPayment,
                first,
                queued
            } = await queueBehindPayment();

            const deletion = store.deleteConnection(connection.id);
            await flushMicrotasks();
            firstPayment.release({});
            await first;

            expect(await queued).toEqual(UNAUTHORIZED);
            expect(transactionsStore.sendPaymentSilently).toHaveBeenCalledTimes(
                1
            );
            await settle(deletion);
            expect(store.connections).toHaveLength(0);
        });

        it('does not run a queued request while its pay permission is removed', async () => {
            const {
                store,
                transactionsStore,
                connection,
                firstPayment,
                first,
                queued
            } = await queueBehindPayment();

            const update = store.updateConnection(connection.id, {
                permissions: ['get_balance']
            });
            await flushMicrotasks();
            firstPayment.release({});
            await first;

            expect(await queued).toEqual(RATE_LIMITED);
            expect(transactionsStore.sendPaymentSilently).toHaveBeenCalledTimes(
                1
            );
            expect((await settle(update)).success).toBe(true);
            expect(connection.hasPermission('pay_invoice')).toBe(false);
        });

        it('does not pay when an update removes pay_invoice while the balance is read', async () => {
            const harness = await startService(
                [{ permissions: ['pay_invoice'], maxAmountSats: 100000 }],
                payCollaborators()
            );
            const { store, balanceStore, transactionsStore } = harness;
            const [connection] = harness.connections;
            const balanceRead = holdNextCall<any>(
                balanceStore.getLightningBalance
            );

            const paying = clientFor(connection).payInvoice({ invoice });
            await settle(balanceRead.entered);
            const update = store.updateConnection(connection.id, {
                permissions: ['get_balance']
            });
            await flushMicrotasks();
            balanceRead.release({ lightningBalance: 100000 });

            expect((await settle(paying)).error).toBeDefined();
            expect(
                transactionsStore.sendPaymentSilently
            ).not.toHaveBeenCalled();
            expect((await settle(update)).success).toBe(true);
            expect(connection.hasPermission('pay_invoice')).toBe(false);
        });

        it('does not pay for a stored connection without pay_invoice', async () => {
            const { store, settingsStore, transactionsStore } = createStore(
                payCollaborators()
            );
            const connection = addConnection(store, {
                permissions: ['get_balance'],
                maxAmountSats: 100000
            });

            const response = await (store as any).handleLightningPayInvoice(
                connection,
                { invoice },
                settingsStore.getConnectionGuard()
            );

            expect(response).toEqual(PAY_RESTRICTED);
            expect(
                transactionsStore.sendPaymentSilently
            ).not.toHaveBeenCalled();
        });

        it('does not pay when the connection is deleted while the balance is read', async () => {
            const { store, settingsStore, balanceStore, transactionsStore } =
                createStore(payCollaborators());
            const connection = addConnection(store, {
                permissions: ['pay_invoice'],
                maxAmountSats: 100000
            });
            let deletion: Promise<unknown> = Promise.resolve();
            balanceStore.getLightningBalance.mockImplementation(async () => {
                deletion = store.deleteConnection(connection.id);
                return { lightningBalance: 100000 };
            });

            const response = await (store as any).handleLightningPayInvoice(
                connection,
                { invoice },
                settingsStore.getConnectionGuard()
            );

            expect(response).toEqual(UNAUTHORIZED);
            expect(
                transactionsStore.sendPaymentSilently
            ).not.toHaveBeenCalled();
            await settle(deletion);
        });

        it('does not pay when the connection was removed from the store', async () => {
            const { store, settingsStore, transactionsStore } = createStore(
                payCollaborators()
            );
            const connection = addConnection(store, {
                permissions: ['pay_invoice'],
                maxAmountSats: 100000
            });
            (BackendUtils.decodePaymentRequest as jest.Mock).mockImplementation(
                async () => {
                    store.connections = [];
                    return {};
                }
            );

            const response = await (store as any).handleLightningPayInvoice(
                connection,
                { invoice },
                settingsStore.getConnectionGuard()
            );

            expect(response).toEqual(UNAUTHORIZED);
            expect(
                transactionsStore.sendPaymentSilently
            ).not.toHaveBeenCalled();
            expect(connection.activity).toEqual([]);
        });

        it('does not melt ecash for a connection that is being deleted', async () => {
            const payLnInvoiceFromEcash = jest.fn();
            const { store, settingsStore } = createStore({
                cashuStore: {
                    selectedMintUrl: 'https://mint.example',
                    isProperlyConfigured: () => true,
                    getPayReq: jest.fn(),
                    payLnInvoiceFromEcash
                }
            });
            store.cashuEnabled = true;
            const connection = addConnection(store, {
                permissions: ['pay_invoice'],
                maxAmountSats: 100000
            });
            const isCurrent = settingsStore.getConnectionGuard();
            const keyWrite = holdNextWrite(NWC_CLIENT_KEYS);
            const deletion = store.deleteConnection(connection.id);

            const response = await (store as any).handleCashuPayInvoice(
                connection,
                { invoice },
                isCurrent
            );

            expect(response).toEqual(UNAUTHORIZED);
            expect(payLnInvoiceFromEcash).not.toHaveBeenCalled();
            keyWrite.release();
            await settle(deletion);
        });
    });
});

describe('NostrWalletConnectStore handleLightningPayInvoice fee cap', () => {
    beforeEach(() => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            timestamp: String(Math.floor(Date.now() / 1000) - 60),
            expiry: '3600'
        });
        jest.spyOn(NostrConnectUtils, 'decodeInvoiceTags').mockImplementation(
            async (invoice: string) => ({
                paymentRequest: invoice,
                paymentHash: '',
                descriptionHash: '',
                description: '',
                amount: 5000,
                expiryTime: 0,
                createdAt: 0,
                isExpired: false,
                network: 'bitcoin'
            })
        );
        jest.spyOn(
            NostrConnectUtils,
            'resolvePayInvoiceAmount'
        ).mockResolvedValue({ amountSats: 5000, zeroAmountInvoice: false });
    });

    afterEach(() => jest.restoreAllMocks());

    function buildHandlerStore() {
        return createStore({
            transactionsStore: {
                sendPaymentSilently: jest.fn().mockResolvedValue({}),
                getPaymentOutcome: jest.fn().mockReturnValue({})
            },
            balanceStore: {
                getLightningBalance: jest
                    .fn()
                    .mockResolvedValue({ lightningBalance: 100000 })
            },
            paymentsStore: {
                payments: [],
                getPayments: jest.fn().mockResolvedValue([])
            }
        });
    }

    const sentFeeLimits = (transactionsStore: any) =>
        (transactionsStore.sendPaymentSilently as jest.Mock).mock.calls.map(
            (call) => call[0].fee_limit_sat
        );

    it('limits the fee cap to the budget left after the amount', async () => {
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 5400
        });

        await (store as any).handleLightningPayInvoice(
            connection,
            {
                invoice: 'lnbc1fee-cap-a'
            },
            () => true
        );

        expect(sentFeeLimits(transactionsStore)).toEqual([400]);
    });

    it('keeps the full fee cap when the connection has no budget', async () => {
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, {
            permissions: ['pay_invoice']
        });

        await (store as any).handleLightningPayInvoice(
            connection,
            {
                invoice: 'lnbc1fee-cap-a'
            },
            () => true
        );

        expect(sentFeeLimits(transactionsStore)).toEqual([1000]);
    });

    it('holds the fee cap of an in-flight payment against later payments', async () => {
        jest.spyOn(
            NostrConnectUtils,
            'resolveLightningPaymentInTransit'
        ).mockReturnValue({ inTransit: true } as any);
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 11000
        });

        await (store as any).handleLightningPayInvoice(
            connection,
            {
                invoice: 'lnbc1fee-cap-a'
            },
            () => true
        );
        expect(connection.activity[0].status).toBe('pending');
        expect(connection.activity[0].feeLimitSats).toBe(1000);
        expect(connection.pendingSpendSats).toBe(6000);

        await (store as any).handleLightningPayInvoice(
            connection,
            {
                invoice: 'lnbc1fee-cap-b'
            },
            () => true
        );
        expect(connection.pendingSpendSats).toBe(11000);

        const third = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice: 'lnbc1fee-cap-c' },
            () => true
        );

        // sent: 5000 + 1000 and 5000 + 0, within the 11000 sat budget
        expect(sentFeeLimits(transactionsStore)).toEqual([1000, 0]);
        expect(third.error?.code).toBe(Nip47ErrorCode.INSUFFICIENT_BALANCE);
    });

    it('says the budget limited the fee cap when the payment fails', async () => {
        const { store, transactionsStore } = buildHandlerStore();
        transactionsStore.getPaymentOutcome.mockReturnValue({
            error: true,
            payment_error: 'No route found.'
        });
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 5400
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice: 'lnbc1fee-cap-a' },
            () => true
        );

        const expected =
            'No route found. stores.NostrWalletConnectStore.error.feeLimitReducedByBudget';
        expect(response.error).toEqual({
            code: Nip47ErrorCode.FAILED_TO_PAY_INVOICE,
            message: expected
        });
        expect(connection.activity[0].status).toBe('failed');
        expect(connection.activity[0].error).toBe(expected);
    });

    it('leaves the error unchanged when the full fee cap was sent', async () => {
        const { store, transactionsStore } = buildHandlerStore();
        transactionsStore.getPaymentOutcome.mockReturnValue({
            error: true,
            payment_error: 'No route found.'
        });
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 6000
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice: 'lnbc1fee-cap-a' },
            () => true
        );

        expect(sentFeeLimits(transactionsStore)).toEqual([1000]);
        expect(response.error?.message).toBe('No route found.');
    });

    it('sends the full fee cap and holds the fee reserve when the backend ignores fee limits', async () => {
        (BackendUtils.supportsCustomFeeLimit as jest.Mock).mockReturnValue(
            false
        );
        jest.spyOn(
            NostrConnectUtils,
            'resolveLightningPaymentInTransit'
        ).mockReturnValue({ inTransit: true } as any);
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 5400
        });

        await (store as any).handleLightningPayInvoice(
            connection,
            {
                invoice: 'lnbc1fee-cap-a'
            },
            () => true
        );

        // reserve: max(1% of 5000, 10) = 50
        expect(sentFeeLimits(transactionsStore)).toEqual([1000]);
        expect(connection.activity[0].status).toBe('pending');
        expect(connection.activity[0].feeLimitSats).toBe(50);
        expect(connection.pendingSpendSats).toBe(5050);
        expect(connection.remainingBudget).toBe(350);
    });

    it('refuses before paying when the budget covers the amount but not the fee reserve on a backend that ignores fee limits', async () => {
        (BackendUtils.supportsCustomFeeLimit as jest.Mock).mockReturnValue(
            false
        );
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 5049
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice: 'lnbc1fee-cap-a' },
            () => true
        );

        expect(transactionsStore.sendPaymentSilently).not.toHaveBeenCalled();
        expect(response.result).toBeUndefined();
        expect(response.error).toEqual({
            code: Nip47ErrorCode.INSUFFICIENT_BALANCE,
            message:
                'stores.NostrWalletConnectStore.error.paymentAndFeeReserveExceedBudget'
        });
        expect(connection.activity).toHaveLength(0);
        expect(connection.totalSpendSats).toBe(0);
    });

    it('uses a 10 sat fee reserve for small payments on a backend that ignores fee limits', async () => {
        (BackendUtils.supportsCustomFeeLimit as jest.Mock).mockReturnValue(
            false
        );
        jest.spyOn(
            NostrConnectUtils,
            'resolvePayInvoiceAmount'
        ).mockResolvedValue({ amountSats: 100, zeroAmountInvoice: false });
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 109
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice: 'lnbc1fee-cap-a' },
            () => true
        );

        expect(transactionsStore.sendPaymentSilently).not.toHaveBeenCalled();
        expect(response.error?.code).toBe(Nip47ErrorCode.INSUFFICIENT_BALANCE);
    });

    it('pays when the budget covers the fee reserve and debits the fee paid on a backend that ignores fee limits', async () => {
        (BackendUtils.supportsCustomFeeLimit as jest.Mock).mockReturnValue(
            false
        );
        const { store, transactionsStore } = buildHandlerStore();
        transactionsStore.getPaymentOutcome.mockReturnValue({
            payment_preimage: 'ab'.repeat(32),
            payment_fee: '7',
            isIncomplete: false
        });
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 5050
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice: 'lnbc1fee-cap-a' },
            () => true
        );

        expect(transactionsStore.sendPaymentSilently).toHaveBeenCalledTimes(1);
        expect(response.error).toBeUndefined();
        expect(connection.totalSpendSats).toBe(5007);
        expect(connection.pendingSpendSats).toBe(0);
    });

    // LNbits' LndHub extension reports an outgoing fee as negative msat
    // (#5254); the fee still comes out of the budget
    it('debits the fee of an LNbits payment that reports it as negative', async () => {
        (BackendUtils.supportsCustomFeeLimit as jest.Mock).mockReturnValue(
            false
        );
        const { store, transactionsStore } = buildHandlerStore();
        const lnbitsPayInvoice = new Payment({
            payment_error: '',
            payment_preimage: 'ab'.repeat(32),
            payment_route: {},
            fee_msat: -5000,
            fee: -5
        });
        transactionsStore.getPaymentOutcome.mockReturnValue({
            payment_preimage: lnbitsPayInvoice.getPreimage,
            payment_fee: lnbitsPayInvoice.getFee,
            isIncomplete: false
        });
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 5050
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice: 'lnbc1fee-cap-a' },
            () => true
        );

        expect(response.error).toBeUndefined();
        expect(connection.totalSpendSats).toBe(5005);
        expect(connection.pendingSpendSats).toBe(0);
    });

    it('requires no fee reserve when the backend enforces the fee limit', async () => {
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 5000
        });

        await (store as any).handleLightningPayInvoice(
            connection,
            { invoice: 'lnbc1fee-cap-a' },
            () => true
        );

        expect(sentFeeLimits(transactionsStore)).toEqual([0]);
    });

    it('leaves the error unchanged when the backend ignores fee limits', async () => {
        (BackendUtils.supportsCustomFeeLimit as jest.Mock).mockReturnValue(
            false
        );
        const { store, transactionsStore } = buildHandlerStore();
        transactionsStore.getPaymentOutcome.mockReturnValue({
            error: true,
            payment_error: 'No route found.'
        });
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 5400
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice: 'lnbc1fee-cap-a' },
            () => true
        );

        expect(response.error?.message).toBe('No route found.');
        expect(connection.activity[0].error).toBe('No route found.');
    });

    it('leaves a non-route error unchanged when the fee cap was reduced', async () => {
        const { store, transactionsStore } = buildHandlerStore();
        transactionsStore.getPaymentOutcome.mockReturnValue({
            error: true,
            payment_error: 'error.failureReasonInsufficientBalance'
        });
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 5400
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice: 'lnbc1fee-cap-a' },
            () => true
        );

        expect(sentFeeLimits(transactionsStore)).toEqual([400]);
        expect(response.error).toEqual({
            code: Nip47ErrorCode.FAILED_TO_PAY_INVOICE,
            message: 'error.failureReasonInsufficientBalance'
        });
        expect(connection.activity[0].error).toBe(
            'error.failureReasonInsufficientBalance'
        );
    });

    it('leaves an invoice-state error unchanged when the fee cap was reduced', async () => {
        const { store, transactionsStore } = buildHandlerStore();
        transactionsStore.getPaymentOutcome.mockReturnValue({
            error: true,
            payment_error: 'invoice expired'
        });
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 5400
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice: 'lnbc1fee-cap-a' },
            () => true
        );

        expect(response.error?.message).toBe('invoice expired');
        expect(connection.activity).toHaveLength(0);
    });
});

describe('NostrWalletConnectStore handleLightningPayInvoice payments refresh failure', () => {
    beforeEach(() => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            timestamp: String(Math.floor(Date.now() / 1000) - 60),
            expiry: '3600'
        });
        jest.spyOn(NostrConnectUtils, 'decodeInvoiceTags').mockImplementation(
            async (invoice: string) => ({
                paymentRequest: invoice,
                paymentHash: '',
                descriptionHash: '',
                description: '',
                amount: 5000,
                expiryTime: 0,
                createdAt: 0,
                isExpired: false,
                network: 'bitcoin'
            })
        );
        jest.spyOn(
            NostrConnectUtils,
            'resolvePayInvoiceAmount'
        ).mockResolvedValue({ amountSats: 5000, zeroAmountInvoice: false });
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    function buildStore(outcome: any) {
        return createStore({
            transactionsStore: {
                sendPaymentSilently: jest.fn().mockResolvedValue({}),
                getPaymentOutcome: jest.fn().mockReturnValue(outcome)
            },
            balanceStore: {
                getLightningBalance: jest
                    .fn()
                    .mockResolvedValue({ lightningBalance: 100000 })
            },
            paymentsStore: {
                payments: [],
                getPayments: jest
                    .fn()
                    .mockRejectedValue(new Error('node unreachable'))
            }
        });
    }

    it('debits the budget for a paid invoice when the payments refresh fails', async () => {
        const { store } = buildStore({
            payment_preimage: 'aa'.repeat(32),
            payment_fee: 3
        });
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 10000
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice: 'lnbc1refresh-fail-paid' },
            () => true
        );

        expect(response.error).toBeUndefined();
        expect(response.result.preimage).toBe('aa'.repeat(32));
        expect(connection.totalSpendSats).toBe(5003);
        expect(connection.activity[0].status).toBe('success');
    });

    it('holds the budget for a timed-out payment when the payments refresh fails', async () => {
        const { store } = buildStore({
            error: true,
            payment_error: 'views.SendingLightning.paymentTimedOut'
        });
        jest.spyOn(
            NostrConnectUtils,
            'isPaymentTimedOutMessage'
        ).mockReturnValue(true);
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 10000
        });

        await (store as any).handleLightningPayInvoice(
            connection,
            { invoice: 'lnbc1refresh-fail-timeout' },
            () => true
        );

        expect(connection.activity[0].status).toBe('pending');
        expect(connection.pendingSpendSats).toBeGreaterThanOrEqual(5000);
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
                sendPaymentSilently: jest.fn().mockResolvedValue({}),
                getPaymentOutcome: jest.fn().mockReturnValue({
                    payment_hash: paymentHash,
                    payment_preimage: hex64('f'),
                    payment_fee: 0,
                    status: 'SUCCEEDED',
                    isIncomplete: false
                })
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
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice, amount: 7_000_000 },
            () => true
        );

        expect(transactionsStore.sendPaymentSilently).toHaveBeenCalledWith(
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
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice },
            () => true
        );

        expect(transactionsStore.sendPaymentSilently).not.toHaveBeenCalled();
        expect(response.result).toBeUndefined();
        expect(response.error?.code).toBe(Nip47ErrorCode.INVALID_INVOICE);
    });

    it.each([0, -1000, 1500, Number.NaN, Number.POSITIVE_INFINITY])(
        'rejects an unusable requested amount (%p msat)',
        async (amount) => {
            mockInvoiceAmount(0);
            const { store, transactionsStore } = buildHandlerStore();
            const connection = addConnection(store, {
                permissions: ['pay_invoice'],
                maxAmountSats: 100000
            });

            const response = await (store as any).handleLightningPayInvoice(
                connection,
                { invoice, amount },
                () => true
            );

            expect(
                transactionsStore.sendPaymentSilently
            ).not.toHaveBeenCalled();
            expect(response.error?.code).toBe(Nip47ErrorCode.INVALID_INVOICE);
        }
    );

    it('enforces the connection budget on the requested amount', async () => {
        mockInvoiceAmount(0);
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 5000
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice, amount: 7_000_000 },
            () => true
        );

        expect(transactionsStore.sendPaymentSilently).not.toHaveBeenCalled();
        expect(response.result).toBeUndefined();
        expect(response.error?.code).toBe(Nip47ErrorCode.INSUFFICIENT_BALANCE);
    });

    it('checks the node balance against the requested amount', async () => {
        mockInvoiceAmount(0);
        const { store, transactionsStore } = buildHandlerStore();
        (store as any).balanceStore.getLightningBalance = jest
            .fn()
            .mockResolvedValue({ lightningBalance: 1000 });
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice, amount: 7_000_000 },
            () => true
        );

        expect(transactionsStore.sendPaymentSilently).not.toHaveBeenCalled();
        expect(response.error?.code).toBe(Nip47ErrorCode.INSUFFICIENT_BALANCE);
    });

    it('ignores the requested amount when the invoice has one', async () => {
        mockInvoiceAmount(5000);
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });

        await (store as any).handleLightningPayInvoice(
            connection,
            {
                invoice,
                amount: 90_000_000
            },
            () => true
        );

        const call = (transactionsStore.sendPaymentSilently as jest.Mock).mock
            .calls[0][0];
        expect(call.payment_request).toBe(invoice);
        expect(call.amount).toBeUndefined();
    });

    it('treats a sub-sat invoice as having an amount', async () => {
        mockInvoiceAmount(0, '500');
        const { store, transactionsStore } = buildHandlerStore();
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });

        await (store as any).handleLightningPayInvoice(
            connection,
            {
                invoice,
                amount: 7_000_000
            },
            () => true
        );

        const call = (transactionsStore.sendPaymentSilently as jest.Mock).mock
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
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });

        const response = await (store as any).handleLightningPayInvoice(
            connection,
            { invoice, amount: 7_000_000 },
            () => true
        );

        expect(response.error).toBeUndefined();
        expect(response.result?.preimage).toBe('');
        expect(connection.activity[0].status).toBe('pending');
        expect(connection.activity[0].satAmount).toBe(7000);
        // the amount plus the 1000 sat fee cap it was sent with
        expect(connection.pendingSpendSats).toBe(8000);
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
        transactionsStore.getPaymentOutcome.mockReturnValue({
            payment_hash: paymentHash,
            payment_preimage: null,
            payment_fee: 0,
            error: true,
            payment_error: 'invoice is already paid',
            status: 'FAILED',
            isIncomplete: true
        });
        const connection = addConnection(store, {
            permissions: ['pay_invoice'],
            maxAmountSats: 100000
        });

        await (store as any).handleLightningPayInvoice(
            connection,
            {
                invoice,
                amount: 7_000_000
            },
            () => true
        );

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

    it('refuses the LNURL-auth canonical phrase without signing', async () => {
        const signMessage = jest.fn();
        const store = buildStore(signMessage);

        const response = await (store as any).handleSignMessage({
            message: `  ${LNURLAUTH_CANONICAL_PHRASE.toLowerCase()}\n`
        });

        expect(signMessage).not.toHaveBeenCalled();
        expect(response).toEqual({
            result: undefined,
            error: {
                code: 'RESTRICTED',
                message: 'views.Settings.SignMessage.reservedMessage'
            }
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
    const payWith = async (
        cashuInvoice: any,
        payments: any[] = [],
        cashuOverrides: any = {}
    ) => {
        const { store } = createStore({
            cashuStore: {
                selectedMintUrl: 'https://mint.example',
                totalBalanceSats: 100_000,
                paymentError: false,
                paymentErrorMsg: '',
                paymentRequest: invoice,
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
                payments,
                ...cashuOverrides
            }
        });
        // isCashuConfigured is a computed, so satisfy its inputs rather
        // than trying to redefine it
        store.cashuEnabled = true;
        const connection = addConnection(store, {
            permissions: ['pay_invoice']
        });
        const response = await (store as any).handleCashuPayInvoice(
            connection,
            { invoice },
            () => true
        );
        return { response, connection, cashuStore: (store as any).cashuStore };
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

    // A melt confirmed only from its quote carries no fee, and the mint may
    // have spent up to the fee reserve
    it('debits the fee reserve when the melt fee is unknown', async () => {
        const { response, connection } = await payWith({
            isFailed: false,
            getPreimage: preimage,
            getPaymentRequest: invoice,
            getFee: '',
            fee_unknown: true,
            meltResponse: { quote: { quote: 'quote-1', fee_reserve: 3 } }
        });

        expect(connection.totalSpendSats).toBe(103);
        expect(response.result.fees_paid).toBe(3000);
    });

    it('tells CashuStore which invoice it may pay', async () => {
        const { cashuStore } = await payWith({
            isFailed: false,
            getPreimage: preimage,
            getPaymentRequest: invoice,
            getFee: 1
        });

        expect(cashuStore.payLnInvoiceFromEcash).toHaveBeenCalledWith(
            expect.objectContaining({ paymentRequest: invoice })
        );
    });

    it('pays nothing when another invoice was loaded into CashuStore meanwhile', async () => {
        // getPayReq was superseded: it returns without an error and the
        // store describes the invoice opened on a send screen
        const { response, connection, cashuStore } = await payWith(
            {
                isFailed: false,
                getPreimage: preimage,
                getPaymentRequest: invoice,
                getFee: 1
            },
            [],
            { paymentRequest: 'lnbc1otherinvoice' }
        );

        expect(response.result).toBeUndefined();
        expect(response.error).toBeDefined();
        expect(cashuStore.payLnInvoiceFromEcash).not.toHaveBeenCalled();
        expect(connection.totalSpendSats).toBe(0);
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

describe('NostrWalletConnectStore wallet deletion', () => {
    const OTHER_WALLET = {
        id: 'conn-other',
        name: 'Other Wallet App',
        pubkey: hex64('c'),
        nodePubkey: 'other-node-pubkey'
    };

    it('deleteCurrentWalletConnections stops serving and deletes only the current wallet connections', async () => {
        const otherWallet = connectionData(OTHER_WALLET);
        const {
            store,
            connections: [first, second]
        } = await startService([{}, {}]);
        storedItems.set(
            NWC_CONNECTIONS_KEY,
            JSON.stringify([...persistedConnections(), otherWallet])
        );
        storedItems.set(
            NWC_CLIENT_KEYS,
            JSON.stringify({
                ...storedClientKeys(),
                [otherWallet.pubkey]: hex64('9')
            })
        );
        const client = clientFor(first);

        await store.deleteCurrentWalletConnections();

        expect(store.isInitialized).toBe(false);
        expect(store.connections).toEqual([]);
        expect(isSubscribed(first)).toBe(false);
        expect(isSubscribed(second)).toBe(false);
        expect(persistedConnections().map((c) => c.id)).toEqual([
            OTHER_WALLET.id
        ]);
        expect(storedClientKeys()).toEqual({
            [otherWallet.pubkey]: hex64('9')
        });
        expect(storedItems.has(NWC_SERVICE_KEYS)).toBe(true);
        expect(await client.getInfo()).toEqual(UNAUTHORIZED);
    });

    it('deleteCurrentWalletConnections deletes stored connections the service has not loaded', async () => {
        const current = connectionData();
        const otherWallet = connectionData(OTHER_WALLET);
        storedItems.set(
            NWC_CONNECTIONS_KEY,
            JSON.stringify([current, otherWallet])
        );
        storedItems.set(
            NWC_CLIENT_KEYS,
            JSON.stringify({
                [current.pubkey]: hex64('3'),
                [otherWallet.pubkey]: hex64('9')
            })
        );
        // Wallet deleted before initializeService loaded its connections
        const { store } = createStore();
        expect(store.connections).toEqual([]);

        await store.deleteCurrentWalletConnections();

        expect(persistedConnections().map((c) => c.id)).toEqual([
            OTHER_WALLET.id
        ]);
        expect(storedClientKeys()).toEqual({
            [otherWallet.pubkey]: hex64('9')
        });
    });

    it('deleteCurrentWalletConnections leaves a re-added node with no connections', async () => {
        const { store } = await startService();

        await store.deleteCurrentWalletConnections();
        await store.initializeService();
        await jest.advanceTimersByTimeAsync(SERVICE_START_MS);

        expect(store.connections).toEqual([]);
        expect(store.isInitialized).toBe(false);
    });

    describe('deleteWalletConfigConnections', () => {
        const WALLET_A = {
            implementation: 'lnd',
            host: 'a.example.com',
            port: '8080'
        };
        const WALLET_B = { ...WALLET_A, host: 'b.example.com' };
        const B_CONNECTION = {
            id: 'conn-b',
            name: 'Wallet B App',
            pubkey: hex64('b'),
            nodePubkey: 'node-b-pubkey'
        };
        const B_KEY = hex64('8');

        // Pairs a client to wallet B while it is the current wallet, the
        // way the app stores it, then switches to wallet A
        const pairWithWalletBThenSwitchToA = async () => {
            storedItems.set(
                NWC_CONNECTIONS_KEY,
                JSON.stringify([
                    connectionData({ id: 'conn-a', pubkey: hex64('a') }),
                    connectionData(B_CONNECTION)
                ])
            );
            storedItems.set(
                NWC_CLIENT_KEYS,
                JSON.stringify({
                    [hex64('a')]: hex64('3'),
                    [B_CONNECTION.pubkey]: B_KEY
                })
            );
            const walletB = createStore({
                settingsStore: { ...WALLET_B, settings: {} },
                nodeInfoStore: {
                    nodeInfo: { nodeId: B_CONNECTION.nodePubkey },
                    getNodeInfo: jest.fn()
                }
            });
            await walletB.store.loadConnections();
            await jest.advanceTimersByTimeAsync(SERVICE_START_MS);

            return createStore({
                settingsStore: { ...WALLET_A, settings: {} }
            });
        };

        it('loadConnections stamps the current wallet config on its connections only', async () => {
            await pairWithWalletBThenSwitchToA();

            const [a, b] = persistedConnections();
            expect(b.walletConfigId).toBe(
                NostrConnectUtils.getWalletConfigId(WALLET_B)
            );
            expect(a.walletConfigId).toBeUndefined();
        });

        it("deletes an inactive wallet's connections and client keys so a re-added node has none", async () => {
            const { store } = await pairWithWalletBThenSwitchToA();
            await store.loadConnections();

            await store.deleteWalletConfigConnections(WALLET_B, [WALLET_A]);

            expect(persistedConnections().map((c) => c.id)).toEqual(['conn-a']);
            expect(storedClientKeys()).toEqual({ [hex64('a')]: hex64('3') });
            expect(store.connections.map((c) => c.id)).toEqual(['conn-a']);

            // The same node added back as a new config
            const readded = createStore({
                settingsStore: { ...WALLET_B, settings: {} },
                nodeInfoStore: {
                    nodeInfo: { nodeId: B_CONNECTION.nodePubkey },
                    getNodeInfo: jest.fn()
                }
            });
            await readded.store.loadConnections();
            expect(readded.store.connections).toEqual([]);
        });

        it('createConnection stamps the current wallet config', async () => {
            const { store } = await startService([{}], {
                settingsStore: { ...WALLET_A, settings: {} }
            });

            await store.createConnection({
                name: 'New App',
                relayUrl: OLD_RELAY
            });

            const created = persistedConnections().find(
                (c) => c.name === 'New App'
            );
            expect(created.walletConfigId).toBe(
                NostrConnectUtils.getWalletConfigId(WALLET_A)
            );
        });

        it("does not let a save already in flight write back a deleted wallet's connections", async () => {
            const { store } = await pairWithWalletBThenSwitchToA();
            await store.loadConnections();
            // Wallet A's save has read the stored records, wallet B's
            // included, and is about to write them
            const write = holdNextWrite(NWC_CONNECTIONS_KEY);
            const save = store.saveConnections();
            await settle(write.entered);

            const deletion = store.deleteWalletConfigConnections(WALLET_B, [
                WALLET_A
            ]);
            // Give the deletion time to run before the save's write lands
            await jest.advanceTimersByTimeAsync(1000);
            write.release();
            await settle(save);
            await settle(deletion);

            expect(persistedConnections().map((c) => c.id)).toEqual(['conn-a']);
            expect(storedClientKeys()).toEqual({ [hex64('a')]: hex64('3') });
        });

        it("deletes an inactive wallet's connections after its host or port is edited", async () => {
            const { store } = await pairWithWalletBThenSwitchToA();
            const editedB = { ...WALLET_B, port: '9090' };

            await store.rekeyWalletConfigConnections(WALLET_B, editedB, [
                WALLET_A
            ]);
            await store.deleteWalletConfigConnections(editedB, [WALLET_A]);

            expect(persistedConnections().map((c) => c.id)).toEqual(['conn-a']);
            expect(storedClientKeys()[B_CONNECTION.pubkey]).toBeUndefined();

            // The original node added back as a new config
            const readded = createStore({
                settingsStore: { ...WALLET_B, settings: {} },
                nodeInfoStore: {
                    nodeInfo: { nodeId: B_CONNECTION.nodePubkey },
                    getNodeInfo: jest.fn()
                }
            });
            await readded.store.loadConnections();
            expect(readded.store.connections).toEqual([]);
        });

        it('does not move the connections of a config edited while a duplicate remains', async () => {
            const { store } = await pairWithWalletBThenSwitchToA();

            await store.rekeyWalletConfigConnections(
                WALLET_B,
                { ...WALLET_B, port: '9090' },
                [WALLET_A, WALLET_B]
            );

            expect(
                persistedConnections().find((c) => c.id === 'conn-b')
                    .walletConfigId
            ).toBe(NostrConnectUtils.getWalletConfigId(WALLET_B));
        });

        it('moves the loaded connections of the current wallet to its new id', async () => {
            await pairWithWalletBThenSwitchToA();
            const walletA = createStore({
                settingsStore: { ...WALLET_A, settings: {} }
            });
            await walletA.store.loadConnections();
            await jest.advanceTimersByTimeAsync(SERVICE_START_MS);
            const editedA = { ...WALLET_A, port: '9090' };

            await walletA.store.rekeyWalletConfigConnections(
                WALLET_A,
                editedA,
                [WALLET_B]
            );
            // A later save writes the in-memory records
            await walletA.store.saveConnections();

            const newId = NostrConnectUtils.getWalletConfigId(editedA);
            expect(walletA.store.connections[0].walletConfigId).toBe(newId);
            expect(
                persistedConnections().find((c) => c.id === 'conn-a')
                    .walletConfigId
            ).toBe(newId);
        });

        it('keeps the connections while a duplicate of the config remains', async () => {
            const { store } = await pairWithWalletBThenSwitchToA();

            await store.deleteWalletConfigConnections(WALLET_B, [
                WALLET_A,
                { ...WALLET_B, nickname: 'Copy' } as any
            ]);

            expect(persistedConnections().map((c) => c.id)).toEqual([
                'conn-a',
                'conn-b'
            ]);
            expect(storedClientKeys()[B_CONNECTION.pubkey]).toBe(B_KEY);
        });

        it("deletes an inactive LNbits wallet's connections while another wallet on the same server and login remains", async () => {
            const lnbitsWallet = (password: string) => ({
                implementation: 'lndhub',
                lndhubUrl: 'https://lnbits.example.com/lndhub/ext/',
                username: 'admin',
                password
            });
            const WALLET_X = lnbitsWallet('a'.repeat(32));
            const WALLET_Y = lnbitsWallet('b'.repeat(32));
            // Pair a client while wallet X is current
            const walletX = createStore({
                settingsStore: {
                    ...WALLET_X,
                    settings: { nodes: [WALLET_X, WALLET_Y] }
                },
                nodeInfoStore: { nodeInfo: {}, getNodeInfo: jest.fn() }
            });
            storedItems.set(
                NWC_CONNECTIONS_KEY,
                JSON.stringify([
                    connectionData({ id: 'conn-a', pubkey: hex64('a') }),
                    connectionData({
                        ...B_CONNECTION,
                        implementation: 'lndhub',
                        nodePubkey: (
                            walletX.store as any
                        ).getCurrentWalletPubkey()
                    })
                ])
            );
            storedItems.set(
                NWC_CLIENT_KEYS,
                JSON.stringify({
                    [hex64('a')]: hex64('3'),
                    [B_CONNECTION.pubkey]: B_KEY
                })
            );
            await walletX.store.loadConnections();
            await jest.advanceTimersByTimeAsync(SERVICE_START_MS);
            const { store } = createStore({
                settingsStore: { ...WALLET_A, settings: {} }
            });

            await store.deleteWalletConfigConnections(WALLET_X, [
                WALLET_A,
                WALLET_Y
            ]);

            expect(persistedConnections().map((c) => c.id)).toEqual(['conn-a']);
            expect(storedClientKeys()).toEqual({ [hex64('a')]: hex64('3') });
        });

        it("keeps the current wallet's connections when a deleted config for the same node last loaded them", async () => {
            // Wallets A and B reach the same node through different hosts,
            // and B was the last to load the connection
            storedItems.set(
                NWC_CONNECTIONS_KEY,
                JSON.stringify([
                    connectionData({
                        ...B_CONNECTION,
                        nodePubkey: NODE_PUBKEY,
                        walletConfigId:
                            NostrConnectUtils.getWalletConfigId(WALLET_B)
                    })
                ])
            );
            storedItems.set(
                NWC_CLIENT_KEYS,
                JSON.stringify({ [B_CONNECTION.pubkey]: B_KEY })
            );
            const { store } = createStore({
                settingsStore: { ...WALLET_A, settings: {} }
            });
            // A's restamp is scheduled but not yet saved
            await store.loadConnections();

            await store.deleteWalletConfigConnections(WALLET_B, [WALLET_A]);
            await jest.advanceTimersByTimeAsync(SERVICE_START_MS);

            expect(persistedConnections().map((c) => c.id)).toEqual(['conn-b']);
            expect(storedClientKeys()[B_CONNECTION.pubkey]).toBe(B_KEY);
            expect(store.connections.map((c) => c.id)).toEqual(['conn-b']);
        });

        it('leaves connections that were never loaded with a wallet config id', async () => {
            storedItems.set(
                NWC_CONNECTIONS_KEY,
                JSON.stringify([connectionData(B_CONNECTION)])
            );
            const { store } = createStore({
                settingsStore: { ...WALLET_A, settings: {} }
            });

            await store.deleteWalletConfigConnections(WALLET_B, [WALLET_A]);

            expect(persistedConnections().map((c) => c.id)).toEqual(['conn-b']);
        });
    });

    it('deleteAllConnectionData removes every stored connection and key', async () => {
        const { store, connections } = await startService();
        storedItems.set(
            NWC_CONNECTIONS_KEY,
            JSON.stringify([
                ...persistedConnections(),
                connectionData(OTHER_WALLET)
            ])
        );

        await store.deleteAllConnectionData();

        expect(store.connections).toEqual([]);
        expect(isSubscribed(connections[0])).toBe(false);
        expect(storedItems.has(NWC_CONNECTIONS_KEY)).toBe(false);
        expect(storedItems.has(NWC_CLIENT_KEYS)).toBe(false);
        expect(storedItems.has(NWC_SERVICE_KEYS)).toBe(false);
    });
});

describe('NostrWalletConnectStore Android Stop Service', () => {
    const RELAY = 'wss://relay.example';
    // Payloads NostrConnectService sends for the notification action and
    // for stopService() (Persistent Mode switched off)
    const STOP_PRESSED = { fromNotification: true };
    const PERSISTENT_MODE_OFF = { fromNotification: false };
    const originalOS = Platform.OS;
    let unsubscribe: jest.Mock;

    beforeEach(() => {
        Platform.OS = 'android';
        unsubscribe = jest.fn();
        NativeModules.NostrConnectModule = {
            initialize: jest.fn().mockResolvedValue(0),
            updateTranslationCache: jest.fn(),
            stopNostrConnectService: jest.fn().mockResolvedValue(true),
            unbindNostrConnectService: jest.fn().mockResolvedValue(true)
        };
    });

    afterEach(() => {
        Platform.OS = originalOS;
        delete NativeModules.NostrConnectModule;
        DeviceEventEmitter.removeAllListeners('NostrConnectServiceStopped');
    });

    // A store serving one connection with Persistent Mode on
    async function buildRunningStore(initialize = true) {
        const store = new NostrWalletConnectStore(
            { connecting: false } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any
        );
        store.persistentNWCServiceEnabled = true;
        (store as any).isInitialized = true;
        (store as any).walletServiceKeys = {
            privateKey: SERVICE_PRIV,
            publicKey: SERVICE_PUB
        };
        (store as any).nwcWalletServices.set(RELAY, { connected: true });
        (store as any).publishedRelays.add(RELAY);
        (store as any).activeSubscriptions.set('conn-1', unsubscribe);
        if (initialize) {
            await (store as any).initializeAndroidPersistentService();
        }
        return store;
    }

    it('stops answering requests and unbinds when Stop Service is pressed', async () => {
        const store = await buildRunningStore();

        DeviceEventEmitter.emit('NostrConnectServiceStopped', STOP_PRESSED);
        await flushMicrotasks();

        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect((store as any).activeSubscriptions.size).toBe(0);
        expect(store.isServiceReady()).toBe(false);
        expect((store as any).isInitialized).toBe(false);
        expect(
            NativeModules.NostrConnectModule.unbindNostrConnectService
        ).toHaveBeenCalledTimes(1);
    });

    it('handles Stop Service pressed before initialize resolves', async () => {
        const store = await buildRunningStore(false);
        NativeModules.NostrConnectModule.initialize.mockImplementation(
            async () => {
                DeviceEventEmitter.emit(
                    'NostrConnectServiceStopped',
                    STOP_PRESSED
                );
                return 0;
            }
        );

        await (store as any).initializeAndroidPersistentService();
        await flushMicrotasks();

        expect(
            NativeModules.NostrConnectModule.unbindNostrConnectService
        ).toHaveBeenCalledTimes(1);
        expect((store as any).activeSubscriptions.size).toBe(0);
    });

    it('still unbinds when the reset fails', async () => {
        const store = await buildRunningStore();
        jest.spyOn(store, 'reset').mockRejectedValue(new Error('x'));

        DeviceEventEmitter.emit('NostrConnectServiceStopped', STOP_PRESSED);
        await flushMicrotasks();

        expect(
            NativeModules.NostrConnectModule.unbindNostrConnectService
        ).toHaveBeenCalledTimes(1);
    });

    it('still handles Stop Service after a node switch reset', async () => {
        const store = await buildRunningStore();
        await store.reset(true);

        DeviceEventEmitter.emit('NostrConnectServiceStopped', STOP_PRESSED);
        await flushMicrotasks();

        expect(
            NativeModules.NostrConnectModule.unbindNostrConnectService
        ).toHaveBeenCalledTimes(1);
    });

    it('only unbinds when Persistent Mode is switched off', async () => {
        const store = await buildRunningStore();
        NativeModules.NostrConnectModule.stopNostrConnectService.mockImplementation(
            async () => {
                DeviceEventEmitter.emit(
                    'NostrConnectServiceStopped',
                    PERSISTENT_MODE_OFF
                );
                return true;
            }
        );

        await store.setPersistentNWCServiceEnabled(false);
        await flushMicrotasks();

        expect(unsubscribe).not.toHaveBeenCalled();
        expect(store.isServiceReady()).toBe(true);
        expect(
            NativeModules.NostrConnectModule.unbindNostrConnectService
        ).toHaveBeenCalledTimes(1);
    });

    it('does not reset when Persistent Mode is back on by the time the stop arrives', async () => {
        const store = await buildRunningStore();
        expect(store.persistentNWCServiceEnabled).toBe(true);

        DeviceEventEmitter.emit(
            'NostrConnectServiceStopped',
            PERSISTENT_MODE_OFF
        );
        await flushMicrotasks();

        expect(unsubscribe).not.toHaveBeenCalled();
        expect(store.isServiceReady()).toBe(true);
        expect(
            NativeModules.NostrConnectModule.unbindNostrConnectService
        ).toHaveBeenCalledTimes(1);
    });

    it('stays stopped, and starts on the next open, when Stop Service is pressed during initializeService', async () => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation(
            async (key: string) =>
                key === NWC_PERSISTENT_SERVICE_ENABLED ? 'true' : null
        );
        seedStoredService([{ permissions: ['get_info'] }]);
        const { store } = createStore();
        const loadMaxBudget = store.loadMaxBudget.bind(store);
        // The notification is up once startService() has run
        const budgetSpy = jest
            .spyOn(store, 'loadMaxBudget')
            .mockImplementationOnce(async () => {
                DeviceEventEmitter.emit(
                    'NostrConnectServiceStopped',
                    STOP_PRESSED
                );
                await flushMicrotasks();
                await loadMaxBudget();
            });

        await store.initializeService();
        await jest.advanceTimersByTimeAsync(SERVICE_START_MS);

        expect(budgetSpy).toHaveBeenCalledTimes(1);
        expect(store.isInitialized).toBe(false);
        expect(store.isServiceReady()).toBe(false);
        expect(store.error).toBe(false);
        expect(isSubscribed(store.connections[0])).toBe(false);

        await store.initializeService();
        await jest.advanceTimersByTimeAsync(SERVICE_START_MS);

        expect(store.isInitialized).toBe(true);
        expect(isSubscribed(store.connections[0])).toBe(true);
    });

    it('shows no error when Stop Service is pressed while startService checks the node', async () => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation(
            async (key: string) =>
                key === NWC_PERSISTENT_SERVICE_ENABLED ? 'true' : null
        );
        seedStoredService([{ permissions: ['get_info'] }]);
        const { store, balanceStore } = createStore();
        balanceStore.getLightningBalance.mockImplementationOnce(async () => {
            DeviceEventEmitter.emit('NostrConnectServiceStopped', STOP_PRESSED);
            await flushMicrotasks();
            return { lightningBalance: WALLET_BALANCE_SATS };
        });

        await store.initializeService();
        await jest.advanceTimersByTimeAsync(SERVICE_START_MS);

        expect(store.isInitialized).toBe(false);
        expect(store.error).toBe(false);
        expect(store.errorMessage).toBe('');
        expect(isSubscribed(store.connections[0])).toBe(false);
    });
});

describe('NostrWalletConnectStore wallet switch during initializeService', () => {
    // Stores one wallet's service keys, connection and client key, the way
    // initializeService reads them after a wallet switch
    function seedWallet(id: string, pubkey: string, relayUrl: string) {
        storedItems.set(
            NWC_SERVICE_KEYS,
            JSON.stringify({ privateKey: SERVICE_PRIV, publicKey: SERVICE_PUB })
        );
        storedItems.set(
            NWC_CONNECTIONS_KEY,
            JSON.stringify([
                connectionData({
                    id,
                    name: id,
                    pubkey,
                    relayUrl,
                    permissions: ['get_info', 'get_balance']
                })
            ])
        );
        storedItems.set(
            NWC_CLIENT_KEYS,
            JSON.stringify({ [pubkey]: hex64('3') })
        );
    }

    it('does not let the old run set error after its publish retries run out', async () => {
        silence('error');
        // alice's relay is unreachable, so each publish attempt fails.
        // Kept here because reset closes it, and relayFor then returns a
        // new fake
        const aliceRelay = relayFor(OLD_RELAY);
        aliceRelay.failPublish = true;
        seedWallet('alice1', hex64('a'), OLD_RELAY);
        const { store } = createStore();

        const aliceRun = store.initializeService();
        // Into the second retry backoff (attempts at 0 ms, 1 s and 3 s)
        await jest.advanceTimersByTimeAsync(1500);
        expect(aliceRelay.publishWalletServiceInfoEvent).toHaveBeenCalledTimes(
            2
        );

        // Switch to bob, whose relay is reachable
        seedWallet('bob1', hex64('b'), NEW_RELAY);
        await store.reset(true);
        const bobRun = store.initializeService();

        // alice's third attempt fails at 3 s, before bob's delayed subscribe
        await jest.advanceTimersByTimeAsync(SERVICE_START_MS);
        await Promise.all([aliceRun, bobRun]);

        expect(aliceRelay.publishWalletServiceInfoEvent).toHaveBeenCalledTimes(
            3
        );
        expect(aliceRelay.close).toHaveBeenCalledTimes(1);
        expect(store.error).toBe(false);
        expect(store.errorMessage).toBe('');
        expect(store.isInitialized).toBe(true);
        expect(store.isServiceReady()).toBe(true);
        expect(store.connections.map((c) => c.id)).toEqual(['bob1']);
        expect(isSubscribed(store.connections[0])).toBe(true);
    });

    it('does not let the old run set error when it fails after the switch', async () => {
        silence('error');
        seedWallet('alice1', hex64('a'), OLD_RELAY);
        const { store } = createStore();
        const loadMaxBudget = store.loadMaxBudget.bind(store);
        jest.spyOn(store, 'loadMaxBudget').mockImplementationOnce(async () => {
            // Switch to bob while alice's run loads the balance, and let
            // bob's run finish first
            seedWallet('bob1', hex64('b'), NEW_RELAY);
            await store.reset(true);
            await store.initializeService();
            // alice's budget check then throws
            jest.spyOn(
                store as any,
                'checkAndResetAllBudgets'
            ).mockRejectedValueOnce(new Error('budget check failed'));
            await loadMaxBudget();
        });

        await store.initializeService();
        await jest.advanceTimersByTimeAsync(SERVICE_START_MS);

        expect(store.error).toBe(false);
        expect(store.errorMessage).toBe('');
        expect(store.isInitialized).toBe(true);
        expect(store.isServiceReady()).toBe(true);
        expect(store.connections.map((c) => c.id)).toEqual(['bob1']);
        expect(isSubscribed(store.connections[0])).toBe(true);
    });
});

describe('NostrWalletConnectStore request event age and expiration', () => {
    const NOW = 1_800_000_000;

    // SDK-shaped service: subscribe opens a pool subscription whose
    // onevent decrypts the request and dispatches it to the handler
    function createSdkLikeService() {
        const service: any = {
            delivered: [] as ((event: any) => Promise<void>)[],
            pool: {
                subscribe: jest.fn(
                    (_relays: string[], _filter: any, params: any) => {
                        service.delivered.push(params.onevent);
                        return { close: jest.fn() };
                    }
                )
            },
            decrypt: jest.fn(async (_keypair: any, content: string) => content),
            publishWalletServiceInfoEvent: jest.fn(),
            close: jest.fn(),
            subscribe: jest.fn(
                async (
                    _keypair: any,
                    handler: NWCWalletServiceRequestHandler
                ) => {
                    service.pool.subscribe(
                        [OLD_RELAY],
                        { kinds: [23194] },
                        {
                            onevent: async (event: any) => {
                                const request = JSON.parse(
                                    await service.decrypt(
                                        _keypair,
                                        event.content
                                    )
                                );
                                if (request.method === 'pay_invoice') {
                                    await handler.payInvoice?.(request.params);
                                } else if (request.method === 'get_info') {
                                    await handler.getInfo?.();
                                }
                            }
                        }
                    );
                    return () => {};
                }
            )
        };
        return service;
    }

    async function subscribe() {
        const sdkService = createSdkLikeService();
        (NWCWalletService as unknown as jest.Mock).mockImplementation(
            () => sdkService
        );
        const { store } = createStore();
        addConnection(store, { permissions: ['pay_invoice', 'get_info'] });
        (store as any).walletServiceKeys = { privateKey: hex64('f') };
        await (store as any).initializeNWCWalletServices();
        const service = (store as any).nwcWalletServices.get(OLD_RELAY);
        const handler = {
            payInvoice: jest.fn().mockResolvedValue({}),
            getInfo: jest.fn().mockResolvedValue({})
        };
        await service.subscribe({ clientPubkey: hex64('a') }, handler);
        const deliver = (event: any) =>
            sdkService.delivered[0]({
                id: hex64('e'),
                pubkey: hex64('a'),
                tags: [],
                ...event
            });
        return { handler, deliver };
    }

    const payInvoice = JSON.stringify({
        method: 'pay_invoice',
        params: { invoice: 'lnbc1late' }
    });
    const getInfo = JSON.stringify({ method: 'get_info', params: {} });

    beforeEach(() => {
        jest.spyOn(Date, 'now').mockReturnValue(NOW * 1000);
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('pays a pay_invoice request signed a minute ago', async () => {
        const { handler, deliver } = await subscribe();

        await deliver({ created_at: NOW - 60, content: payInvoice });

        expect(handler.payInvoice).toHaveBeenCalledTimes(1);
    });

    it('ignores a pay_invoice request delivered two hours after it was signed', async () => {
        const { handler, deliver } = await subscribe();

        await deliver({ created_at: NOW - 2 * 60 * 60, content: payInvoice });

        expect(handler.payInvoice).not.toHaveBeenCalled();
    });

    it('ignores a pay_invoice request dated far in the future', async () => {
        const { handler, deliver } = await subscribe();

        await deliver({ created_at: NOW + 60 * 60, content: payInvoice });

        expect(handler.payInvoice).not.toHaveBeenCalled();
    });

    it('ignores a request whose expiration tag has passed', async () => {
        const { handler, deliver } = await subscribe();

        await deliver({
            created_at: NOW - 30,
            tags: [['expiration', String(NOW - 1)]],
            content: payInvoice
        });
        await deliver({
            created_at: NOW - 30,
            tags: [['expiration', String(NOW - 1)]],
            content: getInfo
        });

        expect(handler.payInvoice).not.toHaveBeenCalled();
        expect(handler.getInfo).not.toHaveBeenCalled();
    });

    it('pays a request whose expiration tag has not passed', async () => {
        const { handler, deliver } = await subscribe();

        await deliver({
            created_at: NOW - 30,
            tags: [['expiration', String(NOW + 30)]],
            content: payInvoice
        });

        expect(handler.payInvoice).toHaveBeenCalledTimes(1);
    });

    it('still answers an old request that does not pay', async () => {
        const { handler, deliver } = await subscribe();

        await deliver({ created_at: NOW - 2 * 60 * 60, content: getInfo });

        expect(handler.getInfo).toHaveBeenCalledTimes(1);
    });

    it('warns when the service has no pool to check events on', async () => {
        (NWCWalletService as unknown as jest.Mock).mockImplementation(() => ({
            publishWalletServiceInfoEvent: jest.fn(),
            close: jest.fn()
        }));
        const { store } = createStore();
        addConnection(store);

        await (store as any).initializeNWCWalletServices();

        expect((store as any).nwcWalletServices.has(OLD_RELAY)).toBe(true);
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('no pool.subscribe')
        );
    });
});

// Runs the store's check inside the real @getalby/sdk NWCWalletService, so
// an SDK update that stops routing request events through pool.subscribe,
// or changes decrypt, fails here instead of turning the check off. Only the
// pool's network calls are stubbed.
describe('NostrWalletConnectStore request event checks with the real SDK', () => {
    const sdk = jest.requireActual('@getalby/sdk');
    const walletSecret = generateSecretKey();
    const clientSecret = generateSecretKey();
    const walletPubkey = getPublicKey(walletSecret);
    const clientPubkey = getPublicKey(clientSecret);

    async function subscribe() {
        const subscriptions: any[] = [];
        // the store wraps pool.subscribe, so keep the stub it wraps
        const poolSubscribe = jest.fn(
            (_relays: string[], _filter: any, params: any) => {
                subscriptions.push(params);
                return { close: jest.fn() };
            }
        );
        (NWCWalletService as unknown as jest.Mock).mockImplementation(
            (options: any) => {
                const service = new sdk.NWCWalletService(options);
                expect(typeof service.pool?.subscribe).toBe('function');
                service.pool.ensureRelay = jest.fn().mockResolvedValue({});
                service.pool.publish = jest.fn(() => [Promise.resolve('ok')]);
                service.pool.subscribe = poolSubscribe;
                return service;
            }
        );
        (NWCWalletServiceKeyPair as unknown as jest.Mock).mockImplementation(
            (secret: string, pubkey: string) =>
                new sdk.NWCWalletServiceKeyPair(secret, pubkey)
        );
        const { store } = createStore();
        addConnection(store, { pubkey: clientPubkey });
        (store as any).walletServiceKeys = {
            privateKey: bytesToHex(walletSecret),
            publicKey: walletPubkey
        };
        await (store as any).initializeNWCWalletServices();
        const service = (store as any).nwcWalletServices.get(OLD_RELAY);
        const handler = {
            payInvoice: jest.fn().mockResolvedValue({
                result: { preimage: hex64('b') },
                error: undefined
            }),
            getInfo: jest.fn().mockResolvedValue({
                result: { methods: ['get_info'] },
                error: undefined
            })
        };
        await service.subscribe(
            new sdk.NWCWalletServiceKeyPair(
                bytesToHex(walletSecret),
                clientPubkey
            ),
            handler
        );
        expect(service.pool.subscribe).not.toBe(poolSubscribe);
        expect(poolSubscribe).toHaveBeenCalledWith(
            [OLD_RELAY],
            expect.objectContaining({ kinds: [23194] }),
            expect.anything()
        );
        expect(subscriptions).toHaveLength(1);
        return { handler, onevent: subscriptions[0].onevent };
    }

    function requestEvent(
        method: string,
        params: Record<string, unknown>,
        ageSeconds: number,
        encryption: 'nip04' | 'nip44_v2' = 'nip04'
    ) {
        const plaintext = JSON.stringify({ method, params });
        const content =
            encryption === 'nip04'
                ? nip04.encrypt(clientSecret, walletPubkey, plaintext)
                : nip44.encrypt(
                      plaintext,
                      nip44.getConversationKey(clientSecret, walletPubkey)
                  );
        return finalizeEvent(
            {
                kind: 23194,
                created_at: Math.floor(Date.now() / 1000) - ageSeconds,
                tags: [
                    ['p', walletPubkey],
                    ['encryption', encryption]
                ],
                content
            },
            clientSecret
        );
    }

    beforeEach(() => {
        jest.useRealTimers();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('pays a pay_invoice request signed a minute ago', async () => {
        const { handler, onevent } = await subscribe();

        await onevent(
            requestEvent('pay_invoice', { invoice: 'lnbc1recent' }, 60)
        );

        expect(handler.payInvoice).toHaveBeenCalledWith({
            invoice: 'lnbc1recent'
        });
    });

    it.each(['nip04', 'nip44_v2'] as const)(
        'ignores a %s pay_invoice request signed two hours ago',
        async (encryption) => {
            const { handler, onevent } = await subscribe();

            await onevent(
                requestEvent(
                    'pay_invoice',
                    { invoice: 'lnbc1late' },
                    2 * 60 * 60,
                    encryption
                )
            );

            expect(handler.payInvoice).not.toHaveBeenCalled();
        }
    );

    it.each(['nip04', 'nip44_v2'] as const)(
        'answers a %s get_info request signed two hours ago',
        async (encryption) => {
            const { handler, onevent } = await subscribe();

            await onevent(
                requestEvent('get_info', {}, 2 * 60 * 60, encryption)
            );

            expect(handler.getInfo).toHaveBeenCalledTimes(1);
        }
    );

    describe('request mark', () => {
        const nowSeconds = () => Math.floor(Date.now() / 1000);
        const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
        const seedMark = (mark: number) =>
            storedItems.set(
                NWC_REQUEST_MARKS_KEY,
                JSON.stringify({ 'conn-1': mark })
            );
        const markWrites = () =>
            (Storage.setItem as jest.Mock).mock.calls.filter(
                ([key]) => key === NWC_REQUEST_MARKS_KEY
            );

        it('ignores a request older than the window behind the newest one accepted', async () => {
            const { handler, onevent } = await subscribe();

            await onevent(requestEvent('get_info', {}, 60));
            expect(handler.getInfo).toHaveBeenCalledTimes(1);

            // an old event delivered again, e.g. once its id is forgotten
            await onevent(requestEvent('get_info', {}, 30 * 60));
            expect(handler.getInfo).toHaveBeenCalledTimes(1);

            // within the window it still runs
            await onevent(requestEvent('get_info', {}, 5 * 60));
            expect(handler.getInfo).toHaveBeenCalledTimes(2);
        });

        it('takes any age while there is no mark, then holds later requests to it', async () => {
            const { handler, onevent } = await subscribe();

            await onevent(requestEvent('get_info', {}, 2 * 60 * 60));
            expect(handler.getInfo).toHaveBeenCalledTimes(1);

            await onevent(requestEvent('get_info', {}, 60));
            expect(handler.getInfo).toHaveBeenCalledTimes(2);

            await onevent(requestEvent('get_info', {}, 2 * 60 * 60));
            expect(handler.getInfo).toHaveBeenCalledTimes(2);
        });

        it('keeps the mark across a restart', async () => {
            seedMark(nowSeconds() - 60);
            const { handler, onevent } = await subscribe();

            await onevent(requestEvent('get_info', {}, 30 * 60));
            expect(handler.getInfo).not.toHaveBeenCalled();

            await onevent(requestEvent('get_info', {}, 30));
            expect(handler.getInfo).toHaveBeenCalledTimes(1);
        });

        it('does not move the mark past now for a request dated in the future', async () => {
            const { handler, onevent } = await subscribe();

            await onevent(requestEvent('get_info', {}, -60 * 60));
            expect(handler.getInfo).toHaveBeenCalledTimes(1);
            await flush();
            expect(
                JSON.parse(markWrites()[0][1])['conn-1']
            ).toBeLessThanOrEqual(nowSeconds());

            await onevent(requestEvent('get_info', {}, 5 * 60));
            expect(handler.getInfo).toHaveBeenCalledTimes(2);

            await onevent(requestEvent('get_info', {}, 15 * 60));
            expect(handler.getInfo).toHaveBeenCalledTimes(2);
        });

        it('does not lock requests out when the saved mark is ahead of the clock', async () => {
            seedMark(nowSeconds() + 24 * 60 * 60);
            const { handler, onevent } = await subscribe();

            await onevent(requestEvent('get_info', {}, 60));

            expect(handler.getInfo).toHaveBeenCalledTimes(1);
        });

        it('holds a pay request to the window as before, without a mark', async () => {
            const { handler, onevent } = await subscribe();

            await onevent(
                requestEvent('pay_invoice', { invoice: 'lnbc1late' }, 30 * 60)
            );
            await onevent(requestEvent('get_info', {}, 60));
            await onevent(
                requestEvent('pay_invoice', { invoice: 'lnbc1late' }, 30 * 60)
            );

            expect(handler.payInvoice).not.toHaveBeenCalled();
            expect(handler.getInfo).toHaveBeenCalledTimes(1);
        });

        it('saves the mark once it is a minute ahead of the saved one', async () => {
            const { onevent } = await subscribe();

            await onevent(requestEvent('get_info', {}, 120));
            await flush();
            expect(markWrites()).toHaveLength(1);

            await onevent(requestEvent('get_info', {}, 100));
            await flush();
            expect(markWrites()).toHaveLength(1);

            await onevent(requestEvent('get_info', {}, 0));
            await flush();
            expect(markWrites()).toHaveLength(2);
            expect(
                JSON.parse(markWrites()[1][1])['conn-1']
            ).toBeGreaterThanOrEqual(nowSeconds() - 1);
        });

        it('answers when the marks cannot be read, and reads them on the next request', async () => {
            const read = (
                Storage.getItem as jest.Mock
            ).getMockImplementation()!;
            let failing = true;
            (Storage.getItem as jest.Mock).mockImplementation(
                async (key: string) => {
                    if (failing && key === NWC_REQUEST_MARKS_KEY) {
                        throw new Error('keychain read failed');
                    }
                    return read(key);
                }
            );
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            const { handler, onevent } = await subscribe();

            // the marks cannot be read, so this request sets the first mark
            await onevent(requestEvent('get_info', {}, 2 * 60 * 60));
            expect(handler.getInfo).toHaveBeenCalledTimes(1);

            // only the stored mark, read now, holds this one back
            failing = false;
            seedMark(nowSeconds() - 30);
            await onevent(requestEvent('get_info', {}, 30 * 60));
            expect(handler.getInfo).toHaveBeenCalledTimes(1);
        });

        it('keeps a newer mark in memory when an older one is read later', async () => {
            const read = (
                Storage.getItem as jest.Mock
            ).getMockImplementation()!;
            let failing = true;
            (Storage.getItem as jest.Mock).mockImplementation(
                async (key: string) => {
                    if (failing && key === NWC_REQUEST_MARKS_KEY) {
                        throw new Error('keychain read failed');
                    }
                    return read(key);
                }
            );
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            const { handler, onevent } = await subscribe();

            await onevent(requestEvent('get_info', {}, 60));
            expect(handler.getInfo).toHaveBeenCalledTimes(1);

            // an older mark than the one just accepted
            failing = false;
            seedMark(nowSeconds() - 60 * 60);
            await onevent(requestEvent('get_info', {}, 30 * 60));

            expect(handler.getInfo).toHaveBeenCalledTimes(1);
        });

        it('does not drop the stored marks of other connections when a read failed before the save', async () => {
            const read = (
                Storage.getItem as jest.Mock
            ).getMockImplementation()!;
            let failing = true;
            (Storage.getItem as jest.Mock).mockImplementation(
                async (key: string) => {
                    if (failing && key === NWC_REQUEST_MARKS_KEY) {
                        throw new Error('keychain read failed');
                    }
                    return read(key);
                }
            );
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            const other = nowSeconds() - 10;
            storedItems.set(
                NWC_REQUEST_MARKS_KEY,
                JSON.stringify({ 'conn-1': nowSeconds() - 60, other })
            );
            const { onevent } = await subscribe();

            // the marks cannot be read, so nothing may be written over them
            await onevent(requestEvent('get_info', {}, 30));
            await flush();
            expect(markWrites()).toHaveLength(0);
            expect(JSON.parse(storedItems.get(NWC_REQUEST_MARKS_KEY)!)).toEqual(
                expect.objectContaining({ other })
            );

            // once they are read, the save keeps them
            failing = false;
            await onevent(requestEvent('get_info', {}, 0));
            await flush();
            const saved = JSON.parse(storedItems.get(NWC_REQUEST_MARKS_KEY)!);
            expect(saved.other).toBe(other);
            expect(saved['conn-1']).toBeGreaterThanOrEqual(nowSeconds() - 1);
        });

        it('answers when the mark cannot be saved', async () => {
            const write = (
                Storage.setItem as jest.Mock
            ).getMockImplementation()!;
            (Storage.setItem as jest.Mock).mockImplementation(
                async (key: string, value: string) => {
                    if (key === NWC_REQUEST_MARKS_KEY) {
                        throw new Error('keychain write failed');
                    }
                    return write(key, value);
                }
            );
            const error = jest
                .spyOn(console, 'error')
                .mockImplementation(() => undefined);
            const { handler, onevent } = await subscribe();

            await onevent(requestEvent('get_info', {}, 60));
            await flush();

            expect(handler.getInfo).toHaveBeenCalledTimes(1);
            expect(error).toHaveBeenCalledWith(
                'NWC: failed to save request marks:',
                expect.any(Error)
            );
        });
    });
});

describe('NostrWalletConnectStore request mark and subscriptions', () => {
    const window = NostrConnectUtils.REQUEST_REPLAY_WINDOW_SECONDS;
    const nowSeconds = () => Math.floor(Date.now() / 1000);
    const seedMark = (mark: number) =>
        storedItems.set(
            NWC_REQUEST_MARKS_KEY,
            JSON.stringify({ 'conn-1': mark })
        );

    it('subscribes without a filter when the connection has no mark', async () => {
        const {
            connections: [connection]
        } = await startService();

        expect(
            relays.get(connection.relayUrl)!.filters.get(connection.pubkey)
        ).toBeUndefined();
    });

    it('asks the relay only for requests newer than the window behind the mark', async () => {
        const mark = nowSeconds() - 100;
        seedMark(mark);

        const {
            connections: [connection]
        } = await startService();

        expect(
            relays.get(connection.relayUrl)!.filters.get(connection.pubkey)
        ).toEqual({ since: mark - window });
    });

    it('does not ask for requests after now when the mark is ahead of the clock', async () => {
        const started = nowSeconds();
        seedMark(started + 24 * 60 * 60);

        const {
            connections: [connection]
        } = await startService();

        const filter = relays
            .get(connection.relayUrl)!
            .filters.get(connection.pubkey) as { since: number };
        expect(filter.since).toBeGreaterThanOrEqual(started - window);
        expect(filter.since).toBeLessThanOrEqual(nowSeconds() - window);
    });

    it('forgets the marks of a connection that no longer exists', async () => {
        const mark = nowSeconds() - 100;
        storedItems.set(
            NWC_REQUEST_MARKS_KEY,
            JSON.stringify({ 'conn-1': mark, deleted: mark })
        );

        await startService();
        await jest.advanceTimersByTimeAsync(0);

        expect(JSON.parse(storedItems.get(NWC_REQUEST_MARKS_KEY)!)).toEqual({
            'conn-1': mark
        });
    });

    it("keeps another wallet's marks when the connections are loaded", async () => {
        const mark = nowSeconds() - 100;
        storedItems.set(
            NWC_REQUEST_MARKS_KEY,
            JSON.stringify({ 'conn-1': mark, 'conn-2': mark })
        );

        const { store } = await startService([
            {},
            { nodePubkey: 'another-node-pubkey' }
        ]);
        await store.loadConnections();
        await jest.advanceTimersByTimeAsync(0);

        expect(store.connections.map((c) => c.id)).toEqual(['conn-1']);
        expect((store as any).requestMarks.get('conn-2')).toBe(mark);
    });

    it('drops the mark of a deleted connection from memory', async () => {
        seedMark(nowSeconds() - 100);
        const {
            store,
            connections: [connection]
        } = await startService();
        await (store as any).loadRequestMarks();
        expect((store as any).requestMarks.has(connection.id)).toBe(true);

        const deletion = store.deleteConnection(connection.id);
        await jest.advanceTimersByTimeAsync(RELAY_RELEASE_GRACE_MS);
        await deletion;

        expect((store as any).requestMarks.has(connection.id)).toBe(false);
    });

    it('removes the marks with the rest of the connection data', async () => {
        seedMark(nowSeconds() - 100);
        const { store } = await startService();

        await store.deleteAllConnectionData();

        expect(storedItems.has(NWC_REQUEST_MARKS_KEY)).toBe(false);
    });
});
