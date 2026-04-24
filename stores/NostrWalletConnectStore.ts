// Ensure TextDecoder is available before any nostr-tools imports
if (typeof global !== 'undefined' && !global.TextDecoder) {
    const TextEncodingPolyfill = require('text-encoding');
    global.TextDecoder = TextEncodingPolyfill.TextDecoder;
    global.TextEncoder = TextEncodingPolyfill.TextEncoder;
}
import 'websocket-polyfill';
import { action, computed, observable, runInAction } from 'mobx';
import { nwc } from '@getalby/sdk';
import type {
    Nip47GetInfoResponse,
    Nip47GetBalanceResponse,
    Nip47PayInvoiceRequest,
    Nip47PayResponse,
    Nip47MakeInvoiceRequest,
    Nip47LookupInvoiceRequest,
    Nip47ListTransactionsRequest,
    Nip47ListTransactionsResponse,
    Nip47Transaction,
    Nip47SignMessageResponse,
    Nip47SignMessageRequest,
    Nip47SingleMethod
} from '@getalby/sdk/dist/nwc/types';

import type {
    NWCWalletServiceRequestHandler,
    NWCWalletServiceResponsePromise
} from '@getalby/sdk/dist/nwc';

import {
    getPublicKey,
    generatePrivateKey,
    relayInit,
    getEventHash,
    getSignature,
    UnsignedEvent,
    validateEvent,
    verifySignature
} from 'nostr-tools';
import * as nip04 from '@nostr/tools/nip04';
import * as nip44 from '@nostr/tools/nip44';
import { hexToBytes } from '@noble/hashes/utils';

import {
    Platform,
    NativeModules,
    DeviceEventEmitter,
    AppState
} from 'react-native';
import { Notifications } from 'react-native-notifications';
import ReactNativeBlobUtil from 'react-native-blob-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import NostrConnectUtils from '../utils/NostrConnectUtils';
import {
    buildNostrWalletConnectUrl,
    InvalidLightningAddressError,
    isValidLightningAddress
} from '../utils/NostrWalletConnectUrlUtils';
import IOSBackgroundTaskUtils from '../utils/IOSBackgroundTaskUtils';
import dateTimeUtils from '../utils/DateTimeUtils';
import { satsToMillisats } from '../utils/AmountUtils';
import { numberWithCommas } from '../utils/UnitsUtils';

import NWCConnection, {
    BudgetRenewalType,
    ConnectionActivity,
    ConnectionActivityType,
    ConnectionPaymentSourceType,
    ConnectionWarningType,
    TimeUnit
} from '../models/NWCConnection';
import type { StoredNWCConnectionData } from '../models/NWCConnection';
import Invoice from '../models/Invoice';
import CashuInvoice from '../models/CashuInvoice';
import Payment from '../models/Payment';
import CashuPayment from '../models/CashuPayment';

import Storage from '../storage';

import SettingsStore from './SettingsStore';
import BalanceStore from './BalanceStore';
import NodeInfoStore from './NodeInfoStore';
import TransactionsStore from './TransactionsStore';
import PaymentsStore from './PaymentsStore';
import CashuStore from './CashuStore';
import InvoicesStore from './InvoicesStore';
import MessageSignStore from './MessageSignStore';
import LightningAddressStore from './LightningAddressStore';
import ModalStore from './ModalStore';

export const NWC_CONNECTIONS_KEY = 'zeus-nwc-connections';
export const NWC_PENDING_PAYMENTS = 'zeus-nwc-pending-payments';
const NWC_PROCESSED_REPLAY_EVENTS = 'zeus-nwc-processed-replay-events';
const NWC_REPLAY_RESPONSES = 'zeus-nwc-replay-responses';
export const NWC_CLIENT_KEYS = 'zeus-nwc-client-keys';
export const NWC_SERVICE_KEYS = 'zeus-nwc-service-keys';
export const NWC_CASHU_ENABLED = 'zeus-nwc-cashu-enabled';
export const NWC_PERSISTENT_SERVICE_ENABLED = 'persistentNWCServicesEnabled';
export const NWC_IOS_EVENTS_LISTENER_SERVER_URL =
    'https://nwc-ios-handoff.zeusln.com/api/v1';

const MAX_RELAY_ATTEMPTS = 5;
const SUBSCRIPTION_DELAY_MS = 1000;
const SERVICE_START_DELAY_MS = 2000;
const DEFAULT_INVOICE_EXPIRY_SECONDS = 3600;
const PAYMENT_TIMEOUT_SECONDS = 120;
const PAYMENT_FEE_LIMIT_SATS = 1000;
const PAYMENT_PROCESSING_DELAY_MS = 100;
// Replay cache limits: keep up to 1000 responses and processed event IDs
// to prevent unbounded memory growth in long-running sessions
const MAX_REPLAY_RESPONSES = 1000;
const MAX_PROCESSED_REPLAY_EVENTS = 1000;
// Cache entries older than 24 hours are considered stale and rejected even if in cache
// This prevents double-charging if a replay arrives after FIFO eviction but within event TTL
const REPLAY_CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_NOSTR_RELAYS = [
    'wss://relay.getalby.com/v1',
    'wss://relay.snort.social',
    'wss://relay.damus.io'
];

// Per NIP-47 spec: get_info requires NO permissions and should always be available
// All methods except get_info require explicit connection permissions
const NWC_METHODS_REQUIRING_CONNECTION_PERMISSION =
    NostrConnectUtils.getFullAccessPermissions().filter(
        (method) => method !== 'get_info'
    );

enum ErrorCodes {
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    RATE_LIMITED = 'RATE_LIMITED',
    INVALID_PARAMS = 'INVALID_PARAMS',
    INVALID_INVOICE = 'INVALID_INVOICE',
    FAILED_TO_PAY_INVOICE = 'FAILED_TO_PAY_INVOICE',
    FAILED_TO_CREATE_INVOICE = 'FAILED_TO_CREATE_INVOICE',
    NOT_FOUND = 'NOT_FOUND',
    NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
    RESTRICTED = 'RESTRICTED',
    INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
    INVOICE_EXPIRED = 'INVOICE_EXPIRED',
    UNSUPPORTED_ENCRYPTION = 'UNSUPPORTED_ENCRYPTION',
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED'
}

interface ClientKeys {
    [pubkey: string]: string;
}

interface WalletServiceKeys {
    privateKey: string;
    publicKey: string;
}

interface StoredReplayResponse {
    method: Nip47SingleMethod;
    response: any;
    encryptionScheme: NwcEncryptionScheme;
    cachedAt: number; // Timestamp when response was cached (ms since epoch)
}

interface NostrEvent {
    kind: number;
    tags: string[][];
    created_at: number;
    pubkey: string;
    content: string;
    id: string;
    sig: string;
}
interface RestoreResponse {
    connections: { relay: string; pubkey: string }[];
    events: string[];
}
interface NWCRequest {
    id: string;
    method: Nip47SingleMethod;
    params: any;
}

type NwcEncryptionScheme = 'nip04' | 'nip44_v2';

class UnsupportedEncryptionError extends Error {
    constructor(
        public readonly connection: NWCConnection,
        public readonly eventId: string,
        public readonly encryptionScheme: NwcEncryptionScheme
    ) {
        super('UNSUPPORTED_ENCRYPTION');
        this.name = 'UnsupportedEncryptionError';
    }
}

interface InvoiceEventType {
    eventStr: string;
    request: NWCRequest;
    connection: NWCConnection;
    eventId: string;
    amount: number;
    encryptionScheme: NwcEncryptionScheme;
}

export interface PendingPayment {
    eventStr: string;
    request: NWCRequest;
    connection: NWCConnection;
    eventId: string;
    connectionName: string;
    amount: number;
    encryptionScheme?: NwcEncryptionScheme;
    isProcessed?: boolean;
    status?: boolean;
    errorMessage?: string;
}

export interface CreateConnectionParams {
    id?: string; // For Regenerating connections with the same Id
    replaceConnectionId?: string;
    name: string;
    relayUrl: string;
    permissions?: Nip47SingleMethod[];
    budgetAmount?: number;
    budgetRenewal?: BudgetRenewalType;
    expiresAt?: Date;
    customExpiryValue?: number;
    customExpiryUnit?: TimeUnit;
    includeLightningAddress?: boolean;
    totalSpendSats?: number;
    lastBudgetReset?: Date;
    activity?: ConnectionActivity[];
}
export default class NostrWalletConnectStore {
    @observable public loading = false;
    @observable public error = false;
    @observable public errorMessage = '';
    @observable public loadingMsg?: string;
    @observable public connections: NWCConnection[] = [];
    @observable private nwcWalletServices: Map<string, nwc.NWCWalletService> =
        new Map();
    @observable private activeSubscriptions: Map<string, () => void> =
        new Map();
    @observable private publishedRelays: Set<string> = new Set();
    @observable public waitingForConnection = false;
    @observable public currentConnectionId?: string;
    @observable public connectionJustSucceeded = false;
    @observable public isInNWCConnectionQRView = false;
    @observable public isInNWCPendingPaymentsView = false;
    @observable private walletServiceKeys: WalletServiceKeys | null = null;
    @observable public cashuEnabled: boolean = false;
    @observable public persistentNWCServiceEnabled: boolean = false;
    @observable private lastConnectionAttempt: number = 0;
    @observable private iosBackgroundTaskActive: boolean = false;
    @observable public iosBackgroundTimeRemaining: number = 0;
    @observable public iosHandoffInProgress: boolean = false;
    @observable public isProcessingPendingPayInvoices: boolean = false;
    @observable public isAllPendingPaymentsSuccessful: boolean = false;
    @observable public processedPendingPayInvoiceEventIds: string[] = [];
    @observable public failedPendingPayInvoiceEventIds: string[] = [];
    @observable public pendingPayInvoiceErrors: Map<string, string> = new Map();
    private replayResponsesCache: Map<string, StoredReplayResponse> | null =
        null;
    @observable public maxBudgetLimit: number = 0; // Max wallet balance
    private iosBackgroundTimerInterval: any = null;
    private androidReconnectionListener: any = null;
    private appStateListener: any = null;
    private androidLogListener: any = null;
    private processedReplayEventsCache: Set<string> | null = null;

    settingsStore: SettingsStore;
    balanceStore: BalanceStore;
    nodeInfoStore: NodeInfoStore;
    transactionsStore: TransactionsStore;
    cashuStore: CashuStore;
    invoicesStore: InvoicesStore;
    messageSignStore: MessageSignStore;
    lightningAddressStore: LightningAddressStore;
    modalStore: ModalStore;
    paymentsStore: PaymentsStore;

    constructor(
        settingsStore: SettingsStore,
        balanceStore: BalanceStore,
        nodeInfoStore: NodeInfoStore,
        transactionsStore: TransactionsStore,
        cashuStore: CashuStore,
        invoicesStore: InvoicesStore,
        messageSignStore: MessageSignStore,
        lightningAddressStore: LightningAddressStore,
        modalStore: ModalStore,
        paymentsStore: PaymentsStore
    ) {
        this.settingsStore = settingsStore;
        this.balanceStore = balanceStore;
        this.nodeInfoStore = nodeInfoStore;
        this.transactionsStore = transactionsStore;
        this.cashuStore = cashuStore;
        this.invoicesStore = invoicesStore;
        this.messageSignStore = messageSignStore;
        this.lightningAddressStore = lightningAddressStore;
        this.modalStore = modalStore;
        this.paymentsStore = paymentsStore;
    }

    @action
    public initializeService = async () => {
        await this.loadInitialSettings();
        const hasActiveConnections = this.activeConnections.length > 0;
        if (!hasActiveConnections) return;

        if (this.isInNWCConnectionQRView) this.endIOSBackgroundTask();
        await this.retryWithBackoff(async () => {
            runInAction(() => {
                this.error = false;
                this.loading = true;
                this.loadingMsg = localeString(
                    'stores.NostrWalletConnectStore.initializingService'
                );
            });
            try {
                await this.initializeNWCWalletServices();
                await this.startService(hasActiveConnections);
                await this.loadMaxBudget();
                await this.checkAndResetAllBudgets();
                if (Platform.OS === 'android') {
                    this.setupAndroidReconnectionListener();
                    this.setupAppStateMonitoring();
                    this.setupAndroidLogListener();
                }
                if (Platform.OS === 'ios') {
                    await this.fetchPendingEvents();
                    await this.sendHandoffRequest();
                }
                runInAction(() => {
                    this.loadingMsg = undefined;
                    this.loading = false;
                });
            } catch (error) {
                console.error('Failed to initialize NWC service:', error);
                const errorMessage =
                    (error instanceof Error ? error.message : String(error)) ||
                    localeString(
                        'stores.NostrWalletConnectStore.error.failedToInitializeService'
                    );
                runInAction(() => {
                    this.setError(errorMessage);
                    this.loading = false;
                    this.loadingMsg = undefined;
                });
            }
        }, MAX_RELAY_ATTEMPTS);
    };

    private async loadInitialSettings() {
        await Promise.all([
            this.initializeWalletServiceKeys(),
            this.loadPersistentServiceSetting(),
            this.loadCashuSetting(),
            this.loadConnections()
        ]);
    }

    private async initializeWalletServiceKeys(): Promise<void> {
        let keys = await this.loadWalletServiceKeys();
        if (!keys) {
            keys = this.generateWalletServiceKeys();
            await this.saveWalletServiceKeys(keys);
        }
        runInAction(() => {
            this.walletServiceKeys = keys;
            this.publishedRelays.clear();
        });
    }
    private initializeNWCWalletServices = async () => {
        let successfulRelays = 0;
        const relays = this.activeConnections.map((conn) => conn.relayUrl);
        const uniqueRelaysArr = [...new Set(relays)];
        for (const relayUrl of uniqueRelaysArr) {
            if (this.nwcWalletServices.has(relayUrl)) {
                successfulRelays++;
                continue;
            }

            try {
                this.nwcWalletServices.set(
                    relayUrl,
                    new nwc.NWCWalletService({
                        relayUrl
                    })
                );
                successfulRelays++;
            } catch (relayError) {
                console.warn(
                    `Failed to initialize relay ${relayUrl}:`,
                    relayError
                );
            }
        }

        if (successfulRelays === 0) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToInitializeRelays'
                )
            );
        }
    };
    @action
    public startService = async (hasActiveConnections = false) => {
        try {
            if (!this.walletServiceKeys?.privateKey) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.walletServiceKeyNotFound'
                    )
                );
            }
            if (hasActiveConnections && this.persistentNWCServiceEnabled) {
                await this.initializeAndroidPersistentService();
            }
            await this.verifyServiceHealth();
            const successfulPublishes = await this.publishToAllRelays();
            if (successfulPublishes === 0) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.failedToPublishToRelays'
                    )
                );
            }
            setTimeout(async () => {
                await this.subscribeToAllConnections();
            }, SERVICE_START_DELAY_MS);
        } catch (error) {
            console.error('Failed to start NWC service:', error);
            const errorMessage =
                (error instanceof Error ? error.message : String(error)) ||
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToStartService'
                );
            runInAction(() => {
                this.setError(errorMessage);
            });
            return false;
        }
    };

    @action
    public stopService = async (): Promise<boolean> => {
        try {
            runInAction(() => {
                this.loading = true;
                this.error = false;
            });

            if (Platform.OS === 'android') {
                try {
                    const { NostrConnectModule } =
                        require('react-native').NativeModules;
                    await NostrConnectModule.stopNostrConnectService();
                } catch (serviceError) {
                    console.warn(
                        'NWC: Failed to stop Android background service:',
                        serviceError
                    );
                }
            }
            await this.unsubscribeFromAllConnections();
            return true;
        } catch (error: any) {
            console.error('Failed to stop NWC service:', error);
            runInAction(() => {
                this.error = true;
                this.errorMessage =
                    (error instanceof Error ? error.message : String(error)) ||
                    localeString(
                        'stores.NostrWalletConnectStore.error.failedToStopService'
                    );
            });
            return false;
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };
    // iOS: Always reset (except when in NWC connection QR view)
    // Android: Only reset if persistentNWCServicesEnabled is false
    @action
    public reset = async () => {
        if (this.isInNWCConnectionQRView) this.startIOSBackgroundTask();
        if (
            (Platform.OS === 'ios' && !this.isInNWCConnectionQRView) ||
            (Platform.OS === 'android' && !this.persistentNWCServiceEnabled)
        ) {
            if (this.iosBackgroundTimerInterval) {
                clearInterval(this.iosBackgroundTimerInterval);
                this.iosBackgroundTimerInterval = null;
            }
            if (this.androidReconnectionListener) {
                this.androidReconnectionListener.remove();
                this.androidReconnectionListener = null;
            }
            if (this.appStateListener) {
                this.appStateListener.remove();
                this.appStateListener = null;
            }
            if (this.androidLogListener) {
                this.androidLogListener.remove();
                this.androidLogListener = null;
            }
            this.error = false;
            this.walletServiceKeys = null;
            this.errorMessage = '';
            this.loading = false;
            this.loadingMsg = undefined;
            this.waitingForConnection = false;
            this.currentConnectionId = undefined;
            this.connectionJustSucceeded = false;
            this.lastConnectionAttempt = 0;
            this.cashuEnabled = false;
            this.persistentNWCServiceEnabled = false;
            this.iosBackgroundTimeRemaining = 0;
            this.iosHandoffInProgress = false;
            this.nwcWalletServices.clear();
            this.publishedRelays.clear();
            this.resetPendingPayInvoiceState();
            await this.unsubscribeFromAllConnections();
        }
    };
    @action
    public resetPendingPayInvoiceState(): void {
        this.isProcessingPendingPayInvoices = false;
        this.processedPendingPayInvoiceEventIds = [];
        this.failedPendingPayInvoiceEventIds = [];
        this.pendingPayInvoiceErrors.clear();
    }
    public isServiceReady(): boolean {
        return (
            this.walletServiceKeys?.privateKey !== undefined &&
            this.nwcWalletServices.size > 0 &&
            !this.error
        );
    }

    private async verifyServiceHealth(): Promise<void> {
        if (!this.walletServiceKeys?.privateKey) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.walletServiceKeysNotInitialized'
                )
            );
        }
        if (this.nwcWalletServices.size === 0) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.noRelaysAvailable'
                )
            );
        }
        try {
            if (BackendUtils.supportsNodeInfo()) {
                await this.nodeInfoStore.getNodeInfo();
            } else {
                await this.balanceStore.getLightningBalance(true);
            }
        } catch (error) {
            console.warn('NWC: Backend not accessible, but continuing:', error);
        }
    }

    /**
     * Validates that a relay URL uses the proper WebSocket scheme (wss:// or ws://).
     * @param url The relay URL to validate.
     * @returns true if valid WebSocket scheme, false otherwise.
     */
    private validateRelayUrl = (url: string): boolean => {
        try {
            const parsed = new URL(url);
            const scheme = parsed.protocol.toLowerCase();
            return scheme === 'wss:' || scheme === 'ws:';
        } catch {
            return false;
        }
    };

    private localizeConnectionUrlBuildError(error: unknown): Error {
        if (error instanceof InvalidLightningAddressError) {
            return new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.invalidLightningAddress'
                )
            );
        }
        // Safely normalize any error type to Error instance
        if (error instanceof Error) {
            return error;
        }
        // Fallback for non-Error throws (e.g., strings, objects)
        return new Error(String(error));
    }

    /**
     * Creates a new NWC connection with the specified parameters.
     * @param params Configuration for the new connection.
     * @returns The connection URL or null if creation fails.
     * @throws Error if the connection name is invalid or the relay is unavailable.
     */
    @action
    public createConnection = async (
        params: CreateConnectionParams
    ): Promise<string> => {
        let createdConnectionId: string | undefined;
        let createdConnectionPersisted = false;
        let createdConnectionPublicKey: string | undefined;
        try {
            if (!params.name.trim()) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.connectionNameRequired'
                    )
                );
            }
            const includeLightningAddress =
                params.includeLightningAddress ?? false;
            const lud16 = this.getConnectionLud16(includeLightningAddress);
            if (includeLightningAddress && !lud16) {
                throw new InvalidLightningAddressError();
            }
            if (!isValidLightningAddress(lud16)) {
                throw new InvalidLightningAddressError();
            }

            const existingConnection = this.connections.find(
                (c) =>
                    c.name.trim().toLowerCase() ===
                    params.name.trim().toLowerCase()
            );
            if (
                existingConnection &&
                existingConnection.id !== params.replaceConnectionId
            ) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.connectionNameExists'
                    )
                );
            }

            if (!this.validateRelayUrl(params.relayUrl)) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.invalidRelayUrl'
                    )
                );
            }

            if (!this.walletServiceKeys?.privateKey) {
                await this.loadWalletServiceKeys();
            }
            const { nodeInfo } = this.nodeInfoStore;
            const nodePubkey = nodeInfo.nodeId;
            const { implementation } = this.settingsStore;

            if (!this.nwcWalletServices.has(params.relayUrl)) {
                this.nwcWalletServices.set(
                    params.relayUrl,
                    new nwc.NWCWalletService({
                        relayUrl: params.relayUrl
                    })
                );
            }
            if (!this.publishedRelays.has(params.relayUrl)) {
                const nwcWalletService = this.nwcWalletServices.get(
                    params.relayUrl
                );
                if (nwcWalletService && this.walletServiceKeys?.privateKey) {
                    try {
                        await this.retryWithBackoff(async () => {
                            await nwcWalletService.publishWalletServiceInfoEvent(
                                this.walletServiceKeys!.privateKey,
                                NostrConnectUtils.getFullAccessPermissions(),
                                NostrConnectUtils.getNotifications()
                            );
                            runInAction(() => {
                                this.publishedRelays.add(params.relayUrl);
                            });
                        }, 3);
                        await new Promise((resolve) =>
                            setTimeout(resolve, 500)
                        );
                    } catch (error) {
                        console.warn(
                            `NWC: Failed to publish wallet service info to relay ${params.relayUrl} before connection creation:`,
                            error
                        );
                    }
                }
            }

            if (params.id) {
                const connection = this.connections.find(
                    (c) => c.id === params.id
                );
                if (connection) {
                    throw new Error(
                        localeString(
                            'stores.NostrWalletConnectStore.error.connectionIdExists'
                        )
                    );
                }
            }

            const { connectionUrl, connectionPrivateKey, connectionPublicKey } =
                this.generateConnectionSecret(
                    params.relayUrl,
                    includeLightningAddress
                );
            const connectionData = {
                id: params.id || uuidv4(),
                name: params.name.trim(),
                pubkey: connectionPublicKey,
                relayUrl: params.relayUrl,
                permissions:
                    params.permissions ||
                    NostrConnectUtils.getFullAccessPermissions(),
                totalSpendSats:
                    params.totalSpendSats !== undefined
                        ? params.totalSpendSats
                        : 0,
                createdAt: new Date(),
                maxAmountSats: params.budgetAmount,
                budgetRenewal: params.budgetRenewal || BudgetRenewalType.Never,
                expiresAt: params.expiresAt,
                lastBudgetReset:
                    params.lastBudgetReset !== undefined
                        ? params.lastBudgetReset
                        : params.budgetAmount
                        ? new Date()
                        : undefined,
                customExpiryValue: params.customExpiryValue,
                customExpiryUnit: params.customExpiryUnit,
                nodePubkey,
                implementation,
                includeLightningAddress,
                activity: params.activity || []
            };

            createdConnectionId = connectionData.id;
            createdConnectionPublicKey = connectionPublicKey;
            const connection = new NWCConnection(connectionData);
            await this.storeClientKeys(
                connectionPublicKey,
                connectionPrivateKey
            );
            runInAction(() => {
                this.connections.unshift(connection);
            });
            createdConnectionPersisted = true;
            await this.saveConnections();
            const subscribed = await this.subscribeToConnection(connection);
            if (!subscribed) {
                throw new Error(
                    localeString(
                        'views.Settings.NostrWalletConnect.validation.failedToCreateConnection'
                    )
                );
            }
            await this.sendHandoffRequest();
            return connectionUrl;
        } catch (error: any) {
            if (createdConnectionPersisted && createdConnectionId) {
                try {
                    await this.deleteConnection(createdConnectionId);
                } catch (cleanupError) {
                    console.warn(
                        'NWC: Failed to roll back partially created connection:',
                        cleanupError
                    );
                }
            } else if (createdConnectionPublicKey) {
                await this.deleteClientKeys(createdConnectionPublicKey);
            }
            throw this.localizeConnectionUrlBuildError(error);
        }
    };

    /**
     * Delete an existing NWC connection and cleans up associated resources.
     * @param connectionId The unique identifier of the connection to delete.
     * @returns Promise<boolean> - True if deletion was successful, false otherwise.
     * @throws Error if the connection is not found or deletion fails.
     */
    @action
    public deleteConnection = async (connectionId: string) => {
        try {
            const connectionIndex = this.connections.findIndex(
                (c) => c.id === connectionId
            );
            if (connectionIndex === -1) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.connectionNotFound'
                    )
                );
            }

            const connection = this.connections[connectionIndex];
            await this.deleteClientKeys(connection.pubkey);
            await this.unsubscribeFromConnection(connectionId);
            runInAction(() => {
                this.connections.splice(connectionIndex, 1);
            });
            await this.saveConnections();
        } catch (error: any) {
            runInAction(() => {
                this.setError(
                    error?.message ||
                        localeString(
                            'stores.NostrWalletConnectStore.error.failedToDeleteConnection'
                        )
                );
            });

            throw error;
        }
    };

    /**
     * Update an existing NWC connection with new parameters.
     * @param connectionId The unique identifier of the connection to update.
     * @param updates Partial object containing the fields to update.
     * @returns Promise<{ nostrUrl?: string; success: boolean }> - Success flag (or error flag if connection not found or update fails) and optional regenerated URL if relay or lightning address settings changed.
     */
    @action
    public updateConnection = async (
        connectionId: string,
        updates: Partial<NWCConnection>
    ): Promise<{ nostrUrl?: string; success: boolean }> => {
        let connectionIndex = -1;
        let originalConnectionData: StoredNWCConnectionData | undefined;
        let previousUnsubscribe: (() => void) | undefined;
        let restorePreviousSubscription = false;
        let acquiredNewSubscription = false;
        try {
            runInAction(() => {
                this.error = false;
            });
            connectionIndex = this.connections.findIndex(
                (c) => c.id === connectionId
            );
            if (connectionIndex === -1) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.connectionNotFound'
                    )
                );
            }
            const connection = this.connections[connectionIndex];
            originalConnectionData = { ...connection };
            const oldRelayUrl = connection.relayUrl;
            const newRelayUrl = updates.relayUrl;

            if (newRelayUrl && !this.validateRelayUrl(newRelayUrl)) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.invalidRelayUrl'
                    )
                );
            }

            const relayUrlChanged =
                !!newRelayUrl && newRelayUrl !== oldRelayUrl;
            const includeLightningAddressChanged =
                updates.includeLightningAddress !== undefined &&
                updates.includeLightningAddress !==
                    connection.includeLightningAddress;
            const permissionsChanged =
                updates.permissions !== undefined &&
                JSON.stringify([...updates.permissions].slice().sort()) !==
                    JSON.stringify([...connection.permissions].slice().sort());

            const shouldReturnUrl =
                relayUrlChanged || includeLightningAddressChanged;
            const nextIncludeLightningAddress =
                updates.includeLightningAddress ??
                connection.includeLightningAddress;
            const requiresLightningAddressForUrl =
                shouldReturnUrl &&
                nextIncludeLightningAddress &&
                (relayUrlChanged || includeLightningAddressChanged);
            const nextLud16 = requiresLightningAddressForUrl
                ? this.getConnectionLud16(nextIncludeLightningAddress)
                : undefined;
            if (requiresLightningAddressForUrl) {
                if (!nextLud16 || !isValidLightningAddress(nextLud16)) {
                    throw new InvalidLightningAddressError();
                }
            }

            const existingClientPrivateKey = shouldReturnUrl
                ? await this.loadClientPrivateKey(connection.pubkey)
                : undefined;
            const walletServicePubkey = this.walletServiceKeys?.publicKey;

            if (
                shouldReturnUrl &&
                (!existingClientPrivateKey || !walletServicePubkey)
            ) {
                this.setError(
                    localeString(
                        'stores.NostrWalletConnectStore.error.failedToUpdateConnection'
                    )
                );
                return { success: false };
            }

            const updatedNostrUrl = shouldReturnUrl
                ? buildNostrWalletConnectUrl({
                      walletServicePubkey: walletServicePubkey!,
                      relayUrl: newRelayUrl || oldRelayUrl,
                      secret: existingClientPrivateKey!,
                      lud16: nextLud16
                  })
                : undefined;

            const shouldResubscribe = relayUrlChanged || permissionsChanged;
            previousUnsubscribe = shouldResubscribe
                ? this.activeSubscriptions.get(connectionId)
                : undefined;
            const subscriptionConnection = shouldResubscribe
                ? new NWCConnection({
                      ...connection,
                      ...updates,
                      relayUrl: newRelayUrl || oldRelayUrl,
                      includeLightningAddress: nextIncludeLightningAddress
                  })
                : undefined;

            if (shouldResubscribe && subscriptionConnection) {
                restorePreviousSubscription = !!previousUnsubscribe;
                if (previousUnsubscribe) {
                    await this.unsubscribeFromConnection(connectionId);
                }
                if (
                    !this.nwcWalletServices.has(subscriptionConnection.relayUrl)
                ) {
                    runInAction(() => {
                        this.nwcWalletServices.set(
                            subscriptionConnection.relayUrl,
                            new nwc.NWCWalletService({
                                relayUrl: subscriptionConnection.relayUrl
                            })
                        );
                    });
                }
                if (
                    !this.nwcWalletServices.has(subscriptionConnection.relayUrl)
                ) {
                    await this.initializeNWCWalletServices();
                }
                const subscribed = await this.subscribeToConnection(
                    subscriptionConnection,
                    { replaceExisting: true }
                );
                if (!subscribed) {
                    throw new Error(
                        localeString(
                            'stores.NostrWalletConnectStore.error.failedToUpdateConnection'
                        )
                    );
                }
                acquiredNewSubscription = true;
            }

            runInAction(() => {
                const oldBudgetRenewal = connection.budgetRenewal;
                const hadBudget = connection.hasBudgetLimit;
                const newBudgetRenewal = updates.budgetRenewal;
                const newMaxAmountSats = updates.maxAmountSats;

                Object.assign(connection, updates);

                const hasBudget =
                    newMaxAmountSats !== undefined && newMaxAmountSats > 0;
                const budgetRenewalChanged =
                    newBudgetRenewal !== undefined &&
                    newBudgetRenewal !== oldBudgetRenewal;

                if (!hadBudget && hasBudget) {
                    connection.resetBudget();
                } else if (hadBudget && !hasBudget) {
                    connection.lastBudgetReset = undefined;
                    connection.totalSpendSats = 0;
                } else if (hasBudget && budgetRenewalChanged) {
                    connection.resetBudget();
                }

                this.connections[connectionIndex] = connection;
            });

            await this.saveConnections();
            if (shouldReturnUrl) {
                return {
                    nostrUrl: updatedNostrUrl,
                    success: true
                };
            }
            return { success: true };
        } catch (error: any) {
            if (acquiredNewSubscription) {
                const activeUnsubscribe =
                    this.activeSubscriptions.get(connectionId);
                if (
                    activeUnsubscribe &&
                    typeof activeUnsubscribe === 'function'
                ) {
                    try {
                        activeUnsubscribe();
                    } catch {
                        // ignore rollback unsubscribe failures
                    }
                }
                if (previousUnsubscribe) {
                    this.activeSubscriptions.set(
                        connectionId,
                        previousUnsubscribe
                    );
                } else {
                    this.activeSubscriptions.delete(connectionId);
                }
            }
            if (restorePreviousSubscription && originalConnectionData) {
                try {
                    await this.subscribeToConnection(
                        new NWCConnection(originalConnectionData)
                    );
                } catch {
                    // ignore rollback resubscribe failure
                }
            }
            if (connectionIndex !== -1 && originalConnectionData) {
                runInAction(() => {
                    Object.assign(this.connections[connectionIndex], {
                        ...originalConnectionData
                    });
                });
            }
            const localizedError = this.localizeConnectionUrlBuildError(error);
            console.error('Failed to update NWC connection:', error);
            runInAction(() => {
                this.setError(
                    localizedError.message ||
                        localeString(
                            'stores.NostrWalletConnectStore.error.failedToUpdateConnection'
                        )
                );
            });
            return { success: false };
        }
    };
    @action
    public loadConnections = async () => {
        try {
            const connectionsData = await Storage.getItem(NWC_CONNECTIONS_KEY);
            if (connectionsData) {
                const connections = JSON.parse(connectionsData);
                runInAction(() => {
                    const { nodeInfo } = this.nodeInfoStore;
                    const { implementation } = this.settingsStore;
                    const currentNodeId = nodeInfo?.nodeId;
                    const currentImpl = implementation;
                    const shouldFilter = !!currentNodeId && !!currentImpl;

                    const filtered = shouldFilter
                        ? connections.filter(
                              (c: any) =>
                                  c.nodePubkey === currentNodeId &&
                                  c.implementation === currentImpl
                          )
                        : connections;

                    this.connections = filtered.map((data: any) => {
                        const conn = new NWCConnection(data);
                        return conn;
                    });
                });
                await this.checkAndResetAllBudgets();
            } else {
                runInAction(() => {
                    this.connections = [];
                });
                console.log('NWC: No connections found in storage');
            }
        } catch (error: any) {
            console.error('Failed to load NWC connections:', error);
            runInAction(() => {
                this.connections = [];
                this.setError(
                    localeString(
                        'stores.NostrWalletConnectStore.error.failedToLoadConnections'
                    )
                );
            });
        }
    };
    @action
    public saveConnections = async () => {
        try {
            const existingData = await Storage.getItem(NWC_CONNECTIONS_KEY);
            const allConnections: any[] = existingData
                ? JSON.parse(existingData)
                : [];
            const { nodeInfo } = this.nodeInfoStore;
            const { implementation } = this.settingsStore;
            const currentNodeId = nodeInfo?.nodeId;
            const filteredExisting = allConnections.filter(
                (c: any) =>
                    !(
                        c.nodePubkey === currentNodeId &&
                        c.implementation === implementation
                    )
            );
            const mergedConnections = [
                ...filteredExisting,
                ...this.connections
            ];
            const dedupedById = new Map<string, any>();
            for (const conn of mergedConnections) {
                if (conn && conn.id) {
                    dedupedById.set(conn.id, conn);
                }
            }
            await Storage.setItem(
                NWC_CONNECTIONS_KEY,
                JSON.stringify(Array.from(dedupedById.values()))
            );
        } catch (error: any) {
            console.error('Failed to save NWC connections:', error);
            runInAction(() => {
                this.setError(
                    localeString(
                        'stores.NostrWalletConnectStore.error.failedToSaveConnections'
                    )
                );
            });
            throw error;
        }
    };
    private savePendingPayments = async (pendingPayments: PendingPayment[]) => {
        try {
            const existsPendingPayment = await Storage.getItem(
                NWC_PENDING_PAYMENTS
            );
            const prev: PendingPayment[] = existsPendingPayment
                ? JSON.parse(existsPendingPayment)
                : [];
            const dedupedPayments = Array.from(
                new Map(
                    [...prev, ...pendingPayments].map((payment) => [
                        payment.eventId,
                        payment
                    ])
                ).values()
            );
            await Storage.setItem(
                NWC_PENDING_PAYMENTS,
                JSON.stringify(dedupedPayments)
            );
        } catch (error) {
            console.error('failed to save pending payment');
        }
    };

    private getProcessedReplayEvents = async (): Promise<Set<string>> => {
        if (this.processedReplayEventsCache) {
            return this.processedReplayEventsCache;
        }
        try {
            const stored = await Storage.getItem(NWC_PROCESSED_REPLAY_EVENTS);
            if (!stored) {
                this.processedReplayEventsCache = new Set();
                return this.processedReplayEventsCache;
            }
            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) {
                this.processedReplayEventsCache = new Set();
                return this.processedReplayEventsCache;
            }
            this.processedReplayEventsCache = new Set(
                parsed.filter(
                    (eventId): eventId is string => typeof eventId === 'string'
                )
            );
            return this.processedReplayEventsCache;
        } catch (error) {
            console.error('failed to load processed replay events', error);
            this.processedReplayEventsCache = new Set();
            return this.processedReplayEventsCache;
        }
    };

    private saveProcessedReplayEvents = async (
        eventIds: Set<string>
    ): Promise<boolean> => {
        const orderedIds = Array.from(eventIds).slice(-MAX_PROCESSED_REPLAY_EVENTS);
        this.processedReplayEventsCache = new Set(orderedIds);
        try {
            // Keep a bounded replay window across restarts without growing storage forever.
            await Storage.setItem(
                NWC_PROCESSED_REPLAY_EVENTS,
                JSON.stringify(orderedIds)
            );
            return true;
        } catch (error) {
            console.error('failed to save processed replay events', error);
            return false;
        }
    };

    private markProcessedReplayEvent = async (
        eventId: string
    ): Promise<boolean> => {
        if (!eventId) return false;
        // Serialize read-modify-write across all callers/connections so
        // concurrent updates can't lose entries (last-writer-wins on Storage).
        return await this.withMutex('processed-replay-events', async () => {
            const processed = await this.getProcessedReplayEvents();
            if (processed.has(eventId)) {
                return true;
            }
            processed.add(eventId);
            const saved = await this.saveProcessedReplayEvents(processed);
            if (!saved) {
                throw new Error(
                    `Critical: Failed to persist processed replay event marker for idempotency (eventId: ${eventId})`
                );
            }
            return saved;
        });
    };

    private hasProcessedReplayEvent = async (
        eventId: string
    ): Promise<boolean> => {
        if (!eventId) return false;
        const processed = await this.getProcessedReplayEvents();
        return processed.has(eventId);
    };

    private getReplayResponses = async (): Promise<
        Map<string, StoredReplayResponse>
    > => {
        if (this.replayResponsesCache) {
            return this.replayResponsesCache;
        }
        try {
            const stored = await Storage.getItem(NWC_REPLAY_RESPONSES);
            if (!stored) {
                this.replayResponsesCache = new Map();
                return this.replayResponsesCache;
            }
            const parsed = JSON.parse(stored);
            if (
                !parsed ||
                typeof parsed !== 'object' ||
                Array.isArray(parsed)
            ) {
                this.replayResponsesCache = new Map();
                return this.replayResponsesCache;
            }
            const entries = Object.entries(parsed).filter(
                ([eventId, value]) =>
                    typeof eventId === 'string' &&
                    !!value &&
                    typeof value === 'object' &&
                    'method' in value &&
                    'response' in value &&
                    'encryptionScheme' in value
            ) as [string, StoredReplayResponse][];
            this.replayResponsesCache = new Map<string, StoredReplayResponse>(
                entries
            );
            return this.replayResponsesCache;
        } catch (error) {
            console.error('failed to load replay responses', error);
            this.replayResponsesCache = new Map<string, StoredReplayResponse>();
            return this.replayResponsesCache;
        }
    };

    private saveReplayResponses = async (
        responses: Map<string, StoredReplayResponse>
    ): Promise<boolean> => {
        this.replayResponsesCache = responses;
        try {
            await Storage.setItem(
                NWC_REPLAY_RESPONSES,
                JSON.stringify(Object.fromEntries(responses))
            );
            return true;
        } catch (error) {
            console.error('failed to save replay responses', error);
            return false;
        }
    };

    private cacheReplayResponse = async (
        eventId: string,
        method: Nip47SingleMethod,
        response: any,
        encryptionScheme: NwcEncryptionScheme
    ): Promise<boolean> => {
        if (!eventId) return false;
        return await this.withMutex('replay-responses', async () => {
            const responses = await this.getReplayResponses();
            const now = Date.now();
            responses.set(eventId, {
                method,
                response,
                encryptionScheme,
                cachedAt: now
            });
            // Enforce cache size limit: keep only the most recent MAX_REPLAY_RESPONSES
            // entries by converting to array, slicing, and reconstructing the map.
            // This prevents unbounded memory growth in long-running sessions.
            if (responses.size > MAX_REPLAY_RESPONSES) {
                const entries = Array.from(responses.entries());
                const trimmed = entries.slice(-MAX_REPLAY_RESPONSES);
                const trimmedMap = new Map(trimmed);
                const saved = await this.saveReplayResponses(trimmedMap);
                if (!saved) {
                    throw new Error(
                        `Critical: Failed to persist replay response cache for idempotency (eventId: ${eventId})`
                    );
                }
                return saved;
            }
            const saved = await this.saveReplayResponses(responses);
            if (!saved) {
                throw new Error(
                    `Critical: Failed to persist replay response cache for idempotency (eventId: ${eventId})`
                );
            }
            return saved;
        });
    };

    private removeReplayResponse = async (eventId: string): Promise<void> => {
        if (!eventId) return;
        await this.withMutex('replay-responses', async () => {
            const responses = await this.getReplayResponses();
            if (responses.delete(eventId)) {
                const saved = await this.saveReplayResponses(responses);
                if (!saved) {
                    throw new Error(
                        `Critical: Failed to persist replay response removal for idempotency (eventId: ${eventId})`
                    );
                }
            }
        });
    };

    private getReplayResponse = async (
        eventId: string,
        eventCreatedAt?: number
    ): Promise<StoredReplayResponse | undefined> => {
        if (!eventId) return undefined;
        const responses = await this.getReplayResponses();
        const cached = responses.get(eventId);
        if (!cached) return undefined;

        // Validate cache entry is not stale. If the cached entry is older than
        // REPLAY_CACHE_EXPIRATION_MS, consider it expired to prevent double-charging
        // vulnerability: payment evicted from FIFO cache after 1000 events could be
        // replayed without cache protection.
        const now = Date.now();
        const cacheAge = now - cached.cachedAt;
        if (cacheAge > REPLAY_CACHE_EXPIRATION_MS) {
            // Cache entry has expired; treat as a cache miss to prevent replay bypass
            console.warn(
                'NWC: Replay response cache entry expired (24h+ old), rejecting to prevent double-charging',
                {
                    eventId,
                    cacheAge: `${Math.round(cacheAge / 1000)}s`,
                    threshold: `${REPLAY_CACHE_EXPIRATION_MS / 1000}s`
                }
            );
            return undefined;
        }

        // Additionally, if we have the event's created_at timestamp, verify the event
        // is not older than the cache entry itself (prevents using stale events)
        if (eventCreatedAt && eventCreatedAt * 1000 < cached.cachedAt) {
            console.warn(
                'NWC: Replay event created_at is older than cache entry timestamp, rejecting',
                {
                    eventId,
                    eventCreatedAt,
                    cachedAt: Math.round(cached.cachedAt / 1000)
                }
            );
            return undefined;
        }

        return cached;
    };

    private async replayCachedResponse(
        connection: NWCConnection,
        eventId: string,
        eventCreatedAt?: number
    ): Promise<{
        success: boolean;
        errorMessage?: string;
        committed: boolean;
    } | null> {
        const cached = await this.getReplayResponse(eventId, eventCreatedAt);
        if (!cached) {
            return null;
        }

        try {
            await this.publishEventToClient(
                connection,
                cached.method,
                cached.response,
                eventId,
                cached.encryptionScheme
            );
            await this.removeReplayResponse(eventId);
            return {
                success: !cached.response?.error,
                errorMessage: cached.response?.error?.message,
                committed: true
            };
        } catch (error) {
            console.warn('NWC: Failed to replay cached response', {
                eventId,
                method: cached.method,
                error
            });
            return null;
        }
    }

    public deleteAllPendingPayments = async () => {
        try {
            await Storage.setItem(NWC_PENDING_PAYMENTS, JSON.stringify([]));
            return true;
        } catch (error) {
            console.error('failed to delete pending payment');
            return false;
        }
    };
    public deletePendingPaymentById = async (deleteId: string) => {
        try {
            const result = await Storage.getItem(NWC_PENDING_PAYMENTS);
            if (result) {
                const pendingPayments: PendingPayment[] = JSON.parse(result);
                const newpendingPayments = pendingPayments.filter(
                    (item) => item.eventId !== deleteId
                );
                await Storage.setItem(
                    NWC_PENDING_PAYMENTS,
                    JSON.stringify(newpendingPayments)
                );
                return true;
            }
            return false;
        } catch (error) {
            console.error('failed to delete pending payment');
            return false;
        }
    };
    public updatePendingPayment = async (
        pendingPayment: PendingPayment
    ): Promise<boolean> => {
        try {
            const pendingPayments = await this.getPendingPayments();
            const pendingPaymentindex = pendingPayments.findIndex(
                (payment) => pendingPayment.eventId === payment.eventId
            );
            if (pendingPaymentindex === -1) {
                return false;
            }
            pendingPayments[pendingPaymentindex] = pendingPayment;
            await Storage.setItem(
                NWC_PENDING_PAYMENTS,
                JSON.stringify(pendingPayments)
            );
            return true;
        } catch (error) {
            console.error('failed to update pending payment');
            return false;
        }
    };
    public getPendingPayments = async (): Promise<PendingPayment[]> => {
        try {
            const pendingPayments = await Storage.getItem(NWC_PENDING_PAYMENTS);
            if (!pendingPayments) {
                return [];
            }
            const parsed = JSON.parse(pendingPayments);
            const payments = Array.isArray(parsed) ? parsed : [];
            const dedupedPayments = Array.from(
                new Map(
                    payments.map((payment: PendingPayment) => [
                        payment.eventId,
                        payment
                    ])
                ).values()
            );
            const restoredPayments = (
                await Promise.all(
                    dedupedPayments.map(async (payment: PendingPayment) => {
                        if (
                            await this.hasProcessedReplayEvent(payment.eventId)
                        ) {
                            await this.deletePendingPaymentById(
                                payment.eventId
                            );
                            return null;
                        }
                        const connection = this.getConnection(
                            payment.connection.id
                        );

                        if (!connection) {
                            await this.deletePendingPaymentById(
                                payment.eventId
                            );
                            return null;
                        }
                        if (payment.isProcessed && !payment.status) {
                            if (
                                NostrConnectUtils.isIgnorableError(
                                    payment.errorMessage || ''
                                )
                            ) {
                                await this.deletePendingPaymentById(
                                    payment.eventId
                                );
                            }
                        }

                        return {
                            ...payment,
                            connection
                        };
                    })
                )
            ).filter((payment): payment is PendingPayment => payment !== null);

            return restoredPayments;
        } catch (error) {
            console.error('failed to load pending payment', error);
            return [];
        }
    };

    public getConnection = (
        connectionId: string
    ): NWCConnection | undefined => {
        const { nodeInfo } = this.nodeInfoStore;
        const { implementation } = this.settingsStore;
        const connection = this.connections.find(
            (c) =>
                c.id === connectionId &&
                c.nodePubkey === nodeInfo.nodeId &&
                c.implementation === implementation
        );
        return connection;
    };
    public getActivities = async (
        connectionId: string
    ): Promise<{ name: string; activity: ConnectionActivity[] }> => {
        const connection = this.getConnection(connectionId);
        if (!connection) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.connectionNotFound'
                )
            );
        }
        if (connection.activity.length === 0)
            return { name: connection.name, activity: [] };

        const locale = this.settingsStore.settings.locale;
        const promises = connection.activity.map(async (activity) => {
            if (activity?.invoice) {
                runInAction(() => {
                    activity.invoice =
                        activity.payment_source == 'cashu'
                            ? new CashuInvoice(activity.invoice)
                            : new Invoice(activity.invoice);
                });
                activity.invoice.determineFormattedRemainingTimeUntilExpiry(
                    locale
                );
                activity.invoice.determineFormattedOriginalTimeUntilExpiry(
                    locale
                );
                if (
                    activity.type === 'make_invoice' &&
                    activity.status === 'pending'
                ) {
                    let invoiceAlreadyPaid = false;
                    if (activity.payment_source === 'cashu') {
                        const cashuInvoices = this.cashuStore.invoices || [];
                        const findCashuInvoice = cashuInvoices.find(
                            (inv) =>
                                inv.getPaymentRequest ===
                                activity.invoice?.getPaymentRequest
                        );
                        if (
                            findCashuInvoice &&
                            findCashuInvoice instanceof CashuInvoice
                        ) {
                            invoiceAlreadyPaid = findCashuInvoice.isPaid;
                        }
                    } else {
                        const decodedInvoice =
                            await NostrConnectUtils.decodeInvoiceTags(
                                activity.invoice.getPaymentRequest,
                                true
                            );
                        invoiceAlreadyPaid =
                            decodedInvoice.isPaid || activity.invoice.isPaid;
                    }
                    if (invoiceAlreadyPaid) {
                        runInAction(() => {
                            activity.status = 'success';
                        });
                    } else if (activity.invoice.isExpired) {
                        runInAction(() => {
                            activity.status = 'failed';
                        });
                    }
                }
            }
            if (activity?.payment) {
                runInAction(() => {
                    activity.payment =
                        activity.payment_source === 'cashu'
                            ? new CashuPayment(activity.payment)
                            : new Payment(activity.payment);
                });
            }
        });
        await Promise.all(promises);
        runInAction(() => {
            connection.activity = connection.activity.filter((activity) => {
                const isInvalidFailure =
                    activity.status === 'failed' &&
                    NostrConnectUtils.isIgnorableError(activity.error || '');
                return !isInvalidFailure;
            });
        });
        this.saveConnections();
        return { name: connection.name, activity: connection.activity };
    };
    @action
    private markConnectionUsed = async (connectionId: string) => {
        const connection = this.connections.find((c) => c.id === connectionId);
        if (connection) {
            const wasNeverUsed = !connection.lastUsed;

            if (wasNeverUsed) {
                this.startWaitingForConnection(connectionId);
            }
            runInAction(() => {
                connection.lastUsed = new Date();
            });
            await this.saveConnections();

            if (
                this.waitingForConnection &&
                this.currentConnectionId === connectionId
            ) {
                this.stopWaitingForConnection();
            }
        }
    };
    @action
    private findAndUpdateConnection(connection: NWCConnection): void {
        const index = this.connections.findIndex((c) => c.id === connection.id);
        if (index !== -1) {
            this.connections[index] = connection;
        }
    }
    private generateConnectionSecret(
        relayUrl: string,
        includeLightningAddress = false
    ) {
        if (!this.walletServiceKeys?.publicKey) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.walletServicePublicKeyNotAvailable'
                )
            );
        }
        const connectionPrivateKey = generatePrivateKey();
        const connectionPublicKey = getPublicKey(connectionPrivateKey);
        const lud16 = this.getConnectionLud16(includeLightningAddress);
        const connectionUrl = buildNostrWalletConnectUrl({
            walletServicePubkey: this.walletServiceKeys.publicKey,
            relayUrl,
            secret: connectionPrivateKey,
            lud16
        });
        return { connectionUrl, connectionPrivateKey, connectionPublicKey };
    }

    private getConnectionLud16(
        includeLightningAddress: boolean
    ): string | undefined {
        return includeLightningAddress &&
            this.lightningAddressStore.lightningAddressActivated
            ? this.lightningAddressStore.lightningAddress
            : undefined;
    }
    @action
    public startWaitingForConnection = (connectionId: string) => {
        this.waitingForConnection = true;
        this.currentConnectionId = connectionId;
        this.isInNWCConnectionQRView = true;
    };

    @action
    public stopWaitingForConnection = () => {
        this.connectionJustSucceeded = true;
        this.waitingForConnection = false;
        this.currentConnectionId = undefined;
        this.isInNWCConnectionQRView = false;

        setTimeout(() => {
            runInAction(() => {
                this.connectionJustSucceeded = false;
            });
        }, 100);
    };

    // SUBSCRIPTION MANAGEMENT

    private async subscribeToConnection(
        connection: NWCConnection,
        options?: { forceResubscribe?: boolean; replaceExisting?: boolean }
    ): Promise<boolean> {
        if (!this.isServiceReady()) {
            runInAction(() => {
                this.error = true;
                this.errorMessage = localeString(
                    'stores.NostrWalletConnectStore.error.serviceNotReady'
                );
            });
            return false;
        }
        try {
            // Subscription state machine:
            // - forceResubscribe (Android relay reconnect): tear down the
            //   stale handle then create a fresh subscription. Without this
            //   the early-return below silently skips re-subscribing after
            //   a relay disconnect.
            // - replaceExisting (updateConnection): leave the previous
            //   handle in place; the caller will dispose of it after the new
            //   subscription is confirmed (transactional swap).
            // - default: idempotent skip when already subscribed.
            if (this.activeSubscriptions.has(connection.id)) {
                if (options?.forceResubscribe) {
                    await this.unsubscribeFromConnection(connection.id);
                } else if (!options?.replaceExisting) {
                    return true;
                }
            }
            const serviceSecretKey = this.walletServiceKeys?.privateKey;

            if (!serviceSecretKey) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.walletServiceKeyNotFound'
                    )
                );
            }
            const keypair = new nwc.NWCWalletServiceKeyPair(
                serviceSecretKey,
                connection.pubkey
            );
            const handler: NWCWalletServiceRequestHandler = {};

            // Always register every supported method handler and perform the
            // per-connection permission check inside it. This makes the live
            // path return RESTRICTED (matching the restored-event path) when
            // the connection lacks a method permission, instead of letting
            // the SDK respond with NOT_IMPLEMENTED. NIP-47 specifies
            // RESTRICTED for "method not enabled for this connection".
            const restrictedResponse = () =>
                this.handleError(
                    localeString('backends.NWC.permissionDenied'),
                    ErrorCodes.RESTRICTED
                );
            const gated = <Req, Resp>(
                method: Nip47SingleMethod,
                handle: (request: Req) => any
            ) =>
                ((request: Req) =>
                    this.withGlobalHandler(connection.id, () =>
                        connection.hasPermission(method)
                            ? handle(request)
                            : (restrictedResponse() as Resp)
                    )) as any;

            // Per NIP-47 spec: get_info MUST ALWAYS be available, regardless of permissions
            handler.getInfo = () =>
                this.withGlobalHandler(connection.id, () =>
                    this.handleGetInfo(connection)
                );

            handler.getBalance = gated('get_balance', () =>
                this.handleGetBalance(connection)
            );
            handler.payInvoice = gated(
                'pay_invoice',
                (request: Nip47PayInvoiceRequest) =>
                    this.runPayInvoiceSerialized(() =>
                        this.handlePayInvoice(connection, request)
                    )
            );
            handler.makeInvoice = gated(
                'make_invoice',
                (request: Nip47MakeInvoiceRequest) =>
                    this.handleMakeInvoice(connection, request)
            );
            handler.lookupInvoice = gated(
                'lookup_invoice',
                (request: Nip47LookupInvoiceRequest) =>
                    this.handleLookupInvoice(request)
            );
            handler.listTransactions = gated(
                'list_transactions',
                (request: Nip47ListTransactionsRequest) =>
                    this.handleListTransactions(connection, request)
            );
            handler.signMessage = gated(
                'sign_message',
                (request: Nip47SignMessageRequest) =>
                    this.handleSignMessage(request)
            );

            const nwcWalletService = this.nwcWalletServices.get(
                connection.relayUrl
            );
            if (!nwcWalletService) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.nwcWalletServiceNotFound',
                        {
                            relayUrl: connection.relayUrl
                        }
                    )
                );
            }
            const unsubscribe = await this.retryWithBackoff(async () => {
                return await nwcWalletService.subscribe(keypair, handler);
            }, MAX_RELAY_ATTEMPTS);

            runInAction(() => {
                this.activeSubscriptions.set(connection.id, unsubscribe);
            });
            await new Promise((resolve) =>
                setTimeout(resolve, SUBSCRIPTION_DELAY_MS)
            ); //wait for 1 second to prevent rate limiting
            return true;
        } catch (error: any) {
            console.error(
                `Failed to subscribe to connection ${connection.name}:`,
                error?.message || String(error)
            );
            return false;
        }
    }

    private async subscribeToAllConnections(): Promise<void> {
        if (this.activeConnections.length === 0) {
            console.log(
                'NWC: No active connections to subscribe to, skipping subscribeToAllConnections'
            );
            return;
        }
        const subscriptionPromises = this.activeConnections.map(
            async (connection) => {
                try {
                    const subscribed = await this.subscribeToConnection(
                        connection
                    );
                    if (!subscribed) {
                        return {
                            success: false,
                            connection: connection.name,
                            error: new Error(
                                localeString(
                                    'stores.NostrWalletConnectStore.error.failedToUpdateConnection'
                                )
                            )
                        };
                    }
                    return { success: true, connection: connection.name };
                } catch (error) {
                    console.error(
                        `NWC: Failed to subscribe to ${connection.name}:`,
                        error
                    );
                    return {
                        success: false,
                        connection: connection.name,
                        error
                    };
                }
            }
        );

        const results = await Promise.allSettled(subscriptionPromises);
        const successful = results.filter(
            (r) => r.status === 'fulfilled' && r.value.success
        ).length;
        const failed = results.length - successful;

        console.log(
            `NWC: Subscription results - ${successful} successful, ${failed} failed`
        );

        if (failed > 0) {
            console.warn(
                'NWC: Some subscriptions failed:',
                results
                    .filter(
                        (r) =>
                            r.status === 'rejected' ||
                            (r.status === 'fulfilled' && !r.value.success)
                    )
                    .map((r) =>
                        r.status === 'fulfilled'
                            ? r.value.connection
                            : 'unknown'
                    )
            );
        }
    }
    private async unsubscribeFromConnection(
        connectionId: string
    ): Promise<void> {
        const unsub = this.activeSubscriptions.get(connectionId);
        if (unsub) {
            await this.retryWithBackoff(async () => {
                try {
                    unsub();
                    runInAction(() => {
                        this.activeSubscriptions.delete(connectionId);
                    });
                } catch (error) {
                    console.error(
                        `Error unsubscribing from connection ${connectionId}:`,
                        error
                    );
                }
            }, 3);
        }
    }

    private async unsubscribeFromAllConnections(): Promise<void> {
        const connectionIds = Array.from(this.activeSubscriptions.keys());
        for (const connectionId of connectionIds) {
            await this.unsubscribeFromConnection(connectionId);
        }
        runInAction(() => {
            this.activeSubscriptions.clear();
        });
    }
    private async publishToAllRelays(): Promise<number> {
        let successfulPublishes = 0;
        const publishPromises = Array.from(
            this.nwcWalletServices.entries()
        ).map(async ([relayUrl, nwcWalletService]) => {
            if (
                this.publishedRelays.has(relayUrl) &&
                nwcWalletService.connected
            ) {
                successfulPublishes++;
                return;
            }
            try {
                await this.retryWithBackoff(async () => {
                    await nwcWalletService.publishWalletServiceInfoEvent(
                        this.walletServiceKeys!.privateKey,
                        NostrConnectUtils.getFullAccessPermissions(),
                        NostrConnectUtils.getNotifications()
                    );
                    runInAction(() => {
                        this.publishedRelays.add(relayUrl);
                    });
                    successfulPublishes++;
                }, 3);
            } catch (error) {
                console.error(`Failed to publish to relay ${relayUrl}`, {
                    error
                });
            }
        });
        await Promise.allSettled(publishPromises);
        return successfulPublishes;
    }

    private async withGlobalHandler<T>(
        connectionId: string,
        handler: () => Promise<T>
    ): Promise<T> {
        await this.markConnectionUsed(connectionId);
        return await handler();
    }

    // Promise-chain mutex used to serialize side-effecting work that touches
    // singleton stores (TransactionsStore / CashuStore) and budget tracking.
    // Per-key chains let unrelated work proceed in parallel while preventing
    // races inside a single critical section.
    private mutexes: Map<string, Promise<unknown>> = new Map();
    private withMutex<T>(
        key: string,
        fn: () => Promise<T>,
        timeoutMs: number = 120000
    ): Promise<T> {
        const prev = this.mutexes.get(key) || Promise.resolve();
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const next = prev
            .catch(() => undefined) // Swallow prev failures only
            .then(() => {
                // Create a timeout promise that rejects after specified duration
                return Promise.race([
                    fn(),
                    new Promise<T>((_, reject) => {
                        timeoutId = setTimeout(
                            () =>
                                reject(
                                    new Error(
                                        `Mutex operation timeout after ${timeoutMs}ms for key: ${key}`
                                    )
                                ),
                            timeoutMs
                        );
                    })
                ]).finally(() => {
                    if (timeoutId) clearTimeout(timeoutId);
                });
            })
            .catch((err) => {
                // Log errors in critical sections for observability
                console.error(
                    `[withMutex] Error in critical section '${key}': ${
                        err instanceof Error ? err.message : String(err)
                    }`,
                    err
                );
                // Re-throw to propagate error to caller
                throw err;
            });

        // Store a chain that swallows rejections so subsequent waiters aren't
        // poisoned by an earlier failure. The error is already logged above.
        this.mutexes.set(
            key,
            next.catch(() => undefined)
        );
        return next;
    }
    // pay_invoice serializes globally because the underlying TransactionsStore
    // and CashuStore expose request-scoped state via singleton fields
    // (payment_preimage, payment_error, paymentError, ...). Two concurrent
    // dispatches would clobber each other regardless of connection id.
    private runPayInvoiceSerialized<T>(fn: () => Promise<T>): Promise<T> {
        return this.withMutex('pay_invoice', fn);
    }
    // NWC REQUEST HANDLERS

    private async handleGetInfo(
        connection: NWCConnection
    ): NWCWalletServiceResponsePromise<Nip47GetInfoResponse> {
        try {
            if (
                BackendUtils.supportsNodeInfo() &&
                !this.nodeInfoStore.nodeInfo?.identity_pubkey
            ) {
                await this.nodeInfoStore.getNodeInfo();
            }
            const nodeInfo = this.nodeInfoStore.nodeInfo;
            let network = 'mainnet';
            if (nodeInfo?.isTestNet) {
                network = 'testnet';
            } else if (nodeInfo?.isRegTest) {
                network = 'regtest';
            } else if (nodeInfo?.isSigNet) {
                network = 'signet';
            }
            const methods = [...(connection.permissions || [])];
            // Ensure get_info is always included, as per NIP-47: get_info requires no permissions
            if (!methods.includes('get_info')) {
                methods.push('get_info');
            }
            return {
                result: {
                    alias:
                        nodeInfo?.alias ||
                        connection.displayName ||
                        localeString(
                            'stores.NostrWalletConnectStore.zeusWallet'
                        ),
                    color: nodeInfo?.color || '#3399FF',
                    pubkey: nodeInfo?.identity_pubkey || '',
                    network,
                    block_height: nodeInfo?.block_height || 0,
                    block_hash: nodeInfo?.block_hash || '',
                    methods,
                    notifications: NostrConnectUtils.getNotifications()
                },
                error: undefined
            };
        } catch (error) {
            return this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToGetInfo'
                ),
                ErrorCodes.INTERNAL_ERROR
            );
        }
    }

    private async handleGetBalance(
        connection: NWCConnection
    ): NWCWalletServiceResponsePromise<Nip47GetBalanceResponse> {
        try {
            if (connection.hasBudgetLimit) {
                return {
                    result: {
                        balance: satsToMillisats(connection.remainingBudget)
                    },
                    error: undefined
                };
            }
            const balance = this.isCashuConfigured
                ? this.cashuStore.totalBalanceSats
                : (await this.balanceStore.getLightningBalance(true))
                      ?.lightningBalance;
            return {
                result: {
                    balance: satsToMillisats(Number(balance) || 0)
                },
                error: undefined
            };
        } catch (error) {
            return this.handleError(
                (error as Error).message,
                ErrorCodes.INTERNAL_ERROR
            );
        }
    }
    private async handlePayInvoice(
        connection: NWCConnection,
        request: Nip47PayInvoiceRequest,
        skipNotification: boolean = false
    ): NWCWalletServiceResponsePromise<Nip47PayResponse> {
        try {
            if (this.isCashuConfigured) {
                return this.handleCashuPayInvoice(
                    connection,
                    request,
                    skipNotification
                );
            }
            return this.handleLightningPayInvoice(
                connection,
                request,
                skipNotification
            );
        } catch (error: any) {
            console.error('NWC: Error in handlePayInvoice:', error);
            return this.handleError(
                (error instanceof Error ? error.message : String(error)) ||
                    localeString(
                        'stores.NostrWalletConnectStore.error.failedToPayInvoice'
                    ),
                ErrorCodes.INTERNAL_ERROR
            );
        }
    }

    private async handleMakeInvoice(
        connection: NWCConnection,
        request: Nip47MakeInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        try {
            const hasRequestAmount =
                request.amount !== undefined && request.amount !== null;
            const requestAmountMsats = hasRequestAmount
                ? Number(request.amount)
                : 0;
            if (
                hasRequestAmount &&
                (!Number.isFinite(requestAmountMsats) ||
                    !Number.isInteger(requestAmountMsats) ||
                    requestAmountMsats < 0)
            ) {
                return this.handleError(
                    localeString(
                        'stores.NostrWalletConnectStore.error.invalidAmountMsats'
                    ),
                    ErrorCodes.INVALID_PARAMS
                );
            }
            // All msat-to-sat conversions use ceil (round UP) to ensure
            // sub-sat amounts never bypass budget limits or appear cheaper to users.
            // This ensures both backend requests and user-facing notifications show
            // at least the amount needed to cover the millisatoshi value.
            const requestAmountSats =
                requestAmountMsats > 0
                    ? Math.ceil(requestAmountMsats / 1000)
                    : 0;
            // Use same amount for notifications to avoid confusion (1001 msat shows
            // as 2 sats everywhere, not 1 sat to backend and 2 to user).
            const notificationSats =
                requestAmountMsats > 0
                    ? Math.max(1, requestAmountSats)
                    : 0;

            if (this.isCashuConfigured) {
                // Cashu mints operate in whole sats; reject NIP-47 msat
                // amounts that would otherwise be silently truncated. Per
                // NIP-47 the spec error for a malformed amount is
                // INVALID_PARAMS; clients can downgrade to a sat-aligned
                // amount or pick a different connection.
                if (requestAmountMsats > 0 && requestAmountMsats % 1000 !== 0) {
                    return this.handleError(
                        localeString(
                            'stores.NostrWalletConnectStore.error.invalidAmountMsats'
                        ),
                        ErrorCodes.INVALID_PARAMS
                    );
                }
                try {
                    const cashuInvoice = await this.cashuStore.createInvoice({
                        value: requestAmountSats.toString(),
                        memo: request.description || ''
                    });

                    if (!cashuInvoice || !cashuInvoice.paymentRequest) {
                        throw new Error(
                            localeString(
                                'stores.NostrWalletConnectStore.error.failedToCreateCashuInvoice'
                            )
                        );
                    }

                    let paymentHash = '';
                    let descriptionHash = '';
                    let expiryTime = 0;

                    try {
                        const decoded =
                            await NostrConnectUtils.decodeInvoiceTags(
                                cashuInvoice.paymentRequest
                            );
                        paymentHash = decoded.paymentHash;
                        descriptionHash = decoded.descriptionHash;
                        expiryTime = decoded?.expiryTime;
                    } catch (decodeError) {
                        console.error(
                            'handleMakeInvoice: Failed to decode Cashu invoice tags',
                            decodeError
                        );
                        expiryTime =
                            dateTimeUtils.getCurrentTimestamp() +
                            (request.expiry || DEFAULT_INVOICE_EXPIRY_SECONDS);
                    }
                    const cashuPaymentHash = paymentHash || '';
                    if (!cashuPaymentHash) {
                        // Spec requires a real payment_hash; without one
                        // clients can't correlate later lookup_invoice or
                        // payment_received notifications. Surface an
                        // internal error rather than fabricating a hash.
                        // Validate BEFORE mutating local activity / firing
                        // notifications so a hash-less invoice doesn't leave
                        // us with stale "pending" history the client never
                        // acknowledged.
                        return this.handleError(
                            'Cashu invoice missing payment_hash',
                            ErrorCodes.INTERNAL_ERROR
                        );
                    }
                    const invoice = this.cashuStore.invoices?.find(
                        (invoice) =>
                            invoice.getPaymentRequest ===
                            cashuInvoice.paymentRequest
                    );
                    if (invoice)
                        runInAction(() => {
                            connection.addActivity({
                                id: cashuInvoice.paymentRequest,
                                status: 'pending',
                                invoice: new CashuInvoice(invoice),
                                type: 'make_invoice',
                                payment_source: 'cashu',
                                satAmount: requestAmountSats,
                                msatAmount: requestAmountMsats
                            });
                            this.findAndUpdateConnection(connection);
                        });
                    this.saveConnections();
                    this.showInvoiceCreatedNotification(
                        notificationSats,
                        connection.name,
                        request.description
                    );
                    const result = NostrConnectUtils.createNip47Transaction({
                        type: 'incoming',
                        state: 'pending',
                        invoice: cashuInvoice.paymentRequest,
                        payment_hash: cashuPaymentHash,
                        amount: requestAmountMsats,
                        description: request.description,
                        description_hash: descriptionHash,
                        expires_at: expiryTime
                    });
                    return {
                        result,
                        error: undefined
                    };
                } catch (cashuError) {
                    return this.handleError(
                        (cashuError as Error).message,
                        ErrorCodes.FAILED_TO_CREATE_INVOICE
                    );
                }
            }
            this.invoicesStore.creatingInvoiceError = false;
            this.invoicesStore.error_msg = null;

            const invoiceResult = await this.invoicesStore.createUnifiedInvoice(
                {
                    value: requestAmountSats.toString(),
                    value_msat: requestAmountMsats.toString(),
                    memo: request.description || '',
                    expirySeconds: String(
                        request.expiry || DEFAULT_INVOICE_EXPIRY_SECONDS
                    ),
                    noLsp: true
                }
            );

            const paymentRequest = this.invoicesStore.payment_request;

            if (
                this.invoicesStore.creatingInvoiceError ||
                (!invoiceResult && !paymentRequest)
            ) {
                const errorMessage =
                    this.invoicesStore.error_msg ||
                    localeString(
                        'stores.NostrWalletConnectStore.error.failedToCreateInvoice'
                    );
                throw new Error(errorMessage);
            }

            if (!paymentRequest || typeof paymentRequest !== 'string') {
                const errorMessage =
                    this.invoicesStore.error_msg ||
                    localeString(
                        'stores.NostrWalletConnectStore.error.failedToCreateInvoice'
                    );
                throw new Error(errorMessage);
            }

            const rHash = invoiceResult?.rHash || '';
            let paymentHash = rHash;

            await this.invoicesStore.getInvoices();
            const invoice = this.invoicesStore.invoices.find(
                (invoice) =>
                    invoice.payment_hash === paymentHash ||
                    invoice.paymentRequest === paymentRequest
            );

            let descriptionHash = '';
            let expiryTime = 0;

            try {
                const decoded = await NostrConnectUtils.decodeInvoiceTags(
                    paymentRequest
                );
                paymentHash = decoded.paymentHash || rHash;
                descriptionHash = decoded.descriptionHash;
                expiryTime =
                    decoded?.expiryTime || DEFAULT_INVOICE_EXPIRY_SECONDS;
            } catch (decodeError) {
                if (!paymentHash && rHash) {
                    paymentHash = rHash;
                }
                if (!paymentHash) {
                    throw new Error(
                        localeString(
                            'stores.NostrWalletConnectStore.error.failedToDecodeInvoice'
                        )
                    );
                }
                expiryTime =
                    dateTimeUtils.getCurrentTimestamp() +
                    (request.expiry || DEFAULT_INVOICE_EXPIRY_SECONDS);
            }

            if (!paymentHash) {
                // Spec requires payment_hash; without one the client
                // can't correlate settlement. Bail out with an internal
                // error instead of fabricating a synthetic hash. Validate
                // BEFORE mutating local activity / firing notifications so
                // a hash-less invoice doesn't leave us with stale "pending"
                // history that the client never acknowledged.
                return this.handleError(
                    'Backend returned no payment_hash for created invoice',
                    ErrorCodes.INTERNAL_ERROR
                );
            }

            if (invoice) {
                runInAction(() => {
                    connection.addActivity({
                        id: paymentRequest,
                        invoice: new Invoice(invoice),
                        status: 'pending',
                        type: 'make_invoice',
                        payment_source: 'lightning',
                        paymentHash,
                        satAmount: requestAmountSats,
                        msatAmount: requestAmountMsats,
                        createdAt: new Date()
                    });
                    this.findAndUpdateConnection(connection);
                });
            } else {
                const invoiceData = {
                    payment_request: paymentRequest,
                    payment_hash: paymentHash,
                    value: requestAmountSats.toString(),
                    value_msat: requestAmountMsats.toString(),
                    memo: request.description || '',
                    expiry: expiryTime.toString(),
                    creation_date: Math.floor(Date.now() / 1000).toString(),
                    settled: false
                };
                runInAction(() => {
                    connection.addActivity({
                        id: paymentRequest,
                        invoice: new Invoice(invoiceData),
                        status: 'pending',
                        type: 'make_invoice',
                        payment_source: 'lightning',
                        paymentHash,
                        satAmount: requestAmountSats,
                        msatAmount: requestAmountMsats,
                        createdAt: new Date()
                    });
                    this.findAndUpdateConnection(connection);
                });
            }
            this.saveConnections();
            this.showInvoiceCreatedNotification(
                notificationSats,
                connection.name,
                request.description
            );

            const result = NostrConnectUtils.createNip47Transaction({
                type: 'incoming',
                state: 'pending',
                invoice: paymentRequest,
                payment_hash: paymentHash,
                amount: requestAmountMsats,
                description: request.description,
                description_hash: descriptionHash,
                expires_at: expiryTime
            });
            return {
                result,
                error: undefined
            };
        } catch (error) {
            const errorMessage =
                (error as Error).message ||
                String(error) ||
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToCreateInvoice'
                );
            return this.handleError(errorMessage, ErrorCodes.INTERNAL_ERROR);
        }
    }

    private async handleLookupInvoice(
        request: Nip47LookupInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        try {
            if (this.isCashuConfigured) {
                const cashuInvoices = this.cashuStore.invoices || [];
                let matchingInvoice: CashuInvoice | undefined;

                for (const inv of cashuInvoices) {
                    if (inv.getPaymentRequest === request.invoice) {
                        matchingInvoice = inv;
                        break;
                    }
                    if (request.payment_hash) {
                        try {
                            const decodedInvoice =
                                await NostrConnectUtils.decodeInvoiceTags(
                                    inv.getPaymentRequest
                                );
                            if (
                                decodedInvoice.paymentHash ===
                                request.payment_hash
                            ) {
                                matchingInvoice = inv;
                                break;
                            }
                        } catch {
                            // Skip malformed/undecodable invoices and continue lookup.
                        }
                    }
                }
                if (
                    matchingInvoice &&
                    matchingInvoice instanceof CashuInvoice
                ) {
                    const isPaid = matchingInvoice.isPaid || false;
                    const amtSat = matchingInvoice.getAmount;
                    const decodedInvoice =
                        await NostrConnectUtils.decodeInvoiceTags(
                            matchingInvoice.getPaymentRequest
                        );
                    const lookupPaymentHash =
                        decodedInvoice.paymentHash ||
                        request.payment_hash ||
                        '';
                    if (!lookupPaymentHash) {
                        return this.handleError(
                            'lookup_invoice missing payment_hash',
                            ErrorCodes.INTERNAL_ERROR
                        );
                    }

                    const timestamp =
                        Number(matchingInvoice.getTimestamp) ||
                        dateTimeUtils.getCurrentTimestamp();
                    const expiresAt =
                        Number(matchingInvoice.expires_at) ||
                        timestamp + DEFAULT_INVOICE_EXPIRY_SECONDS;

                    const result = NostrConnectUtils.createNip47Transaction({
                        type: 'incoming',
                        state: isPaid ? 'settled' : 'pending',
                        invoice: matchingInvoice.getPaymentRequest,
                        payment_hash: lookupPaymentHash,
                        amount: satsToMillisats(amtSat || 0),
                        description: matchingInvoice.getMemo,
                        settled_at: isPaid
                            ? matchingInvoice.settleDate.getTime() / 1000
                            : 0,
                        created_at: timestamp,
                        expires_at: expiresAt
                    });
                    return {
                        result,
                        error: undefined
                    };
                } else {
                    return this.handleError(
                        localeString(
                            'stores.NostrWalletConnectStore.error.invoiceNotFound'
                        ),
                        ErrorCodes.NOT_FOUND
                    );
                }
            } else {
                let lookupPaymentHash = request.payment_hash || '';
                if (!lookupPaymentHash && request.invoice) {
                    const decodedLookupInvoice =
                        await NostrConnectUtils.decodeInvoiceTags(
                            request.invoice
                        );
                    lookupPaymentHash = decodedLookupInvoice.paymentHash || '';
                }
                if (!lookupPaymentHash) {
                    return this.handleError(
                        'lookup_invoice missing payment_hash',
                        ErrorCodes.INTERNAL_ERROR
                    );
                }
                const rawInvoice = await BackendUtils.lookupInvoice({
                    r_hash: lookupPaymentHash
                });
                const invoice = new Invoice(rawInvoice);
                const state = invoice.isPaid
                    ? 'settled'
                    : invoice.isExpired
                    ? 'failed'
                    : 'pending';
                const resolvedLookupPaymentHash =
                    invoice.getRHash || request.payment_hash || '';
                const result = NostrConnectUtils.createNip47Transaction({
                    type: 'incoming',
                    state,
                    invoice: invoice.getPaymentRequest,
                    payment_hash: resolvedLookupPaymentHash,
                    amount: satsToMillisats(invoice.getAmount), // Convert to msats
                    description: invoice.getMemo,
                    ...(invoice.isPaid && {
                        preimage: invoice.getRPreimage
                    }),
                    description_hash: invoice.getDescriptionHash,
                    settled_at: invoice.settleDate.getTime() / 1000,
                    created_at: invoice.getCreationDate.getTime() / 1000,
                    expires_at: invoice.getCreationDate.getTime() / 1000
                });
                return {
                    result,
                    error: undefined
                };
            }
        } catch (error) {
            return this.handleError(
                (error as Error).message,
                ErrorCodes.NOT_FOUND
            );
        }
    }

    private async handleListTransactions(
        connection: NWCConnection,
        request: Nip47ListTransactionsRequest
    ): NWCWalletServiceResponsePromise<Nip47ListTransactionsResponse> {
        try {
            let nip47Transactions: Nip47Transaction[] = [];

            if (connection.hasPaymentPermissions()) {
                nip47Transactions = connection.activity
                    .map((activity) =>
                        NostrConnectUtils.convertConnectionActivityToNip47Transaction(
                            activity
                        )
                    )
                    .filter((tx) => !!tx.payment_hash)
                    .sort((a, b) => b.created_at - a.created_at);
            } else {
                await Promise.all([
                    this.paymentsStore.getPayments(),
                    this.invoicesStore.getInvoices(),
                    this.transactionsStore.getTransactions()
                ]);
                const lightningTransactions =
                    NostrConnectUtils.convertLightningDataToNip47Transactions({
                        payments: this.paymentsStore.payments || [],
                        invoices: this.invoicesStore.invoices || []
                    });
                const onChainTransactions =
                    NostrConnectUtils.convertOnChainTransactionsToNip47Transactions(
                        this.transactionsStore.transactions || []
                    );
                let cashuTransactions: Nip47Transaction[] = [];
                if (this.isCashuConfigured) {
                    cashuTransactions =
                        NostrConnectUtils.convertCashuDataToNip47Transactions({
                            payments: this.cashuStore.payments || [],
                            invoices: this.cashuStore.invoices || [],
                            receivedTokens:
                                this.cashuStore.receivedTokens || [],
                            sentTokens: this.cashuStore.sentTokens || []
                        });
                }
                nip47Transactions = [
                    ...lightningTransactions,
                    ...onChainTransactions,
                    ...cashuTransactions
                ].sort((a, b) => b.created_at - a.created_at);
            }

            // Filter and paginate transactions
            const { transactions, totalCount } =
                NostrConnectUtils.filterAndPaginateTransactions(
                    nip47Transactions,
                    request
                );

            return {
                result: {
                    transactions,
                    total_count: totalCount
                },
                error: undefined
            };
        } catch (error) {
            return this.handleError(
                (error as Error).message,
                ErrorCodes.INTERNAL_ERROR
            );
        }
    }

    private async handleSignMessage(
        request: Nip47SignMessageRequest
    ): NWCWalletServiceResponsePromise<Nip47SignMessageResponse> {
        try {
            if (this.isCashuConfigured) {
                const selectedMintUrl = this.cashuStore.selectedMintUrl;
                const wallet = this.cashuStore.cashuWallets[selectedMintUrl];

                if (!wallet) {
                    return this.handleError(
                        localeString(
                            'stores.NostrWalletConnectStore.error.cashuWalletNotInitialized'
                        ),
                        ErrorCodes.INTERNAL_ERROR
                    );
                }
            }
            this.messageSignStore.signMessage(request.message);
            const signature = this.messageSignStore.signature;
            return {
                result: {
                    message: request.message,
                    signature: signature || ''
                },
                error: undefined
            };
        } catch (error) {
            return this.handleError(
                (error as Error).message,
                ErrorCodes.INTERNAL_ERROR
            );
        }
    }

    // PAYMENT PROCESSING METHODS

    private async handleLightningPayInvoice(
        connection: NWCConnection,
        request: Nip47PayInvoiceRequest,
        skipNotification: boolean = false
    ) {
        const invoiceInfo = await BackendUtils.decodePaymentRequest([
            request.invoice
        ]);
        const {
            amountMsats,
            amountSats,
            usedRequestAmount,
            invalidRequestAmount
        } = await this.getInvoiceAmount(
            request.invoice,
            invoiceInfo,
            request.amount
        );
        if (invalidRequestAmount) {
            return this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.invalidAmountMsats'
                ),
                ErrorCodes.INVALID_PARAMS
            );
        }
        // When no explicit request amount is provided, the decoded invoice amount
        // must still resolve to a positive millisatoshi value.
        if (!usedRequestAmount && amountMsats <= 0) {
            return this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToDecodeInvoice'
                ),
                ErrorCodes.INVALID_INVOICE
            );
        }
        if (invoiceInfo.expiry && invoiceInfo.timestamp) {
            const expiryTime =
                (Number(invoiceInfo.timestamp) + Number(invoiceInfo.expiry)) *
                1000;
            const now = Date.now();

            if (now > expiryTime) {
                const errorMessage = localeString(
                    'stores.NostrWalletConnectStore.error.invoiceExpired'
                );
                return {
                    result: undefined,
                    error: {
                        code: ErrorCodes.INVOICE_EXPIRED,
                        message: errorMessage
                    }
                };
            }
        }
        // Charge the connection budget in whole sats but round UP from msats
        // so a sub-sat payment (e.g. 1500 msat) cannot bypass the budget by
        // appearing as 1 sat instead of 2. Math.ceil keeps budget accounting
        // strictly >= the actual amount sent.
        const paymentChargeAmountSats =
            amountMsats > 0 ? Math.ceil(amountMsats / 1000) : 0;
        // Determine fee limit: support both fee_limit_sat and fee_limit_msat per NIP-47 spec.
        // fee_limit_msat takes precedence if both are provided.
        // Validate it before any balance/budget checks so invalid values fail fast.
        let feeLimitSat = PAYMENT_FEE_LIMIT_SATS;
        let feeLimitMsat = PAYMENT_FEE_LIMIT_SATS * 1000;
        const req = request as any;
        const reqFeeLimitMsat = Number(req.fee_limit_msat);
        const reqFeeLimitSat = Number(req.fee_limit_sat);
        if (
            req.fee_limit_msat !== undefined &&
            req.fee_limit_msat !== null &&
            Number.isFinite(reqFeeLimitMsat)
        ) {
            if (!Number.isInteger(reqFeeLimitMsat) || reqFeeLimitMsat < 0) {
                return this.handleError(
                    localeString(
                        'stores.NostrWalletConnectStore.error.invalidAmountMsats'
                    ),
                    ErrorCodes.INVALID_PARAMS
                );
            }
            feeLimitMsat = reqFeeLimitMsat;
            feeLimitSat = Math.floor(reqFeeLimitMsat / 1000);
        } else if (
            req.fee_limit_sat !== undefined &&
            req.fee_limit_sat !== null &&
            Number.isFinite(reqFeeLimitSat)
        ) {
            if (!Number.isInteger(reqFeeLimitSat) || reqFeeLimitSat < 0) {
                return this.handleError(
                    localeString(
                        'stores.NostrWalletConnectStore.error.invalidAmountMsats'
                    ),
                    ErrorCodes.INVALID_PARAMS
                );
            }
            feeLimitSat = reqFeeLimitSat;
            feeLimitMsat = reqFeeLimitSat * 1000;
        }
        const lightningBalance = await this.balanceStore.getLightningBalance(
            true
        );
        const budgetCheck = this.validateBudgetBeforePayment(
            connection,
            paymentChargeAmountSats,
            ErrorCodes.INSUFFICIENT_BALANCE
        );
        if (!budgetCheck.success) {
            return { result: undefined, error: budgetCheck.error };
        }
        const currentLightningBalance = lightningBalance?.lightningBalance || 0;
        if (currentLightningBalance < paymentChargeAmountSats) {
            const errorMessage = localeString(
                'stores.NostrWalletConnectStore.error.lightningInsufficientBalance',
                {
                    amount: paymentChargeAmountSats.toString(),
                    balance: currentLightningBalance.toString()
                }
            );
            return this.handleError(
                errorMessage,
                ErrorCodes.INSUFFICIENT_BALANCE
            );
        }
        this.transactionsStore.reset();

        const paymentData: {
            payment_request: string;
            fee_limit_sat: string;
            fee_limit_msat: string;
            timeout_seconds: string;
            amount?: string;
            amount_msat?: string;
        } = {
            payment_request: request.invoice,
            fee_limit_sat: feeLimitSat.toString(),
            fee_limit_msat: feeLimitMsat.toString(),
            timeout_seconds: PAYMENT_TIMEOUT_SECONDS.toString()
        };
        // Send both units so msat-aware backends keep the exact NWC amount while sat-only paths still work.
        if (amountMsats > 0) {
            paymentData.amount = paymentChargeAmountSats.toString();
            paymentData.amount_msat = amountMsats.toString();
        } else if (usedRequestAmount && request.amount) {
            paymentData.amount = paymentChargeAmountSats.toString();
            paymentData.amount_msat = String(request.amount);
        }
        this.transactionsStore.sendPayment(paymentData);

        await this.waitForPaymentCompletion();

        const paymentError = this.checkPaymentErrors(
            ErrorCodes.FAILED_TO_PAY_INVOICE,
            localeString('views.SendingLightning.paymentTimedOut'),
            localeString(
                'stores.NostrWalletConnectStore.error.noPreimageReceived'
            )
        );

        if (paymentError) {
            const { paymentRequest, paymentHash: decodedHash } =
                await NostrConnectUtils.decodeInvoiceTags(request.invoice);
            if (paymentRequest || request.invoice)
                if (
                    !NostrConnectUtils.isIgnorableError(
                        paymentError.error?.message
                    )
                )
                    await this.recordFailedPayment(
                        paymentRequest || request.invoice,
                        connection,
                        'pay_invoice',
                        paymentChargeAmountSats,
                        amountMsats,
                        'lightning',
                        paymentError.error?.message || 'Payment failed',
                        decodedHash || invoiceInfo.payment_hash || ''
                    );
            return paymentError;
        }
        const preimage = this.transactionsStore.payment_preimage;
        const fees_paid = this.transactionsStore.payment_fee;

        // NIP-47 pay_invoice success requires a real 32-byte preimage. If we
        // got here with no error but no preimage, treat it as INTERNAL_ERROR
        // rather than returning success with an empty preimage.
        if (!preimage || preimage.length === 0) {
            return this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.noPreimageReceived'
                ),
                ErrorCodes.INTERNAL_ERROR
            );
        }

        // Charge the budget IMMEDIATELY on confirmed success so a missing
        // activity-row lookup (paymentsStore lag, MPP, normalization mismatch)
        // can't let a successful payment escape budget accounting. The
        // pay_invoice mutex + replay-marker guarantee idempotency.
        this.chargeBudgetOnSuccess(connection, paymentChargeAmountSats, {
            activityId: request.invoice,
            method: 'pay_invoice'
        });

        await this.paymentsStore.getPayments();
        const payment = this.paymentsStore.payments.find(
            (payment) => payment.getPaymentRequest === request.invoice
        );
        if (payment) {
            await this.finalizePayment({
                id: request.invoice,
                type: 'pay_invoice',
                decoded: payment,
                payment_source: 'lightning',
                connection,
                amountSats,
                amountMsats,
                budgetChargeAmountSats: paymentChargeAmountSats,
                skipNotification,
                skipBudgetCharge: true
            });
        } else {
            const { paymentHash: decodedHash } =
                await NostrConnectUtils.decodeInvoiceTags(request.invoice);
            const fallbackPaymentHash =
                decodedHash || invoiceInfo.payment_hash || '';
            if (!fallbackPaymentHash) {
                return this.handleError(
                    'fallback payment missing payment_hash',
                    ErrorCodes.INTERNAL_ERROR
                );
            }
            await this.recordMinimalSuccessActivity({
                connection,
                invoice: request.invoice,
                type: 'pay_invoice',
                payment_source: 'lightning',
                amountSats: paymentChargeAmountSats,
                amountMsats,
                preimage,
                feesPaidMsats: satsToMillisats(Number(fees_paid) || 0),
                paymentHash: fallbackPaymentHash
            });
            if (!skipNotification) {
                this.showPaymentSentNotification(
                    paymentChargeAmountSats,
                    connection.name
                );
            }
        }

        return {
            result: {
                preimage,
                fees_paid: satsToMillisats(Number(fees_paid) || 0)
            },
            error: undefined
        };
    }

    private async handleCashuPayInvoice(
        connection: NWCConnection,
        request: Nip47PayInvoiceRequest,
        skipNotification: boolean = false
    ) {
        const cashuStatus = this.cashuConfigurationStatus;
        if (!cashuStatus.isConfigured) {
            return this.handleError(
                cashuStatus.errorMessage ||
                    localeString(
                        'stores.NostrWalletConnectStore.error.noCashuMintSelected'
                    ),
                ErrorCodes.INTERNAL_ERROR
            );
        }

        await this.cashuStore.getPayReq(request.invoice);
        const invoice = this.cashuStore.payReq;
        const error = this.cashuStore.getPayReqError;
        if (error) {
            return this.handleError(error, ErrorCodes.INVALID_INVOICE);
        }
        if (!invoice) {
            return this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToDecodeInvoice'
                ),
                ErrorCodes.INVALID_INVOICE
            );
        }
        if (invoice.isPaid) {
            return this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.invoiceAlreadyPaid'
                ),
                ErrorCodes.INVALID_INVOICE
            );
        }
        if (invoice.isExpired) {
            return this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.invoiceExpired'
                ),
                ErrorCodes.INVALID_INVOICE
            );
        }
        if (
            !invoice.getPaymentRequest ||
            invoice.getPaymentRequest.trim() === ''
        ) {
            return this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.invalidPaymentRequest'
                ),
                ErrorCodes.INVALID_INVOICE
            );
        }

        let amountMsats = 0;
        if (invoice.getAmount && invoice.getAmount > 0) {
            amountMsats = satsToMillisats(Math.floor(invoice.getAmount));
        } else if ((invoice as any).satoshis) {
            amountMsats = satsToMillisats(
                Math.floor((invoice as any).satoshis)
            );
        } else if ((invoice as any).millisatoshis) {
            amountMsats = Math.floor(Number((invoice as any).millisatoshis));
        } else if (request.amount !== undefined && request.amount !== null) {
            const normalizedRequestAmount = Number(request.amount);
            // Validate request amount same as lightning path: finite, integer, positive
            if (
                !Number.isFinite(normalizedRequestAmount) ||
                !Number.isInteger(normalizedRequestAmount) ||
                normalizedRequestAmount <= 0
            ) {
                return this.handleError(
                    localeString(
                        'stores.NostrWalletConnectStore.error.invalidAmountMsats'
                    ),
                    ErrorCodes.INVALID_PARAMS
                );
            }
            amountMsats = normalizedRequestAmount;
        }
        // Cashu mints settle in whole sats. Reject any msat-precise amount
        // (invoice or request override) so the wallet doesn't silently pay
        // a different amount than the client requested.
        if (amountMsats > 0 && amountMsats % 1000 !== 0) {
            return this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.invalidAmountMsats'
                ),
                ErrorCodes.INVALID_PARAMS
            );
        }
        // Round up to whole sats so sub-sat msat amounts cannot bypass the
        // budget; matches the lightning path's accounting.
        const amount = amountMsats > 0 ? Math.ceil(amountMsats / 1000) : 0;
        if (!amountMsats || amount <= 0) {
            return this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.invalidAmount'
                ),
                ErrorCodes.INVALID_INVOICE
            );
        }
        const budgetCheck = this.validateBudgetBeforePayment(
            connection,
            amount,
            ErrorCodes.INSUFFICIENT_BALANCE
        );
        if (!budgetCheck.success) {
            return { result: undefined, error: budgetCheck.error };
        }

        const currentBalance = this.cashuStore.totalBalanceSats || 0;
        if (currentBalance < amount) {
            return this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.cashuInsufficientBalance',
                    {
                        amount: amount.toString(),
                        balance: currentBalance.toString()
                    }
                ),
                ErrorCodes.INSUFFICIENT_BALANCE
            );
        }

        const cashuInvoice = await this.cashuStore.payLnInvoiceFromEcash({
            amount: amount.toString()
        });
        if (!cashuInvoice || this.cashuStore.paymentError) {
            const { paymentRequest, paymentHash: decodedHash } =
                await NostrConnectUtils.decodeInvoiceTags(request.invoice);
            if (paymentRequest || request.invoice)
                if (
                    !NostrConnectUtils.isIgnorableError(
                        this.cashuStore.paymentErrorMsg || ''
                    )
                )
                    await this.recordFailedPayment(
                        paymentRequest || request.invoice,
                        connection,
                        'pay_invoice',
                        amount,
                        amountMsats,
                        'cashu',
                        this.cashuStore.paymentErrorMsg || 'Payment failed',
                        decodedHash || ''
                    );
            return this.handleError(
                this.cashuStore.paymentErrorMsg ||
                    localeString(
                        'stores.NostrWalletConnectStore.error.failedToPayInvoice'
                    ),
                ErrorCodes.FAILED_TO_PAY_INVOICE
            );
        }

        if (cashuInvoice.isFailed) {
            return this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.cashuPaymentFailed'
                ),
                ErrorCodes.FAILED_TO_PAY_INVOICE
            );
        }
        // NIP-47 pay_invoice success requires an actual 32-byte preimage.
        // The bolt11 payment request is NOT a preimage; if the mint didn't
        // return one, surface an internal error instead of returning a fake.
        const cashuPreimage = cashuInvoice.getPreimage;
        if (!cashuPreimage || cashuPreimage.length === 0) {
            return this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.noPreimageReceived'
                ),
                ErrorCodes.INTERNAL_ERROR
            );
        }

        // Charge budget unconditionally on confirmed success — see lightning
        // path for rationale. Idempotency is enforced by the pay_invoice mutex
        // and replay-event marker.
        this.chargeBudgetOnSuccess(connection, amount, {
            activityId: request.invoice,
            method: 'pay_invoice'
        });

        const payment = this.cashuStore.payments?.find(
            (payment) => payment.getPaymentRequest === request.invoice
        );
        if (payment) {
            await this.finalizePayment({
                id: request.invoice,
                decoded: payment,
                type: 'pay_invoice',
                payment_source: 'cashu',
                amountSats: amount,
                amountMsats,
                budgetChargeAmountSats: amount,
                skipNotification,
                connection,
                skipBudgetCharge: true
            });
        } else {
            const { paymentHash: decodedHash } =
                await NostrConnectUtils.decodeInvoiceTags(request.invoice);
            if (!decodedHash) {
                return this.handleError(
                    'fallback payment missing payment_hash',
                    ErrorCodes.INTERNAL_ERROR
                );
            }
            await this.recordMinimalSuccessActivity({
                connection,
                invoice: request.invoice,
                type: 'pay_invoice',
                payment_source: 'cashu',
                amountSats: amount,
                amountMsats,
                preimage: cashuPreimage,
                feesPaidMsats: satsToMillisats(cashuInvoice.fee || 0),
                paymentHash: decodedHash
            });
            if (!skipNotification) {
                this.showPaymentSentNotification(amount, connection.name);
            }
        }
        return {
            result: {
                preimage: cashuPreimage,
                fees_paid: satsToMillisats(cashuInvoice.fee || 0)
            },
            error: undefined
        };
    }
    @action
    private checkAndResetAllBudgets = async (): Promise<void> => {
        let needsSave = false;
        runInAction(() => {
            for (const connection of this.connections) {
                const changed = connection.checkAndResetBudgetIfNeeded(
                    this.maxBudgetLimit
                );
                if (changed) {
                    needsSave = true;
                }
            }
        });

        if (needsSave) {
            await this.saveConnections();
        }
    };
    @action
    public async clearWarnings(
        connectionId: string,
        warningType: ConnectionWarningType
    ): Promise<void> {
        const connection = this.connections.find((c) => c.id === connectionId);
        if (!connection) return;
        switch (warningType) {
            case ConnectionWarningType.WalletBalanceLowerThanBudget:
                runInAction(() => {
                    connection.checkAndResetBudgetIfNeeded(this.maxBudgetLimit);
                    connection.removeWarning(warningType);
                    this.findAndUpdateConnection(connection);
                });
                break;
            default:
                runInAction(() => {
                    connection.removeWarning(warningType);
                });
        }
        await this.saveConnections();
    }

    // HELPER METHODS

    private validateBudgetBeforePayment(
        connection: NWCConnection,
        amountSats: number,
        errorCode: ErrorCodes = ErrorCodes.INSUFFICIENT_BALANCE,
        fallbackErrorMessage?: string
    ):
        | { success: true }
        | { success: false; error: { code: string; message: string } } {
        const budgetValidation =
            connection.validateBudgetBeforePayment(amountSats);
        if (!budgetValidation.success) {
            return {
                success: false,
                error: this.handleError(
                    budgetValidation.errorMessage ||
                        fallbackErrorMessage ||
                        localeString(
                            'stores.NostrWalletConnectStore.error.connectionInsufficientBalance',
                            {
                                amount: amountSats.toString(),
                                balance: connection.remainingBudget.toString()
                            }
                        ),
                    errorCode
                ).error
            };
        }
        return { success: true };
    }

    private checkPaymentErrors(
        errorCode: ErrorCodes,
        timeoutMessage?: string,
        noPreimageMessage?: string
    ): void | { result: undefined; error: { code: string; message: string } } {
        if (this.transactionsStore.payment_error) {
            return this.handleError(
                this.transactionsStore.payment_error,
                errorCode
            );
        }

        if (this.transactionsStore.error && this.transactionsStore.error_msg) {
            return this.handleError(
                this.transactionsStore.error_msg,
                errorCode
            );
        }
        if (this.transactionsStore.loading && timeoutMessage) {
            return this.handleError(timeoutMessage, errorCode);
        }
        const preimage = this.transactionsStore.payment_preimage;
        const paymentCompleted = !this.transactionsStore.loading;
        const hasPaymentHash = !!this.transactionsStore.payment_hash;
        const hasSuccessStatus =
            this.transactionsStore.status === 'complete' ||
            this.transactionsStore.status === 'SUCCEEDED';

        const canAssumeSuccess =
            paymentCompleted && (hasPaymentHash || hasSuccessStatus);

        if (!preimage && noPreimageMessage && !canAssumeSuccess) {
            return this.handleError(noPreimageMessage, errorCode);
        }
    }
    private async getInvoiceAmount(
        invoice: string,
        invoiceInfo: any,
        requestAmountMsats?: number
    ): Promise<{
        amountMsats: number;
        amountSats: number;
        usedRequestAmount: boolean;
        invalidRequestAmount: boolean;
    }> {
        // Step 1: Try backend amount
        let backendAmountMsats = 0;
        const numMsatFields = [
            invoiceInfo.num_msat,
            invoiceInfo.amount_msat,
            invoiceInfo.millisatoshis,
            invoiceInfo.invoice_amount_msat
        ];
        const exactMsatField = numMsatFields.find(
            (value) => value !== undefined && value !== null
        );
        if (exactMsatField !== undefined && exactMsatField !== null) {
            backendAmountMsats = Math.floor(Number(exactMsatField) || 0);
        } else if (invoiceInfo.num_satoshis !== undefined) {
            backendAmountMsats = satsToMillisats(
                Math.floor(Number(invoiceInfo.num_satoshis) || 0)
            );
        } else if (invoiceInfo.satoshis !== undefined) {
            backendAmountMsats = satsToMillisats(
                Math.floor(Number(invoiceInfo.satoshis) || 0)
            );
        }
        if (backendAmountMsats > 0) {
            return {
                amountMsats: backendAmountMsats,
                amountSats: Math.ceil(backendAmountMsats / 1000),
                usedRequestAmount: false,
                invalidRequestAmount: false
            };
        }

        // Step 2: Try decoded invoice amount.
        // Wrap the decode in try/catch so a malformed BOLT11 surfaces as an
        // amount of 0 (caller maps to INVALID_INVOICE/INVALID_PARAMS) instead
        // of bubbling up as an INTERNAL error.
        let decodedAmount = 0;
        try {
            const { amount } = await NostrConnectUtils.decodeInvoiceTags(
                invoice
            );
            decodedAmount = Number(amount) || 0;
        } catch (decodeErr) {
            console.log(
                'NWC: decodeInvoiceTags failed; treating as zero amount:',
                decodeErr instanceof Error ? decodeErr.message : decodeErr
            );
        }
        if (decodedAmount > 0) {
            console.log(
                'NWC: Backend did not provide amount, using decoded invoice amount:',
                decodedAmount
            );
            return {
                amountMsats: satsToMillisats(decodedAmount),
                amountSats: decodedAmount,
                usedRequestAmount: false,
                invalidRequestAmount: false
            };
        }

        // Step 3: Try request amount if provided
        // Per NIP-47 spec, request amounts are in millisatoshis
        const normalizedRequestAmountMsats = Number(requestAmountMsats);
        const hasRequestAmount =
            requestAmountMsats !== undefined && requestAmountMsats !== null;

        if (hasRequestAmount) {
            if (
                !Number.isFinite(normalizedRequestAmountMsats) ||
                !Number.isInteger(normalizedRequestAmountMsats) ||
                normalizedRequestAmountMsats <= 0
            ) {
                return {
                    amountMsats: 0,
                    amountSats: 0,
                    usedRequestAmount: false,
                    invalidRequestAmount: true
                };
            }

            const requestedMsats = normalizedRequestAmountMsats;
            return {
                amountMsats: requestedMsats,
                amountSats: Math.ceil(requestedMsats / 1000),
                usedRequestAmount: true,
                invalidRequestAmount: false
            };
        }

        // Step 4: No valid amount found anywhere
        return {
            amountMsats: 0,
            amountSats: 0,
            usedRequestAmount: false,
            invalidRequestAmount: false
        };
    }

    /**
     * Waits for payment completion with timeout handling
     */
    private async waitForPaymentCompletion(): Promise<void> {
        const maxWaitTime = (PAYMENT_TIMEOUT_SECONDS + 5) * 1000;
        const pollInterval = 200;
        const startTime = Date.now();

        while (
            this.transactionsStore.loading &&
            Date.now() - startTime < maxWaitTime
        ) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }

        // If still loading after max wait, consider it timed out
        if (this.transactionsStore.loading) {
            await new Promise((resolve) =>
                setTimeout(resolve, PAYMENT_PROCESSING_DELAY_MS)
            );
        }
    }

    /**
     * Charges the connection's budget on a confirmed-successful payment.
     * Called UNCONDITIONALLY before finalizePayment so a failed payment-row
     * lookup (e.g. paymentsStore lag) cannot let a successful payment escape
     * budget accounting. Idempotency is enforced by the caller via the
     * pay_invoice mutex + replay-event marker.
     */
    private chargeBudgetOnSuccess(
        connection: NWCConnection,
        chargeAmountSats: number,
        context: { activityId: string; method: string }
    ): void {
        const trackResult = connection.trackSpending(chargeAmountSats);
        if (!trackResult.success) {
            console.warn(
                '[NostrWalletConnectStore.chargeBudgetOnSuccess] Budget limit exceeded during spend tracking',
                {
                    timestamp: new Date().toISOString(),
                    connectionId: connection.id,
                    connectionName: connection.name,
                    activityId: context.activityId,
                    method: context.method,
                    chargeAmountSats,
                    totalSpendSats: connection.totalSpendSats,
                    maxAmountSats: connection.maxAmountSats,
                    budgetLimitReached: connection.budgetLimitReached,
                    error: trackResult.errorMessage,
                    severity: 'warning',
                    category: 'budget_race_detected'
                }
            );
        }
    }

    /**
     * Records minimal activity for a successful payment when paymentsStore
     * lookup fails (delayed listing / MPP / Cashu mint-quote latency).
     * Uses the actually-paid amount and the real preimage / fees we already
     * have from the wallet response so list_transactions stays accurate.
     */
    private async recordMinimalSuccessActivity(params: {
        connection: NWCConnection;
        invoice: string;
        type: ConnectionActivityType;
        payment_source: ConnectionPaymentSourceType;
        amountSats: number;
        amountMsats: number;
        preimage: string;
        feesPaidMsats: number;
        paymentHash: string;
    }): Promise<void> {
        runInAction(() => {
            const placeholder: any = {
                getPaymentRequest: params.invoice,
                paymentHash: params.paymentHash,
                getPreimage: params.preimage,
                payment_preimage: params.preimage,
                fee_msat: params.feesPaidMsats.toString(),
                getAmount: params.amountSats,
                amount: params.amountSats
            };
            const paymentObj =
                params.payment_source == 'cashu'
                    ? new CashuPayment(placeholder)
                    : new Payment(placeholder);
            params.connection.addActivity({
                id: params.invoice,
                type: params.type,
                payment: paymentObj,
                status: 'success',
                payment_source: params.payment_source,
                satAmount: params.amountSats,
                msatAmount: params.amountMsats,
                paymentHash: params.paymentHash
            });
            this.findAndUpdateConnection(params.connection);
        });
        await this.saveConnections();
    }

    /**
     * Processes payment completion: tracks spending, saves, and shows notification
     */
    private async finalizePayment({
        id,
        type,
        payment_source,
        decoded,
        connection,
        amountSats,
        amountMsats,
        budgetChargeAmountSats,
        skipNotification = false,
        skipBudgetCharge = false
    }: {
        id: string;
        type: ConnectionActivityType;
        payment_source: ConnectionPaymentSourceType;
        decoded: Payment | CashuPayment | null;
        connection: NWCConnection;
        amountSats: number;
        amountMsats?: number;
        budgetChargeAmountSats?: number;
        skipNotification?: boolean;
        // When true, skip trackSpending — caller has already charged the
        // budget (see chargeBudgetOnSuccess) and we only need to record
        // activity and notify here. Avoids double-charging.
        skipBudgetCharge?: boolean;
    }): Promise<void> {
        runInAction(() => {
            // Use budgetChargeAmountSats if provided (for sub-satoshi budget enforcement),
            // otherwise use amountSats (payment amount)
            const chargeAmount = budgetChargeAmountSats ?? amountSats;
            const exactAmountMsats =
                amountMsats ?? satsToMillisats(chargeAmount);
            if (!skipBudgetCharge) {
                const trackResult = connection.trackSpending(chargeAmount);
                if (!trackResult.success) {
                    const timestamp = new Date().toISOString();
                    console.warn(
                        '[NostrWalletConnectStore.finalizePayment] Budget limit exceeded during spend tracking',
                        {
                            timestamp,
                            connectionId: connection.id,
                            connectionName: connection.name,
                            activityId: id,
                            amountSats,
                            totalSpendSats: connection.totalSpendSats,
                            maxAmountSats: connection.maxAmountSats,
                            budgetLimitReached: connection.budgetLimitReached,
                            error: trackResult.errorMessage,
                            severity: 'warning',
                            category: 'budget_race_detected'
                        }
                    );
                }
            }
            const paymentObj =
                payment_source == 'cashu'
                    ? new CashuPayment(decoded)
                    : new Payment(decoded);
            connection.addActivity({
                id,
                type,
                payment: paymentObj,
                status: 'success',
                payment_source,
                satAmount: amountSats,
                msatAmount: exactAmountMsats,
                paymentHash:
                    paymentObj instanceof Payment
                        ? paymentObj.paymentHash
                        : undefined
            });
            this.findAndUpdateConnection(connection);
        });
        await this.saveConnections();
        if (!skipNotification) {
            this.showPaymentSentNotification(
                budgetChargeAmountSats ?? amountSats,
                connection.name
            );
        }
    }

    private async recordFailedPayment(
        id: string,
        connection: NWCConnection,
        type: ConnectionActivityType,
        amountSats: number,
        amountMsats: number | undefined,
        payment_source: ConnectionPaymentSourceType,
        errorMessage: string,
        paymentHash?: string
    ): Promise<void> {
        const activity = connection.activity.find((conn) => conn.id === id);
        if (activity?.status === 'success') {
            return;
        }
        const index = connection.activity.findIndex((conn) => conn.id === id);
        runInAction(() => {
            const record: ConnectionActivity = {
                id,
                type,
                satAmount: amountSats,
                msatAmount: amountMsats ?? satsToMillisats(amountSats),
                status: 'failed',
                payment_source,
                error: errorMessage,
                paymentHash,
                createdAt: new Date()
            };
            if (index !== -1) {
                connection.activity[index] = {
                    ...connection.activity[index],
                    ...record
                };
            } else {
                // ➕ add new element
                connection.addActivity(record);
            }

            this.findAndUpdateConnection(connection);
        });
        await this.saveConnections();
    }

    // STORAGE OPERATIONS

    private generateWalletServiceKeys(): WalletServiceKeys {
        const walletServiceSecretKey = generatePrivateKey();
        const walletServicePubkey = getPublicKey(walletServiceSecretKey);
        return {
            privateKey: walletServiceSecretKey,
            publicKey: walletServicePubkey
        };
    }

    private async loadWalletServiceKeys(): Promise<WalletServiceKeys> {
        try {
            const storedKeys = await Storage.getItem(NWC_SERVICE_KEYS);
            if (!storedKeys) {
                const keys = this.generateWalletServiceKeys();
                await this.saveWalletServiceKeys(keys);
                return keys;
            }

            const keys = JSON.parse(storedKeys);
            if (!keys.privateKey || !keys.publicKey) {
                console.warn(
                    'NWC: Invalid wallet service keys found, regenerating'
                );
                const newKeys = this.generateWalletServiceKeys();
                await this.saveWalletServiceKeys(newKeys);
                return newKeys;
            }

            return keys;
        } catch (error) {
            console.error('Failed to load wallet service keys:', error);
            const keys = this.generateWalletServiceKeys();
            await this.saveWalletServiceKeys(keys);
            return keys;
        }
    }

    private async saveWalletServiceKeys(
        keys: WalletServiceKeys
    ): Promise<void> {
        try {
            await Storage.setItem(NWC_SERVICE_KEYS, JSON.stringify(keys));
        } catch (error) {
            console.error('Failed to save wallet service keys:', error);
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToStoreServiceKeys'
                )
            );
        }
    }

    private async storeClientKeys(
        pubkey: string,
        privateKey: string
    ): Promise<void> {
        try {
            const storedKeys = await Storage.getItem(NWC_CLIENT_KEYS);
            const keys: ClientKeys = storedKeys ? JSON.parse(storedKeys) : {};
            keys[pubkey] = privateKey;
            await Storage.setItem(NWC_CLIENT_KEYS, JSON.stringify(keys));
        } catch (error) {
            console.error('Failed to store private key:', error);
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToStorePrivateKey'
                )
            );
        }
    }

    private async loadClientPrivateKey(
        pubkey: string
    ): Promise<string | undefined> {
        try {
            const storedKeys = await Storage.getItem(NWC_CLIENT_KEYS);
            if (!storedKeys) return undefined;

            const keys: ClientKeys = JSON.parse(storedKeys);
            return keys[pubkey];
        } catch (error) {
            console.error('Failed to load client private key:', error);
            return undefined;
        }
    }

    private async deleteClientKeys(pubkey: string): Promise<void> {
        try {
            const storedKeys = await Storage.getItem(NWC_CLIENT_KEYS);
            if (storedKeys) {
                const keys: ClientKeys = JSON.parse(storedKeys);
                delete keys[pubkey];
                await Storage.setItem(NWC_CLIENT_KEYS, JSON.stringify(keys));
            }
        } catch (error) {
            console.error('Failed to delete client keys:', error);
        }
    }

    private async loadCashuSetting(): Promise<void> {
        try {
            const cashuEnabled =
                BackendUtils.supportsCashuWallet() &&
                this.settingsStore.settings.ecash.enableCashu;
            if (!cashuEnabled) {
                runInAction(() => {
                    this.cashuEnabled = false;
                });
                return;
            }
            const stored = await Storage.getItem(NWC_CASHU_ENABLED);
            runInAction(() => {
                this.cashuEnabled = stored === 'true';
            });
        } catch (error) {
            console.error('Failed to load Cashu setting:', error);
            runInAction(() => {
                this.cashuEnabled = false;
            });
        }
    }
    @action
    public async setCashuEnabled(enabled: boolean): Promise<void> {
        try {
            await Storage.setItem(NWC_CASHU_ENABLED, enabled.toString());
            runInAction(() => {
                this.cashuEnabled = enabled;
            });
        } catch (error) {
            console.error('Failed to save Cashu setting:', error);
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToSaveCashuSetting'
                )
            );
        }
    }
    // Android Persistent Setting
    private async loadPersistentServiceSetting(): Promise<void> {
        try {
            const stored = await AsyncStorage.getItem(
                NWC_PERSISTENT_SERVICE_ENABLED
            );
            runInAction(() => {
                this.persistentNWCServiceEnabled = stored === 'true';
            });
        } catch (error) {
            console.error(
                'Failed to load persistent NWC service setting:',
                error
            );
            runInAction(() => {
                this.persistentNWCServiceEnabled = false;
            });
        }
    }
    @action
    public async setPersistentNWCServiceEnabled(
        enabled: boolean
    ): Promise<void> {
        try {
            await AsyncStorage.setItem(
                NWC_PERSISTENT_SERVICE_ENABLED,
                enabled.toString()
            );

            runInAction(() => {
                this.persistentNWCServiceEnabled = enabled;
            });

            // Stop background service if disabling persistent service
            if (!enabled && Platform.OS === 'android') {
                try {
                    const { NostrConnectModule } = NativeModules;
                    await NostrConnectModule.stopNostrConnectService();
                } catch (serviceError) {
                    console.warn(
                        'NWC: Failed to stop background service:',
                        serviceError
                    );
                }
            }
        } catch (error) {
            console.error(
                'Failed to save persistent NWC service setting:',
                error
            );
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToSavePersistentServiceSetting'
                )
            );
        }
    }

    // COMPUTED PROPERTIES & GETTERS
    @computed
    get isCashuConfigured(): boolean {
        return this.cashuEnabled && this.cashuStore.isProperlyConfigured();
    }
    @computed
    get cashuConfigurationStatus(): {
        isEnabled: boolean;
        isConfigured: boolean;
        selectedMintUrl?: string;
        errorMessage?: string;
    } {
        const isEnabled = this.cashuEnabled;
        const isConfigured = this.cashuStore.isProperlyConfigured();
        const selectedMintUrl = this.cashuStore.selectedMintUrl;

        let errorMessage: string | undefined;
        if (isEnabled && !isConfigured) {
            if (!selectedMintUrl) {
                errorMessage = localeString(
                    'stores.NostrWalletConnectStore.error.noCashuMintSelected'
                );
            } else {
                errorMessage = localeString(
                    'stores.NostrWalletConnectStore.error.cashuMintNotConfigured',
                    { mintUrl: selectedMintUrl }
                );
            }
        }

        return {
            isEnabled,
            isConfigured,
            selectedMintUrl,
            errorMessage
        };
    }
    public async loadMaxBudget() {
        try {
            if (this.isCashuConfigured) {
                runInAction(() => {
                    this.maxBudgetLimit = this.cashuStore.totalBalanceSats || 0;
                });
            } else {
                const balance = await this.balanceStore.getLightningBalance(
                    true
                );
                runInAction(() => {
                    this.maxBudgetLimit =
                        Number(balance?.lightningBalance) || 0;
                });
            }
        } catch (error) {
            runInAction(() => {
                this.maxBudgetLimit = 0;
            });
            console.error('Failed to get max budget:', error);
        }
    }
    @computed
    public get activeConnections(): NWCConnection[] {
        const { nodeInfo } = this.nodeInfoStore;
        const { implementation } = this.settingsStore;
        return this.connections.filter(
            (c) =>
                c.isActive &&
                c.nodePubkey === nodeInfo.nodeId &&
                c.implementation === implementation
        );
    }

    @computed
    public get expiredConnections(): NWCConnection[] {
        const { nodeInfo } = this.nodeInfoStore;
        const { implementation } = this.settingsStore;
        return this.connections.filter(
            (c) =>
                c.isExpired &&
                c.nodePubkey === nodeInfo.nodeId &&
                c.implementation === implementation
        );
    }

    public get availableRelays(): string[] {
        return Array.from(this.nwcWalletServices.keys());
    }

    public get recommendedRelays(): string[] {
        return this.availableRelays;
    }

    // PLATFORM SPECIFIC SETUP

    // Android
    private async initializeAndroidPersistentService(): Promise<void> {
        if (Platform.OS === 'android') {
            try {
                const { NostrConnectModule } = NativeModules;

                if (!NostrConnectModule) {
                    throw new Error(
                        'NostrConnectModule not found in NativeModules'
                    );
                }

                await NostrConnectModule.initialize();
                this.updateAndroidTranslationCache();
            } catch (serviceError) {
                console.warn(
                    'NWC: Failed to initialize Android service:',
                    serviceError
                );
            }
        }
    }
    private updateAndroidTranslationCache(): void {
        if (Platform.OS === 'android') {
            try {
                const { NostrConnectModule } = NativeModules;
                const translations = {
                    'androidNotification.nwcRunningBackground': localeString(
                        'androidNotification.nwcRunningBackground'
                    ),
                    'androidNotification.nwcShutdown': localeString(
                        'androidNotification.nwcShutdown'
                    )
                };
                NostrConnectModule.updateTranslationCache('en', translations);
            } catch (error) {
                console.warn(
                    'Failed to update Android translation cache:',
                    error
                );
            }
        }
    }
    // Android: Set up listener for background reconnection events from native service
    private setupAndroidReconnectionListener() {
        if (this.androidReconnectionListener) {
            this.androidReconnectionListener.remove();
        }
        this.androidReconnectionListener = DeviceEventEmitter.addListener(
            'NostrConnectReconnectionCheck',
            async () => {
                await this.handleAndroidReconnectionCheck();
            }
        );
    }
    private async setupAndroidLogListener() {
        if (this.androidLogListener) {
            this.androidLogListener.remove();
        }
        this.androidLogListener = DeviceEventEmitter.addListener(
            'NostrConnectLog',
            (event: { level: string; message: string }) => {
                const { level, message } = event;
                switch (level) {
                    case 'error':
                        console.error(`[NWC Native] ${message}`);
                        break;
                    case 'warn':
                        console.warn(`[NWC Native] ${message}`);
                        break;
                    case 'info':
                    default:
                        console.log(`[NWC Native] ${message}`);
                        break;
                }
            }
        );
    }
    private setupAppStateMonitoring() {
        if (this.appStateListener) {
            this.appStateListener.remove();
        }

        this.appStateListener = AppState.addEventListener(
            'change',
            async (nextAppState: string) => {
                if (!this.persistentNWCServiceEnabled) {
                    return;
                }

                try {
                    const { NostrConnectModule } = NativeModules;
                    if (nextAppState === 'background') {
                        await NostrConnectModule.startBackgroundMonitoring();
                    } else if (nextAppState === 'active') {
                        await NostrConnectModule.stopBackgroundMonitoring();
                    }
                } catch (error) {
                    console.warn('Android: App state monitoring error:', error);
                }
            }
        );
    }
    private async handleAndroidReconnectionCheck(): Promise<void> {
        if (!this.persistentNWCServiceEnabled) {
            console.log(
                'Android: Background service not enabled, skipping reconnection check'
            );
            return;
        }
        try {
            const { NostrConnectModule } = NativeModules;
            const isServiceRunning =
                await NostrConnectModule.isNostrConnectServiceRunning();

            if (!isServiceRunning) {
                console.warn(
                    'Android: Background service stopped, attempting restart'
                );
                await this.initializeAndroidPersistentService();
                return;
            }

            const now = Date.now();
            const timeSinceLastAttempt = now - this.lastConnectionAttempt;

            if (
                timeSinceLastAttempt > 30000 &&
                this.activeConnections.length > 0
            ) {
                const relayUrlsUsed = new Set(
                    this.activeConnections.map((c) => c.relayUrl)
                );
                const reconnectResults = await Promise.allSettled(
                    Array.from(this.nwcWalletServices.entries())
                        .filter(([relayUrl]) => relayUrlsUsed.has(relayUrl))
                        .map(async ([relayUrl, nwcWalletService]) => {
                            if (!nwcWalletService.connected) {
                                if (this.walletServiceKeys) {
                                    try {
                                        await this.retryWithBackoff(
                                            async () => {
                                                await nwcWalletService.publishWalletServiceInfoEvent(
                                                    this.walletServiceKeys!
                                                        .privateKey,
                                                    NostrConnectUtils.getFullAccessPermissions(),
                                                    NostrConnectUtils.getNotifications()
                                                );
                                                runInAction(() => {
                                                    this.publishedRelays.add(
                                                        relayUrl
                                                    );
                                                });
                                            },
                                            3
                                        );
                                        // Verify connection after reconnection attempt
                                        if (nwcWalletService.connected) {
                                            return {
                                                relayUrl,
                                                reconnected: true
                                            };
                                        }
                                    } catch (error) {
                                        console.warn(
                                            `Android: Failed to reconnect relay ${relayUrl}:`,
                                            error
                                        );
                                    }
                                }
                                return { relayUrl, reconnected: false };
                            }
                            return { relayUrl, reconnected: false };
                        })
                );

                const reconnectedRelays = reconnectResults
                    .filter(
                        (r) =>
                            r.status === 'fulfilled' &&
                            r.value.reconnected === true
                    )
                    .map((r) =>
                        r.status === 'fulfilled' ? r.value.relayUrl : ''
                    )
                    .filter((url) => url !== '');

                if (reconnectedRelays.length > 0) {
                    console.log(
                        `Android: Successfully reconnected ${reconnectedRelays.length} relays:`,
                        reconnectedRelays
                    );

                    const connectionsToResubscribe =
                        this.activeConnections.filter((c) =>
                            reconnectedRelays.includes(c.relayUrl)
                        );

                    if (connectionsToResubscribe.length > 0) {
                        console.log(
                            `Android: Re-subscribing ${connectionsToResubscribe.length} connections for reconnected relays`
                        );
                        const resubscribePromises =
                            connectionsToResubscribe.map(async (connection) => {
                                try {
                                    // Force a clean resubscribe after the
                                    // relay reconnect — the default skip
                                    // path would no-op because the stale
                                    // unsubscribe handle is still in
                                    // activeSubscriptions.
                                    const subscribed =
                                        await this.subscribeToConnection(
                                            connection,
                                            { forceResubscribe: true }
                                        );
                                    if (!subscribed) {
                                        throw new Error(
                                            localeString(
                                                'stores.NostrWalletConnectStore.error.failedToUpdateConnection'
                                            )
                                        );
                                    }
                                } catch (error) {
                                    console.warn(
                                        `Android: Failed to re-subscribe connection ${connection.name}:`,
                                        error
                                    );
                                }
                            });
                        await Promise.allSettled(resubscribePromises);
                    }
                }
                const subscriptionCount = this.activeSubscriptions.size;
                const expectedSubscriptions = this.activeConnections.length;

                if (subscriptionCount < expectedSubscriptions) {
                    console.log(
                        `Android: Reconnecting ${
                            expectedSubscriptions - subscriptionCount
                        } lost connections`
                    );
                    this.lastConnectionAttempt = now;
                    await this.subscribeToAllConnections();
                }
            }
        } catch (error) {
            console.warn('Android: Reconnection check error:', error);
        }
    }
    @action
    public async startIOSBackgroundTask(
        duration: number = 30000
    ): Promise<boolean> {
        if (Platform.OS !== 'ios') {
            return false;
        }
        try {
            const started = await IOSBackgroundTaskUtils.startBackgroundTask();
            if (!started) {
                console.warn('IOS NWC: Failed to start background task');
                return false;
            }
            runInAction(() => {
                this.iosBackgroundTaskActive = true;
                this.iosBackgroundTimeRemaining = 30;
                this.iosHandoffInProgress = true;
            });

            if (this.iosBackgroundTimerInterval) {
                clearInterval(this.iosBackgroundTimerInterval);
            }

            this.iosBackgroundTimerInterval = setInterval(() => {
                runInAction(() => {
                    if (this.iosBackgroundTimeRemaining > 0) {
                        this.iosBackgroundTimeRemaining--;
                    } else {
                        this.endIOSBackgroundTask();
                    }
                });
            }, 1000);

            await new Promise((resolve) => setTimeout(resolve, duration));

            return true;
        } catch (error) {
            console.error('IOS NWC: Failed to start background task:', error);
            return false;
        } finally {
            this.endIOSBackgroundTask();
        }
    }

    @action
    public async endIOSBackgroundTask(): Promise<void> {
        if (Platform.OS !== 'ios' || !this.iosBackgroundTaskActive) {
            return;
        }

        if (this.iosBackgroundTimerInterval) {
            clearInterval(this.iosBackgroundTimerInterval);
            this.iosBackgroundTimerInterval = null;
        }

        runInAction(() => {
            this.iosBackgroundTimeRemaining = 0;
            this.iosHandoffInProgress = false;
        });

        try {
            await IOSBackgroundTaskUtils.endBackgroundTask();
            runInAction(() => {
                this.iosBackgroundTaskActive = false;
            });
        } catch (error) {
            console.error('iOS NWC: Failed to end background task:', error);
        }
    }
    // for IOS fetch and process pending events
    @action
    public async fetchPendingEvents(maxRetries: number = 3): Promise<void> {
        if (!this.isServiceReady()) {
            console.warn('Service not ready, cannot fetch pending events');
            return;
        }
        if (this.activeConnections.length === 0) {
            console.info(
                'IOS NWC: No active connections, skipping fetch pending events'
            );
            return;
        }

        runInAction(() => {
            this.error = false;
            this.loadingMsg = localeString(
                'stores.NostrWalletConnectStore.fetchingPendingEvents'
            );
        });
        try {
            const deviceToken = this.lightningAddressStore.currentDeviceToken;
            if (!deviceToken) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.deviceTokenNotAvailable'
                    )
                );
            }
            const data = await this.retryWithBackoff(
                async (): Promise<RestoreResponse | void> => {
                    const response = await ReactNativeBlobUtil.fetch(
                        'GET',
                        `${NWC_IOS_EVENTS_LISTENER_SERVER_URL}/restore?device_token=${encodeURIComponent(
                            deviceToken
                        )}`,
                        { 'Content-Type': 'application/json' }
                    );
                    if (response.info().status !== 200) {
                        throw new Error(
                            `HTTP error ${
                                response.info().status
                            }: ${await response.text()}`
                        );
                    }
                    return await JSON.parse(response.data);
                },
                maxRetries
            );
            if (data?.events) {
                await this.validatingPendingPaymentEvents(data.events);
            }
        } catch (error) {
            console.warn(
                'iOS NWC: Failed to fetch pending events:',
                (error as Error).message
            );
        } finally {
            runInAction(() => {
                this.loadingMsg = undefined;
            });
        }
    }

    private async validatingPendingPaymentEvents(
        events: string[]
    ): Promise<void> {
        if (!events?.length) {
            console.info('NWC: No pending events to process');
            return;
        }

        const results = await Promise.all(
            events.map(async (eventStr) => {
                try {
                    const { request, connection, eventId, encryptionScheme } =
                        await this.retryWithBackoff(
                            () => this.validateAndParsePendingEvent(eventStr),
                            3
                        );

                    // Extract event created_at for cache validation
                    let eventCreatedAt: number | undefined;
                    try {
                        const event = JSON.parse(eventStr);
                        eventCreatedAt = event.created_at;
                    } catch (e) {
                        // If parsing fails, proceed without created_at
                    }

                    if (
                        request.method === 'pay_invoice' &&
                        !connection.hasPermission('pay_invoice')
                    ) {
                        try {
                            await this.publishEventToClient(
                                connection,
                                request.method,
                                this.handleError(
                                    localeString(
                                        'backends.NWC.permissionDenied'
                                    ),
                                    ErrorCodes.RESTRICTED
                                ),
                                eventId,
                                encryptionScheme
                            );
                        } catch (error) {
                            console.warn(
                                'NWC: Failed to publish RESTRICTED for pending event',
                                { eventId, method: request.method, error }
                            );
                        }
                        // Persist before returning so the same restored event
                        // doesn't re-publish RESTRICTED on every iOS restore.
                        await this.markProcessedReplayEvent(eventId);
                        return null;
                    }

                    if (request.method === 'pay_invoice') {
                        const { isExpired } =
                            await NostrConnectUtils.decodeInvoiceTags(
                                request.params?.invoice
                            );
                        const { amountSats } = await this.getInvoiceAmount(
                            request.params?.invoice,
                            {},
                            request.params?.amount
                        );
                        if (isExpired) {
                            // Surface a terminal PAYMENT_FAILED to the client
                            // and persist the event so future restores don't
                            // silently re-evaluate the same expired invoice.
                            // (NIP-47: pay_invoice expired-at-pay-time is a
                            // payment failure, not a missing record.)
                            try {
                                await this.publishEventToClient(
                                    connection,
                                    request.method,
                                    this.handleError(
                                        localeString(
                                            'stores.NostrWalletConnectStore.error.invoiceExpired'
                                        ),
                                        ErrorCodes.FAILED_TO_PAY_INVOICE
                                    ),
                                    eventId,
                                    encryptionScheme
                                );
                            } catch (error) {
                                console.warn(
                                    'NWC: Failed to publish PAYMENT_FAILED for expired pending event',
                                    { eventId, method: request.method, error }
                                );
                            }
                            await this.markProcessedReplayEvent(eventId);
                            return null;
                        }
                        return {
                            eventStr,
                            request,
                            connection,
                            eventId,
                            amount: amountSats,
                            encryptionScheme
                        };
                    }

                    if (
                        NostrConnectUtils.getFullAccessPermissions().includes(
                            request.method
                        )
                    ) {
                        if (await this.hasProcessedReplayEvent(eventId)) {
                            const replayResult =
                                await this.replayCachedResponse(
                                    connection,
                                    eventId,
                                    eventCreatedAt
                                );
                            if (replayResult) {
                                return null;
                            }
                            return null;
                        }
                        await this.handleEventRequest(
                            connection,
                            request,
                            eventId,
                            true,
                            encryptionScheme
                        );
                        // Mark restored full-access methods (make_invoice,
                        // sign_message, lookup_invoice, ...) as processed so
                        // a re-delivered restore event doesn't re-execute
                        // them (NIP-47 idempotency for non-pay_invoice
                        // methods on iOS background restore).
                        await this.markProcessedReplayEvent(eventId);
                        return null;
                    }

                    await this.publishNotImplementedNip47Response(
                        connection,
                        request,
                        eventId,
                        encryptionScheme
                    );
                    // Terminal NOT_IMPLEMENTED — persist so a restored
                    // event of an unsupported method doesn't keep
                    // re-publishing the error.
                    await this.markProcessedReplayEvent(eventId);
                    return null;
                } catch (error) {
                    if (error instanceof UnsupportedEncryptionError) {
                        await this.publishUnsupportedEncryptionResponse(
                            error.connection,
                            'unsupported_encryption',
                            error.eventId,
                            error.encryptionScheme
                        );
                        // Terminal UNSUPPORTED_ENCRYPTION error: dedupe
                        // restored deliveries.
                        await this.markProcessedReplayEvent(error.eventId);
                        return null;
                    }
                    console.warn('NWC: PROCESS PENDING EVENTS ERROR', {
                        error,
                        eventStr
                    });
                    return null;
                }
            })
        );

        const pendingEvents = results
            .filter((r): r is InvoiceEventType => r !== null)
            .map((event) => ({
                ...event,
                connectionName: event.connection.name,
                status: false,
                isProcessed: false
            }));

        const dedupedPendingEvents = Array.from(
            new Map(
                pendingEvents.map((event) => [event.eventId, event])
            ).values()
        );

        if (!dedupedPendingEvents.length) return;

        const totalAmount = dedupedPendingEvents.reduce(
            (sum, e) => sum + e.amount,
            0
        );

        this.savePendingPayments(dedupedPendingEvents);

        if (!this.isInNWCPendingPaymentsView) {
            this.modalStore.toggleNWCPendingPaymentsModal({
                pendingEvents: dedupedPendingEvents,
                totalAmount
            });
        }
    }
    private async validateAndParsePendingEvent(eventStr: string): Promise<{
        request: NWCRequest;
        connection: NWCConnection;
        eventId: string;
        encryptionScheme: NwcEncryptionScheme;
    }> {
        let event: NostrEvent;
        try {
            event = JSON.parse(eventStr);
        } catch (error) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.pendingEventParseFailed'
                )
            );
        }
        if (
            event.kind !== 23194 ||
            !event.content ||
            !event.pubkey ||
            !event.id ||
            !event.sig
        ) {
            console.warn('NWC: Invalid event format, skipping', {
                event
            });
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.pendingEventInvalidFormat'
                )
            );
        }
        const connection = this.activeConnections.find(
            (c) => c.pubkey === event.pubkey
        );
        if (!connection) {
            console.warn('NWC: Connection not found for event', {
                pubkey: event.pubkey
            });
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.connectionNotFound'
                )
            );
        }
        if (!validateEvent(event)) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.pendingEventInvalidPayload'
                )
            );
        }

        const recomputedEventId = getEventHash({
            kind: event.kind,
            tags: event.tags,
            content: event.content,
            created_at: event.created_at,
            pubkey: event.pubkey
        });
        if (event.id !== recomputedEventId) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.pendingEventIdHashMismatch'
                )
            );
        }
        if (!verifySignature(event)) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.pendingEventInvalidSignature'
                )
            );
        }

        const encryptionScheme = this.getEventEncryptionScheme(event.tags);

        // Validate that the encryption scheme is supported
        if (!this.isSupportedEncryptionScheme(event.tags)) {
            throw new UnsupportedEncryptionError(
                connection,
                event.id,
                this.getEventEncryptionScheme(event.tags)
            );
        }

        let request: NWCRequest;
        try {
            const privateKey = this.walletServiceKeys!.privateKey;
            if (!privateKey) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.walletServiceKeyNotFound'
                    )
                );
            }
            const decryptedContent =
                encryptionScheme === 'nip44_v2'
                    ? (() => {
                          try {
                              const conversationKey = nip44.getConversationKey(
                                  hexToBytes(privateKey),
                                  connection.pubkey
                              );
                              return nip44.decrypt(
                                  event.content,
                                  conversationKey
                              );
                          } catch (nip44Error) {
                              // NIP-44 decryption failed. Per NIP-44 security model,
                              // if a client explicitly declares NIP-44 encryption but
                              // decryption fails, we must NOT silently downgrade to
                              // NIP-04 (which would break security guarantees).
                              // Instead, return an explicit error so clients can
                              // understand the failure and retry appropriately.
                              console.error(
                                  'NWC: NIP-44 decryption failed - rejecting request to prevent security downgrade',
                                  {
                                      nip44Error,
                                      eventId: event.id,
                                      reason: 'NIP-44 explicitly declared but decryption failed; no implicit NIP-04 fallback'
                                  }
                              );
                              throw new Error(
                                  `NIP-44 decryption failed and no fallback allowed per NIP-44 security model: ${
                                      nip44Error instanceof Error
                                          ? nip44Error.message
                                          : String(nip44Error)
                                  }`
                              );
                          }
                      })()
                    : nip04.decrypt(
                          privateKey,
                          connection.pubkey,
                          event.content
                      );
            request = JSON.parse(decryptedContent);
        } catch (error) {
            const encryptionTag =
                event.tags.find(
                    (tag) =>
                        Array.isArray(tag) &&
                        tag.length >= 2 &&
                        tag[0] === 'encryption'
                )?.[1] || 'none';
            console.error('NWC: Failed to decrypt or parse event content', {
                error,
                encryptionScheme,
                encryptionTag,
                diagnostic:
                    `Decryption failed with scheme=${encryptionScheme}, tag=${encryptionTag}. ` +
                    `If this persists, the client may be using a different encryption scheme than expected.`,
                eventStr
            });
            throw error;
        }

        return {
            request,
            connection,
            eventId: event.id,
            encryptionScheme
        };
    }

    @action
    public async processPendingPaymentsEvents(
        pendingEvents: PendingPayment[]
    ): Promise<void> {
        const uniquePendingEvents = Array.from(
            new Map(
                pendingEvents.map((event) => [event.eventId, event])
            ).values()
        );
        let remainingEvents = [...uniquePendingEvents];
        let remainingTotal = remainingEvents.reduce(
            (sum, event) => sum + event.amount,
            0
        );
        this.resetPendingPayInvoiceState();
        runInAction(() => {
            this.isProcessingPendingPayInvoices = true;
        });

        if (!this.isInNWCPendingPaymentsView)
            this.modalStore.toggleNWCPendingPaymentsModal({
                pendingEvents: remainingEvents,
                totalAmount: remainingTotal
            });

        // Serialize per-connection processing so budget checks, payment
        // dispatch, replay-marker persistence and trackSpending happen
        // atomically for a given connection. Two approved pay_invoice
        // requests for the same connection running in parallel could each
        // pass the budget check before either has been recorded as spent,
        // bypassing maxAmountSats. Different connections can still run in
        // parallel.
        const eventsByConnection = new Map<string, PendingPayment[]>();
        for (const event of uniquePendingEvents) {
            const list = eventsByConnection.get(event.connection.id) || [];
            list.push(event);
            eventsByConnection.set(event.connection.id, list);
        }

        const processSingleEvent = async (event: PendingPayment) => {
            try {
                // Persisted replay guards stop a previously approved event
                // from being re-run after a restart.
                const connection = this.getConnection(event.connection.id);
                if (!connection) {
                    return null;
                }

                // Extract event created_at for cache validation
                let eventCreatedAt: number | undefined;
                try {
                    const nostrEvent = JSON.parse(event.eventStr);
                    eventCreatedAt = nostrEvent.created_at;
                } catch (e) {
                    // If parsing fails, proceed without created_at
                }

                let result: {
                    success: boolean;
                    errorMessage?: string;
                    committed: boolean;
                } | null = null;

                // Replay detection uses check-then-act pattern that is safe because:
                // 1. hasProcessedReplayEvent is read-only (no state mutation)
                // 2. replayCachedResponse is idempotent (returns null if cache misses)
                // 3. markProcessedReplayEvent uses mutex for atomic read-modify-write
                // This prevents double-execution even with concurrent connections processing
                // the same eventId, as the first to successfully mark it gains exclusivity.
                if (await this.hasProcessedReplayEvent(event.eventId)) {
                    result = await this.replayCachedResponse(
                        connection,
                        event.eventId,
                        eventCreatedAt
                    );
                    if (!result) {
                        return null;
                    }
                } else {
                    result = await this.handleEventRequest(
                        connection,
                        event.request,
                        event.eventId,
                        true, // skip single payment notification for pending events
                        event.encryptionScheme || 'nip04'
                    );
                    if (result.committed) {
                        // Persist replay marker IMMEDIATELY after successful handling
                        // to minimize window where state mutations are visible but marker
                        // isn't persisted (which would cause replayed transactions on restart).
                        // Mark as processed now, before updating UI state.
                        const persisted = await this.markProcessedReplayEvent(
                            event.eventId
                        );
                        if (!persisted) {
                            // CRITICAL: If marker fails to persist, we cannot safely
                            // update UI state. Log and fail the event to be retried later.
                            console.error(
                                'NWC: CRITICAL - replay marker persistence failed after handling event. Event marked for retry.',
                                {
                                    eventId: event.eventId,
                                    method: event.request.method,
                                    severity: 'CRITICAL'
                                }
                            );
                            // Return error to prevent UI state mutation
                            result = {
                                success: false,
                                errorMessage: 'Failed to persist replay marker',
                                committed: false
                            };
                        }
                    }
                }
                if (result.success) {
                    await this.updatePendingPayment({
                        ...event,
                        status: true,
                        isProcessed: true
                    });
                    runInAction(() => {
                        this.processedPendingPayInvoiceEventIds.push(
                            event.eventId
                        );
                    });
                } else {
                    let formattedError: string | undefined;
                    if (result.errorMessage) {
                        formattedError = result.errorMessage;
                        try {
                            const parsed = JSON.parse(result.errorMessage);
                            if (parsed.message) {
                                formattedError = parsed.message;
                            } else if (typeof parsed === 'string') {
                                formattedError = parsed;
                            }
                        } catch {
                            // keep raw message
                        }
                        await this.updatePendingPayment({
                            ...event,
                            status: false,
                            isProcessed: true,
                            errorMessage: formattedError
                        });
                    }
                    runInAction(() => {
                        this.failedPendingPayInvoiceEventIds.push(
                            event.eventId
                        );
                        if (formattedError) {
                            this.pendingPayInvoiceErrors.set(
                                event.eventId,
                                formattedError
                            );
                        }
                    });
                }
                if (result.committed && !result.success) {
                    console.warn(
                        'NWC: response publish failed after committing pending event',
                        {
                            eventId: event.eventId,
                            method: event.request.method,
                            errorMessage: result.errorMessage
                        }
                    );
                }
                return { event, result };
            } catch (error) {
                console.warn('NWC: Failed to process pending pay invoice', {
                    error,
                    eventId: event.eventId
                });
                const message =
                    error instanceof Error ? error.message : String(error);
                let formattedError = message;
                try {
                    const parsed = JSON.parse(message);
                    if (parsed.message) {
                        formattedError = parsed.message;
                    } else if (typeof parsed === 'string') {
                        formattedError = parsed;
                    }
                } catch {
                    formattedError = message;
                }
                await this.updatePendingPayment({
                    ...event,
                    status: false,
                    isProcessed: true,
                    errorMessage: formattedError
                });
                runInAction(() => {
                    this.failedPendingPayInvoiceEventIds.push(event.eventId);
                    this.pendingPayInvoiceErrors.set(
                        event.eventId,
                        formattedError
                    );
                });
                return { event, result: { success: false } };
            }
        };

        // Per-connection sequential, cross-connection parallel.
        const groupResults = await Promise.allSettled(
            Array.from(eventsByConnection.values()).map(async (group) => {
                const out: Array<{
                    event: PendingPayment;
                    result: any;
                } | null> = [];
                for (const event of group) {
                    out.push(await processSingleEvent(event));
                }
                return out;
            })
        );

        const processingResults: PromiseSettledResult<{
            event: PendingPayment;
            result: any;
        } | null>[] = [];
        for (const group of groupResults) {
            if (group.status === 'fulfilled') {
                for (const item of group.value) {
                    processingResults.push({
                        status: 'fulfilled',
                        value: item
                    } as any);
                }
            } else {
                processingResults.push({
                    status: 'rejected',
                    reason: group.reason
                } as any);
            }
        }
        const successfulEventIds = new Set<string>();
        const successfulPayments: Array<{
            amount: number;
            connectionName: string;
        }> = [];
        for (const result of processingResults) {
            if (result.status === 'fulfilled') {
                if (result.value?.result?.committed) {
                    successfulEventIds.add(result.value.event.eventId);
                    successfulPayments.push({
                        amount: result.value.event.amount,
                        connectionName: result.value.event.connectionName
                    });
                    await this.deletePendingPaymentById(
                        result.value.event.eventId
                    );
                }
            }
        }
        remainingEvents = remainingEvents.filter(
            (e) => !successfulEventIds.has(e.eventId)
        );
        remainingTotal = remainingEvents.reduce((sum, e) => sum + e.amount, 0);

        if (successfulPayments.length > 0) {
            const totalAmount = successfulPayments.reduce(
                (sum, p) => sum + p.amount,
                0
            );
            const value = numberWithCommas(totalAmount.toString());
            const connectionNames = [
                ...new Set(successfulPayments.map((p) => p.connectionName))
            ].join(', ');
            const connectionNameDisplay =
                connectionNames.length > 50
                    ? connectionNames.substring(0, 50) + '...'
                    : connectionNames;
            const paymentCountText =
                successfulPayments.length === 1
                    ? `1 ${localeString(
                          'views.Wallet.Wallet.payments'
                      ).toLowerCase()}`
                    : `${successfulPayments.length} ${localeString(
                          'views.Wallet.Wallet.payments'
                      )}`;
            const notificationBody = `${paymentCountText} ${localeString(
                'general.sent'
            )}: ${value} ${localeString('general.sats')}${
                connectionNames ? ` (${connectionNameDisplay})` : ''
            }`;
            this.showNotification(
                localeString(
                    'stores.NostrWalletConnectStore.paymentSentNotificationTitle'
                ),
                notificationBody
            );
        }

        runInAction(() => {
            this.isProcessingPendingPayInvoices = false;
        });

        const hasFailures = this.failedPendingPayInvoiceEventIds.length > 0;

        if (hasFailures) {
            if (!this.isInNWCPendingPaymentsView)
                this.modalStore.toggleNWCPendingPaymentsModal({
                    pendingEvents: remainingEvents,
                    totalAmount: remainingTotal
                });
        } else {
            if (!this.isInNWCPendingPaymentsView)
                this.modalStore.toggleNWCPendingPaymentsModal({});
            runInAction(() => {
                this.isAllPendingPaymentsSuccessful = true;
            });
            await this.deleteAllPendingPayments();

            runInAction(() => {
                this.resetPendingPayInvoiceState();
            });
        }
    }

    private async handleEventRequest(
        connection: NWCConnection,
        request: NWCRequest,
        eventId: string,
        skipNotification: boolean = false,
        requestEncryptionScheme: NwcEncryptionScheme = 'nip04'
    ): Promise<{
        success: boolean;
        errorMessage?: string;
        committed: boolean;
    }> {
        let response: any;
        try {
            if (
                NWC_METHODS_REQUIRING_CONNECTION_PERMISSION.includes(
                    request.method as any
                ) &&
                !connection.hasPermission(request.method)
            ) {
                response = this.handleError(
                    localeString('backends.NWC.permissionDenied'),
                    ErrorCodes.RESTRICTED
                );
            } else {
                switch (request.method) {
                    case 'get_info':
                        response = await this.handleGetInfo(connection);
                        break;
                    case 'get_balance':
                        response = await this.handleGetBalance(connection);
                        break;
                    case 'pay_invoice':
                        response = await this.runPayInvoiceSerialized(() =>
                            this.handlePayInvoice(
                                connection,
                                request.params,
                                skipNotification
                            )
                        );
                        break;
                    case 'make_invoice':
                        response = await this.handleMakeInvoice(
                            connection,
                            request.params
                        );
                        break;
                    case 'lookup_invoice':
                        response = await this.handleLookupInvoice(
                            request.params
                        );
                        break;
                    case 'list_transactions':
                        response = await this.handleListTransactions(
                            connection,
                            request.params
                        );
                        break;
                    case 'sign_message':
                        response = await this.handleSignMessage(request.params);
                        break;
                    default:
                        response = this.handleError(
                            localeString(
                                'stores.NostrWalletConnectStore.error.methodNotImplemented',
                                { method: request.method }
                            ),
                            ErrorCodes.NOT_IMPLEMENTED
                        );
                        break;
                }
            }
        } catch (error) {
            console.warn('NWC: Failed to handle event request', {
                error: (error as Error).message,
                method: request.method,
                connection: connection.name,
                eventId
            });
            const errorMessage =
                (error instanceof Error ? error.message : String(error)) ||
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToPayInvoice'
                );
            response = this.handleError(
                errorMessage,
                ErrorCodes.INTERNAL_ERROR
            );
        }
        const hasError = !!response?.error;
        const errorMessage = response?.error?.message;
        let committed = !!response;

        // Only publish if we have a response
        if (response) {
            try {
                if (eventId) {
                    await this.cacheReplayResponse(
                        eventId,
                        request.method,
                        response,
                        requestEncryptionScheme
                    );
                }
                await this.publishEventToClient(
                    connection,
                    request.method,
                    response,
                    eventId,
                    requestEncryptionScheme
                );
                if (eventId) {
                    await this.removeReplayResponse(eventId);
                }
            } catch (error) {
                console.warn('NWC: Failed to publish event response', {
                    error,
                    method: request.method,
                    connection: connection.name,
                    eventId
                });
                return {
                    success: false,
                    errorMessage:
                        error instanceof Error ? error.message : String(error),
                    committed
                };
            }
        }

        return {
            success: !hasError,
            errorMessage: hasError ? errorMessage : undefined,
            committed
        };
    }
    /**
     * NIP-47 error codes include NOT_IMPLEMENTED for wallet methods that are not supported.
     */
    private async publishNotImplementedNip47Response(
        connection: NWCConnection,
        request: NWCRequest,
        eventId: string,
        requestEncryptionScheme: NwcEncryptionScheme = 'nip04'
    ): Promise<void> {
        try {
            const response = this.handleError(
                localeString(
                    'stores.NostrWalletConnectStore.error.methodNotImplemented',
                    { method: request.method }
                ),
                ErrorCodes.NOT_IMPLEMENTED
            );
            await this.publishEventToClient(
                connection,
                request.method,
                response,
                eventId,
                requestEncryptionScheme
            );
        } catch (error) {
            console.warn(
                'NWC: Failed to publish NOT_IMPLEMENTED for pending event',
                { eventId, method: request.method, error }
            );
        }
    }

    private async publishUnsupportedEncryptionResponse(
        connection: NWCConnection,
        originalMethod: string,
        eventId: string,
        // Accepted for legacy callers but intentionally ignored: the inbound
        // scheme is by definition unsupported, so the response MUST fall
        // back to NIP-04 (which every NIP-47 client supports). Sending the
        // error encrypted with the same unsupported scheme would be
        // unparseable by the client.
        _requestEncryptionScheme: NwcEncryptionScheme = 'nip04'
    ): Promise<void> {
        try {
            await this.publishEventToClient(
                connection,
                originalMethod,
                this.handleError(
                    'Unsupported encryption scheme',
                    ErrorCodes.UNSUPPORTED_ENCRYPTION
                ),
                eventId,
                'nip04'
            );
        } catch (error) {
            console.warn(
                'NWC: Failed to publish UNSUPPORTED_ENCRYPTION for pending event',
                { eventId, error }
            );
        }
    }

    // Publishing Events to Nostr client
    private async publishEventToClient(
        connection: NWCConnection,
        method: string,
        response: any,
        eventId?: string,
        encryptionScheme: NwcEncryptionScheme = 'nip04'
    ): Promise<void> {
        const servicePrivateKey = this.walletServiceKeys!.privateKey;
        const servicePublicKey = this.walletServiceKeys!.publicKey;
        const normalizedError = response?.error
            ? {
                  ...response.error,
                  code: this.toNip47ErrorCode(response.error.code, method)
              }
            : null;
        const payload: any = {
            result_type: method
        };

        if (normalizedError) {
            payload.error = normalizedError;
        } else {
            payload.result = response?.result ?? null;
        }
        const payloadString = JSON.stringify(payload);
        let content: string;
        let actualEncryptionScheme: NwcEncryptionScheme = encryptionScheme;
        try {
            content =
                encryptionScheme === 'nip44_v2'
                    ? nip44.encrypt(
                          payloadString,
                          nip44.getConversationKey(
                              hexToBytes(servicePrivateKey),
                              connection.pubkey
                          )
                      )
                    : nip04.encrypt(
                          servicePrivateKey,
                          connection.pubkey,
                          payloadString
                      );
        } catch (error) {
            console.error('NWC: Failed to encrypt response payload', {
                method,
                eventId,
                encryptionScheme,
                error: error instanceof Error ? error.message : String(error)
            });
            // If NIP-44 was explicitly requested, reject instead of downgrading to NIP-04.
            // This maintains security model consistency with request decryption, which also
            // rejects NIP-44 failures. Symmetric security posture prevents downgrade attacks.
            if (encryptionScheme === 'nip44_v2') {
                throw new Error(
                    `NIP-44 response encryption failed and fallback not allowed per NIP-44 security model: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            } else {
                throw error;
            }
        }
        let tags: string[][] = [];
        if (eventId) {
            tags.push(['e', eventId]);
        }
        // Per NIP-47: response events SHOULD include an `encryption` tag
        // identifying the scheme used (`nip04` or `nip44_v2`) so clients can
        // decrypt without guessing. Always emit it for both schemes.
        tags.push(['encryption', actualEncryptionScheme]);
        tags.push(['p', connection.pubkey]);
        const unsignedEvent: UnsignedEvent = {
            kind: 23195,
            tags,
            content,
            created_at: dateTimeUtils.getCurrentTimestamp(),
            pubkey: servicePublicKey
        };
        const signedEvent = {
            ...unsignedEvent,
            id: getEventHash(unsignedEvent),
            sig: getSignature(unsignedEvent, servicePrivateKey)
        };

        await this.retryWithBackoff(async () => {
            const relay = relayInit(connection.relayUrl);
            try {
                await relay.connect();
                await relay.publish(signedEvent);
            } finally {
                try {
                    relay.close();
                } catch (error) {
                    console.error('NWC: Failed to close relay:', error);
                }
            }
        }, MAX_RELAY_ATTEMPTS);
    }

    private isSupportedEncryptionScheme(tags: string[][]): boolean {
        const encryptionTag = tags.find((tag) => tag[0] === 'encryption');
        const schemeValue = encryptionTag?.[1];

        // No encryption tag or empty means default (nip04), which is supported
        if (!schemeValue) {
            return true;
        }

        // Validate that the scheme value is a string
        if (typeof schemeValue !== 'string') {
            console.warn('NWC: Invalid encryption tag value type', {
                tagValue: schemeValue,
                tagType: typeof schemeValue
            });
            return false;
        }

        const normalized = schemeValue.toLowerCase();
        const validSchemes = ['nip04', 'nip44_v2'];

        // Check if it's one of the supported schemes using exact match
        if (validSchemes.includes(normalized)) {
            return true;
        }

        // Unknown encryption scheme
        console.warn('NWC: Unsupported encryption scheme', {
            scheme: normalized,
            validSchemes
        });
        return false;
    }

    private getEventEncryptionScheme(tags: string[][]): NwcEncryptionScheme {
        const encryptionTag = tags.find(
            (tag) =>
                Array.isArray(tag) && tag.length >= 2 && tag[0] === 'encryption'
        );
        const schemeValue = encryptionTag?.[1];

        // No encryption tag means default (nip04)
        if (!schemeValue) {
            return 'nip04';
        }

        // Validate that the scheme value is a string
        if (typeof schemeValue !== 'string') {
            console.warn(
                'NWC: Invalid encryption tag value type, defaulting to nip04',
                {
                    tagValue: schemeValue,
                    tagType: typeof schemeValue
                }
            );
            return 'nip04';
        }

        const normalized = schemeValue.toLowerCase();
        const validSchemes = ['nip04', 'nip44_v2'];

        // Use exact match for scheme detection
        if (normalized === 'nip44_v2') {
            return 'nip44_v2';
        }

        // Default to nip04 for unknown schemes
        if (!validSchemes.includes(normalized)) {
            console.warn(
                'NWC: Unknown encryption scheme, defaulting to nip04',
                {
                    scheme: normalized,
                    validSchemes
                }
            );
        }

        return 'nip04';
    }

    // Maps internal error codes to NIP-47 specification error codes.
    // NIP-47 defines (canonical set across spec + per-method extensions):
    //   RATE_LIMITED, NOT_IMPLEMENTED, INSUFFICIENT_BALANCE, QUOTA_EXCEEDED,
    //   RESTRICTED, UNAUTHORIZED, INTERNAL, UNSUPPORTED_ENCRYPTION, OTHER,
    //   PAYMENT_FAILED (pay_invoice / pay_keysend), NOT_FOUND (lookup_invoice),
    //   INVALID_PARAMS (widely-supported request-validation extension).
    // Internal codes that have no direct NIP-47 equivalent are mapped to the
    // closest spec category — see per-case comments below for the rationale
    // (e.g. INVALID_INVOICE → INVALID_PARAMS, INVOICE_EXPIRED → NOT_FOUND,
    // FAILED_TO_PAY_INVOICE → PAYMENT_FAILED, FAILED_TO_CREATE_INVOICE → INTERNAL).
    private toNip47ErrorCode(code?: string, method?: string): string {
        switch ((code || '').toUpperCase()) {
            case 'RATE_LIMITED':
                return 'RATE_LIMITED';
            case 'NOT_IMPLEMENTED':
                return 'NOT_IMPLEMENTED';
            case 'INSUFFICIENT_BALANCE':
                return 'INSUFFICIENT_BALANCE';
            case 'QUOTA_EXCEEDED':
                return 'QUOTA_EXCEEDED';
            case 'RESTRICTED':
                return 'RESTRICTED';
            case 'NOT_FOUND':
                return 'NOT_FOUND';
            case 'UNSUPPORTED_ENCRYPTION':
                return 'UNSUPPORTED_ENCRYPTION';
            case 'INVALID_PARAMS':
                return 'INVALID_PARAMS';
            case 'INVALID_INVOICE':
                // An invalid/undecodable invoice is a request-parameter
                // validation failure; surface as INVALID_PARAMS so clients
                // can react deterministically (same NIP-47 spec category).
                return 'INVALID_PARAMS';
            case 'INVOICE_EXPIRED':
                // Per NIP-47, expired-at-pay-time is a payment failure for
                // pay_invoice / pay_keysend, not a missing record. Other
                // methods (e.g. lookup_invoice) keep the NOT_FOUND mapping.
                if (method === 'pay_invoice' || method === 'pay_keysend') {
                    return 'PAYMENT_FAILED';
                }
                return 'NOT_FOUND';
            case 'FAILED_TO_PAY_INVOICE':
                // Per NIP-47 §pay_invoice errors, payment-flow failures
                // (timeout / no route / capacity) map to PAYMENT_FAILED.
                return 'PAYMENT_FAILED';
            case 'FAILED_TO_CREATE_INVOICE':
                // No spec-defined code for invoice-creation failures;
                // treat as an internal wallet-service error.
                return 'INTERNAL';
            case 'INTERNAL_ERROR':
                return 'INTERNAL';
            default:
                // Log unmapped error codes for monitoring; fallback to INTERNAL
                // for safety (NIP-47 doesn't define 'OTHER' code).
                if (code) {
                    console.warn(
                        'NWC: Unmapped error code in toNip47ErrorCode, falling back to INTERNAL',
                        {
                            originalCode: code,
                            method,
                            severity: 'warning'
                        }
                    );
                }
                return 'INTERNAL';
        }
    }

    // IOS: handoff request to notification server
    @action
    public sendHandoffRequest = async (): Promise<void> => {
        if (Platform.OS !== 'ios') {
            console.log('IOS NWC: Not iOS, skipping handoff request');
            return;
        }
        if (this.activeConnections.length === 0) {
            console.log(
                'IOS NWC: No active connections, skipping handoff request'
            );
            return;
        }
        try {
            const deviceToken = this.lightningAddressStore.currentDeviceToken;
            if (!deviceToken) {
                console.warn(
                    'IOS NWC: Device token not available, skipping handoff request'
                );
                return;
            }
            const handoffData = {
                device_token: deviceToken,
                connections: this.activeConnections.map((conn) => ({
                    relay: conn.relayUrl,
                    pubkey: conn.pubkey,
                    name: conn.name
                }))
            };
            const response = await ReactNativeBlobUtil.fetch(
                'POST',
                `${NWC_IOS_EVENTS_LISTENER_SERVER_URL}/handoff`,
                {
                    'Content-Type': 'application/json'
                },
                JSON.stringify(handoffData)
            );
            if (response.info().status !== 200) {
                throw new Error(
                    `IOS NWC: Handoff request failed with status ${
                        response.info().status
                    }: ${await response.text()}`
                );
            }
            console.info('IOS NWC: Handoff request sent successfully');
        } catch (error) {
            console.error('IOS NWC: Failed to send handoff request:', error);
        }
    };

    private showNotification(title: string, body: string): void {
        if (Platform.OS === 'android') {
            // @ts-ignore:next-line
            Notifications.postLocalNotification({
                title,
                body
            });
        } else if (Platform.OS === 'ios') {
            // @ts-ignore:next-line
            Notifications.postLocalNotification({
                title,
                body,
                sound: 'chime.aiff'
            });
        }
    }
    private showPaymentSentNotification(
        amountSats: number,
        connectionName: string
    ): void {
        const value = numberWithCommas(amountSats.toString());
        this.showNotification(
            localeString(
                'stores.NostrWalletConnectStore.paymentSentNotificationTitle'
            ),
            localeString(
                'stores.NostrWalletConnectStore.paymentSentNotificationBody',
                {
                    amount: value,
                    unit: localeString('general.sats'),
                    connectionName
                }
            )
        );
    }

    private showInvoiceCreatedNotification(
        amountSats: number,
        connectionName: string,
        description?: string
    ): void {
        const value = numberWithCommas(amountSats.toString());
        const body = description
            ? localeString(
                  'stores.NostrWalletConnectStore.invoiceCreatedNotificationBodyWithDescription',
                  {
                      amount: value,
                      unit: localeString('general.sats'),
                      connectionName,
                      description
                  }
              )
            : localeString(
                  'stores.NostrWalletConnectStore.invoiceCreatedNotificationBody',
                  {
                      amount: value,
                      unit: localeString('general.sats'),
                      connectionName
                  }
              );
        this.showNotification(
            localeString(
                'stores.NostrWalletConnectStore.invoiceCreatedNotificationTitle'
            ),
            body
        );
    }

    @action private setError(message: string) {
        this.error = true;
        this.errorMessage = message;
    }

    private handleError(
        message: string,
        code: ErrorCodes = ErrorCodes.INTERNAL_ERROR
    ): {
        result: undefined;
        error: {
            code: string;
            message: string;
        };
    } {
        return {
            result: undefined,
            error: {
                code: code as string,
                message
            }
        };
    }

    async retryWithBackoff<T>(
        operation: () => Promise<T>,
        maxRetries: number,
        baseDelay: number = 1000,
        maxDelay: number = 10000
    ): Promise<T> {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                if (attempt === maxRetries - 1) throw error;
                const delay = Math.min(
                    baseDelay * Math.pow(2, attempt) + Math.random() * 100,
                    maxDelay
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        throw new Error(
            localeString(
                'stores.NostrWalletConnectStore.error.maxRetriesReached'
            )
        );
    }
    public async pingRelay(relayUrl: string): Promise<{
        status: boolean;
        error?: string | null;
    }> {
        try {
            const relay = relayInit(relayUrl);
            const timeout = new Promise<void>((_, reject) =>
                setTimeout(
                    () => reject(new Error('Connection timed out')),
                    5000
                )
            );
            await Promise.race([relay.connect(), timeout]);
            relay.close();
            return { status: true, error: null };
        } catch (e) {
            return {
                status: false,
                error: localeString(
                    'stores.NostrWalletConnectStore.error.failedToConnectRelay',
                    { relayUrl }
                )
            };
        }
    }
    public setisInNWCPendingPaymentsView(isInNWCPendingPaymentsView: boolean) {
        runInAction(() => {
            this.isInNWCPendingPaymentsView = isInNWCPendingPaymentsView;
        });
    }
}
