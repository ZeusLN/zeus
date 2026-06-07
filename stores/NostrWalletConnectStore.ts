// Ensure TextDecoder is available before any nostr-tools imports
if (typeof global !== 'undefined' && !global.TextDecoder) {
    const TextEncodingPolyfill = require('text-encoding');
    global.TextDecoder = TextEncodingPolyfill.TextDecoder;
    global.TextEncoder = TextEncodingPolyfill.TextEncoder;
}
import { action, computed, observable, reaction, runInAction } from 'mobx';

import {
    NWCWalletService,
    NWCWalletServiceKeyPair,
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
    Nip47SingleMethod,
    NWCWalletServiceRequestHandler,
    NWCWalletServiceResponsePromise
} from '@getalby/sdk';

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
import Base64Utils from '../utils/Base64Utils';

import NWCConnection, {
    BudgetRenewalType,
    ConnectionActivity,
    ConnectionActivityStatus,
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
export const NWC_LUD16_ENABLED = 'zeus-nwc-lud16-enabled';

export const NWC_PERSISTENT_SERVICE_ENABLED = 'persistentNWCServicesEnabled';

const MAX_RELAY_ATTEMPTS = 5;
const SUBSCRIPTION_DELAY_MS = 1000;
const SERVICE_START_DELAY_MS = 2000;
const PAYMENT_TIMEOUT_SECONDS = 120;
const PAYMENT_FEE_LIMIT_SATS = 1000;
const PAYMENT_PROCESSING_DELAY_MS = 100;
const SAVE_CONNECTIONS_DEBOUNCE_MS = 500;
/** Min time a pay_invoice must stay pending before getActivities polls the node */
const PENDING_PAYMENT_STATUS_MIN_AGE_MS = 5_000;
/** Per-connection debounce for pending pay_invoice status refresh in getActivities */
const PENDING_PAYMENT_STATUS_REFRESH_MS = 30_000;

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
    createdAt?: Date;
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
    @observable private nwcWalletServices: Map<string, NWCWalletService> =
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
    @observable public lud16Enabled: boolean = true;
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
    private resetInFlight: Promise<void> | null = null;
    private lastPendingPaymentStatusFetchByConnection = new Map<
        string,
        number
    >();
    private lastPendingInvoiceStatusFetchByConnection = new Map<
        string,
        number
    >();

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

        // Node switch: `reset(true)` clears `isInitialized` synchronously and exposes
        // `resetInFlight` so `initializeService` waits for teardown before starting.
        reaction(
            () => this.settingsStore.connecting,
            (connecting) => {
                if (connecting) {
                    console.log('NWC: node switch - resetting service');
                    void this.reset(true);
                }
            }
        );
    }

    @action
    public initializeService = async () => {
        if (this.resetInFlight) {
            await this.resetInFlight;
        }
        if (this.isInitialized) {
            console.log('NWC: skipping initialization - already initialized');
            return;
        }
        await this.loadInitialSettings();
        const hasActiveConnections = this.activeConnections.length > 0;
        if (!hasActiveConnections) {
            console.log('NWC: no active connections - skipping initialization');
            return;
        }

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
            if (Platform.OS === 'ios') {
                // Auto-start background keep-alive whenever at least one connection exists.
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
            this.loadLud16Enabled(),
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
                    new NWCWalletService({
                        relayUrls: [relayUrl]
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

    // Skip full teardown when not forcing a node switch and NWC should stay
    // attached:
    //   iOS — at least one active connection (`inactive` runs before background;
    //   do not require `iosAudioKeepAliveActive`).
    //   Android — persistent foreground service enabled.
    @action
    public reset = async (forceReset = false) => {
        const skipTeardown =
            !forceReset &&
            ((Platform.OS === 'ios' && this.activeConnections.length > 0) ||
                (Platform.OS === 'android' &&
                    this.persistentNWCServiceEnabled));
        if (!skipTeardown) {
            this.isInitialized = false;
            const previousReset = this.resetInFlight;
            const teardown = (async () => {
                if (previousReset) {
                    await previousReset;
                }
                console.log('NWC: resetting service');
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
                await this.unsubscribeFromAllConnections();
            })();
            this.resetInFlight = teardown;
            try {
                await teardown;
            } finally {
                if (this.resetInFlight === teardown) {
                    this.resetInFlight = null;
                }
            }
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
            if (
                BackendUtils.supportsNodeInfo() &&
                !this.getCurrentWalletPubkey()
            ) {
                await this.nodeInfoStore.getNodeInfo();
            }
            const nodePubkey = this.getCurrentWalletPubkey();
            const { implementation } = this.settingsStore;
            if (!nodePubkey) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.walletIdentityUnavailable'
                    )
                );
            }

            if (!this.nwcWalletServices.has(params.relayUrl)) {
                this.nwcWalletServices.set(
                    params.relayUrl,
                    new NWCWalletService({
                        relayUrls: [params.relayUrl]
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

            let expiresAt = params.expiresAt;
            let customExpiryValue = params.customExpiryValue;
            let customExpiryUnit = params.customExpiryUnit;
            if (params.id && params.createdAt) {
                const refreshed = NostrConnectUtils.refreshExpiryForRegenerate({
                    expiresAt: params.expiresAt,
                    createdAt: params.createdAt,
                    customExpiryValue: params.customExpiryValue,
                    customExpiryUnit: params.customExpiryUnit
                });
                expiresAt = refreshed.expiresAt;
                customExpiryValue = refreshed.customExpiryValue;
                customExpiryUnit = refreshed.customExpiryUnit;
            }

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
                expiresAt,
                lastBudgetReset:
                    params.lastBudgetReset !== undefined
                        ? params.lastBudgetReset
                        : params.budgetAmount
                        ? new Date()
                        : undefined,
                customExpiryValue,
                customExpiryUnit,
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
            this.ensureIOSNWCBackgroundMonitoring();
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
     * @throws Error if the connection is not found, name is invalid or duplicate, or update fails.
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
            if (updates.name !== undefined) {
                const newName =
                    typeof updates.name === 'string' ? updates.name.trim() : '';
                if (!newName) {
                    throw new Error(
                        localeString(
                            'stores.NostrWalletConnectStore.error.connectionNameRequired'
                        )
                    );
                }
                const { connection: sameName } = this.getConnection({
                    connectionName: newName
                });
                if (sameName && sameName.id !== connectionId) {
                    throw new Error(
                        localeString(
                            'stores.NostrWalletConnectStore.error.connectionNameExists'
                        )
                    );
                }
                updates.name = newName;
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
    /** Stable node pubkey used to scope NWC connections to the active node/account. */
    private getCurrentWalletPubkey(): string {
        const nodeId = this.nodeInfoStore.nodeInfo?.nodeId;
        if (nodeId) return nodeId;

        const { implementation, lndhubUrl, username } = this.settingsStore;
        if (implementation === 'lndhub' && lndhubUrl && username) {
            return `lndhub:${lndhubUrl}:${username}`;
        }
        return '';
    }

    private connectionBelongsToCurrentWallet(
        connection: Pick<NWCConnectionData, 'nodePubkey' | 'implementation'>
    ): boolean {
        const currentNodePubkey = this.getCurrentWalletPubkey();
        if (!currentNodePubkey || !connection.nodePubkey) {
            return false;
        }
        return (
            connection.implementation === this.settingsStore.implementation &&
            connection.nodePubkey === currentNodePubkey
        );
    }

    private hasWalletContext(): boolean {
        return Boolean(
            this.settingsStore.implementation && this.getCurrentWalletPubkey()
        );
    }

    @action
    public loadConnections = async () => {
        try {
            const connectionsData = await Storage.getItem(NWC_CONNECTIONS_KEY);
            if (connectionsData) {
                const connections = JSON.parse(connectionsData);
                runInAction(() => {
                    const filtered = this.hasWalletContext()
                        ? connections.filter((c: NWCConnectionData) =>
                              this.connectionBelongsToCurrentWallet(c)
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
            const filteredExisting = allConnections.filter(
                (c: NWCConnectionData) =>
                    !this.connectionBelongsToCurrentWallet(c)
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
        const index = this.connections.findIndex((c) => {
            if (!this.connectionBelongsToCurrentWallet(c)) return false;
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
        const pendingCashuInvoiceActivities: ConnectionActivity[] = [];

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
                            const paidInvoice = cashuInvoices.find(
                                (inv) =>
                                    inv.getPaymentRequest === pr && inv.isPaid
                            );
                            runInAction(() => {
                                activity.status = 'success';
                                if (paidInvoice) {
                                    activity.invoice = paidInvoice;
                                }
                            });
                        } else if (activity.invoice.isExpired) {
                            runInAction(() => {
                                activity.status = 'expired';
                            });
                        } else {
                            pendingCashuInvoiceActivities.push(activity);
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
                                activity.status = 'expired';
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

        if (
            pendingCashuInvoiceActivities.length > 0 &&
            this.isCashuConfigured &&
            this.shouldRefreshPendingCashuInvoices(
                connectionId,
                pendingCashuInvoiceActivities
            )
        ) {
            await Promise.all(
                pendingCashuInvoiceActivities.map(async (activity) => {
                    const cashuInv = activity.invoice as
                        | CashuInvoice
                        | undefined;
                    const quote = cashuInv?.quote;
                    if (!quote || !cashuInv) return;

                    try {
                        const result = await this.cashuStore.checkInvoicePaid(
                            quote,
                            cashuInv.mintUrl,
                            undefined,
                            true
                        );
                        runInAction(() => {
                            if (result.isPaid) {
                                activity.status = 'success';
                                const updated =
                                    result.updatedInvoice ||
                                    this.cashuStore.invoices?.find(
                                        (inv) => inv.quote === quote
                                    );
                                if (updated) {
                                    activity.invoice = updated;
                                }
                                const paidSats = Math.floor(
                                    Number(result.amtSat) || 0
                                );
                                if (
                                    paidSats > 0 &&
                                    (!activity.satAmount ||
                                        activity.satAmount <= 0)
                                ) {
                                    activity.satAmount = paidSats;
                                }
                            } else if (cashuInv.isExpired) {
                                activity.status = 'expired';
                            }
                        });
                    } catch (err) {
                        console.error(
                            'NWC: failed to refresh cashu make_invoice status:',
                            err
                        );
                    }
                })
            );
            this.lastPendingInvoiceStatusFetchByConnection.set(
                connectionId,
                Date.now()
            );
        }

        const pendingPayInvoiceActivities = connection.activity.filter(
            (activity) =>
                activity.type === 'pay_invoice' && activity.status === 'pending'
        );
        if (pendingPayInvoiceActivities.length > 0) {
            const lightningPending = pendingPayInvoiceActivities.filter(
                (activity) => activity.payment_source !== 'cashu'
            );
            if (lightningPending.length > 0) {
                const payments =
                    await this.getPaymentsForPendingPayInvoiceRefresh(
                        connectionId,
                        lightningPending
                    );
                for (const activity of lightningPending) {
                    const payment = payments.find(
                        (p) =>
                            p.getPaymentRequest === activity.id ||
                            (!!activity.paymentHash &&
                                p.paymentHash === activity.paymentHash)
                    );
                    if (!payment) continue;

                    runInAction(() => {
                        activity.payment = new Payment(payment);
                        if (!payment.isIncomplete) {
                            activity.status = 'success';
                            const amountSats =
                                Math.floor(Number(activity.satAmount)) ||
                                Math.floor(Number(payment.getAmount) || 0);
                            if (amountSats > 0) {
                                connection.trackSpending(amountSats);
                            }
                        } else if (payment.isFailed) {
                            activity.status = 'failed';
                        }
                    });
                }
            }
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
    private getLightningAddress(): string | null {
        if (!this.settingsStore.settings.lightningAddress?.enabled) {
            return null;
        }
        const lud16 = this.lightningAddressStore.lightningAddress?.trim();
        if (!lud16) {
            return null;
        }
        return lud16;
    }

    private generateConnectionSecret(relayUrl: string) {
        if (!this.walletServiceKeys?.publicKey) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.walletServicePublicKeyNotAvailable'
                )
            );
        }
        const lud16 = this.lud16Enabled ? this.getLightningAddress() : null;
        return NostrConnectUtils.generateConnectionSecret(
            this.walletServiceKeys.publicKey,
            relayUrl,
            lud16
        );
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
            const keypair = new NWCWalletServiceKeyPair(
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
        nwcWalletService: NWCWalletService,
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
        status: ConnectionActivityStatus;
        type: ConnectionActivityType;
        payment_source: ConnectionPaymentSourceType;
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
            const rHash =
                request.payment_hash && request.payment_hash.includes('=')
                    ? Base64Utils.base64ToHex(request.payment_hash)
                    : request.payment_hash;
            if (!rHash) {
                return NostrConnectUtils.createNip47Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.invoiceNotFound'
                    ),
                    Nip47ErrorCode.NOT_FOUND
                );
            }
            const result =
                await NostrConnectUtils.buildNip47TransactionForLightningInvoiceLookup(
                    rHash
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
    ): NWCWalletServiceResponsePromise<Nip47PayResponse> {
        const invoiceInfo = await BackendUtils.decodePaymentRequest([
            request.invoice
        ]);
        const amountSats = await NostrConnectUtils.getPayInvoiceAmountSats({
            paymentRequest: request.invoice,
            lightningDecodedPayReq: invoiceInfo
        });

        if (invoiceInfo.expiry && invoiceInfo.timestamp) {
            const expiryTime =
                (Number(invoiceInfo.timestamp) + Number(invoiceInfo.expiry)) *
                1000;
            if (Date.now() > expiryTime) {
                return NostrConnectUtils.createNip47Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.invoiceExpired'
                    ),
                    Nip47ErrorCode.INVOICE_EXPIRED
                );
            }
        }

        const budgetCheck = this.validateBudgetBeforePayment(
            connection,
            amountSats,
            Nip47ErrorCode.INSUFFICIENT_BALANCE
        );
        if (!budgetCheck.success) {
            return { result: undefined, error: budgetCheck.error };
        }

        const lightningBalance = await this.balanceStore.getLightningBalance(
            true
        );
        const currentLightningBalance = lightningBalance?.lightningBalance || 0;
        if (currentLightningBalance < amountSats) {
            return NostrConnectUtils.createNip47Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.lightningInsufficientBalance',
                    {
                        amount: amountSats.toString(),
                        balance: currentLightningBalance.toString()
                    }
                ),
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

        const payments: Payment[] = await this.paymentsStore.getPayments();
        const paymentHash = this.transactionsStore.payment_hash;
        const inTransitResult =
            NostrConnectUtils.resolveLightningPaymentInTransit({
                invoice: request.invoice,
                payments,
                paymentHash,
                paymentState: this.getTransactionsStorePaymentState()
            });

        if (inTransitResult.inTransit) {
            await this.recordPendingPayment({
                rawInvoice: request.invoice,
                connection,
                amountSats,
                payment_source: 'lightning',
                payment: inTransitResult.payment,
                paymentHash: paymentHash || inTransitResult.payment?.paymentHash
            });

            const fees_paid =
                this.transactionsStore.payment_fee ||
                inTransitResult.payment?.getFee ||
                0;

            // NIP-47 requires preimage; empty string means HTLC is out but not settled (hodl/in-flight).
            return {
                result: {
                    preimage: '',
                    fees_paid: satsToMillisats(Number(fees_paid) || 0)
                },
                error: undefined
            };
        }

        const paymentError = this.checkPaymentErrors(
            Nip47ErrorCode.FAILED_TO_PAY_INVOICE,
            localeString('views.SendingLightning.paymentTimedOut'),
            localeString(
                'stores.NostrWalletConnectStore.error.noPreimageReceived'
            )
        );
        if (
            paymentError &&
            paymentError.error &&
            paymentError.error.code === Nip47ErrorCode.FAILED_TO_PAY_INVOICE
        ) {
            await this.recordFailedPayment({
                rawInvoice: request.invoice,
                connection,
                amountSats,
                payment_source: 'lightning',
                errorMessage: paymentError.error?.message
            });
            return paymentError;
        }

        const preimage = this.transactionsStore.payment_preimage;
        const fees_paid = this.transactionsStore.payment_fee;

        const payment =
            inTransitResult.payment ||
            NostrConnectUtils.findPaymentForInvoice(
                request.invoice,
                payments,
                paymentHash
            );

        if (payment) {
            await this.finalizePayment({
                id: request.invoice,
                type: 'pay_invoice',
                decoded: payment,
                payment_source: 'lightning',
                connection,
                amountSats
            });
        }

        return {
            result: {
                preimage: preimage || payment?.getPreimage || '',
                fees_paid: satsToMillisats(
                    Number(fees_paid) || Number(payment?.getFee) || 0
                )
            },
            error: undefined
        };
    }

    private async handleCashuPayInvoice(
        connection: NWCConnection,
        request: Nip47PayInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47PayResponse> {
        if (!this.isCashuConfigured) {
            const selectedMintUrl = this.cashuStore.selectedMintUrl;
            const errorMessage = !selectedMintUrl
                ? localeString(
                      'stores.NostrWalletConnectStore.error.noCashuMintSelected'
                  )
                : localeString(
                      'stores.NostrWalletConnectStore.error.cashuMintNotConfigured',
                      { mintUrl: selectedMintUrl }
                  );
            return NostrConnectUtils.createNip47Error(
                errorMessage,
                Nip47ErrorCode.INTERNAL_ERROR
            );
        }

        await this.cashuStore.getPayReq(request.invoice);
        const invoice = this.cashuStore.payReq;
        const decodeError = this.cashuStore.getPayReqError;

        if (decodeError) {
            return NostrConnectUtils.createNip47Error(
                decodeError,
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
        if (!invoice.getPaymentRequest?.trim()) {
            return NostrConnectUtils.createNip47Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.invalidPaymentRequest'
                ),
                Nip47ErrorCode.INVALID_INVOICE
            );
        }

        const amountSats = await NostrConnectUtils.getPayInvoiceAmountSats({
            paymentRequest: request.invoice,
            decodedInvoice: invoice
        });

        if (amountSats <= 0) {
            return NostrConnectUtils.createNip47Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.invalidAmount'
                ),
                Nip47ErrorCode.INVALID_INVOICE
            );
        }

        const budgetCheck = this.validateBudgetBeforePayment(
            connection,
            amountSats,
            Nip47ErrorCode.INSUFFICIENT_BALANCE
        );
        if (!budgetCheck.success) {
            return { result: undefined, error: budgetCheck.error };
        }

        const currentBalance = this.cashuStore.totalBalanceSats || 0;
        if (currentBalance < amountSats) {
            return NostrConnectUtils.createNip47Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.cashuInsufficientBalance',
                    {
                        amount: amountSats.toString(),
                        balance: currentBalance.toString()
                    }
                ),
                Nip47ErrorCode.INSUFFICIENT_BALANCE
            );
        }

        const cashuInvoice = await this.cashuStore.payLnInvoiceFromEcash({
            amount: amountSats.toString()
        });

        if (
            !cashuInvoice ||
            cashuInvoice.isFailed ||
            this.cashuStore.paymentError
        ) {
            const paymentErrorMsg =
                this.cashuStore.paymentErrorMsg ||
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToPayInvoice'
                );
            await this.recordFailedPayment({
                rawInvoice: request.invoice,
                connection,
                amountSats,
                payment_source: 'cashu',
                errorMessage: paymentErrorMsg
            });
            return NostrConnectUtils.createNip47Error(
                paymentErrorMsg,
                Nip47ErrorCode.FAILED_TO_PAY_INVOICE
            );
        }

        const payment = this.cashuStore.payments?.find(
            (p) => p.getPaymentRequest === request.invoice
        );

        // CashuStore does not surface IN_FLIGHT melts yet; add recordPendingPayment
        // plus getActivities cashu reconciliation when it does.
        if (payment) {
            await this.finalizePayment({
                id: request.invoice,
                decoded: payment,
                type: 'pay_invoice',
                payment_source: 'cashu',
                amountSats,
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

    /**
     * Gates Cashu make_invoice status polling in getActivities (mint round-trip)
     * using the same min-age and per-connection debounce as pay_invoice refresh.
     */
    private shouldRefreshPendingCashuInvoices(
        connectionId: string,
        pendingCashuInvoices: ConnectionActivity[]
    ): boolean {
        const now = Date.now();
        const oldestPendingMs = Math.max(
            0,
            ...pendingCashuInvoices.map(
                (activity) => now - (activity.createdAt?.getTime() ?? now)
            )
        );

        if (oldestPendingMs < PENDING_PAYMENT_STATUS_MIN_AGE_MS) {
            return false;
        }

        const lastFetch =
            this.lastPendingInvoiceStatusFetchByConnection.get(connectionId) ??
            0;
        if (now - lastFetch < PENDING_PAYMENT_STATUS_REFRESH_MS) {
            return false;
        }

        return true;
    }

    private async getPaymentsForPendingPayInvoiceRefresh(
        connectionId: string,
        lightningPending: ConnectionActivity[]
    ): Promise<Payment[]> {
        const cached = this.paymentsStore.payments || [];
        const now = Date.now();
        const oldestPendingMs = Math.max(
            0,
            ...lightningPending.map(
                (activity) => now - (activity.createdAt?.getTime() ?? now)
            )
        );

        if (oldestPendingMs < PENDING_PAYMENT_STATUS_MIN_AGE_MS) {
            return cached;
        }

        const lastFetch =
            this.lastPendingPaymentStatusFetchByConnection.get(connectionId) ??
            0;
        if (now - lastFetch < PENDING_PAYMENT_STATUS_REFRESH_MS) {
            return cached;
        }

        await this.paymentsStore.getPayments();
        this.lastPendingPaymentStatusFetchByConnection.set(connectionId, now);
        return this.paymentsStore.payments || [];
    }

    private getTransactionsStorePaymentState() {
        return {
            status: this.transactionsStore.status,
            isIncomplete: this.transactionsStore.isIncomplete,
            error: this.transactionsStore.error,
            payment_error: this.transactionsStore.payment_error,
            loading: this.transactionsStore.loading
        };
    }

    private checkPaymentErrors(
        errorCode: Nip47ErrorCode,
        timeoutMessage?: string,
        noPreimageMessage?: string
    ): void | { result: undefined; error: { code: string; message: string } } {
        if (
            NostrConnectUtils.isTransactionsStorePaymentInTransit(
                this.getTransactionsStorePaymentState()
            )
        ) {
            return undefined;
        }

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
        const hasInFlightStatus = NostrConnectUtils.isInFlightPaymentStatus(
            this.transactionsStore.status
        );

        const canAssumeSuccess =
            paymentCompleted &&
            (hasPaymentHash || hasSuccessStatus || hasInFlightStatus);

        if (!preimage && noPreimageMessage && !canAssumeSuccess) {
            return NostrConnectUtils.createNip47Error(
                noPreimageMessage,
                errorCode
            );
        }
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

    private async recordPendingPayment({
        rawInvoice,
        connection,
        amountSats,
        payment_source,
        payment,
        paymentHash: passedPaymentHash
    }: {
        rawInvoice: string;
        connection: NWCConnection;
        amountSats: number;
        payment_source: ConnectionPaymentSourceType;
        payment?: Payment | CashuPayment | null;
        paymentHash?: string;
    }): Promise<void> {
        const { paymentRequest, paymentHash: decodedPaymentHash } =
            await NostrConnectUtils.decodeInvoiceTags(rawInvoice);
        const id = paymentRequest || rawInvoice;
        const index = connection.activity.findIndex(
            (activity) => activity.id === id
        );
        const activity = index !== -1 ? connection.activity[index] : undefined;
        if (activity?.status === 'success') return;

        const paymentHash =
            passedPaymentHash ||
            decodedPaymentHash ||
            payment?.paymentHash ||
            undefined;

        runInAction(() => {
            const record: ConnectionActivity = {
                id,
                type: 'pay_invoice',
                satAmount: amountSats,
                status: 'pending',
                payment_source,
                createdAt: new Date(),
                ...(paymentHash ? { paymentHash } : {})
            };

            if (payment) {
                record.payment =
                    payment_source === 'cashu'
                        ? new CashuPayment(payment)
                        : new Payment(payment);
            }

            if (index !== -1) {
                connection.activity[index] = {
                    ...connection.activity[index],
                    ...record
                };
            } else {
                connection.activity.push(record);
            }

            this.findAndUpdateConnection(connection);
        });
    }

    private async recordFailedPayment({
        rawInvoice,
        connection,
        amountSats,
        payment_source,
        errorMessage = localeString('error.paymentFailed'),
        paymentHash: passedPaymentHash
    }: {
        rawInvoice: string;
        connection: NWCConnection;
        amountSats: number;
        payment_source: ConnectionPaymentSourceType;
        errorMessage?: string;
        paymentHash?: string;
    }): Promise<void> {
        if (NostrConnectUtils.isIgnorableError(errorMessage || '')) return;
        const { paymentRequest, paymentHash: decodedPaymentHash } =
            await NostrConnectUtils.decodeInvoiceTags(rawInvoice);
        const id = paymentRequest || rawInvoice;
        const index = connection.activity.findIndex(
            (activity) => activity.id === id
        );
        const activity = index !== -1 ? connection.activity[index] : undefined;
        if (activity?.status === 'success') return;

        const paymentHash =
            passedPaymentHash || decodedPaymentHash || undefined;

        runInAction(() => {
            const record: ConnectionActivity = {
                id,
                type: 'pay_invoice',
                satAmount: amountSats,
                status: 'failed',
                payment_source,
                error: errorMessage,
                createdAt: new Date(),
                ...(paymentHash ? { paymentHash } : {})
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
        NostrConnectUtils.notifyOutgoingNwcPaymentFailed(
            amountSats,
            connection.name,
            connection.id,
            id
        );
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
                    'stores.NostrWalletConnectStore.error.failedToSaveNwcSetting'
                )
            );
        }
    }
    public async loadLud16Enabled(): Promise<void> {
        try {
            const stored = await Storage.getItem(NWC_LUD16_ENABLED);
            runInAction(() => {
                this.lud16Enabled = stored !== 'false';
            });
        } catch (error) {
            runInAction(() => {
                this.lud16Enabled = true;
            });
        }
    }
    @action
    public async setLud16Enabled(enabled: boolean): Promise<void> {
        try {
            await Storage.setItem(NWC_LUD16_ENABLED, enabled.toString());
            runInAction(() => {
                this.lud16Enabled = enabled;
            });
        } catch (error) {
            throw new Error(
                localeString(
                    'stores.NostrWalletConnectStore.error.failedToSaveNwcSetting'
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
                    'stores.NostrWalletConnectStore.error.failedToSaveNwcSetting'
                )
            );
        }
    }

    @computed
    get isCashuConfigured(): boolean {
        return this.cashuEnabled && this.cashuStore.isProperlyConfigured();
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
        return this.connections.filter(
            (c) => c.isActive && this.connectionBelongsToCurrentWallet(c)
        );
    }

    @computed
    public get expiredConnections(): NWCConnection[] {
        return this.connections.filter(
            (c) => c.isExpired && this.connectionBelongsToCurrentWallet(c)
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
    private setupIOSAppStateMonitoring(): void {
        if (Platform.OS !== 'ios') return;
        // Remove any stale listener before registering a new one
        this.teardownIOSAppStateMonitor();

        // If we're already in the background (rare edge case), start immediately
        if (AppState.currentState === 'background') {
            this.startIOSAudioKeepAlive();
        } else {
            IOSAudioKeepAliveUtils.arm();
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
                    this.iosAudioKeepAliveActive
                ) {
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
        IOSAudioKeepAliveUtils.disarm();
    }

    private ensureIOSNWCBackgroundMonitoring(): void {
        if (Platform.OS !== 'ios') return;
        if (this.activeConnections.length === 0) return;
        if (!this.isServiceReady()) return;
        this.setupIOSAppStateMonitoring();
    }
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
