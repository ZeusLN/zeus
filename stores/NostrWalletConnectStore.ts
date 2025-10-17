// Ensure TextDecoder is available before any nostr-tools imports
if (typeof global !== 'undefined' && !global.TextDecoder) {
    const TextEncodingPolyfill = require('text-encoding');
    global.TextDecoder = TextEncodingPolyfill.TextDecoder;
    global.TextEncoder = TextEncodingPolyfill.TextEncoder;
}
import 'websocket-polyfill';
import { action, computed, observable, runInAction } from 'mobx';
import { nwc } from '@getalby/sdk';
import {
    getPublicKey,
    generatePrivateKey,
    relayInit,
    getEventHash,
    getSignature,
    UnsignedEvent
} from 'nostr-tools';
import * as nip04 from '@nostr/tools/nip04';
import { Platform, NativeModules } from 'react-native';
import { Notifications } from 'react-native-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import { localeString } from '../utils/LocaleUtils';
import NostrConnectUtils from '../utils/NostrConnectUtils';

import NWCConnection, { BudgetRenewalType } from '../models/NWCConnection';
import Transaction from '../models/Transaction';
import Invoice from '../models/Invoice';

import Storage from '../storage';

import SettingsStore from './SettingsStore';
import BalanceStore from './BalanceStore';
import NodeInfoStore from './NodeInfoStore';
import TransactionsStore from './TransactionsStore';
import CashuStore from './CashuStore';
import InvoicesStore from './InvoicesStore';
import MessageSignStore from './MessageSignStore';
import LightningAddressStore from './LightningAddressStore';

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

import bolt11 from 'bolt11';

export const NWC_CONNECTIONS_KEY = 'zeus-nwc-connections';
export const NWC_CLIENT_KEYS = 'zeus-nwc-client-keys';
export const NWC_SERVICE_KEYS = 'zeus-nwc-service-keys';
export const NWC_CASHU_ENABLED = 'zeus-nwc-cashu-enabled';
export const NWC_PERSISTENT_SERVICE_ENABLED = 'persistentNWCServicesEnabled';
export const NWC_IOS_EVENTS_LISTENER_SERVER_URL =
    'http://localhost:8080/api/v1';

const RATE_LIMIT_MS = 500;
const HEALTH_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const CONNECTION_RETRY_INTERVAL_MS = 60000;
const MAX_RELAY_ATTEMPTS = 5;
const FETCH_TIMEOUT_MS = 10000;
const SUBSCRIPTION_DELAY_MS = 1000;
const SERVICE_START_DELAY_MS = 2000;
const MILLISATS_PER_SAT = 1000;
const DEFAULT_INVOICE_EXPIRY_SECONDS = 3600;
const PAYMENT_TIMEOUT_SECONDS = 120;
const PAYMENT_FEE_LIMIT_SATS = 1000;
const PAYMENT_PROCESSING_DELAY_MS = 100;

export const DEFAULT_NOSTR_RELAYS = [
    // 'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.getalby.com/v1',
    'wss://relay.damus.io'
];

enum ErrorCodes {
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    RATE_LIMITED = 'RATE_LIMITED',
    QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
    INVALID_INVOICE = 'INVALID_INVOICE',
    FAILED_TO_PAY_INVOICE = 'FAILED_TO_PAY_INVOICE',
    FAILED_TO_CREATE_INVOICE = 'FAILED_TO_CREATE_INVOICE',
    NOT_FOUND = 'NOT_FOUND',
    NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
    SEND_KEYSEND_FAILED = 'SEND_KEYSEND_FAILED',
    INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE'
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

export interface CreateConnectionParams {
    name: string;
    relayUrl: string;
    permissions?: Nip47SingleMethod[];
    budgetAmount?: number;
    budgetRenewal?: BudgetRenewalType;
    expiresAt?: Date;
}

export default class NostrWalletConnectStore {
    @observable public loading = false;
    @observable public error = false;
    @observable public errorMessage = '';
    @observable public connections: NWCConnection[] = [];
    @observable private nwcWalletServices: Map<string, nwc.NWCWalletService> =
        new Map();
    @observable private activeSubscriptions: Map<string, () => void> =
        new Map();
    @observable private publishedRelays: Set<string> = new Set();
    @observable public initializing = false;
    @observable public loadingMsg?: string;
    @observable public waitingForConnection = false;
    @observable public currentConnectionId?: string;
    @observable public connectionJustSucceeded = false;
    @observable public relayConnectionAttempts: number = 0;
    @observable public relayConnected: boolean = false;
    @observable private walletServiceKeys: WalletServiceKeys | null = null;
    @observable public cashuEnabled: boolean = false;
    @observable public persistentNWCServiceEnabled: boolean = false;
    @observable private healthCheckInterval: any = null;
    @observable private connectionRetryInterval: any = null;
    @observable private lastConnectionAttempt: number = 0;
    @observable private lastCallTimes: Map<string, number> = new Map();

    settingsStore: SettingsStore;
    balanceStore: BalanceStore;
    nodeInfoStore: NodeInfoStore;
    transactionsStore: TransactionsStore;
    cashuStore: CashuStore;
    invoicesStore: InvoicesStore;
    messageSignStore: MessageSignStore;
    lightningAddressStore: LightningAddressStore;

    constructor(
        settingsStore: SettingsStore,
        balanceStore: BalanceStore,
        nodeInfoStore: NodeInfoStore,
        transactionsStore: TransactionsStore,
        cashuStore: CashuStore,
        invoicesStore: InvoicesStore,
        messageSignStore: MessageSignStore,
        lightningAddressStore: LightningAddressStore
    ) {
        this.settingsStore = settingsStore;
        this.balanceStore = balanceStore;
        this.nodeInfoStore = nodeInfoStore;
        this.transactionsStore = transactionsStore;
        this.cashuStore = cashuStore;
        this.invoicesStore = invoicesStore;
        this.messageSignStore = messageSignStore;
        this.lightningAddressStore = lightningAddressStore;
    }
    @action
    public reset = () => {
        // iOS: Always reset
        // Android: Only reset if persistentNWCServicesEnabled is false
        if (
            Platform.OS === 'ios' ||
            (Platform.OS === 'android' && !this.persistentNWCServiceEnabled)
        ) {
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }
            if (this.connectionRetryInterval) {
                clearInterval(this.connectionRetryInterval);
                this.connectionRetryInterval = null;
            }
            this.connections = [];
            this.error = false;
            this.walletServiceKeys = null;
            this.errorMessage = '';
            this.loading = false;
            this.initializing = false;
            this.loadingMsg = undefined;
            this.waitingForConnection = false;
            this.currentConnectionId = undefined;
            this.connectionJustSucceeded = false;
            this.relayConnected = false;
            this.relayConnectionAttempts = 0;
            this.lastConnectionAttempt = 0;
            this.cashuEnabled = false;
            this.persistentNWCServiceEnabled = false;
            this.activeSubscriptions.clear();
            this.nwcWalletServices.clear();
            this.lastCallTimes.clear();
            this.publishedRelays.clear();
            this.unsubscribeFromAllConnections();
        }
    };

    private generateWalletServiceKeys(): WalletServiceKeys {
        const walletServiceSecretKey = generatePrivateKey();
        const walletServicePubkey = getPublicKey(walletServiceSecretKey);
        return {
            privateKey: walletServiceSecretKey,
            publicKey: walletServicePubkey
        };
    }

    private async loadClientKeys(): Promise<ClientKeys> {
        try {
            const storedKeys = await Storage.getItem(NWC_CLIENT_KEYS);
            return storedKeys ? JSON.parse(storedKeys) : {};
        } catch (error) {
            console.error('Failed to load client keys:', error);
            return {};
        }
    }
    private async loadWalletServiceKeys(): Promise<WalletServiceKeys> {
        try {
            const storedKeys = await Storage.getItem(NWC_SERVICE_KEYS);
            if (!storedKeys) {
                console.info(
                    'NWC: No stored wallet service keys found, generating new ones'
                );
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
                    'views.Settings.NostrWalletConnect.error.failedToStoreServiceKeys'
                )
            );
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
                    'views.Settings.NostrWalletConnect.error.failedToSavePersistentServiceSetting'
                )
            );
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
                    'views.Settings.NostrWalletConnect.error.failedToSaveCashuSetting'
                )
            );
        }
    }

    @action
    public initializeService = async () => {
        this.retryWithBackoff(async () => {
            runInAction(() => {
                this.initializing = true;
                this.loadingMsg = localeString(
                    'views.Settings.NostrWalletConnect.initializingService'
                );
            });
            try {
                await this.initializeNWCWalletServices();
                await this.initializeWalletServiceKeys();
                await this.loadPersistentServiceSetting();
                await this.loadCashuSetting();
                await this.loadConnections();
                await this.checkAndResetAllBudgets();
                await this.startService();

                runInAction(() => {
                    this.loadingMsg = undefined;
                    this.initializing = false;
                });
            } catch (error: any) {
                console.error('Failed to initialize NWC service:', error);
                runInAction(() => {
                    this.setError(
                        (error instanceof Error
                            ? error.message
                            : String(error)) ||
                            localeString(
                                'views.Settings.NostrWalletConnect.error.failedToInitializeService'
                            )
                    );
                    this.initializing = false;
                    this.loadingMsg = undefined;
                });
            }
        }, MAX_RELAY_ATTEMPTS);
    };
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
        for (const relayUrl of DEFAULT_NOSTR_RELAYS) {
            if (this.nwcWalletServices.has(relayUrl)) {
                console.log(
                    `NWC: Relay ${relayUrl} already initialized, skipping`
                );
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
                    'views.Settings.NostrWalletConnect.error.failedToInitializeRelays'
                )
            );
        }
    };

    @action
    public startService = async () => {
        runInAction(() => {
            this.loading = true;
        });

        try {
            if (!this.walletServiceKeys?.privateKey) {
                throw new Error(
                    localeString(
                        'views.Settings.NostrWalletConnect.error.walletServiceKeyNotFound'
                    )
                );
            }
            const hasActiveConnections = this.activeConnections.length > 0;
            if (hasActiveConnections && this.persistentNWCServiceEnabled) {
                await this.initializePlatformService();
            }
            await this.verifyServiceHealth();
            const successfulPublishes = await this.publishToAllRelays();
            if (successfulPublishes === 0) {
                throw new Error(
                    localeString(
                        'views.Settings.NostrWalletConnect.error.failedToPublishToRelays'
                    )
                );
            }
            console.log(
                `Successfully published to ${successfulPublishes}/${this.nwcWalletServices.size} relays`
            );
            setTimeout(async () => {
                await this.subscribeToAllConnections();
                if (hasActiveConnections && this.persistentNWCServiceEnabled) {
                    this.setupPlatformSpecificMonitoring();
                }
            }, SERVICE_START_DELAY_MS);
        } catch (error: any) {
            console.error('Failed to start NWC service:', error);
            runInAction(() => {
                this.setError(
                    (error instanceof Error ? error.message : String(error)) ||
                        localeString(
                            'views.Settings.NostrWalletConnect.error.failedToStartService'
                        )
                );
            });
            return false;
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    private async initializePlatformService(): Promise<void> {
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

    private async publishToAllRelays(): Promise<number> {
        let successfulPublishes = 0;
        const publishPromises = Array.from(
            this.nwcWalletServices.entries()
        ).map(async ([relayUrl, nwcWalletService]) => {
            // Checking if already published to this relay
            if (this.publishedRelays.has(relayUrl)) {
                const isConnected =
                    this.nwcWalletServices.get(relayUrl)?.connected;
                if (isConnected) {
                    console.info(
                        `Skipping already published and healthy relay: ${relayUrl}`
                    );
                    successfulPublishes++;
                    return;
                } else {
                    console.info(
                        `Relay ${relayUrl} was published but is now unhealthy, republishing...`
                    );
                    runInAction(() => {
                        this.publishedRelays.delete(relayUrl);
                    });
                }
            }
            try {
                const success = await this.retryWithBackoff(async () => {
                    await nwcWalletService.publishWalletServiceInfoEvent(
                        this.walletServiceKeys!.privateKey,
                        NostrConnectUtils.getFullAccessPermissions(),
                        NostrConnectUtils.getNotifications()
                    );
                    return true;
                }, 3);
                if (success) {
                    successfulPublishes++;
                    runInAction(() => {
                        this.publishedRelays.add(relayUrl);
                    });
                    console.log(`Successfully published to relay: ${relayUrl}`);
                }
            } catch (publishError: any) {
                const errorMessage =
                    publishError?.message || String(publishError);
                console.warn(
                    `Failed to publish to relay ${relayUrl}:`,
                    errorMessage
                );
            }
        });

        await Promise.allSettled(publishPromises);
        return successfulPublishes;
    }

    private setupPlatformSpecificMonitoring(): void {
        this.setupHealthChecks();

        if (Platform.OS === 'android') {
            this.setupAndroidConnectionMonitoring();
        }
    }

    private setupAndroidConnectionMonitoring(): void {
        if (this.connectionRetryInterval) {
            clearInterval(this.connectionRetryInterval);
        }

        this.connectionRetryInterval = setInterval(async () => {
            try {
                const { NostrConnectModule } = NativeModules;
                const isServiceRunning =
                    await NostrConnectModule.isNostrConnectServiceRunning();

                if (!isServiceRunning) {
                    console.warn(
                        'Android: Background service stopped, attempting restart'
                    );
                    await this.initializePlatformService();
                }

                const now = Date.now();
                const timeSinceLastAttempt = now - this.lastConnectionAttempt;

                if (
                    timeSinceLastAttempt > 30000 &&
                    this.activeConnections.length > 0
                ) {
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
                console.warn('Android: Connection monitoring error:', error);
            }
        }, CONNECTION_RETRY_INTERVAL_MS); // Check every minute on Android
    }

    private async verifyServiceHealth(): Promise<void> {
        if (!this.walletServiceKeys?.privateKey) {
            throw new Error(
                localeString(
                    'views.Settings.NostrWalletConnect.error.walletServiceKeysNotInitialized'
                )
            );
        }
        if (this.nwcWalletServices.size === 0) {
            throw new Error(
                localeString(
                    'views.Settings.NostrWalletConnect.error.noRelaysAvailable'
                )
            );
        }
        try {
            await this.nodeInfoStore.getNodeInfo();
        } catch (error) {
            console.warn('NWC: Backend not accessible, but continuing:', error);
        }
    }

    private setupHealthChecks(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        this.healthCheckInterval = setInterval(async () => {
            const activeConnections = this.connections.filter(
                (c) => !c.isExpired
            );
            const subscriptionCount = this.activeSubscriptions.size;

            if (activeConnections.length > 0 && subscriptionCount === 0) {
                await this.subscribeToAllConnections();
            }
        }, HEALTH_CHECK_INTERVAL_MS); // 10 minutes - less frequent
    }
    public isServiceReady(): boolean {
        return (
            this.walletServiceKeys?.privateKey !== undefined &&
            this.nwcWalletServices.size > 0 &&
            !this.error
        );
    }
    @computed
    get isCashuProperlyConfigured(): boolean {
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
                errorMessage = 'No Cashu mint selected';
            } else {
                errorMessage = `Cashu mint not properly configured: ${selectedMintUrl}`;
            }
        }

        return {
            isEnabled,
            isConfigured,
            selectedMintUrl,
            errorMessage
        };
    }

    @action
    public stopService = async (): Promise<boolean> => {
        try {
            runInAction(() => {
                this.loading = true;
                this.error = false;
            });

            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }
            if (this.connectionRetryInterval) {
                clearInterval(this.connectionRetryInterval);
                this.connectionRetryInterval = null;
            }
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
                        'views.Settings.NostrWalletConnect.error.failedToStopService'
                    );
            });
            return false;
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    private generateConnectionSecret(relayUrl: string) {
        if (!this.walletServiceKeys?.publicKey) {
            throw new Error(
                localeString(
                    'views.Settings.NostrWalletConnect.error.walletServicePublicKeyNotAvailable'
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
                    'views.Settings.NostrWalletConnect.error.failedToStorePrivateKey'
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
    @action
    public loadConnections = async () => {
        try {
            const connectionsData = await Storage.getItem(NWC_CONNECTIONS_KEY);
            if (connectionsData) {
                const connections = JSON.parse(connectionsData);
                runInAction(() => {
                    this.connections = connections.map(
                        (data: any) => new NWCConnection(data)
                    );
                });
                await this.checkAndResetAllBudgets();
            }
        } catch (error: any) {
            console.error('Failed to load NWC connections:', error);
            runInAction(() => {
                this.setError(
                    localeString(
                        'views.Settings.NostrWalletConnect.failedToLoadConnections'
                    )
                );
            });
        }
    };
    @action
    public refreshConnections = async () => {
        try {
            runInAction(() => {
                this.loading = true;
                this.error = false;
            });

            await this.loadConnections();

            runInAction(() => {
                this.loading = false;
            });
        } catch (error: any) {
            runInAction(() => {
                this.setError(
                    localeString(
                        'views.Settings.NostrWalletConnect.failedToLoadConnections'
                    )
                );
                this.loading = false;
            });
        }
    };

    @action
    public saveConnections = async () => {
        try {
            await Storage.setItem(
                NWC_CONNECTIONS_KEY,
                JSON.stringify(this.connections)
            );
        } catch (error: any) {
            console.error('Failed to save NWC connections:', error);
            runInAction(() => {
                this.setError(
                    localeString(
                        'views.Settings.NostrWalletConnect.failedToSaveConnections'
                    )
                );
            });
        }
    };
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
            runInAction(() => {
                this.loading = true;
                this.error = false;
            });

            if (!params.name.trim()) {
                throw new Error(
                    localeString(
                        'views.Settings.NostrWalletConnect.connectionNameRequired'
                    )
                );
            }

            const existingConnection = this.connections.find(
                (c) => c.name.toLowerCase() === params.name.trim().toLowerCase()
            );
            if (existingConnection) {
                throw new Error(
                    localeString(
                        'views.Settings.NostrWalletConnect.connectionNameExists'
                    )
                );
            }
            if (!this.nwcWalletServices.has(params.relayUrl)) {
                throw new Error(
                    localeString(
                        'views.Settings.NostrWalletConnect.error.relayNotAvailable',
                        {
                            relayUrl: params.relayUrl,
                            availableRelays: this.availableRelays.join(', ')
                        }
                    )
                );
            }

            const connectionId = uuidv4();
            const { connectionUrl, connectionPrivateKey, connectionPublicKey } =
                this.generateConnectionSecret(params.relayUrl);
            const connectionData = {
                id: connectionId,
                name: params.name.trim(),
                pubkey: connectionPublicKey,
                relayUrl: params.relayUrl,
                permissions:
                    params.permissions ||
                    NostrConnectUtils.getFullAccessPermissions(),
                totalSpendSats: 0,
                createdAt: new Date(),
                maxAmountSats: params.budgetAmount,
                budgetRenewal: params.budgetRenewal || 'never',
                expiresAt: params.expiresAt,
                lastBudgetReset: params.budgetAmount ? new Date() : undefined
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
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    /**
     * Delete an existing NWC connection and cleans up associated resources.
     * @param connectionId The unique identifier of the connection to delete.
     * @returns Promise<boolean> - True if deletion was successful, false otherwise.
     * @throws Error if the connection is not found or deletion fails.
     */
    @action
    public deleteConnection = async (
        connectionId: string
    ): Promise<boolean> => {
        try {
            runInAction(() => {
                this.loading = true;
                this.error = false;
            });

            const connectionIndex = this.connections.findIndex(
                (c) => c.id === connectionId
            );
            if (connectionIndex === -1) {
                throw new Error(
                    localeString(
                        'views.Settings.NostrWalletConnect.connectionNotFound'
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
            return true;
        } catch (error: any) {
            console.error('Failed to delete NWC connection:', error);
            runInAction(() => {
                this.error = true;
                this.errorMessage =
                    (error instanceof Error ? error.message : String(error)) ||
                    localeString(
                        'views.Settings.NostrWalletConnect.error.failedToDeleteConnection'
                    );
            });
            return false;
        } finally {
            runInAction(() => {
                this.loading = false;
            });
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
    ): Promise<boolean> => {
        try {
            runInAction(() => {
                this.loading = true;
                this.error = false;
            });

            const connection = this.connections.find(
                (c) => c.id === connectionId
            );
            if (!connection) {
                throw new Error(
                    localeString(
                        'views.Settings.NostrWalletConnect.connectionNotFound'
                    )
                );
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
            });

            await this.saveConnections();
            return true;
        } catch (error: any) {
            console.error('Failed to update NWC connection:', error);
            runInAction(() => {
                this.error = true;
                this.errorMessage =
                    (error instanceof Error ? error.message : String(error)) ||
                    localeString(
                        'views.Settings.NostrWalletConnect.error.failedToUpdateConnection'
                    );
            });
            return false;
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };
    @action
    private markConnectionUsed = async (connectionId: string) => {
        const connection = this.connections.find((c) => c.id === connectionId);
        if (connection) {
            const wasNeverUsed = !connection.lastUsed;

            if (wasNeverUsed) {
                this.startWaitingForConnection(connectionId);
            }
            connection.lastUsed = new Date();
            await this.saveConnections();

            if (
                this.waitingForConnection &&
                this.currentConnectionId === connectionId
            ) {
                this.stopWaitingForConnection();
            }
        }
    };
    private isRateLimited(connectionId: string, method: string): boolean {
        const key = `${connectionId}-${method}`;
        const lastCallTime = this.lastCallTimes.get(key);
        const now = Date.now();

        if (lastCallTime && now - lastCallTime < RATE_LIMIT_MS) {
            return true;
        }
        this.lastCallTimes.set(key, now);
        if (this.lastCallTimes.size > 1000) {
            // Arbitrary limit
            const entries = Array.from(this.lastCallTimes.entries()).sort(
                (a, b) => a[1] - b[1]
            );
            this.lastCallTimes = new Map(entries.slice(-500)); // Keep newest 500 entries
        }
        return false;
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
    private manageBudget = async (
        connectionId: string,
        amountSats: number,
        operation: 'validate' | 'track' | 'reset' = 'validate'
    ): Promise<void> => {
        const connection = this.getConnection(connectionId);
        if (!connection) {
            if (operation === 'validate') {
                throw new Error(
                    localeString(
                        'views.Settings.NostrWalletConnect.connectionNotFound'
                    )
                );
            }
            return;
        }
        let needsSave = false;
        if (connection.needsBudgetReset) {
            connection.resetBudget();
            needsSave = true;
        }
        switch (operation) {
            case 'validate':
                if (
                    connection.hasBudgetLimit &&
                    !connection.canSpend(amountSats)
                ) {
                    const remainingBudget = connection.remainingBudget;
                    const error = new Error(
                        localeString(
                            'views.Settings.NostrWalletConnect.error.paymentExceedsBudget',
                            {
                                amount: amountSats.toString(),
                                remaining: remainingBudget.toString()
                            }
                        )
                    );
                    (error as any).code = 'QUOTA_EXCEEDED';
                    throw error;
                }
                break;
            case 'track':
                connection.addSpending(amountSats);
                needsSave = true;
                break;
        }
        if (needsSave) {
            await this.saveConnections();
        }
    };

    @action
    private checkAndResetAllBudgets = async (): Promise<void> => {
        let needsSave = false;

        runInAction(() => {
            for (const connection of this.connections) {
                if (connection.needsBudgetReset) {
                    connection.resetBudget();
                    needsSave = true;
                }
            }
        });

        if (needsSave) {
            await this.saveConnections();
        }
    };
    private async subscribeToAllConnections(): Promise<void> {
        const activeConnections = this.connections.filter((c) => c.isActive);
        if (activeConnections.length === 0) {
            return;
        }
        const subscriptionPromises = activeConnections.map(
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

    private async subscribeToConnection(
        connection: NWCConnection
    ): Promise<void> {
        if (!this.isServiceReady()) {
            runInAction(() => {
                this.error = true;
                this.errorMessage = localeString(
                    'views.Settings.NostrWalletConnect.error.serviceNotReady'
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
                        'views.Settings.NostrWalletConnect.walletServiceKeyNotFound'
                    )
                );
            }
            const keypair = new nwc.NWCWalletServiceKeyPair(
                serviceSecretKey,
                connection.pubkey
            );
            const handler: NWCWalletServiceRequestHandler = {};

            if (connection.hasPermission('get_info')) {
                handler.getInfo = () => this.handleGetInfo(connection);
            }

            if (connection.hasPermission('get_balance')) {
                handler.getBalance = () => this.handleGetBalance(connection);
            }

            if (connection.hasPermission('pay_invoice')) {
                handler.payInvoice = (request: Nip47PayInvoiceRequest) =>
                    this.handlePayInvoice(connection, request);
            }

            if (connection.hasPermission('make_invoice')) {
                handler.makeInvoice = (request: Nip47MakeInvoiceRequest) =>
                    this.handleMakeInvoice(connection, request);
            }

            if (connection.hasPermission('lookup_invoice')) {
                handler.lookupInvoice = (request: Nip47LookupInvoiceRequest) =>
                    this.handleLookupInvoice(connection, request);
            }

            if (connection.hasPermission('list_transactions')) {
                handler.listTransactions = (
                    request: Nip47ListTransactionsRequest
                ) => this.handleListTransactions(connection, request);
            }

            if (connection.hasPermission('pay_keysend')) {
                handler.payKeysend = (request: Nip47PayKeysendRequest) =>
                    this.handlePayKeysend(connection, request);
            }

            if (connection.hasPermission('sign_message')) {
                handler.signMessage = (request: Nip47SignMessageRequest) =>
                    this.handleSignMessage(connection, request);
            }

            const nwcWalletService = this.nwcWalletServices.get(
                connection.relayUrl
            );
            if (!nwcWalletService) {
                throw new Error(
                    localeString(
                        'views.Settings.NostrWalletConnect.error.nwcWalletServiceNotFound',
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
    private async handleGetInfo(
        connection: NWCConnection
    ): NWCWalletServiceResponsePromise<Nip47GetInfoResponse> {
        this.markConnectionUsed(connection.id);
        if (this.isRateLimited(connection.id, 'get_info')) {
            return this.handleError('Rate limited', ErrorCodes.RATE_LIMITED);
        }
        try {
            if (!this.nodeInfoStore.nodeInfo?.identity_pubkey) {
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
                            'views.Settings.NostrWalletConnect.zeusWallet'
                        ),
                    color: nodeInfo?.color || '#3399FF',
                    pubkey: nodeInfo?.identity_pubkey,
                    network,
                    block_height: nodeInfo?.block_height,
                    block_hash: nodeInfo?.block_hash,
                    methods: connection.permissions,
                    notifications: NostrConnectUtils.getNotifications()
                },
                error: undefined
            };
        } catch (error) {
            return this.handleError(
                localeString(
                    'views.Settings.NostrWalletConnect.error.failedToGetInfo'
                ),
                ErrorCodes.INTERNAL_ERROR
            );
        }
    }

    private async handleGetBalance(
        connection: NWCConnection
    ): NWCWalletServiceResponsePromise<Nip47GetBalanceResponse> {
        if (this.isRateLimited(connection.id, 'get_balance')) {
            return this.handleError('Rate limited', ErrorCodes.RATE_LIMITED);
        }
        this.markConnectionUsed(connection.id);
        try {
            const balance = this.isCashuProperlyConfigured
                ? this.cashuStore.totalBalanceSats
                : (await this.balanceStore.getLightningBalance(true))
                      ?.lightningBalance;
            return {
                result: {
                    balance: Number(balance) * MILLISATS_PER_SAT
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
        request: Nip47PayInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47PayResponse> {
        this.markConnectionUsed(connection.id);
        if (this.isRateLimited(connection.id, 'pay_invoice')) {
            return this.handleError('Rate limited', ErrorCodes.RATE_LIMITED);
        }
        try {
            if (this.isCashuProperlyConfigured) {
                const cashuStatus = this.cashuConfigurationStatus;
                if (!cashuStatus.isConfigured) {
                    return this.handleError(
                        cashuStatus.errorMessage ||
                            localeString(
                                'views.Settings.NostrWalletConnect.error.noCashuMintSelected'
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
                            'views.Settings.NostrWalletConnect.error.failedToDecodeInvoice'
                        ),
                        ErrorCodes.INVALID_INVOICE
                    );
                }
                if (invoice.isPaid) {
                    return this.handleError(
                        localeString(
                            'views.Settings.NostrWalletConnect.error.invoiceAlreadyPaid'
                        ),
                        ErrorCodes.INVALID_INVOICE
                    );
                }
                if (invoice.isExpired) {
                    return this.handleError(
                        localeString(
                            'views.Settings.NostrWalletConnect.error.invoiceExpired'
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
                            'views.Settings.NostrWalletConnect.error.invalidPaymentRequest'
                        ),
                        ErrorCodes.INVALID_INVOICE
                    );
                }
                let amount = 0;
                if (invoice.getAmount && invoice.getAmount > 0) {
                    amount = invoice.getAmount;
                } else if ((invoice as any).satoshis) {
                    amount = (invoice as any).satoshis;
                } else if ((invoice as any).millisatoshis) {
                    amount =
                        Number((invoice as any).millisatoshis) /
                        MILLISATS_PER_SAT;
                }
                if (!amount || amount <= 0) {
                    return this.handleError(
                        localeString(
                            'views.Settings.NostrWalletConnect.error.invalidAmount'
                        ),
                        ErrorCodes.INVALID_INVOICE
                    );
                }
                const currentBalance = this.cashuStore.totalBalanceSats || 0;
                if (currentBalance < amount) {
                    return this.handleError(
                        localeString(
                            'views.Settings.NostrWalletConnect.error.insufficientBalance',
                            {
                                amount: amount.toString(),
                                balance: currentBalance.toString()
                            }
                        ),
                        ErrorCodes.INSUFFICIENT_BALANCE
                    );
                }
                await this.manageBudget(connection.id, amount, 'validate');

                const cashuInvoice =
                    await this.cashuStore.payLnInvoiceFromEcash({
                        amount: amount.toString()
                    });
                if (cashuInvoice?.preimage) {
                    await this.manageBudget(connection.id, amount, 'track');
                    this.showPaymentSentNotification(amount, connection.name);
                }
                return {
                    result: {
                        preimage: cashuInvoice?.preimage,
                        fees_paid: (cashuInvoice?.fee || 0) * MILLISATS_PER_SAT // Convert satoshis to millisatoshis
                    },
                    error: undefined
                };
            }
            const invoiceInfo = await BackendUtils.decodePaymentRequest([
                request.invoice
            ]);
            const amountSats = Number(invoiceInfo.num_satoshis) || 0;

            if (invoiceInfo.expiry && invoiceInfo.timestamp) {
                const expiryTime =
                    (Number(invoiceInfo.timestamp) +
                        Number(invoiceInfo.expiry)) *
                    1000;
                const now = Date.now();

                if (now > expiryTime) {
                    return {
                        result: undefined,
                        error: {
                            code: 'INVOICE_EXPIRED',
                            message: localeString(
                                'views.Settings.NostrWalletConnect.error.invoiceExpired'
                            )
                        }
                    };
                }
            }
            const lightningBalance =
                await this.balanceStore.getLightningBalance(true);
            const currentLightningBalance =
                lightningBalance?.lightningBalance || 0;
            if (currentLightningBalance < amountSats) {
                return this.handleError(
                    localeString(
                        'views.Settings.NostrWalletConnect.error.insufficientBalance',
                        {
                            amount: amountSats.toString(),
                            balance: currentLightningBalance.toString()
                        }
                    ),
                    ErrorCodes.INSUFFICIENT_BALANCE
                );
            }

            await this.manageBudget(connection.id, amountSats, 'validate');
            await this.transactionsStore.sendPayment({
                payment_request: request.invoice,
                fee_limit_sat: PAYMENT_FEE_LIMIT_SATS.toString(),
                timeout_seconds: PAYMENT_TIMEOUT_SECONDS.toString()
            });
            await new Promise((resolve) =>
                setTimeout(resolve, PAYMENT_PROCESSING_DELAY_MS)
            );
            if (this.transactionsStore.payment_error) {
                return this.handleError(
                    this.transactionsStore.payment_error,
                    ErrorCodes.FAILED_TO_PAY_INVOICE
                );
            }
            const preimage = this.transactionsStore.payment_preimage;
            const fees_paid = this.transactionsStore.payment_fee;
            await this.manageBudget(connection.id, amountSats, 'track');
            return {
                result: {
                    preimage: preimage!,
                    fees_paid: Math.floor(
                        (Number(fees_paid) || 0) * MILLISATS_PER_SAT
                    )
                },
                error: undefined
            };
        } catch (error: any) {
            return this.handleError(error, ErrorCodes.INTERNAL_ERROR);
        }
    }

    private async handleMakeInvoice(
        connection: NWCConnection,
        request: Nip47MakeInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        this.markConnectionUsed(connection.id);
        if (this.isRateLimited(connection.id, 'make_invoice')) {
            return this.handleError('Rate limited', ErrorCodes.RATE_LIMITED);
        }
        try {
            if (this.isCashuProperlyConfigured) {
                try {
                    const cashuInvoice = await this.cashuStore.createInvoice({
                        value: Math.floor(
                            request.amount / MILLISATS_PER_SAT
                        ).toString(),
                        memo: request.description || ''
                    });

                    if (!cashuInvoice || !cashuInvoice.paymentRequest) {
                        throw new Error(
                            localeString(
                                'views.Settings.NostrWalletConnect.error.failedToCreateCashuInvoice'
                            )
                        );
                    }

                    let paymentHash = '';
                    let descriptionHash = '';
                    let expiryTime =
                        Math.floor(Date.now() / 1000) +
                        (request.expiry || DEFAULT_INVOICE_EXPIRY_SECONDS);

                    try {
                        const decoded = bolt11.decode(
                            cashuInvoice.paymentRequest
                        );
                        for (const tag of decoded.tags) {
                            if (tag.tagName === 'payment_hash') {
                                paymentHash = String(tag.data);
                            } else if (tag.tagName === 'purpose_commit_hash') {
                                descriptionHash = String(tag.data);
                            } else if (tag.tagName === 'expire_time') {
                                const invoiceExpiry = Number(tag.data);
                                if (invoiceExpiry > 0 && decoded.timestamp) {
                                    expiryTime =
                                        decoded.timestamp + invoiceExpiry;
                                }
                            }
                        }
                    } catch (decodeError) {
                        return this.handleError(
                            (decodeError as Error).message,
                            ErrorCodes.INVALID_INVOICE
                        );
                    }

                    this.showInvoiceCreatedNotification(
                        Math.floor(request.amount / MILLISATS_PER_SAT),
                        connection.name,
                        request.description
                    );

                    return {
                        result: {
                            type: 'incoming' as const,
                            state: 'pending' as const,
                            invoice: cashuInvoice.paymentRequest,
                            description: request.description || '',
                            description_hash: descriptionHash,
                            preimage: '',
                            payment_hash: paymentHash,
                            amount: request.amount,
                            fees_paid: 0,
                            settled_at: 0,
                            created_at: Math.floor(Date.now() / 1000),
                            expires_at: expiryTime
                        },
                        error: undefined
                    };
                } catch (cashuError) {
                    return this.handleError(
                        (cashuError as Error).message,
                        ErrorCodes.FAILED_TO_CREATE_INVOICE
                    );
                }
            }
            const invoice = await this.invoicesStore.createInvoice({
                value: Math.floor(
                    request.amount / MILLISATS_PER_SAT
                ).toString(),
                memo: request.description || '',
                expirySeconds: String(
                    request.expiry || DEFAULT_INVOICE_EXPIRY_SECONDS
                )
            });

            this.showInvoiceCreatedNotification(
                Math.floor(request.amount / MILLISATS_PER_SAT),
                connection.name,
                request.description
            );
            const descriptionHash = invoice.description_hash;
            return {
                result: {
                    type: 'incoming' as const,
                    state: 'pending' as const,
                    invoice: invoice.paymentRequest,
                    description: request.description || '',
                    description_hash: descriptionHash,
                    preimage: '',
                    payment_hash: '',
                    amount: request.amount,
                    fees_paid: 0,
                    settled_at: 0,
                    created_at: Math.floor(Date.now() / 1000),
                    expires_at: invoice.expires_at
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

    private async handleLookupInvoice(
        connection: NWCConnection,
        request: Nip47LookupInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        this.markConnectionUsed(connection.id);
        if (this.isRateLimited(connection.id, 'lookup_invoice')) {
            return this.handleError('Rate limited', ErrorCodes.RATE_LIMITED);
        }
        try {
            let paymentHash = this.convertPaymentHashToHex(
                request.payment_hash!
            );
            if (this.isCashuProperlyConfigured) {
                const cashuInvoices = this.cashuStore.invoices || [];
                const matchingInvoice = cashuInvoices.find((inv) => {
                    try {
                        const decoded = bolt11.decode(inv.getPaymentRequest);
                        const invPaymentHash = decoded.tags.find(
                            (tag) => tag.tagName === 'payment_hash'
                        )?.data;
                        return String(invPaymentHash) === paymentHash;
                    } catch {
                        return false;
                    }
                });
                if (matchingInvoice) {
                    if (
                        this.cashuStore.selectedMintUrl !==
                        matchingInvoice.mintUrl
                    ) {
                        await this.cashuStore.setSelectedMint(
                            matchingInvoice.mintUrl
                        );
                    }
                    let cashuInvoice;
                    let isPaid = matchingInvoice.isPaid;
                    let amtSat = matchingInvoice.getAmount;

                    if (!isPaid) {
                        cashuInvoice = await this.cashuStore.checkInvoicePaid(
                            matchingInvoice.quote
                        );
                        isPaid = cashuInvoice?.isPaid || false;
                        amtSat =
                            cashuInvoice?.amtSat || matchingInvoice.getAmount;
                    }

                    const timestamp =
                        Number(matchingInvoice.getTimestamp) ||
                        Math.floor(Date.now() / 1000);
                    const expiresAt =
                        Number(matchingInvoice.expires_at) ||
                        timestamp + DEFAULT_INVOICE_EXPIRY_SECONDS;

                    const result = {
                        type: 'incoming' as const,
                        state: isPaid
                            ? ('settled' as const)
                            : ('pending' as const),
                        invoice: matchingInvoice.getPaymentRequest,
                        description: matchingInvoice.getMemo || '',
                        description_hash: '',
                        preimage: '',
                        payment_hash: request.payment_hash!,
                        amount: Math.floor((amtSat || 0) * MILLISATS_PER_SAT),
                        fees_paid: 0,
                        settled_at: isPaid ? Math.floor(Date.now() / 1000) : 0,
                        created_at: timestamp,
                        expires_at: expiresAt
                    };
                    return {
                        result,
                        error: undefined
                    };
                } else {
                    return this.handleError(
                        localeString(
                            'views.Settings.NostrWalletConnect.error.invoiceNotFound'
                        ),
                        ErrorCodes.NOT_FOUND
                    );
                }
            } else {
                const rawInvoice = await BackendUtils.lookupInvoice({
                    r_hash: paymentHash
                });
                const invoice = new Invoice(rawInvoice);
                const result = {
                    type: 'incoming' as const,
                    state: invoice.isPaid
                        ? ('settled' as const)
                        : invoice.isExpired
                        ? ('failed' as const)
                        : ('pending' as const),
                    invoice: invoice.getPaymentRequest,
                    description: invoice.getMemo || '',
                    description_hash: invoice.getDescriptionHash,
                    preimage: invoice.getRPreimage,
                    payment_hash: invoice.getRHash || request.payment_hash!,
                    amount: Math.floor(invoice.getAmount * MILLISATS_PER_SAT), // Convert to msats
                    fees_paid: 0,
                    settled_at: invoice.isPaid
                        ? Math.floor(invoice.settleDate.getTime() / 1000)
                        : 0,
                    created_at: Math.floor(
                        invoice.getCreationDate.getTime() / 1000
                    ),
                    expires_at: invoice.isExpired
                        ? Math.floor(Date.now() / 1000) +
                          DEFAULT_INVOICE_EXPIRY_SECONDS
                        : Math.floor(invoice.getCreationDate.getTime() / 1000) +
                          (Number(invoice.expiry) ||
                              DEFAULT_INVOICE_EXPIRY_SECONDS)
                };
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
        this.markConnectionUsed(connection.id);
        if (this.isRateLimited(connection.id, 'list_transactions')) {
            return this.handleError('Rate limited', ErrorCodes.RATE_LIMITED);
        }
        try {
            let nip47Transactions: Nip47Transaction[] = [];

            if (this.isCashuProperlyConfigured) {
                const cashuPayments = this.cashuStore.payments || [];
                const cashuInvoices = this.cashuStore.invoices || [];
                const receivedTokens = this.cashuStore.receivedTokens || [];
                const sentTokens = this.cashuStore.sentTokens || [];

                // Convert Cashu  to NIP-47 transactions
                const cashuPaymentTransactions: Nip47Transaction[] =
                    cashuPayments.map((payment) => {
                        const timestamp =
                            Number(payment.getTimestamp) || Date.now() / 1000;
                        return {
                            type: 'outgoing' as const,
                            state: 'settled' as const,
                            invoice: payment.getPaymentRequest || '',
                            description: payment.getMemo || '',
                            description_hash: '',
                            preimage: payment.getPreimage || '',
                            payment_hash: payment.paymentHash || '',
                            amount: Math.floor(
                                (Number(payment.getAmount) || 0) *
                                    MILLISATS_PER_SAT
                            ), // Convert to msats
                            fees_paid: Math.floor(
                                (Number(payment.getFee) || 0) *
                                    MILLISATS_PER_SAT
                            ), // Convert to msats
                            settled_at: Math.floor(timestamp),
                            created_at: Math.floor(timestamp),
                            expires_at: Math.floor(
                                timestamp + DEFAULT_INVOICE_EXPIRY_SECONDS
                            )
                        };
                    });

                // Convert Cashu invoices to NIP-47 transactions
                const cashuInvoiceTransactions: Nip47Transaction[] =
                    cashuInvoices.map((invoice) => {
                        const timestamp =
                            Number(invoice.getTimestamp) || Date.now() / 1000;
                        const expiresAt =
                            Number(invoice.expires_at) ||
                            timestamp + DEFAULT_INVOICE_EXPIRY_SECONDS;
                        return {
                            type: 'incoming' as const,
                            state: invoice.isPaid
                                ? ('settled' as const)
                                : ('pending' as const),
                            invoice: invoice.getPaymentRequest || '',
                            description: invoice.getMemo || '',
                            description_hash: '',
                            preimage: '',
                            payment_hash: invoice.quote || '',
                            amount: Math.floor(
                                (invoice.getAmount || 0) * MILLISATS_PER_SAT
                            ), // Convert to msats
                            fees_paid: 0,
                            settled_at: invoice.isPaid
                                ? Math.floor(Date.now() / 1000)
                                : 0,
                            created_at: Math.floor(timestamp),
                            expires_at: Math.floor(expiresAt)
                        };
                    });

                // Convert received tokens to NIP-47 transactions
                const receivedTokenTransactions: Nip47Transaction[] =
                    receivedTokens.map((token) => {
                        const receivedAt =
                            Number(token.received_at) || Date.now() / 1000;
                        const createdAt =
                            Number(token.created_at) || receivedAt;
                        return {
                            type: 'incoming' as const,
                            state: 'settled' as const,
                            invoice: '',
                            description: token.memo || 'Received Cashu token',
                            description_hash: '',
                            preimage: '',
                            payment_hash: token.encodedToken || '',
                            amount: Math.floor(
                                (token.getAmount || 0) * MILLISATS_PER_SAT
                            ),
                            fees_paid: 0,
                            settled_at: Math.floor(receivedAt),
                            created_at: Math.floor(createdAt),
                            expires_at: Math.floor(
                                createdAt + DEFAULT_INVOICE_EXPIRY_SECONDS
                            )
                        };
                    });

                // Convert sent tokens to NIP-47 transactions
                const sentTokenTransactions: Nip47Transaction[] =
                    sentTokens.map((token) => {
                        const createdAt =
                            Number(token.created_at) || Date.now() / 1000;
                        return {
                            type: 'outgoing' as const,
                            state: token.spent
                                ? ('settled' as const)
                                : ('pending' as const),
                            invoice: '',
                            description: token.memo || 'Sent Cashu token',
                            description_hash: '',
                            preimage: '',
                            payment_hash: token.encodedToken || '',
                            amount: Math.floor(
                                (token.getAmount || 0) * MILLISATS_PER_SAT
                            ), // Convert to msats
                            fees_paid: 0,
                            settled_at: token.spent
                                ? Math.floor(Date.now() / 1000)
                                : 0,
                            created_at: Math.floor(createdAt),
                            expires_at: Math.floor(
                                createdAt + DEFAULT_INVOICE_EXPIRY_SECONDS
                            )
                        };
                    });

                nip47Transactions = [
                    ...cashuPaymentTransactions,
                    ...cashuInvoiceTransactions,
                    ...receivedTokenTransactions,
                    ...sentTokenTransactions
                ];
                nip47Transactions.sort((a, b) => b.created_at - a.created_at);
            } else {
                await this.transactionsStore.getTransactions();
                const transactions = this.transactionsStore.transactions;

                nip47Transactions = (transactions || []).map(
                    (tx: Transaction) => {
                        const amount = Number(tx.amount);
                        const type: 'incoming' | 'outgoing' =
                            amount >= 0 ? 'incoming' : 'outgoing';
                        const state: 'settled' | 'pending' | 'failed' =
                            tx.num_confirmations > 0 ? 'settled' : 'pending';
                        const amountMsats =
                            Math.abs(amount) * MILLISATS_PER_SAT;
                        const feesMsats = Math.floor(
                            (Number(tx.total_fees) || 0) * MILLISATS_PER_SAT
                        );
                        const timestamp = Number(tx.time_stamp);

                        return {
                            type,
                            state,
                            invoice: '',
                            description: tx.note || '',
                            description_hash: '',
                            preimage: '',
                            payment_hash: tx.tx_hash,
                            amount: amountMsats,
                            fees_paid: feesMsats,
                            settled_at: timestamp,
                            created_at: timestamp,
                            expires_at:
                                timestamp + DEFAULT_INVOICE_EXPIRY_SECONDS,
                            metadata: {
                                block_height: tx.block_height,
                                block_hash: tx.block_hash,
                                num_confirmations: tx.num_confirmations,
                                dest_addresses: tx.dest_addresses,
                                raw_tx_hex: tx.raw_tx_hex
                            }
                        };
                    }
                );
            }
            if (request.type && request.type.trim() !== '') {
                nip47Transactions = nip47Transactions.filter(
                    (tx) => tx.type === request.type
                );
            }

            if (request.from) {
                nip47Transactions = nip47Transactions.filter(
                    (tx) => tx.created_at >= request.from!
                );
            }

            if (request.until) {
                nip47Transactions = nip47Transactions.filter(
                    (tx) => tx.created_at <= request.until!
                );
            }

            if (request.unpaid !== undefined) {
                if (request.unpaid) {
                    nip47Transactions = nip47Transactions.filter(
                        (tx) => tx.state === 'pending'
                    );
                } else {
                    nip47Transactions = nip47Transactions.filter(
                        (tx) => tx.state === 'settled'
                    );
                }
            }

            const totalCount = nip47Transactions.length;
            const offset = request.offset || 0;
            const limit = request.limit || totalCount;
            nip47Transactions = nip47Transactions.slice(offset, offset + limit);

            return {
                result: {
                    transactions: nip47Transactions,
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
        request: Nip47PayKeysendRequest
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        this.markConnectionUsed(connection.id);
        if (this.isRateLimited(connection.id, 'pay_keysend')) {
            return this.handleError('Rate limited', ErrorCodes.RATE_LIMITED);
        }
        try {
            const amountSats = Math.floor(request.amount / MILLISATS_PER_SAT);
            await this.manageBudget(connection.id, amountSats, 'validate');

            let result;
            if (this.isCashuProperlyConfigured) {
                return this.handleError(
                    localeString(
                        'views.Settings.NostrWalletConnect.error.keysendNotSupportedForCashu'
                    ),
                    ErrorCodes.NOT_IMPLEMENTED
                );
            } else {
                result = await this.transactionsStore.sendPayment({
                    pubkey: request.pubkey,
                    amount: request.amount.toString()
                });
            }
            await this.manageBudget(connection.id, amountSats, 'track');
            this.showPaymentSentNotification(amountSats, connection.name);
            return {
                result: {
                    type: 'outgoing' as const,
                    state: 'settled' as const,
                    invoice: '',
                    description: localeString(
                        'views.Settings.NostrWalletConnect.keysendPayment'
                    ),
                    description_hash: '',
                    preimage: result.payment_preimage,
                    payment_hash: result.payment_hash,
                    amount: request.amount,
                    fees_paid: Math.floor(
                        (result.fee || 0) * MILLISATS_PER_SAT
                    ),
                    settled_at: Math.floor(Date.now() / 1000),
                    created_at: Math.floor(Date.now() / 1000),
                    expires_at:
                        Math.floor(Date.now() / 1000) +
                        DEFAULT_INVOICE_EXPIRY_SECONDS
                },
                error: undefined
            };
        } catch (error: any) {
            return this.handleError(error, ErrorCodes.SEND_KEYSEND_FAILED);
        }
    }

    private async handleSignMessage(
        connection: NWCConnection,
        request: Nip47SignMessageRequest
    ): NWCWalletServiceResponsePromise<Nip47SignMessageResponse> {
        this.markConnectionUsed(connection.id);
        try {
            if (this.isCashuProperlyConfigured) {
                const selectedMintUrl = this.cashuStore.selectedMintUrl;
                const wallet = this.cashuStore.cashuWallets[selectedMintUrl];

                if (!wallet || !wallet.wallet) {
                    return this.handleError(
                        localeString(
                            'views.Settings.NostrWalletConnect.error.cashuWalletNotInitialized'
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

    private async unsubscribeFromConnection(
        connectionId: string
    ): Promise<void> {
        const unsub = this.activeSubscriptions.get(connectionId);
        if (unsub) {
            this.retryWithBackoff(async () => {
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
    }

    public getConnection = (
        connectionId: string
    ): NWCConnection | undefined => {
        return this.connections.find((c) => c.id === connectionId);
    };

    public get activeConnections(): NWCConnection[] {
        return this.connections.filter((c) => c.isActive);
    }

    public get expiredConnections(): NWCConnection[] {
        return this.connections.filter((c) => c.isExpired);
    }

    public get availableRelays(): string[] {
        return Array.from(this.nwcWalletServices.keys());
    }

    public get recommendedRelays(): string[] {
        return this.availableRelays;
    }
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
        const value = amountSats
            .toString()
            .replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',');
        this.showNotification(
            'Payment Sent via Nostr Wallet Connect',
            `Sent ${value} ${
                value === '1' ? 'sat' : 'sats'
            } via ${connectionName}`
        );
    }

    private showInvoiceCreatedNotification(
        amountSats: number,
        connectionName: string,
        description?: string
    ): void {
        const value = amountSats
            .toString()
            .replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',');
        const body = description
            ? `Invoice for ${value} ${
                  value === '1' ? 'sat' : 'sats'
              } created by ${connectionName}: ${description}`
            : `Invoice for ${value} ${
                  value === '1' ? 'sat' : 'sats'
              } created by ${connectionName}`;
        this.showNotification('Invoice Created via Nostr Wallet Connect', body);
    }

    private convertPaymentHashToHex(
        paymentHash: string | number[] | Uint8Array
    ): string | undefined {
        try {
            if (paymentHash instanceof Uint8Array) {
                return Base64Utils.bytesToHex(Array.from(paymentHash));
            }

            if (Array.isArray(paymentHash)) {
                return Base64Utils.bytesToHex(paymentHash);
            }

            if (!paymentHash || typeof paymentHash !== 'string') {
                console.warn(
                    'convertPaymentHashToHex: Invalid payment hash input:',
                    paymentHash
                );
                return '';
            }
            if (paymentHash.startsWith('{')) {
                let hashObj;
                if (paymentHash.includes('=>')) {
                    const jsonString = paymentHash
                        .replace(/=>/g, ':')
                        .replace(/"(\d+)":/g, '$1:')
                        .replace(/(\d+):/g, '"$1":');
                    hashObj = JSON.parse(jsonString);
                } else {
                    hashObj = JSON.parse(paymentHash);
                }

                const hashArray = Object.keys(hashObj)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .map((key) => hashObj[key])
                    .filter((value) => value !== undefined && value !== null); // Filter out undefined/null values

                if (hashArray.length === 0) {
                    console.warn(
                        'convertPaymentHashToHex: Empty hash array after filtering'
                    );
                    return '';
                }

                return Base64Utils.bytesToHex(hashArray);
            }

            if (
                paymentHash.includes('+') ||
                paymentHash.includes('/') ||
                paymentHash.includes('=')
            ) {
                return Base64Utils.base64ToHex(paymentHash);
            }

            return paymentHash;
        } catch (error) {
            console.warn('Failed to convert payment hash to hex:', error);
        }
    }
    @action private setError(message: string) {
        this.error = true;
        this.errorMessage = localeString(message) || message;
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
    // for IOS fetch and process pending events
    @action
    public async fetchAndProcessPendingEvents(
        maxRetries: number = 3
    ): Promise<void> {
        if (!this.isServiceReady()) {
            console.warn('NWC: Service not ready, cannot fetch pending events');
            return;
        }
        runInAction(() => {
            this.loading = true;
            this.error = false;
            this.loadingMsg = localeString(
                'views.Settings.NostrWalletConnect.fetchingPendingEvents'
            );
        });
        try {
            const deviceToken = this.lightningAddressStore.currentDeviceToken;
            if (!deviceToken) {
                throw new Error(
                    localeString(
                        'views.Settings.NostrWalletConnect.deviceTokenNotAvailable'
                    )
                );
            }
            const data = await this.retryWithBackoff(
                async () => await this.fetchPendingEvents(deviceToken),
                maxRetries
            );
            console.info('FOUND PENDING EVENTS', data, data.events.length);
            await this.processPendingEvents(data.events);
        } catch (error) {
            this.handleError(
                (error as Error).message,
                ErrorCodes.INTERNAL_ERROR
            );
        } finally {
            runInAction(() => {
                this.loading = false;
                this.loadingMsg = undefined;
            });
        }
    }
    private async fetchPendingEvents(
        deviceToken: string
    ): Promise<RestoreResponse> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                FETCH_TIMEOUT_MS
            );
            const response = await fetch(
                `${NWC_IOS_EVENTS_LISTENER_SERVER_URL}/restore?device_token=${encodeURIComponent(
                    deviceToken
                )}`,
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal
                }
            );
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(
                    `HTTP error ${response.status}: ${await response.text()}`
                );
            }

            return await response.json();
        } catch (error) {
            throw error;
        }
    }
    private async validateAndParsePendingEvent(
        eventStr: string,
        clientKey: ClientKeys
    ): Promise<{
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
        const connection = this.connections.find(
            (c) => c.pubkey === event.pubkey
        );
        if (!connection) {
            console.warn('NWC: Connection not found for event', {
                pubkey: event.pubkey
            });
            throw new Error('Connection not found for event');
        }
        const privateKey = clientKey[connection.pubkey];
        if (!privateKey) {
            console.warn('NWC: No private key for connection', {
                pubkey: connection.pubkey
            });
            throw new Error('No private key for connection');
        }
        let request: NWCRequest;
        try {
            const privateKey = this.walletServiceKeys!.privateKey;
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
    private async processPendingEvents(events: string[]): Promise<void> {
        if (!events || !Array.isArray(events) || events.length === 0) {
            console.info('NWC: No pending events to process');
            return;
        }
        const clientKeys = await this.loadClientKeys();
        for (const eventStr of events) {
            try {
                const { request, connection, eventId } =
                    await this.retryWithBackoff(
                        async () =>
                            await this.validateAndParsePendingEvent(
                                eventStr,
                                clientKeys
                            ),
                        3
                    );
                await this.handleEventRequest(connection, request, eventId);
            } catch (error) {
                console.warn('NWC: PROCESS PENDING EVENTS ERROR', {
                    error,
                    eventStr
                });
                continue;
            }
        }
    }

    private async handleEventRequest(
        connection: NWCConnection,
        request: NWCRequest,
        eventId: string
    ): Promise<void> {
        let response;
        try {
            switch (request.method) {
                case 'pay_invoice':
                    response = await this.handlePayInvoice(
                        connection,
                        request.params
                    );
                    break;
                case 'pay_keysend':
                    response = await this.handlePayKeysend(
                        connection,
                        request.params
                    );
                    break;
                default:
                    return;
            }
        } catch (error) {
            console.warn('NWC: Failed to handle event request', {
                error,
                request,
                connection,
                eventId
            });
        }
        await this.publishEventToClient(
            connection,
            request.method,
            response,
            eventId
        );
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
            created_at: Math.floor(Date.now() / 1000),
            pubkey: servicePublicKey
        };
        const signedEvent = {
            ...unsignedEvent,
            id: getEventHash(unsignedEvent),
            sig: getSignature(unsignedEvent, servicePrivateKey)
        };

        await this.retryWithBackoff(async () => {
            const relay = relayInit(connection.relayUrl);
            await relay.connect();
            try {
                await relay.publish(signedEvent);
            } finally {
                relay.close();
            }
        }, MAX_RELAY_ATTEMPTS);
    }
    // For IOS server handoff
    @action
    public sendHandoffRequest = async (): Promise<boolean> => {
        try {
            const deviceToken = this.lightningAddressStore.currentDeviceToken;
            if (!deviceToken) {
                console.warn(
                    'NWC: Cannot send handoff request - device token not available '
                );
                return false;
            }
            const handoffData = {
                device_token: deviceToken,
                connections: this.activeConnections.map((conn) => ({
                    relay: conn.relayUrl,
                    pubkey: conn.pubkey,
                    name: conn.name
                }))
            };
            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                FETCH_TIMEOUT_MS
            );
            const response = await fetch(
                `${NWC_IOS_EVENTS_LISTENER_SERVER_URL}/handoff`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(handoffData),
                    signal: controller.signal
                }
            );

            clearTimeout(timeoutId);

            if (response.ok) {
                console.info('Handoff request sent successfully');
                return true;
            } else {
                console.info('Handoff request failed');
                return false;
            }
        } catch (error) {
            console.error('NWC: Failed to send handoff request:', error);
            return false;
        }
    };

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
        throw new Error('Max retries reached');
    }
}
