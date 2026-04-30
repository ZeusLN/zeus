// Ensure TextDecoder is available before any nostr-tools imports
if (typeof global !== 'undefined' && !global.TextDecoder) {
    const TextEncodingPolyfill = require('text-encoding');
    global.TextDecoder = TextEncodingPolyfill.TextDecoder;
    global.TextEncoder = TextEncodingPolyfill.TextEncoder;
}
import 'websocket-polyfill';
import { action, computed, observable, reaction, runInAction } from 'mobx';
import { nwc } from '@getalby/sdk';

export type Nip47SingleMethod = nwc.Nip47SingleMethod;
export type NWCWalletServiceRequestHandler = nwc.NWCWalletServiceRequestHandler;
export type NWCWalletServiceResponsePromise<T> =
    nwc.NWCWalletServiceResponsePromise<T>;
export type Nip47GetInfoResponse = nwc.Nip47GetInfoResponse;
export type Nip47GetBalanceResponse = nwc.Nip47GetBalanceResponse;
export type Nip47PayInvoiceRequest = nwc.Nip47PayInvoiceRequest;
export type Nip47PayResponse = nwc.Nip47PayResponse;
export type Nip47MakeInvoiceRequest = nwc.Nip47MakeInvoiceRequest;
export type Nip47LookupInvoiceRequest = nwc.Nip47LookupInvoiceRequest;
export type Nip47ListTransactionsRequest = nwc.Nip47ListTransactionsRequest;
export type Nip47ListTransactionsResponse = nwc.Nip47ListTransactionsResponse;
export type Nip47Transaction = nwc.Nip47Transaction;
export type Nip47SignMessageResponse = nwc.Nip47SignMessageResponse;
export type Nip47SignMessageRequest = nwc.Nip47SignMessageRequest;
export type Nip47NotificationType = nwc.Nip47NotificationType;

import { getPublicKey, generatePrivateKey } from 'nostr-tools';

import {
    Platform,
    NativeModules,
    DeviceEventEmitter,
    AppState,
    EmitterSubscription
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import NostrConnectUtils, {
    DEFAULT_INVOICE_EXPIRY_SECONDS,
    Nip47ErrorCode
} from '../utils/NostrConnectUtils';
import IOSAudioKeepAliveUtils from '../utils/IOSAudioKeepAliveUtils';
import { satsToMillisats, millisatsToSats } from '../utils/AmountUtils';
import { retry } from '../utils/SleepUtils';

import NWCConnection, {
    BudgetRenewalType,
    ConnectionActivity,
    ConnectionActivityType,
    ConnectionPaymentSourceType,
    ConnectionWarningType,
    NWCConnectionData,
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
export const NWC_CLIENT_KEYS = 'zeus-nwc-client-keys';
export const NWC_SERVICE_KEYS = 'zeus-nwc-service-keys';
export const NWC_CASHU_ENABLED = 'zeus-nwc-cashu-enabled';
export const NWC_PERSISTENT_SERVICE_ENABLED = 'persistentNWCServicesEnabled';

const MAX_RELAY_ATTEMPTS = 5;
const SUBSCRIPTION_DELAY_MS = 1000;
const SERVICE_START_DELAY_MS = 2000;
const PAYMENT_TIMEOUT_SECONDS = 120;
const PAYMENT_FEE_LIMIT_SATS = 1000;
const PAYMENT_PROCESSING_DELAY_MS = 100;
const SAVE_CONNECTIONS_DEBOUNCE_MS = 500;

export const DEFAULT_NOSTR_RELAYS = [
    'wss://relay.getalby.com/v1',
    'wss://relay.snort.social',
    'wss://relay.damus.io'
];

type AppStateSubscription = ReturnType<typeof AppState.addEventListener>;

interface ClientKeys {
    [pubkey: string]: string;
}

interface WalletServiceKeys {
    privateKey: string;
    publicKey: string;
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
    @observable public isInitialized: boolean = false;
    @observable private activeSubscriptions: Map<string, () => void> =
        new Map();
    @observable private publishedRelays: Set<string> = new Set();
    @observable public waitingForConnection = false;
    @observable public currentConnectionId?: string;
    @observable public connectionJustSucceeded = false;
    @observable private walletServiceKeys: WalletServiceKeys | null = null;
    @observable public cashuEnabled: boolean = false;
    @observable public persistentNWCServiceEnabled: boolean = false;
    @observable private lastConnectionAttempt: number = 0;
    @observable public maxBudgetLimit: number = 0; // Max wallet balance
    @observable public iosAudioKeepAliveActive: boolean = false;
    @observable public iosAudioKeepAliveUptime: number = 0;
    @observable public iosAudioKeepAliveDisconnects: number = 0;
    private iosAudioUptimeInterval: ReturnType<typeof setInterval> | null =
        null;
    private iosAudioInterruptedUnsub: (() => void) | null = null;
    private iosAudioInterruptionEndedUnsub: (() => void) | null = null;
    private iosAudioRouteChangedUnsub: (() => void) | null = null;
    private iosAudioStatusUpdateUnsub: (() => void) | null = null;
    private iosAudioSuspendedUnsub: (() => void) | null = null;
    private iosAudioAppStateListener: AppStateSubscription | null = null;
    private androidReconnectionListener: EmitterSubscription | null = null;
    private appStateListener: AppStateSubscription | null = null;
    private androidLogListener: EmitterSubscription | null = null;
    private _scheduledSave: ReturnType<typeof setTimeout> | null = null;

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
        if (this.isInitialized) {
            console.log('NWC: skipping initialization - already initialized');
            return;
        }
        await this.loadInitialSettings();
        const hasActiveConnections = this.activeConnections.length > 0;
        if (!hasActiveConnections) return;

        runInAction(() => {
            this.error = false;
            this.loading = true;
            this.loadingMsg = localeString(
                'stores.NostrWalletConnectStore.initializingService'
            );
        });
        try {
            await this.initializeNWCWalletServices();
            const started = await this.startService(hasActiveConnections);
            if (!started) {
                runInAction(() => {
                    this.isInitialized = false;
                    this.loading = false;
                    this.loadingMsg = undefined;
                });
                return;
            }
            await this.loadMaxBudget();
            await this.checkAndResetAllBudgets();
            if (Platform.OS === 'android') {
                this.setupAndroidReconnectionListener();
                this.setupAppStateMonitoring();
                this.setupAndroidLogListener();
            }
            if (Platform.OS === 'ios' && this.persistentNWCServiceEnabled) {
                // (iOS: AppState + silent audio session).
                this.setupIOSAppStateMonitoring();
            }
            runInAction(() => {
                this.loadingMsg = undefined;
                this.loading = false;
                this.isInitialized = true;
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
                this.isInitialized = false;
            });
        }
    };

    private async loadInitialSettings() {
        await Promise.all([
            this.loadWalletServiceKeys(),
            this.loadPersistentServiceSetting(),
            this.loadCashuSetting(),
            this.loadConnections()
        ]);
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
    private startService = async (hasActiveConnections = false) => {
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
            return true;
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

    // Skip full teardown while persistent background NWC is enabled (same flag on
    // iOS and Android).
    @action
    public reset = async () => {
        if (!this.persistentNWCServiceEnabled) {
            await this.flushScheduledSave();
            if (Platform.OS === 'ios') {
                this.teardownIOSAppStateMonitor();
                await this.stopIOSAudioKeepAlive();
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
            this.waitingForConnection = false;
            this.currentConnectionId = undefined;
            this.connectionJustSucceeded = false;
            this.lastConnectionAttempt = 0;
            this.cashuEnabled = false;
            this.nwcWalletServices.clear();
            this.publishedRelays.clear();
            this.isInitialized = false;
            await this.unsubscribeFromAllConnections();
        }
        runInAction(() => {
            this.loading = false;
            this.loadingMsg = undefined;
        });
    };

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
            const { connection: existingConnection } = this.getConnection({
                connectionName: params.name
            });
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
                        await this.publishWalletServiceInfoWithRetry(
                            nwcWalletService,
                            params.relayUrl
                        );
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
            const { connection, index } = this.getConnection({ connectionId });
            if (!connection) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.connectionNotFound'
                    )
                );
            }
            await this.deleteClientKeys(connection.pubkey);
            this.unsubscribeFromConnection(connectionId);
            runInAction(() => {
                this.connections.splice(index, 1);
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
            const { connection } = this.getConnection({ connectionId });
            if (!connection) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.connectionNotFound'
                    )
                );
            }
            const oldRelayUrl = connection.relayUrl;
            const newRelayUrl = updates.relayUrl;
            const relayUrlChanged = newRelayUrl && newRelayUrl !== oldRelayUrl;

            if (relayUrlChanged) {
                this.unsubscribeFromConnection(connectionId);
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
                this.findAndUpdateConnection(connection);
            });
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
                    const hasNodeContext =
                        Boolean(currentNodeId) && Boolean(currentImpl);

                    const filtered = hasNodeContext
                        ? connections.filter(
                              (c: NWCConnectionData) =>
                                  c.nodePubkey === currentNodeId &&
                                  c.implementation === currentImpl
                          )
                        : [];

                    this.connections = filtered.map(
                        (data: NWCConnectionData) => new NWCConnection(data)
                    );
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
    private cancelScheduledSave(): void {
        if (this._scheduledSave !== null) {
            clearTimeout(this._scheduledSave);
            this._scheduledSave = null;
        }
    }
    private scheduleSave(): void {
        this.cancelScheduledSave();
        this._scheduledSave = setTimeout(() => {
            this._scheduledSave = null;
            this.saveConnections().catch((err) =>
                console.error(
                    'NWC: scheduleSave → saveConnections failed:',
                    err
                )
            );
        }, SAVE_CONNECTIONS_DEBOUNCE_MS);
    }
    private async flushScheduledSave(): Promise<void> {
        if (this._scheduledSave === null) return;
        this.cancelScheduledSave();
        try {
            await this.saveConnections();
        } catch (err) {
            console.error('NWC: flushScheduledSave failed:', err);
        }
    }

    @action
    public saveConnections = async () => {
        this.cancelScheduledSave();
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

    public getConnection = ({
        connectionId,
        connectionName
    }: {
        connectionId?: string;
        connectionName?: string;
    }): { connection: NWCConnection | undefined; index: number } => {
        const { nodeInfo } = this.nodeInfoStore;
        const { implementation } = this.settingsStore;
        const currentNodeId = nodeInfo?.nodeId;
        const index = this.connections.findIndex((c) => {
            const matchesBase =
                c.nodePubkey === currentNodeId &&
                c.implementation === implementation;
            if (!matchesBase) return false;
            if (connectionId) return c.id === connectionId;
            if (connectionName) return c.name === connectionName;
            return false;
        });
        const connection = index !== -1 ? this.connections[index] : undefined;
        return { connection, index };
    };
    public getActivities = async (
        connectionId: string
    ): Promise<{ name: string; activity: ConnectionActivity[] }> => {
        const { connection } = this.getConnection({ connectionId });
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
        const cashuInvoices = this.cashuStore.invoices || [];
        const firstCashuPaidByPaymentRequest = new Map<string, boolean>();
        const paymentRequestFirstMatchNotCashu = new Set<string>();
        for (const inv of cashuInvoices) {
            const pr = inv.getPaymentRequest;
            if (
                firstCashuPaidByPaymentRequest.has(pr) ||
                paymentRequestFirstMatchNotCashu.has(pr)
            ) {
                continue;
            }
            if (inv instanceof CashuInvoice) {
                firstCashuPaidByPaymentRequest.set(pr, inv.isPaid);
            } else {
                paymentRequestFirstMatchNotCashu.add(pr);
            }
        }
        const pendingLightningInvoiceActivities: ConnectionActivity[] = [];

        for (const activity of connection.activity) {
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
                    const pr = activity.invoice.getPaymentRequest;
                    if (activity.payment_source === 'cashu') {
                        const invoiceAlreadyPaid =
                            !paymentRequestFirstMatchNotCashu.has(pr) &&
                            firstCashuPaidByPaymentRequest.get(pr) === true;
                        if (invoiceAlreadyPaid) {
                            runInAction(() => {
                                activity.status = 'success';
                            });
                        } else if (activity.invoice.isExpired) {
                            runInAction(() => {
                                activity.status = 'failed';
                            });
                        }
                    } else {
                        pendingLightningInvoiceActivities.push(activity);
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
        }

        if (pendingLightningInvoiceActivities.length > 0) {
            await Promise.all(
                pendingLightningInvoiceActivities.map(async (activity) => {
                    const invoice = activity.invoice as Invoice | undefined;
                    if (!invoice) return;

                    const applyPaidOrExpired = (backendSaysPaid: boolean) => {
                        const settled = backendSaysPaid || invoice.isPaid;
                        runInAction(() => {
                            if (settled) {
                                activity.status = 'success';
                            } else if (invoice.isExpired) {
                                activity.status = 'failed';
                            }
                        });
                    };

                    const isInvoicePaid =
                        await NostrConnectUtils.lookupInvoicePaidFromNode({
                            paymentRequest: invoice.getPaymentRequest,
                            rHash: invoice.getRHash
                        });
                    applyPaidOrExpired(isInvoicePaid);
                })
            );
        }
        runInAction(() => {
            connection.activity = connection.activity.filter((activity) => {
                const isInvalidFailure =
                    activity.status === 'failed' &&
                    NostrConnectUtils.isIgnorableError(activity.error || '');
                return !isInvalidFailure;
            });
        });
        this.scheduleSave();
        return { name: connection.name, activity: connection.activity };
    };
    @action
    private markConnectionUsed = async (connectionId: string) => {
        const { connection } = this.getConnection({ connectionId });
        if (!connection) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.connectionNotFound'
                )
            );
        }
        const wasNeverUsed = !connection.lastUsed;

        if (wasNeverUsed) {
            this.startWaitingForConnection(connectionId);
        }
        runInAction(() => {
            connection.lastUsed = new Date();
        });
        try {
            if (wasNeverUsed) {
                await this.saveConnections();
            } else {
                this.scheduleSave();
            }
        } catch (err) {
            console.error('NWC: markConnectionUsed save failed:', err);
        }

        if (
            this.waitingForConnection &&
            this.currentConnectionId === connectionId
        ) {
            this.stopWaitingForConnection();
        }
    };
    @action
    private findAndUpdateConnection(
        connection: NWCConnection,
        save: boolean = true
    ): void {
        const { index } = this.getConnection({ connectionId: connection.id });
        if (index !== -1) {
            this.connections[index] = connection;
        }
        if (save) {
            this.scheduleSave();
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
        const relayParam = /[&?#]/.test(relayUrl)
            ? encodeURIComponent(relayUrl)
            : relayUrl;
        const connectionUrl = `nostr+walletconnect://${this.walletServiceKeys.publicKey}?relay=${relayParam}&secret=${connectionPrivateKey}`;
        return { connectionUrl, connectionPrivateKey, connectionPublicKey };
    }
    @action
    public startWaitingForConnection = (connectionId: string) => {
        this.waitingForConnection = true;
        this.currentConnectionId = connectionId;
    };

    @action
    public stopWaitingForConnection = () => {
        this.connectionJustSucceeded = true;
        this.waitingForConnection = false;
        this.currentConnectionId = undefined;

        setTimeout(() => {
            runInAction(() => {
                this.connectionJustSucceeded = false;
            });
        }, 100);
    };
    @action
    public cancelWaitingForConnection = () => {
        this.waitingForConnection = false;
        this.currentConnectionId = undefined;
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
            this.unsubscribeFromConnection(connection.id);
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
                const payHandler = this.isCashuConfigured
                    ? this.handleCashuPayInvoice.bind(this, connection)
                    : this.handleLightningPayInvoice.bind(this, connection);
                handler.payInvoice = (request: Nip47PayInvoiceRequest) =>
                    this.withGlobalHandler(connection.id, () =>
                        payHandler(request)
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
            const unsubscribe = await retry({
                fn: async () => {
                    return await nwcWalletService.subscribe(keypair, handler);
                },
                maxRetries: MAX_RELAY_ATTEMPTS,
                exponentialBackoff: true
            });

            runInAction(() => {
                this.activeSubscriptions.set(connection.id, unsubscribe);
            });
        } catch (error: any) {
            console.error(
                `Failed to subscribe to connection ${connection.name}:`,
                error?.message || String(error)
            );
        }
    }

    private async subscribeToAllConnections(): Promise<void> {
        const connections = [...this.activeConnections];
        if (connections.length === 0) {
            console.log(
                'NWC: No active connections to subscribe to, skipping subscribeToAllConnections'
            );
            return;
        }
        for (let i = 0; i < connections.length; i++) {
            await this.subscribeToConnection(connections[i]);
            if (i < connections.length - 1) {
                await new Promise((resolve) =>
                    setTimeout(resolve, SUBSCRIPTION_DELAY_MS)
                );
            }
        }

        console.log(
            `NWC: Subscription results - ${connections.length} connection(s) processed (sequential pacing between relays)`
        );
    }
    private unsubscribeFromConnection(connectionId: string): void {
        const unsub = this.activeSubscriptions.get(connectionId);
        if (!unsub) return;
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
    }

    private async unsubscribeFromAllConnections(): Promise<void> {
        const connectionIds = Array.from(this.activeSubscriptions.keys());
        for (const connectionId of connectionIds) {
            this.unsubscribeFromConnection(connectionId);
        }
        runInAction(() => {
            this.activeSubscriptions.clear();
        });
    }

    private async publishWalletServiceInfoWithRetry(
        nwcWalletService: nwc.NWCWalletService,
        relayUrl: string
    ): Promise<void> {
        const privateKey = this.walletServiceKeys?.privateKey;
        if (!privateKey) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.walletServiceKeysNotInitialized'
                )
            );
        }
        await retry({
            fn: async () => {
                await nwcWalletService.publishWalletServiceInfoEvent(
                    privateKey,
                    NostrConnectUtils.getFullAccessPermissions(),
                    NostrConnectUtils.getNotifications()
                );
                runInAction(() => {
                    this.publishedRelays.add(relayUrl);
                });
            },
            exponentialBackoff: true
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
                await this.publishWalletServiceInfoWithRetry(
                    nwcWalletService,
                    relayUrl
                );
                successfulPublishes++;
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
            return NostrConnectUtils.createNip47Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToGetInfo'
                ),
                Nip47ErrorCode.INTERNAL_ERROR
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
            return NostrConnectUtils.createNip47Error(
                (error as Error).message,
                Nip47ErrorCode.INTERNAL_ERROR
            );
        }
    }

    private async pushMakeInvoiceActivityToConnection({
        connection,
        request,
        status,
        type,
        payment_source,
        paymentRequest,
        rHash
    }: {
        connection: NWCConnection;
        request: Nip47MakeInvoiceRequest;
        status: 'pending' | 'success' | 'failed';
        type: 'make_invoice' | 'pay_invoice';
        payment_source: 'cashu' | 'lightning';
        paymentRequest: string;
        rHash?: string;
    }): Promise<{ result: Nip47Transaction; error: undefined }> {
        let invoice: CashuInvoice | Invoice | undefined;

        if (payment_source === 'cashu') {
            invoice = this.cashuStore.invoices?.find(
                (inv: CashuInvoice) => inv.getPaymentRequest === paymentRequest
            );
        } else {
            invoice = this.invoicesStore.invoices?.find(
                (inv: Invoice) =>
                    inv.getRHash === rHash ||
                    inv.getPaymentRequest === paymentRequest
            );
        }

        const satAmount = millisatsToSats(
            request.amount || invoice?.getAmount || 0
        );
        const { paymentHash, descriptionHash, expiryTime } =
            await NostrConnectUtils.decodeInvoiceTagsForMakeInvoice(
                paymentRequest,
                rHash
            );
        runInAction(() => {
            connection.activity.push({
                id: invoice?.getPaymentRequest || paymentRequest,
                status,
                invoice,
                type,
                payment_source,
                paymentHash,
                satAmount,
                createdAt: new Date(),
                expiresAt: new Date(expiryTime * 1000)
            });
            this.findAndUpdateConnection(connection);
        });
        return NostrConnectUtils.buildMakeInvoiceSuccessPayload(
            connection.name,
            request,
            {
                paymentRequest: invoice?.getPaymentRequest || paymentRequest,
                paymentHash: rHash || paymentHash,
                descriptionHash,
                expiryTime
            }
        );
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

                    const result =
                        await this.pushMakeInvoiceActivityToConnection({
                            connection,
                            request,
                            status: 'pending',
                            type: 'make_invoice',
                            paymentRequest: cashuInvoice.paymentRequest,
                            payment_source: 'cashu'
                        });
                    return result;
                } catch (cashuError) {
                    return NostrConnectUtils.createNip47Error(
                        (cashuError as Error).message,
                        Nip47ErrorCode.FAILED_TO_CREATE_INVOICE
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

            const paymentRequest = this.invoicesStore.payment_request;

            const unifiedInvoiceCreationFailed =
                this.invoicesStore.creatingInvoiceError ||
                (!invoiceResult && !paymentRequest) ||
                !paymentRequest ||
                typeof paymentRequest !== 'string';

            if (unifiedInvoiceCreationFailed) {
                throw new Error(
                    this.invoicesStore.error_msg ||
                        localeString(
                            'stores.NostrWalletConnectStore.error.failedToCreateInvoice'
                        )
                );
            }

            const rHash = invoiceResult?.rHash || '';

            await this.invoicesStore.getInvoices();

            const result = await this.pushMakeInvoiceActivityToConnection({
                connection,
                request,
                status: 'pending',
                type: 'make_invoice',
                rHash,
                paymentRequest,
                payment_source: 'lightning'
            });
            return result;
        } catch (error) {
            const errorMessage =
                (error as Error).message ||
                String(error) ||
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToCreateInvoice'
                );
            return NostrConnectUtils.createNip47Error(
                errorMessage,
                Nip47ErrorCode.INTERNAL_ERROR
            );
        }
    }

    private async handleLookupInvoice(
        request: Nip47LookupInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        try {
            if (this.isCashuConfigured) {
                const result =
                    await NostrConnectUtils.buildNip47TransactionForCashuInvoiceLookup(
                        this.cashuStore.invoices || [],
                        request
                    );
                return { result, error: undefined };
            }
            if (!request.payment_hash) {
                return NostrConnectUtils.createNip47Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.invoiceNotFound'
                    ),
                    Nip47ErrorCode.NOT_FOUND
                );
            }
            const result =
                await NostrConnectUtils.buildNip47TransactionForLightningInvoiceLookup(
                    request.payment_hash
                );
            return { result, error: undefined };
        } catch (error) {
            return NostrConnectUtils.createNip47Error(
                (error as Error).message,
                Nip47ErrorCode.NOT_FOUND
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
                    .filter((tx) => tx.amount > 0)
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
            return NostrConnectUtils.createNip47Error(
                (error as Error).message,
                Nip47ErrorCode.INTERNAL_ERROR
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
                    return NostrConnectUtils.createNip47Error(
                        localeString(
                            'stores.NostrWalletConnectStore.error.cashuWalletNotInitialized'
                        ),
                        Nip47ErrorCode.INTERNAL_ERROR
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
            return NostrConnectUtils.createNip47Error(
                (error as Error).message,
                Nip47ErrorCode.INTERNAL_ERROR
            );
        }
    }

    // PAYMENT PROCESSING METHODS

    private async handleLightningPayInvoice(
        connection: NWCConnection,
        request: Nip47PayInvoiceRequest
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
                        code: Nip47ErrorCode.INVOICE_EXPIRED,
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
            Nip47ErrorCode.INSUFFICIENT_BALANCE
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
            return NostrConnectUtils.createNip47Error(
                errorMessage,
                Nip47ErrorCode.INSUFFICIENT_BALANCE
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
            Nip47ErrorCode.FAILED_TO_PAY_INVOICE,
            localeString('views.SendingLightning.paymentTimedOut'),
            localeString(
                'stores.NostrWalletConnectStore.error.noPreimageReceived'
            )
        );

        if (paymentError) {
            const { paymentRequest } =
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
                amountSats
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
        request: Nip47PayInvoiceRequest
    ) {
        const cashuStatus = this.cashuConfigurationStatus;
        if (!cashuStatus.isConfigured) {
            return NostrConnectUtils.createNip47Error(
                cashuStatus.errorMessage ||
                    localeString(
                        'stores.NostrWalletConnectStore.error.noCashuMintSelected'
                    ),
                Nip47ErrorCode.INTERNAL_ERROR
            );
        }

        await this.cashuStore.getPayReq(request.invoice);
        const invoice = this.cashuStore.payReq;
        const error = this.cashuStore.getPayReqError;
        if (error) {
            return NostrConnectUtils.createNip47Error(
                error,
                Nip47ErrorCode.INVALID_INVOICE
            );
        }
        if (!invoice) {
            return NostrConnectUtils.createNip47Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToDecodeInvoice'
                ),
                Nip47ErrorCode.INVALID_INVOICE
            );
        }
        if (invoice.isPaid) {
            return NostrConnectUtils.createNip47Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.invoiceAlreadyPaid'
                ),
                Nip47ErrorCode.INVALID_INVOICE
            );
        }
        if (invoice.isExpired) {
            return NostrConnectUtils.createNip47Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.invoiceExpired'
                ),
                Nip47ErrorCode.INVALID_INVOICE
            );
        }
        if (
            !invoice.getPaymentRequest ||
            invoice.getPaymentRequest.trim() === ''
        ) {
            return NostrConnectUtils.createNip47Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.invalidPaymentRequest'
                ),
                Nip47ErrorCode.INVALID_INVOICE
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
            return NostrConnectUtils.createNip47Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.invalidAmount'
                ),
                Nip47ErrorCode.INVALID_INVOICE
            );
        }
        const budgetCheck = this.validateBudgetBeforePayment(
            connection,
            amount,
            Nip47ErrorCode.INSUFFICIENT_BALANCE
        );
        if (!budgetCheck.success) {
            return { result: undefined, error: budgetCheck.error };
        }

        const currentBalance = this.cashuStore.totalBalanceSats || 0;
        if (currentBalance < amount) {
            return NostrConnectUtils.createNip47Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.cashuInsufficientBalance',
                    {
                        amount: amount.toString(),
                        balance: currentBalance.toString()
                    }
                ),
                Nip47ErrorCode.INSUFFICIENT_BALANCE
            );
        }

        const cashuInvoice = await this.cashuStore.payLnInvoiceFromEcash({
            amount: amount.toString()
        });
        if (!cashuInvoice || this.cashuStore.paymentError) {
            const { paymentRequest } =
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
                        'lightning',
                        this.cashuStore.paymentErrorMsg || 'Payment failed',
                        request.invoice
                    );
            return NostrConnectUtils.createNip47Error(
                this.cashuStore.paymentErrorMsg ||
                    localeString(
                        'stores.NostrWalletConnectStore.error.failedToPayInvoice'
                    ),
                Nip47ErrorCode.FAILED_TO_PAY_INVOICE
            );
        }

        if (cashuInvoice.isFailed) {
            return NostrConnectUtils.createNip47Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.cashuPaymentFailed'
                ),
                Nip47ErrorCode.FAILED_TO_PAY_INVOICE
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
                amountSats: amount,
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
            this.scheduleSave();
        }
    };
    @action
    public async clearWarnings(
        connectionId: string,
        warningType: ConnectionWarningType
    ): Promise<void> {
        const { connection } = this.getConnection({ connectionId });
        if (!connection) return;
        switch (warningType) {
            case ConnectionWarningType.WalletBalanceLowerThanBudget:
                runInAction(() => {
                    connection.checkAndResetBudgetIfNeeded(this.maxBudgetLimit);
                    connection.removeWarning(warningType);
                    this.findAndUpdateConnection(connection, false);
                });
                break;
            default:
                runInAction(() => {
                    connection.removeWarning(warningType);
                });
        }
        this.scheduleSave();
    }

    // HELPER METHODS

    private validateBudgetBeforePayment(
        connection: NWCConnection,
        amountSats: number,
        errorCode: Nip47ErrorCode = Nip47ErrorCode.INSUFFICIENT_BALANCE,
        fallbackErrorMessage?: string
    ):
        | { success: true }
        | { success: false; error: { code: string; message: string } } {
        const budgetValidation =
            connection.validateBudgetBeforePayment(amountSats);
        if (!budgetValidation.success) {
            return {
                success: false,
                error: NostrConnectUtils.createNip47Error(
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
        errorCode: Nip47ErrorCode,
        timeoutMessage?: string,
        noPreimageMessage?: string
    ): void | { result: undefined; error: { code: string; message: string } } {
        if (this.transactionsStore.payment_error) {
            return NostrConnectUtils.createNip47Error(
                this.transactionsStore.payment_error,
                errorCode
            );
        }

        if (this.transactionsStore.error && this.transactionsStore.error_msg) {
            return NostrConnectUtils.createNip47Error(
                this.transactionsStore.error_msg,
                errorCode
            );
        }
        if (this.transactionsStore.loading && timeoutMessage) {
            return NostrConnectUtils.createNip47Error(
                timeoutMessage,
                errorCode
            );
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
            return NostrConnectUtils.createNip47Error(
                noPreimageMessage,
                errorCode
            );
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
     * Resolves when `transactionsStore.loading` becomes false, or after the
     * payment timeout. Uses a MobX reaction instead of polling every 200ms.
     */
    private async waitForPaymentCompletion(): Promise<void> {
        const maxWaitTime = (PAYMENT_TIMEOUT_SECONDS + 5) * 1000;

        await new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                resolve();
            };

            let disposer: (() => void) | undefined;
            const timeoutId = setTimeout(() => {
                disposer?.();
                finish();
            }, maxWaitTime);

            disposer = reaction(
                () => this.transactionsStore.loading,
                (loading) => {
                    if (!loading) {
                        clearTimeout(timeoutId);
                        disposer?.();
                        finish();
                    }
                },
                { fireImmediately: true }
            );
        });

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
        amountSats
    }: {
        id: string;
        type: ConnectionActivityType;
        payment_source: ConnectionPaymentSourceType;
        decoded: Payment | CashuPayment | null;
        connection: NWCConnection;
        amountSats: number;
    }): Promise<void> {
        runInAction(() => {
            connection.trackSpending(amountSats);
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
        NostrConnectUtils.notifyOutgoingNwcPayment(amountSats, connection.name);
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
        const index = connection.activity.findIndex((conn) => conn.id === id);
        const activity = index !== -1 ? connection.activity[index] : undefined;
        if (activity?.status === 'success') return;
        runInAction(() => {
            const record: ConnectionActivity = {
                id,
                type,
                satAmount: amountSats,
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
                connection.activity.push(record);
            }

            this.findAndUpdateConnection(connection);
        });
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

    private async loadWalletServiceKeys(): Promise<void> {
        let keys: WalletServiceKeys;
        try {
            const storedKeys = await Storage.getItem(NWC_SERVICE_KEYS);
            if (!storedKeys) {
                keys = this.generateWalletServiceKeys();
                await this.saveWalletServiceKeys(keys);
            } else {
                const parsed = JSON.parse(storedKeys) as WalletServiceKeys;
                if (!parsed.privateKey || !parsed.publicKey) {
                    console.warn(
                        'NWC: Invalid wallet service keys found, regenerating'
                    );
                    keys = this.generateWalletServiceKeys();
                    await this.saveWalletServiceKeys(keys);
                } else {
                    keys = parsed;
                }
            }
        } catch (error) {
            console.error('Failed to load wallet service keys:', error);
            keys = this.generateWalletServiceKeys();
            await this.saveWalletServiceKeys(keys);
        }
        runInAction(() => {
            this.walletServiceKeys = keys;
        });
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

            if (!enabled) {
                if (Platform.OS === 'android') {
                    try {
                        const { NostrConnectModule } = NativeModules;
                        await NostrConnectModule.stopNostrConnectService();
                    } catch (serviceError) {
                        console.warn(
                            'NWC: Failed to stop background service:',
                            serviceError
                        );
                    }
                } else if (Platform.OS === 'ios') {
                    this.teardownIOSAppStateMonitor();
                    await this.stopIOSAudioKeepAlive();
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
        const currentNodeId = nodeInfo?.nodeId;
        return this.connections.filter(
            (c) =>
                c.isActive &&
                c.nodePubkey === currentNodeId &&
                c.implementation === implementation
        );
    }

    @computed
    public get expiredConnections(): NWCConnection[] {
        const { nodeInfo } = this.nodeInfoStore;
        const { implementation } = this.settingsStore;
        const currentNodeId = nodeInfo?.nodeId;
        return this.connections.filter(
            (c) =>
                c.isExpired &&
                c.nodePubkey === currentNodeId &&
                c.implementation === implementation
        );
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
                        void this.flushScheduledSave();
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
                                        await this.publishWalletServiceInfoWithRetry(
                                            nwcWalletService,
                                            relayUrl
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
                    await this.subscribeToAllConnections();
                }
                this.lastConnectionAttempt = now;
            }
        } catch (error) {
            console.warn('Android: Reconnection check error:', error);
        }
    }
    // ─── iOS audio keep-alive (AVAudioSession + silent loop) ─────────────────

    /**
     * iOS-only: registers AppState listener when `persistentNWCServiceEnabled`
     * is on (same setting as Android’s foreground service). Starts silent audio
     * in background and re-subscribes relays when returning to foreground.
     */
    private setupIOSAppStateMonitoring(): void {
        if (Platform.OS !== 'ios') return;
        if (!this.persistentNWCServiceEnabled) return;

        // Remove any stale listener before registering a new one
        this.teardownIOSAppStateMonitor();

        // If we're already in the background (rare edge case), start immediately
        if (AppState.currentState === 'background') {
            this.startIOSAudioKeepAlive();
        }

        let previousState: string = AppState.currentState;

        this.iosAudioAppStateListener = AppState.addEventListener(
            'change',
            async (nextState: string) => {
                if (!this.isServiceReady()) return;

                if (
                    nextState === 'background' &&
                    previousState !== 'background'
                ) {
                    void this.flushScheduledSave();
                    console.log(
                        '[NWCAudio] App entering background – starting keep-alive'
                    );
                    await this.startIOSAudioKeepAlive();
                } else if (
                    nextState === 'active' &&
                    previousState === 'background'
                ) {
                    // App returning to foreground — stop audio, re-subscribe relay
                    console.log(
                        '[NWCAudio] App returning to foreground – stopping keep-alive'
                    );
                    await this.stopIOSAudioKeepAlive();
                    if (this.isServiceReady()) {
                        await this.subscribeToAllConnections();
                    }
                }

                previousState = nextState;
            }
        );

        console.log('[NWCAudio] iOS AppState monitor registered');
    }

    private teardownIOSAppStateMonitor(): void {
        if (this.iosAudioAppStateListener) {
            this.iosAudioAppStateListener.remove();
            this.iosAudioAppStateListener = null;
        }
    }

    /**
     * Starts a silent AVAudioSession (.playback) backed by an AVAudioEngine
     * loop.  While active, iOS treats the app as a foreground-like audio
     * process and avoids suspending it, allowing the Nostr WebSocket relay
     * subscriptions to remain live in the background.
     */
    @action
    public async startIOSAudioKeepAlive(): Promise<boolean> {
        if (Platform.OS !== 'ios') return false;
        if (!IOSAudioKeepAliveUtils.isAvailable()) {
            console.warn('[NWCAudio] Module not available');
            return false;
        }

        const status = await IOSAudioKeepAliveUtils.start();
        if (!status?.isActive) {
            console.warn('[NWCAudio] Failed to activate audio session');
            return false;
        }

        runInAction(() => {
            this.iosAudioKeepAliveActive = true;
            this.iosAudioKeepAliveUptime = 0;
            this.iosAudioKeepAliveDisconnects = 0;
        });

        // Local uptime counter (JS side, updated every second)
        if (this.iosAudioUptimeInterval) {
            clearInterval(this.iosAudioUptimeInterval);
        }
        this.iosAudioUptimeInterval = setInterval(() => {
            runInAction(() => {
                this.iosAudioKeepAliveUptime += 1;
            });
        }, 1000);

        // Audio session interrupted (e.g. incoming phone call)
        this.iosAudioInterruptedUnsub = IOSAudioKeepAliveUtils.onInterrupted(
            (payload) => {
                console.warn(
                    `[NWCAudio] Interrupted – reason: ${payload.reason}, ` +
                        `disconnects: ${payload.disconnectCount}`
                );
                runInAction(() => {
                    this.iosAudioKeepAliveDisconnects = payload.disconnectCount;
                });
            }
        );

        // Interruption ended – re-subscribe to relay
        this.iosAudioInterruptionEndedUnsub =
            IOSAudioKeepAliveUtils.onInterruptionEnded(async (payload) => {
                console.log(
                    `[NWCAudio] Interruption ended – shouldResume: ${payload.shouldResume}`
                );
                if (payload.shouldResume && this.isServiceReady()) {
                    console.log('[NWCAudio] Re-subscribing to all connections');
                    await this.subscribeToAllConnections();
                }
            });

        // Audio route changed (headphones pulled, CarPlay, etc.)
        this.iosAudioRouteChangedUnsub = IOSAudioKeepAliveUtils.onRouteChanged(
            (payload) => {
                console.log(
                    `[NWCAudio] Route changed: ${payload.reason} → ${payload.currentOutput}`
                );
            }
        );

        // Periodic heartbeat from native layer
        this.iosAudioStatusUpdateUnsub = IOSAudioKeepAliveUtils.onStatusUpdate(
            (payload) => {
                console.log(
                    `[NWCAudio] Status – uptime: ${payload.uptimeSeconds.toFixed(
                        0
                    )}s, ` +
                        `bg: ${payload.backgroundDuration.toFixed(0)}s, ` +
                        `disconnects: ${payload.disconnectCount}, ` +
                        `output: ${payload.currentOutput}, ` +
                        `iOS: ${payload.iosVersion}`
                );
                runInAction(() => {
                    this.iosAudioKeepAliveDisconnects = payload.disconnectCount;
                });
            }
        );

        // Native layer suspects the app is being suspended
        this.iosAudioSuspendedUnsub = IOSAudioKeepAliveUtils.onSuspended(
            async (payload) => {
                console.warn(
                    `[NWCAudio] Suspected suspension – reason: ${payload.reason}, ` +
                        `uptime: ${payload.uptimeSeconds.toFixed(0)}s`
                );
                // Re-subscribe once we can – the next foreground transition
                // will also trigger initializeService via AppState change.
            }
        );

        console.log(
            '[NWCAudio] Keep-alive active – NWC relay will persist in background'
        );
        return true;
    }

    /**
     * Tears down the audio keep-alive session and removes all associated
     * event listeners.
     */
    @action
    public async stopIOSAudioKeepAlive(): Promise<void> {
        if (Platform.OS !== 'ios') return;
        if (!this.iosAudioKeepAliveActive) return;

        if (this.iosAudioUptimeInterval) {
            clearInterval(this.iosAudioUptimeInterval);
            this.iosAudioUptimeInterval = null;
        }

        // Remove all event listeners
        this.iosAudioInterruptedUnsub?.();
        this.iosAudioInterruptedUnsub = null;

        this.iosAudioInterruptionEndedUnsub?.();
        this.iosAudioInterruptionEndedUnsub = null;

        this.iosAudioRouteChangedUnsub?.();
        this.iosAudioRouteChangedUnsub = null;

        this.iosAudioStatusUpdateUnsub?.();
        this.iosAudioStatusUpdateUnsub = null;

        this.iosAudioSuspendedUnsub?.();
        this.iosAudioSuspendedUnsub = null;

        if (IOSAudioKeepAliveUtils.isAvailable()) {
            const finalStatus = await IOSAudioKeepAliveUtils.stop();
            console.log(
                `[NWCAudio] Session ended – total uptime: ` +
                    `${finalStatus?.uptimeSeconds.toFixed(0) ?? '?'}s, ` +
                    `disconnects: ${finalStatus?.disconnectCount ?? '?'}`
            );
        }

        runInAction(() => {
            this.iosAudioKeepAliveActive = false;
        });
    }

    @action private setError(message: string) {
        this.error = true;
        this.errorMessage = message;
    }
}
