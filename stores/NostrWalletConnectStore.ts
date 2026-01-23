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
    Nip47PayKeysendRequest,
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
    UnsignedEvent
} from 'nostr-tools';
import * as nip04 from '@nostr/tools/nip04';

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
import IOSBackgroundTaskUtils from '../utils/IOSBackgroundTaskUtils';
import dateTimeUtils from '../utils/DateTimeUtils';
import { satsToMillisats, millisatsToSats } from '../utils/AmountUtils';
import { numberWithCommas } from '../utils/UnitsUtils';

import NWCConnection, {
    BudgetRenewalType,
    ConnectionActivity,
    ConnectionActivityType,
    ConnectionPaymentSourceType,
    ConnectionWarningType,
    TimeUnit
} from '../models/NWCConnection';
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

export const DEFAULT_NOSTR_RELAYS = [
    'wss://relay.getalby.com/v1',
    'wss://relay.snort.social',
    'wss://relay.damus.io'
];

enum ErrorCodes {
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    RATE_LIMITED = 'RATE_LIMITED',
    INVALID_INVOICE = 'INVALID_INVOICE',
    FAILED_TO_PAY_INVOICE = 'FAILED_TO_PAY_INVOICE',
    FAILED_TO_CREATE_INVOICE = 'FAILED_TO_CREATE_INVOICE',
    NOT_FOUND = 'NOT_FOUND',
    NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
    SEND_KEYSEND_FAILED = 'SEND_KEYSEND_FAILED',
    INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
    INVOICE_EXPIRED = 'INVOICE_EXPIRED'
}

interface ClientKeys {
    [pubkey: string]: string;
}

interface WalletServiceKeys {
    privateKey: string;
    publicKey: string;
}

interface NostrEvent {
    kind: number;
    pubkey: string;
    content: string;
    id: string;
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

export interface PendingPayment {
    eventStr: string;
    request: NWCRequest;
    connection: NWCConnection;
    eventId: string;
    connectionName: string;
    amount: number;
    isProcessed?: boolean;
    status?: boolean;
    errorMessage?: string;
}

export interface CreateConnectionParams {
    id?: string; // For Regenerating connections with the same Id
    name: string;
    relayUrl: string;
    permissions?: Nip47SingleMethod[];
    budgetAmount?: number;
    budgetRenewal?: BudgetRenewalType;
    expiresAt?: Date;
    customExpiryValue?: number;
    customExpiryUnit?: TimeUnit;
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
    @observable public maxBudgetLimit: number = 0; // Max wallet balance
    private iosBackgroundTimerInterval: any = null;
    private androidReconnectionListener: any = null;
    private appStateListener: any = null;
    private androidLogListener: any = null;

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
     * Creates a new NWC connection with the specified parameters.
     * @param params Configuration for the new connection.
     * @returns The connection URL or null if creation fails.
     * @throws Error if the connection name is invalid or the relay is unavailable.
     */
    @action
    public createConnection = async (
        params: CreateConnectionParams
    ): Promise<string> => {
        try {
            if (!params.name.trim()) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.connectionNameRequired'
                    )
                );
            }
            const existingConnection = this.connections.find(
                (c) =>
                    c.name.trim().toLowerCase() ===
                    params.name.trim().toLowerCase()
            );
            if (existingConnection) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.connectionNameExists'
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
                this.generateConnectionSecret(params.relayUrl);
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
                activity: params.activity || []
            };

            const connection = new NWCConnection(connectionData);
            await this.storeClientKeys(
                connectionPublicKey,
                connectionPrivateKey
            );
            runInAction(() => {
                this.connections.unshift(connection);
            });
            await this.saveConnections();
            await this.subscribeToConnection(connection);
            await this.sendHandoffRequest();
            return connectionUrl;
        } catch (error: any) {
            throw error;
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
     * @returns Promise<boolean> - True if update was successful, false otherwise.
     * @throws Error if the connection is not found or update fails.
     */
    @action
    public updateConnection = async (
        connectionId: string,
        updates: Partial<NWCConnection>
    ): Promise<{ nostrUrl?: string; success: boolean }> => {
        try {
            runInAction(() => {
                this.error = false;
            });
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
            const oldRelayUrl = connection.relayUrl;
            const newRelayUrl = updates.relayUrl;
            const relayUrlChanged = newRelayUrl && newRelayUrl !== oldRelayUrl;

            if (relayUrlChanged) {
                await this.unsubscribeFromConnection(connectionId);
                if (!this.nwcWalletServices.has(newRelayUrl)) {
                    await this.initializeNWCWalletServices();
                }
            }

            runInAction(() => {
                const oldBudgetRenewal = connection.budgetRenewal;
                const newBudgetRenewal = updates.budgetRenewal;
                const newMaxAmountSats = updates.maxAmountSats;

                Object.assign(connection, updates);

                const hadBudget = connection.hasBudgetLimit;
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
            await this.subscribeToConnection(connection);
            if (relayUrlChanged) {
                return {
                    nostrUrl:
                        this.generateConnectionSecret(newRelayUrl)
                            .connectionUrl,
                    success: true
                };
            }
            return { success: true };
        } catch (error: any) {
            console.error('Failed to update NWC connection:', error);
            runInAction(() => {
                this.setError(
                    (error as Error).message ||
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
            if (existsPendingPayment) {
                const prev: PendingPayment[] = JSON.parse(existsPendingPayment);
                await Storage.setItem(
                    NWC_PENDING_PAYMENTS,
                    JSON.stringify([...prev, ...pendingPayments])
                );
                return;
            }
            await Storage.setItem(
                NWC_PENDING_PAYMENTS,
                JSON.stringify(pendingPayments)
            );
        } catch (error) {
            console.error('failed to save pending payment');
        }
    };
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
            const restoredPayments = (
                await Promise.all(
                    payments.map(async (payment: PendingPayment) => {
                        const connection = this.getConnection(
                            payment.connection.id
                        );

                        if (!connection) {
                            await this.deletePendingPaymentById(
                                payment.eventId
                            );
                            return [];
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
                            async (inv) =>
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
        return { name: connection.name, activity: connection.activity || [] };
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
    private generateConnectionSecret(relayUrl: string) {
        if (!this.walletServiceKeys?.publicKey) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.walletServicePublicKeyNotAvailable'
                )
            );
        }
        const connectionPrivateKey = generatePrivateKey();
        const connectionPublicKey = getPublicKey(connectionPrivateKey);
        const connectionUrl = `nostr+walletconnect://${
            this.walletServiceKeys.publicKey
        }?relay=${encodeURIComponent(relayUrl)}&secret=${connectionPrivateKey}`;
        return { connectionUrl, connectionPrivateKey, connectionPublicKey };
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
        connection: NWCConnection
    ): Promise<void> {
        if (!this.isServiceReady()) {
            runInAction(() => {
                this.error = true;
                this.errorMessage = localeString(
                    'stores.NostrWalletConnectStore.error.serviceNotReady'
                );
            });
            return;
        }
        try {
            await this.unsubscribeFromConnection(connection.id);
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

            if (connection.hasPermission('get_info')) {
                handler.getInfo = () =>
                    this.withGlobalHandler(connection.id, () =>
                        this.handleGetInfo(connection)
                    );
            }

            if (connection.hasPermission('get_balance')) {
                handler.getBalance = () =>
                    this.withGlobalHandler(connection.id, () =>
                        this.handleGetBalance(connection)
                    );
            }

            if (connection.hasPermission('pay_invoice')) {
                handler.payInvoice = (request: Nip47PayInvoiceRequest) =>
                    this.withGlobalHandler(connection.id, () =>
                        this.handlePayInvoice(connection, request)
                    );
            }

            if (connection.hasPermission('make_invoice')) {
                handler.makeInvoice = (request: Nip47MakeInvoiceRequest) =>
                    this.withGlobalHandler(connection.id, () =>
                        this.handleMakeInvoice(connection, request)
                    );
            }

            if (connection.hasPermission('lookup_invoice')) {
                handler.lookupInvoice = (request: Nip47LookupInvoiceRequest) =>
                    this.withGlobalHandler(connection.id, () =>
                        this.handleLookupInvoice(request)
                    );
            }

            if (connection.hasPermission('list_transactions')) {
                handler.listTransactions = (
                    request: Nip47ListTransactionsRequest
                ) =>
                    this.withGlobalHandler(connection.id, () =>
                        this.handleListTransactions(connection, request)
                    );
            }

            if (connection.hasPermission('pay_keysend')) {
                handler.payKeysend = (request: Nip47PayKeysendRequest) =>
                    this.withGlobalHandler(connection.id, () =>
                        this.handlePayKeysend(connection, request)
                    );
            }

            if (connection.hasPermission('sign_message')) {
                handler.signMessage = (request: Nip47SignMessageRequest) =>
                    this.withGlobalHandler(connection.id, () =>
                        this.handleSignMessage(request)
                    );
            }

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
        } catch (error: any) {
            console.error(
                `Failed to subscribe to connection ${connection.name}:`,
                error?.message || String(error)
            );
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
                    await this.subscribeToConnection(connection);
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
                    methods: connection.permissions || [],
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
            if (this.isCashuConfigured) {
                try {
                    const cashuInvoice = await this.cashuStore.createInvoice({
                        value: millisatsToSats(request.amount).toString(),
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
                    const invoice = this.cashuStore.invoices?.find(
                        (invoice) =>
                            invoice.getPaymentRequest ===
                            cashuInvoice.paymentRequest
                    );
                    if (invoice)
                        runInAction(() => {
                            connection.activity.push({
                                id: cashuInvoice.paymentRequest,
                                status: 'pending',
                                invoice: new CashuInvoice(invoice),
                                type: 'make_invoice',
                                payment_source: 'cashu'
                            });
                            this.findAndUpdateConnection(connection);
                        });
                    this.saveConnections();
                    this.showInvoiceCreatedNotification(
                        millisatsToSats(request.amount),
                        connection.name,
                        request.description
                    );
                    const result = NostrConnectUtils.createNip47Transaction({
                        type: 'incoming',
                        state: 'pending',
                        invoice: cashuInvoice.paymentRequest,
                        payment_hash: paymentHash || '',
                        amount: request.amount,
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
                    value: millisatsToSats(request.amount).toString(),
                    memo: request.description || '',
                    expirySeconds: String(
                        request.expiry || DEFAULT_INVOICE_EXPIRY_SECONDS
                    ),
                    noLsp: true
                }
            );

            if (
                !invoiceResult ||
                !invoiceResult.rHash ||
                this.invoicesStore.creatingInvoiceError
            ) {
                const errorMessage =
                    this.invoicesStore.error_msg ||
                    localeString(
                        'stores.NostrWalletConnectStore.error.failedToCreateInvoice'
                    );
                throw new Error(errorMessage);
            }
            const paymentRequest = this.invoicesStore.payment_request;
            if (!paymentRequest || typeof paymentRequest !== 'string') {
                const errorMessage = localeString(
                    'stores.NostrWalletConnectStore.error.failedToCreateInvoice'
                );
                throw new Error(errorMessage);
            }

            await this.invoicesStore.getInvoices();
            const invoice = this.invoicesStore.invoices.find(
                (invoice) =>
                    invoice.payment_hash === paymentHash ||
                    invoice.paymentRequest === paymentRequest
            );
            if (invoice)
                runInAction(() => {
                    connection.activity.push({
                        id: paymentRequest,
                        invoice: new Invoice(invoice),
                        status: 'pending',
                        type: 'make_invoice',
                        payment_source: 'lightning',
                        lastprocessAt: new Date(),
                        paymentHash,
                        expiresAt: new Date(expiryTime),
                        satAmount: millisatsToSats(request.amount)
                    });
                    this.findAndUpdateConnection(connection);
                });
            this.saveConnections();
            this.showInvoiceCreatedNotification(
                millisatsToSats(request.amount),
                connection.name,
                request.description
            );
            const rHash = invoiceResult.rHash || '';
            let paymentHash = rHash;
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
                if (!paymentHash) {
                    console.warn(
                        'handleMakeInvoice: Payment hash not found in invoice'
                    );
                }
            } catch (decodeError) {
                console.error(
                    'handleMakeInvoice: Failed to decode payment request',
                    decodeError
                );
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

            const result = NostrConnectUtils.createNip47Transaction({
                type: 'incoming',
                state: 'pending',
                invoice: paymentRequest,
                payment_hash: paymentHash,
                amount: request.amount,
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
            console.error('handleMakeInvoice error', {
                error: errorMessage,
                stack: (error as Error).stack,
                connection: connection.name,
                request
            });
            return this.handleError(errorMessage, ErrorCodes.INTERNAL_ERROR);
        }
    }

    private async handleLookupInvoice(
        request: Nip47LookupInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        try {
            if (this.isCashuConfigured) {
                const cashuInvoices = this.cashuStore.invoices || [];
                const matchingInvoice = cashuInvoices.find(async (inv) => {
                    const decodedInvoice =
                        await NostrConnectUtils.decodeInvoiceTags(
                            inv.getPaymentRequest
                        );
                    return (
                        inv.getPaymentRequest === request.invoice ||
                        decodedInvoice.paymentHash === request.payment_hash
                    );
                });
                if (
                    matchingInvoice &&
                    matchingInvoice instanceof CashuInvoice
                ) {
                    let isPaid = matchingInvoice.isPaid || false;
                    let amtSat = matchingInvoice.getAmount;

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
                        payment_hash: request.payment_hash!,
                        amount: satsToMillisats(amtSat || 0),
                        ...(isPaid && {
                            preimage:
                                matchingInvoice.getPaymentRequest ||
                                request.invoice ||
                                request.payment_hash
                        }),
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
                const rawInvoice = await BackendUtils.lookupInvoice({
                    r_hash: request.payment_hash!
                });
                const invoice = new Invoice(rawInvoice);
                const state = invoice.isPaid
                    ? 'settled'
                    : invoice.isExpired
                    ? 'failed'
                    : 'pending';
                const result = NostrConnectUtils.createNip47Transaction({
                    type: 'incoming',
                    state,
                    invoice: invoice.getPaymentRequest,
                    payment_hash: invoice.getRHash || request.payment_hash!,
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

    private async handlePayKeysend(
        connection: NWCConnection,
        request: Nip47PayKeysendRequest,
        skipNotification: boolean = false
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        try {
            const amountSats = millisatsToSats(request.amount);

            if (this.isCashuConfigured) {
                return this.handleError(
                    localeString(
                        'stores.NostrWalletConnectStore.error.keysendNotSupportedForCashu'
                    ),
                    ErrorCodes.NOT_IMPLEMENTED
                );
            }
            const budgetCheck = this.validateBudgetBeforePayment(
                connection,
                amountSats,
                ErrorCodes.SEND_KEYSEND_FAILED,
                localeString(
                    'stores.NostrWalletConnectStore.error.keysendFailed'
                )
            );
            if (!budgetCheck.success) {
                return { result: undefined, error: budgetCheck.error };
            }
            this.transactionsStore.reset();
            this.transactionsStore.sendPayment({
                pubkey: request.pubkey,
                amount: request.amount.toString()
            });

            await this.waitForPaymentCompletion();

            if (this.transactionsStore.payment_error) {
                return this.handleError(
                    this.transactionsStore.payment_error,
                    ErrorCodes.SEND_KEYSEND_FAILED
                );
            }

            if (
                this.transactionsStore.error &&
                this.transactionsStore.error_msg
            ) {
                return this.handleError(
                    this.transactionsStore.error_msg,
                    ErrorCodes.SEND_KEYSEND_FAILED
                );
            }

            const preimage = this.transactionsStore.payment_preimage;
            const payment_hash = this.transactionsStore.payment_hash;
            const fee = this.transactionsStore.payment_fee;

            if (!preimage || !payment_hash) {
                if (this.transactionsStore.loading) {
                    return this.handleError(
                        localeString('views.SendingLightning.paymentTimedOut'),
                        ErrorCodes.SEND_KEYSEND_FAILED
                    );
                }
                return this.handleError(
                    localeString(
                        'stores.NostrWalletConnectStore.error.keysendFailed'
                    ),
                    ErrorCodes.SEND_KEYSEND_FAILED
                );
            }
            await this.paymentsStore.getPayments();
            const payment = this.paymentsStore.payments.find(
                (payment) => payment.preimage === preimage
            );
            if (payment) {
                await this.finalizePayment({
                    id: payment_hash,
                    connection,
                    decoded: payment,
                    skipNotification,
                    payment_source: 'lightning',
                    type: 'pay_keysend'
                });
            }
            return {
                result: NostrConnectUtils.createNip47Transaction({
                    type: 'outgoing',
                    state: 'settled',
                    invoice: '',
                    payment_hash,
                    amount: request.amount,
                    description: localeString(
                        'stores.NostrWalletConnectStore.keysendPayment'
                    ),
                    preimage,
                    fees_paid: satsToMillisats(Number(fee) || 0),
                    expires_at:
                        dateTimeUtils.getCurrentTimestamp() +
                        DEFAULT_INVOICE_EXPIRY_SECONDS
                }),
                error: undefined
            };
        } catch (error: any) {
            return this.handleError(
                (error instanceof Error ? error.message : String(error)) ||
                    localeString(
                        'stores.NostrWalletConnectStore.error.keysendFailed'
                    ),
                ErrorCodes.SEND_KEYSEND_FAILED
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

                if (!wallet || !wallet.wallet) {
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
        const amountSats = await this.getInvoiceAmount(
            request.invoice,
            invoiceInfo
        );
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
        const lightningBalance = await this.balanceStore.getLightningBalance(
            true
        );
        const budgetCheck = this.validateBudgetBeforePayment(
            connection,
            amountSats,
            ErrorCodes.INSUFFICIENT_BALANCE
        );
        if (!budgetCheck.success) {
            return { result: undefined, error: budgetCheck.error };
        }
        const currentLightningBalance = lightningBalance?.lightningBalance || 0;
        if (currentLightningBalance < amountSats) {
            const errorMessage = localeString(
                'stores.NostrWalletConnectStore.error.lightningInsufficientBalance',
                {
                    amount: amountSats.toString(),
                    balance: currentLightningBalance.toString()
                }
            );
            return this.handleError(
                errorMessage,
                ErrorCodes.INSUFFICIENT_BALANCE
            );
        }
        this.transactionsStore.reset();
        this.transactionsStore.sendPayment({
            payment_request: request.invoice,
            fee_limit_sat: PAYMENT_FEE_LIMIT_SATS.toString(),
            timeout_seconds: PAYMENT_TIMEOUT_SECONDS.toString()
        });

        await this.waitForPaymentCompletion();

        const paymentError = this.checkPaymentErrors(
            ErrorCodes.FAILED_TO_PAY_INVOICE,
            localeString('views.SendingLightning.paymentTimedOut'),
            localeString(
                'stores.NostrWalletConnectStore.error.noPreimageReceived'
            )
        );

        if (paymentError) {
            const { paymentHash, paymentRequest } =
                await NostrConnectUtils.decodeInvoiceTags(request.invoice);
            if (paymentHash || paymentRequest)
                if (
                    !NostrConnectUtils.isIgnorableError(
                        paymentError.error?.message
                    )
                )
                    await this.recordFailedPayment(
                        paymentRequest || paymentHash,
                        connection,
                        'pay_invoice',
                        amountSats,
                        'lightning',
                        paymentError.error?.message || 'Payment failed',
                        request.invoice
                    );
            return paymentError;
        }
        const preimage = this.transactionsStore.payment_preimage;
        const fees_paid = this.transactionsStore.payment_fee;

        await this.paymentsStore.getPayments();
        const payment = this.paymentsStore.payments.find(
            (payment) => payment.getPaymentRequest === request.invoice
        );
        if (payment)
            await this.finalizePayment({
                id: request.invoice,
                type: 'pay_invoice',
                decoded: payment,
                payment_source: 'lightning',
                connection,
                skipNotification
            });

        return {
            result: {
                preimage: preimage || '',
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

        let amount = 0;
        if (invoice.getAmount && invoice.getAmount > 0) {
            amount = Math.floor(invoice.getAmount);
        } else if ((invoice as any).satoshis) {
            amount = Math.floor((invoice as any).satoshis);
        } else if ((invoice as any).millisatoshis) {
            amount = millisatsToSats(Number((invoice as any).millisatoshis));
        }
        if (!amount || amount <= 0) {
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
            const { paymentHash, paymentRequest } =
                await NostrConnectUtils.decodeInvoiceTags(request.invoice);
            if (paymentHash || paymentRequest)
                if (
                    !NostrConnectUtils.isIgnorableError(
                        this.cashuStore.paymentErrorMsg || ''
                    )
                )
                    await this.recordFailedPayment(
                        paymentRequest || paymentHash,
                        connection,
                        'pay_invoice',
                        amount,
                        'lightning',
                        this.cashuStore.paymentErrorMsg || 'Payment failed',
                        request.invoice
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
        const payment = this.cashuStore.payments?.find(
            (payment) => payment.getPaymentRequest === request.invoice
        );
        if (payment) {
            await this.finalizePayment({
                id: request.invoice,
                decoded: payment,
                type: 'pay_invoice',
                payment_source: 'cashu',
                skipNotification,
                connection
            });
        }
        return {
            result: {
                preimage:
                    cashuInvoice.getPreimage ||
                    cashuInvoice.getPaymentRequest ||
                    '',
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
        invoiceInfo: any
    ): Promise<number> {
        let backendAmount = Math.floor(Number(invoiceInfo.num_satoshis) || 0);
        if (backendAmount === 0 && invoiceInfo.satoshis !== undefined) {
            backendAmount = Math.floor(Number(invoiceInfo.satoshis) || 0);
        }
        if (backendAmount === 0 && invoiceInfo.millisatoshis !== undefined) {
            backendAmount = millisatsToSats(
                Number(invoiceInfo.millisatoshis) || 0
            );
        }
        if (backendAmount > 0) {
            return backendAmount;
        }
        const { amount } = await NostrConnectUtils.decodeInvoiceTags(invoice);
        if (amount > 0) {
            console.log(
                'NWC: Backend did not provide amount, using decoded invoice amount:',
                amount
            );
            return amount;
        }

        return backendAmount;
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
     * Processes payment completion: tracks spending, saves, and shows notification
     */
    private async finalizePayment({
        id,
        type,
        payment_source,
        decoded,
        connection,
        skipNotification = false
    }: {
        id: string;
        type: ConnectionActivityType;
        payment_source: ConnectionPaymentSourceType;
        decoded: Payment | CashuPayment | null;
        connection: NWCConnection;
        skipNotification?: boolean;
    }): Promise<void> {
        runInAction(() => {
            connection.trackSpending(Number(decoded?.getAmount));
            connection.activity.push({
                id,
                type,
                payment:
                    payment_source == 'cashu'
                        ? new CashuPayment(decoded)
                        : new Payment(decoded),
                status: 'success',
                payment_source
            });
            this.findAndUpdateConnection(connection);
        });
        await this.saveConnections();
        if (!skipNotification) {
            this.showPaymentSentNotification(
                Number(decoded?.getAmount),
                connection.name
            );
        }
    }

    private async recordFailedPayment(
        id: string,
        connection: NWCConnection,
        type: ConnectionActivityType,
        amountSats: number,
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
                status: 'failed',
                lastprocessAt: new Date(),
                payment_source,
                error: errorMessage,
                paymentHash
            };

            if (index !== -1) {
                connection.activity[index] = {
                    ...connection.activity[index],
                    ...record
                };
            } else {
                // ➕ add new element
                connection.activity.push(record);
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
                                    await this.subscribeToConnection(
                                        connection
                                    );
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
                    const response = await ReactNativeBlobUtil.config({
                        trusty: true
                    }).fetch(
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
        if (!events || !Array.isArray(events) || events.length === 0) {
            console.info('NWC: No pending events to process');
            return;
        }
        const payInvoiceEvents: Array<{
            eventStr: string;
            request: NWCRequest;
            connection: NWCConnection;
            eventId: string;
            amount: number;
        }> = [];
        const payKeysendEvents: Array<{
            request: NWCRequest;
            connection: NWCConnection;
            eventId: string;
        }> = [];
        const eventProcessingResults = await Promise.allSettled(
            events.map(async (eventStr) => {
                try {
                    const { request, connection, eventId } =
                        await this.retryWithBackoff(
                            async () =>
                                await this.validateAndParsePendingEvent(
                                    eventStr
                                ),
                            3
                        );
                    // Only process pay_invoice and pay_keysend methods
                    if (request.method === 'pay_invoice') {
                        const invoice = request.params?.invoice;

                        const { isExpired, amount } =
                            await NostrConnectUtils.decodeInvoiceTags(invoice);
                        console.log('isExpired', isExpired);

                        if (!isExpired) {
                            return {
                                type: 'pay_invoice',
                                eventStr,
                                request,
                                connection,
                                eventId,
                                amount
                            };
                        }
                    } else if (request.method === 'pay_keysend') {
                        return {
                            type: 'pay_keysend',
                            request,
                            connection,
                            eventId
                        };
                    }
                    return null;
                } catch (error) {
                    console.warn('NWC: PROCESS PENDING EVENTS ERROR', {
                        error,
                        eventStr
                    });
                    return null;
                }
            })
        );
        // Collect results
        for (const result of eventProcessingResults) {
            if (result.status === 'fulfilled' && result.value) {
                if (result.value.type === 'pay_invoice') {
                    payInvoiceEvents.push({
                        eventStr: result.value.eventStr || '',
                        request: result.value.request,
                        connection: result.value.connection,
                        eventId: result.value.eventId,
                        amount: result.value.amount || 0
                    });
                } else if (result.value.type === 'pay_keysend') {
                    payKeysendEvents.push({
                        request: result.value.request,
                        connection: result.value.connection,
                        eventId: result.value.eventId
                    });
                }
            }
        }

        await Promise.allSettled(
            payKeysendEvents.map(async (event) => {
                try {
                    const result = await this.handleEventRequest(
                        event.connection,
                        event.request,
                        event.eventId,
                        true // skipNotification for pending events
                    );
                    if (!result.success && result.errorMessage) {
                        console.warn(
                            'NWC: Failed to process pay_keysend event',
                            {
                                error: result.errorMessage,
                                eventId: event.eventId
                            }
                        );
                    }
                } catch (error) {
                    console.warn('NWC: Failed to process pay_keysend event', {
                        error,
                        eventId: event.eventId
                    });
                }
            })
        );
        // If there are pay_invoice events, show modal
        if (payInvoiceEvents.length > 0) {
            const totalAmount = payInvoiceEvents.reduce(
                (sum, event) => sum + event.amount,
                0
            );
            const pendingEventsData = payInvoiceEvents.map((event) => ({
                eventStr: event.eventStr,
                request: event.request,
                connection: event.connection,
                eventId: event.eventId,
                connectionName: event.connection.name,
                amount: event.amount,
                status: false,
                isProcessed: false
            }));
            this.savePendingPayments(pendingEventsData);
            if (!this.isInNWCPendingPaymentsView)
                this.modalStore.toggleNWCPendingPaymentsModal({
                    pendingEvents: pendingEventsData,
                    totalAmount
                });
        }
    }

    private async validateAndParsePendingEvent(eventStr: string): Promise<{
        request: NWCRequest;
        connection: NWCConnection;
        eventId: string;
    }> {
        let event: NostrEvent;
        try {
            event = JSON.parse(eventStr);
            if (
                event.kind !== 23194 ||
                !event.content ||
                !event.pubkey ||
                !event.id
            ) {
                console.warn('NWC: Invalid event format, skipping', {
                    event
                });
                throw new Error('Invalid event format');
            }
        } catch (error) {
            throw new Error('Failed to parse event');
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
            const decryptedContent = nip04.decrypt(
                privateKey,
                connection.pubkey,
                event.content
            );
            request = JSON.parse(decryptedContent);
        } catch (error) {
            console.error('NWC: Failed to decrypt or parse event content', {
                error,
                eventStr
            });
            throw error;
        }

        return { request, connection, eventId: event.id };
    }

    @action
    public async processPendingPaymentsEvents(
        pendingEvents: PendingPayment[]
    ): Promise<void> {
        let remainingEvents = [...pendingEvents];
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

        const processingResults = await Promise.allSettled(
            pendingEvents.map(async (event) => {
                try {
                    // Ensure we have a proper NWCConnection instance
                    // In case the connection was not restored properly
                    const connection = this.getConnection(event.connection.id);

                    if (!connection) {
                        return;
                    }

                    const result = await this.handleEventRequest(
                        connection,
                        event.request,
                        event.eventId,
                        true // skip single payment Notification for pending events
                    );
                    runInAction(async () => {
                        if (result.success) {
                            this.processedPendingPayInvoiceEventIds.push(
                                event.eventId
                            );
                            await this.updatePendingPayment({
                                ...event,
                                status: true,
                                isProcessed: true
                            });
                        } else {
                            this.failedPendingPayInvoiceEventIds.push(
                                event.eventId
                            );
                            if (result.errorMessage) {
                                let formattedError = result.errorMessage;
                                try {
                                    const parsed = JSON.parse(
                                        result.errorMessage
                                    );
                                    if (parsed.message) {
                                        formattedError = parsed.message;
                                    } else if (typeof parsed === 'string') {
                                        formattedError = parsed;
                                    }
                                } catch {
                                    formattedError = result.errorMessage;
                                }
                                await this.updatePendingPayment({
                                    ...event,
                                    status: false,
                                    isProcessed: true,
                                    errorMessage: formattedError
                                });
                                this.pendingPayInvoiceErrors.set(
                                    event.eventId,
                                    formattedError
                                );
                            }
                        }
                    });

                    return { event, result };
                } catch (error) {
                    console.warn('NWC: Failed to process pending pay invoice', {
                        error,
                        eventId: event.eventId
                    });
                    runInAction(async () => {
                        this.failedPendingPayInvoiceEventIds.push(
                            event.eventId
                        );
                        const message =
                            error instanceof Error
                                ? error.message
                                : String(error);
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
                        this.pendingPayInvoiceErrors.set(
                            event.eventId,
                            formattedError
                        );
                    });
                    return { event, result: { success: false } };
                }
            })
        );
        const successfulEventIds = new Set<string>();
        const successfulPayments: Array<{
            amount: number;
            connectionName: string;
        }> = [];
        for (const result of processingResults) {
            if (result.status === 'fulfilled') {
                if (result.value?.result?.success) {
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
        skipNotification: boolean = false
    ): Promise<{ success: boolean; errorMessage?: string }> {
        let response: any;
        try {
            switch (request.method) {
                case 'pay_invoice':
                    response = await this.handlePayInvoice(
                        connection,
                        request.params,
                        skipNotification
                    );
                    break;
                case 'pay_keysend':
                    response = await this.handlePayKeysend(
                        connection,
                        request.params,
                        skipNotification
                    );
                    break;
                default:
                    return { success: true };
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

        // Only publish if we have a response
        if (response) {
            await this.publishEventToClient(
                connection,
                request.method,
                response,
                eventId
            );
        }

        return {
            success: !hasError,
            errorMessage: hasError ? errorMessage : undefined
        };
    }
    // Publishing Events to Nostr client
    private async publishEventToClient(
        connection: NWCConnection,
        method: string,
        response: any,
        eventId?: string
    ): Promise<void> {
        const servicePrivateKey = this.walletServiceKeys!.privateKey;
        const servicePublicKey = this.walletServiceKeys!.publicKey;
        const content = nip04.encrypt(
            servicePrivateKey,
            connection.pubkey,
            JSON.stringify({
                result_type: method,
                ...(response?.error
                    ? { error: response.error }
                    : { result: response?.result })
            })
        );
        let tags = [];
        if (eventId) {
            tags.push(['e', eventId, 'encryption', 'nip04 nip44_v2']);
        }
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
            const response = await ReactNativeBlobUtil.config({
                trusty: true
            }).fetch(
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
