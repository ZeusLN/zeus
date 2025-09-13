// Ensure TextDecoder is available before any nostr-tools imports
if (typeof global !== 'undefined' && !global.TextDecoder) {
    const TextEncodingPolyfill = require('text-encoding');
    global.TextDecoder = TextEncodingPolyfill.TextDecoder;
    global.TextEncoder = TextEncodingPolyfill.TextEncoder;
}

import 'websocket-polyfill';
import { action, observable, runInAction } from 'mobx';
import { nwc } from '@getalby/sdk';
import { getPublicKey, generatePrivateKey } from 'nostr-tools';
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

export const DEFAULT_NOSTR_RELAYS = [
    // 'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.getalby.com/v1',
    'wss://relay.damus.io'
];

interface ClientKeys {
    [pubkey: string]: string;
}

interface WalletServiceKeys {
    privateKey: string;
    publicKey: string;
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

    settingsStore: SettingsStore;
    balanceStore: BalanceStore;
    nodeInfoStore: NodeInfoStore;
    transactionsStore: TransactionsStore;
    cashuStore: CashuStore;
    invoicesStore: InvoicesStore;
    messageSignStore: MessageSignStore;

    constructor(
        settingsStore: SettingsStore,
        balanceStore: BalanceStore,
        nodeInfoStore: NodeInfoStore,
        transactionsStore: TransactionsStore,
        cashuStore: CashuStore,
        invoicesStore: InvoicesStore,
        messageSignStore: MessageSignStore
    ) {
        this.settingsStore = settingsStore;
        this.balanceStore = balanceStore;
        this.nodeInfoStore = nodeInfoStore;
        this.transactionsStore = transactionsStore;
        this.cashuStore = cashuStore;
        this.invoicesStore = invoicesStore;
        this.messageSignStore = messageSignStore;
        this.initializeServiceWithRetry();
    }

    @action
    public reset = () => {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        if (this.connectionRetryInterval) {
            clearInterval(this.connectionRetryInterval);
            this.connectionRetryInterval = null;
        }
        this.connections = [];
        this.activeSubscriptions.clear();
        this.nwcWalletServices.clear();
        this.clearPublishedRelays();
        this.error = false;
        this.errorMessage = '';
        this.loading = false;
        this.initializing = false;
        this.loadingMsg = undefined;
        this.relayConnected = false;
        this.relayConnectionAttempts = 0;
        this.lastConnectionAttempt = 0;
        this.cashuEnabled = false;
        this.persistentNWCServiceEnabled = false;
    };

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
                console.log(
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
                    'views.Settings.NostrWalletConnect.failedToStoreServiceKeys'
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
                    'views.Settings.NostrWalletConnect.failedToSavePersistentServiceSetting'
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
                    'views.Settings.NostrWalletConnect.failedToSaveCashuSetting'
                )
            );
        }
    }

    private async initializeWalletServiceKeys(): Promise<void> {
        let keys = await this.loadWalletServiceKeys();
        if (!keys) {
            keys = this.generateWalletServiceKeys();
            await this.saveWalletServiceKeys(keys);
        }
        runInAction(() => {
            this.walletServiceKeys = keys;
            // Clear published relays when wallet service keys change
            this.clearPublishedRelays();
        });
    }

    @action
    public initializeServiceWithRetry = async () => {
        const maxAttempts = 5;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            console.log(
                `Attempting to connect to NWC relay ${
                    attempt + 1
                }/${maxAttempts}`
            );
            runInAction(() => {
                this.relayConnectionAttempts = attempt + 1;
            });
            try {
                let successfulRelays = 0;
                for (const relayUrl of DEFAULT_NOSTR_RELAYS) {
                    // Skip if this relay is already initialized
                    if (this.nwcWalletServices.has(relayUrl)) {
                        console.log(
                            `NWC: Relay ${relayUrl} already initialized, skipping`
                        );
                        successfulRelays++;
                        continue;
                    }

                    try {
                        console.log(
                            'Initializing NWC Wallet Service for relay:',
                            relayUrl
                        );
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
                            'views.Settings.NostrWalletConnect.failedToInitializeRelays'
                        )
                    );
                }
                await this.initializeService();
                runInAction(() => {
                    this.relayConnected = true;
                });
                return;
            } catch (error: any) {
                console.warn(`Failed to connect to relay:`, error);

                if (attempt === maxAttempts - 1) {
                    runInAction(() => {
                        this.error = true;
                        this.errorMessage = localeString(
                            'views.Settings.NostrWalletConnect.errors.failedToConnectToRelay'
                        ).replace(
                            '{error}',
                            error instanceof Error
                                ? error.message
                                : String(error)
                        );
                        this.relayConnected = false;
                    });
                } else {
                    // Longer delay on Android to account for background service startup
                    const delay = Platform.OS === 'android' ? 2000 : 1000;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
    };

    @action
    private initializeService = async () => {
        runInAction(() => {
            this.initializing = true;
            this.loadingMsg = localeString(
                'views.Settings.NostrWalletConnect.initializingService'
            );
        });

        try {
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
                this.error = true;
                this.errorMessage =
                    (error instanceof Error ? error.message : String(error)) ||
                    localeString(
                        'views.Settings.NostrWalletConnect.failedToInitializeService'
                    );
                this.initializing = false;
                this.loadingMsg = undefined;
            });
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
                        'views.Settings.NostrWalletConnect.walletServiceKeyNotFound'
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
                        'views.Settings.NostrWalletConnect.failedToPublishToRelays'
                    )
                );
            }
            console.log(
                `Successfully published to ${successfulPublishes}/${this.nwcWalletServices.size} relays`
            );

            await this.subscribeToAllConnections();

            if (hasActiveConnections && this.persistentNWCServiceEnabled) {
                this.setupPlatformSpecificMonitoring();
            }
        } catch (error: any) {
            console.error('Failed to start NWC service:', error);
            runInAction(() => {
                this.error = true;
                this.errorMessage =
                    (error instanceof Error ? error.message : String(error)) ||
                    localeString(
                        'views.Settings.NostrWalletConnect.failedToStartService'
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
            // Skip if already published to this relay
            if (this.publishedRelays.has(relayUrl)) {
                console.log(`Skipping already published relay: ${relayUrl}`);
                return;
            }
            try {
                const success = await this.publishWithRetry(
                    nwcWalletService,
                    relayUrl,
                    this.walletServiceKeys!.privateKey
                );
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

    @action
    private clearPublishedRelays(): void {
        this.publishedRelays.clear();
    }

    @action
    public forceRepublishToAllRelays = async (): Promise<number> => {
        this.clearPublishedRelays();
        return await this.publishToAllRelays();
    };

    public getPublishedRelaysStatus(): { published: string[]; total: number } {
        return {
            published: Array.from(this.publishedRelays),
            total: this.nwcWalletServices.size
        };
    }

    private setupPlatformSpecificMonitoring(): void {
        // Platform-specific health checks
        this.setupHealthChecks();

        // Android-specific connection monitoring
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
        }, 60000); // Check every minute on Android
    }

    private async verifyServiceHealth(): Promise<void> {
        if (!this.walletServiceKeys?.privateKey) {
            throw new Error(
                localeString(
                    'views.Settings.NostrWalletConnect.walletServiceKeysNotInitialized'
                )
            );
        }
        if (this.nwcWalletServices.size === 0) {
            throw new Error(
                localeString(
                    'views.Settings.NostrWalletConnect.noRelaysAvailable'
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
        }, 10 * 60 * 1000); // 10 minutes - less frequent
    }

    private async subscribeWithPlatformHandling(
        nwcWalletService: nwc.NWCWalletService,
        keypair: nwc.NWCWalletServiceKeyPair,
        handler: NWCWalletServiceRequestHandler,
        connection: NWCConnection
    ): Promise<() => void> {
        // Platform-specific subscription logic
        if (Platform.OS === 'android') {
            return await this.subscribeWithAndroidRetry(
                nwcWalletService,
                keypair,
                handler,
                connection
            );
        } else {
            // iOS: Direct subscription (more stable)
            return await nwcWalletService.subscribe(keypair, handler);
        }
    }

    private async subscribeWithAndroidRetry(
        nwcWalletService: nwc.NWCWalletService,
        keypair: nwc.NWCWalletServiceKeyPair,
        handler: NWCWalletServiceRequestHandler,
        connection: NWCConnection
    ): Promise<() => void> {
        const maxRetries = 3;
        let lastError: any;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const unsubscribe = await nwcWalletService.subscribe(
                    keypair,
                    handler
                );

                return unsubscribe;
            } catch (error: any) {
                lastError = error;
                console.warn(
                    `Android: Subscription attempt ${attempt + 1} failed for ${
                        connection.name
                    }:`,
                    error?.message || String(error)
                );

                if (attempt < maxRetries - 1) {
                    // Exponential backoff for Android
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }

        throw (
            lastError ||
            new Error(
                localeString(
                    'views.Settings.NostrWalletConnect.failedToSubscribeAfterRetries'
                )
            )
        );
    }

    public isServiceReady(): boolean {
        return (
            this.walletServiceKeys?.privateKey !== undefined &&
            this.nwcWalletServices.size > 0 &&
            !this.error
        );
    }
    private isCashuProperlyConfigured(): boolean {
        return this.cashuEnabled && this.cashuStore.isProperlyConfigured();
    }

    public async forceReconnectConnection(
        connectionId: string
    ): Promise<boolean> {
        const connection = this.getConnection(connectionId);
        if (!connection) {
            console.error(`NWC: Connection ${connectionId} not found`);
            return false;
        }

        try {
            console.log(
                `NWC: Force reconnecting connection ${connection.name}`
            );
            await this.unsubscribeFromConnection(connectionId);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await this.subscribeToConnection(connection);

            console.log(
                `NWC: Successfully reconnected connection ${connection.name}`
            );
            return true;
        } catch (error) {
            console.error(
                `NWC: Failed to reconnect connection ${connection.name}:`,
                error
            );
            return false;
        }
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
                        'views.Settings.NostrWalletConnect.failedToStopService'
                    );
            });
            return false;
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    private async publishWithRetry(
        nwcWalletService: nwc.NWCWalletService,
        relayUrl: string,
        privateKey: string,
        maxRetries: number = 3
    ): Promise<boolean> {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                await nwcWalletService.publishWalletServiceInfoEvent(
                    privateKey,
                    NostrConnectUtils.getFullAccessPermissions(),
                    NostrConnectUtils.getNotifications()
                );
                return true;
            } catch (error: any) {
                console.error(
                    `NWC: Failed to publish to ${relayUrl} (attempt ${
                        attempt + 1
                    }/${maxRetries}):`,
                    error?.message || error
                );

                // Simple retry without backoff
                if (attempt < maxRetries - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    continue;
                }
                throw error;
            }
        }
        return false;
    }

    private generateConnectionSecretUrl(
        connectionPrivateKey: string,
        relayUrl: string
    ): string {
        if (!this.walletServiceKeys?.publicKey) {
            throw new Error(
                localeString(
                    'views.Settings.NostrWalletConnect.walletServicePublicKeyNotAvailable'
                )
            );
        }
        const connectionString = `nostr+walletconnect://${
            this.walletServiceKeys.publicKey
        }?relay=${encodeURIComponent(relayUrl)}&secret=${connectionPrivateKey}`;
        return connectionString;
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
                    'views.Settings.NostrWalletConnect.failedToStorePrivateKey'
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
                this.error = true;
                this.errorMessage = localeString(
                    'views.Settings.NostrWalletConnect.failedToLoadConnections'
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
                this.error = true;
                this.errorMessage = localeString(
                    'views.Settings.NostrWalletConnect.failedToLoadConnections'
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
                this.error = true;
                this.errorMessage = localeString(
                    'views.Settings.NostrWalletConnect.failedToSaveConnections'
                );
            });
        }
    };

    @action
    public createConnection = async (
        params: CreateConnectionParams
    ): Promise<string | null> => {
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
                        'views.Settings.NostrWalletConnect.relayNotAvailable'
                    )
                        .replace('{relayUrl}', params.relayUrl)
                        .replace(
                            '{availableRelays}',
                            this.availableRelays.join(', ')
                        )
                );
            }

            const connectionId = uuidv4();
            const connectionPrivateKey = generatePrivateKey();
            const connectionPublicKey = getPublicKey(connectionPrivateKey);
            const nostrUrl = this.generateConnectionSecretUrl(
                connectionPrivateKey,
                params.relayUrl
            );

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
            return nostrUrl;
        } catch (error: any) {
            throw error;
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

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
                        'views.Settings.NostrWalletConnect.failedToDeleteConnection'
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
                        'views.Settings.NostrWalletConnect.failedToUpdateConnection'
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
                            'views.Settings.NostrWalletConnect.errors.paymentExceedsBudget'
                        )
                            .replace('{amount}', amountSats.toString())
                            .replace('{remaining}', remainingBudget.toString())
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
        for (const connection of activeConnections) {
            await this.subscribeToConnection(connection);
        }
    }
    private async subscribeToConnection(
        connection: NWCConnection
    ): Promise<void> {
        if (!this.isServiceReady()) {
            console.warn(
                `NWC: Service not ready, cannot subscribe to connection ${connection.name}`
            );
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
                        'views.Settings.NostrWalletConnect.nwcWalletServiceNotFound'
                    ).replace('{relayUrl}', connection.relayUrl)
                );
            }
            // Platform-specific subscription handling
            const unsubscribe = await this.subscribeWithPlatformHandling(
                nwcWalletService,
                keypair,
                handler,
                connection
            );

            runInAction(() => {
                this.activeSubscriptions.set(connection.id, unsubscribe);
            });

            console.log(
                `NWC: Successfully subscribed to connection ${connection.name}`
            );
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
            return this.handleError(error, 'INTERNAL_ERROR');
        }
    }

    private async handleGetBalance(
        connection: NWCConnection
    ): NWCWalletServiceResponsePromise<Nip47GetBalanceResponse> {
        this.markConnectionUsed(connection.id);
        console.log('calling handleGetBalance for connection', connection.name);
        try {
            const balance = this.isCashuProperlyConfigured()
                ? this.cashuStore.totalBalanceSats
                : (await this.balanceStore.getLightningBalance(true))
                      ?.lightningBalance;

            return {
                result: {
                    balance: Number(balance) * 1000
                },
                error: undefined
            };
        } catch (error) {
            return this.handleError(error, 'INTERNAL_ERROR');
        }
    }

    private async handlePayInvoice(
        connection: NWCConnection,
        request: Nip47PayInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47PayResponse> {
        this.markConnectionUsed(connection.id);
        console.log('calling handlePayInvoice for connection', connection.name);
        try {
            if (this.isCashuProperlyConfigured()) {
                if (!this.cashuStore.selectedMintUrl) {
                    return this.handleError(
                        new Error(
                            localeString(
                                'views.Settings.NostrWalletConnect.errors.noCashuMintSelected'
                            )
                        ),
                        'INTERNAL_ERROR'
                    );
                }
                await this.cashuStore.getPayReq(request.invoice);
                const invoice = this.cashuStore.payReq;
                const error = this.cashuStore.getPayReqError;

                if (error) {
                    return this.handleError(
                        new Error(error),
                        'INVALID_INVOICE'
                    );
                }
                if (!invoice) {
                    return this.handleError(
                        new Error(
                            localeString(
                                'views.Settings.NostrWalletConnect.errors.failedToDecodeInvoice'
                            )
                        ),
                        'INVALID_INVOICE'
                    );
                }
                if (invoice.isPaid) {
                    return this.handleError(
                        new Error(
                            localeString(
                                'views.Settings.NostrWalletConnect.errors.invoiceAlreadyPaid'
                            )
                        ),
                        'INVALID_INVOICE'
                    );
                }
                if (invoice.isExpired) {
                    return this.handleError(
                        new Error(
                            localeString(
                                'views.Settings.NostrWalletConnect.errors.invoiceExpired'
                            )
                        ),
                        'INVALID_INVOICE'
                    );
                }
                if (
                    !invoice.getPaymentRequest ||
                    invoice.getPaymentRequest.trim() === ''
                ) {
                    return this.handleError(
                        new Error(
                            localeString(
                                'views.Settings.NostrWalletConnect.errors.invalidPaymentRequest'
                            )
                        ),
                        'INVALID_INVOICE'
                    );
                }
                let amount = 0;
                if (invoice.getAmount && invoice.getAmount > 0) {
                    amount = invoice.getAmount;
                } else if ((invoice as any).satoshis) {
                    amount = (invoice as any).satoshis;
                } else if ((invoice as any).millisatoshis) {
                    amount = Number((invoice as any).millisatoshis) / 1000;
                }
                if (!amount || amount <= 0) {
                    return {
                        result: undefined,
                        error: {
                            code: 'INVALID_INVOICE',
                            message: localeString(
                                'views.Settings.NostrWalletConnect.errors.invalidAmount'
                            )
                        }
                    };
                }
                const currentBalance = this.cashuStore.totalBalanceSats || 0;
                if (currentBalance < amount) {
                    return {
                        result: undefined,
                        error: {
                            code: 'INSUFFICIENT_BALANCE',
                            message: localeString(
                                'views.Settings.NostrWalletConnect.errors.insufficientBalance'
                            )
                                .replace('{amount}', amount.toString())
                                .replace('{balance}', currentBalance.toString())
                        }
                    };
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
                        fees_paid: (cashuInvoice?.fee || 0) * 1000 // Convert satoshis to millisatoshis
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
                                'views.Settings.NostrWalletConnect.errors.invoiceExpired'
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
                return {
                    result: undefined,
                    error: {
                        code: 'INSUFFICIENT_BALANCE',
                        message: localeString(
                            'views.Settings.NostrWalletConnect.errors.insufficientBalance'
                        )
                            .replace('{amount}', amountSats.toString())
                            .replace(
                                '{balance}',
                                currentLightningBalance.toString()
                            )
                    }
                };
            }

            await this.manageBudget(connection.id, amountSats, 'validate');
            await this.transactionsStore.sendPayment({
                payment_request: request.invoice,
                fee_limit_sat: '1000',
                timeout_seconds: '120'
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
            if (this.transactionsStore.payment_error) {
                return this.handleError(
                    new Error(this.transactionsStore.payment_error),
                    'FAILED_TO_PAY_INVOICE'
                );
            }
            const preimage = this.transactionsStore.payment_preimage;
            const fees_paid = this.transactionsStore.payment_fee;
            await this.manageBudget(connection.id, amountSats, 'track');
            return {
                result: {
                    preimage: preimage || '',
                    fees_paid: Math.floor((Number(fees_paid) || 0) * 1000)
                },
                error: undefined
            };
        } catch (error: any) {
            return this.handleError(error, 'INTERNAL_ERROR');
        }
    }

    private async handleMakeInvoice(
        connection: NWCConnection,
        request: Nip47MakeInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        this.markConnectionUsed(connection.id);
        console.log('handleMakeInvoice', request);
        console.log(
            'calling handleMakeInvoice for connection',
            connection.name
        );
        try {
            if (this.isCashuProperlyConfigured()) {
                try {
                    const cashuInvoice = await this.cashuStore.createInvoice({
                        value: Math.floor(request.amount / 1000).toString(),
                        memo: request.description || ''
                    });

                    if (!cashuInvoice || !cashuInvoice.paymentRequest) {
                        throw new Error(
                            localeString(
                                'views.Settings.NostrWalletConnect.failedToCreateCashuInvoice'
                            )
                        );
                    }

                    let paymentHash = '';
                    let descriptionHash = '';
                    let expiryTime =
                        Math.floor(Date.now() / 1000) +
                        (request.expiry || 3600);

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
                        return this.handleError(decodeError, 'INVALID_INVOICE');
                    }

                    this.showInvoiceCreatedNotification(
                        Math.floor(request.amount / 1000),
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
                        cashuError,
                        'FAILED_TO_CREATE_INVOICE'
                    );
                }
            }
            const invoice = await this.invoicesStore.createInvoice({
                value: Math.floor(request.amount / 1000).toString(),
                memo: request.description || '',
                expirySeconds: String(request.expiry || 3600)
            });

            this.showInvoiceCreatedNotification(
                Math.floor(request.amount / 1000),
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
            return this.handleError(error, 'INTERNAL_ERROR');
        }
    }

    private async handleLookupInvoice(
        connection: NWCConnection,
        request: Nip47LookupInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        console.log('handleLookupInvoice', request);
        this.markConnectionUsed(connection.id);
        console.log(
            'calling handleLookupInvoice for connection',
            connection.name
        );
        try {
            let paymentHash = this.convertPaymentHashToHex(
                request.payment_hash!
            );
            if (this.isCashuProperlyConfigured()) {
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
                        Number(matchingInvoice.expires_at) || timestamp + 3600;

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
                        amount: Math.floor((amtSat || 0) * 1000),
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
                        new Error(
                            localeString(
                                'views.Settings.NostrWalletConnect.errors.invoiceNotFound'
                            )
                        ),
                        'NOT_FOUND'
                    );
                }
            } else {
                const rawInvoice = await BackendUtils.lookupInvoice({
                    r_hash: paymentHash
                });
                console.log('handleLookupInvoice rawInvoice', rawInvoice);

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
                    amount: Math.floor(invoice.getAmount * 1000), // Convert to msats
                    fees_paid: 0,
                    settled_at: invoice.isPaid
                        ? Math.floor(invoice.settleDate.getTime() / 1000)
                        : 0,
                    created_at: Math.floor(
                        invoice.getCreationDate.getTime() / 1000
                    ),
                    expires_at: invoice.isExpired
                        ? Math.floor(Date.now() / 1000) + 3600
                        : Math.floor(invoice.getCreationDate.getTime() / 1000) +
                          (Number(invoice.expiry) || 3600)
                };
                return {
                    result,
                    error: undefined
                };
            }
        } catch (error) {
            return this.handleError(error, 'NOT_FOUND');
        }
    }

    private async handleListTransactions(
        connection: NWCConnection,
        request: Nip47ListTransactionsRequest
    ): NWCWalletServiceResponsePromise<Nip47ListTransactionsResponse> {
        this.markConnectionUsed(connection.id);
        console.log(
            'calling handleListTransactions for connection',
            connection.name
        );
        try {
            let nip47Transactions: Nip47Transaction[] = [];

            if (this.isCashuProperlyConfigured()) {
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
                                (Number(payment.getAmount) || 0) * 1000
                            ), // Convert to msats
                            fees_paid: Math.floor(
                                (Number(payment.getFee) || 0) * 1000
                            ), // Convert to msats
                            settled_at: Math.floor(timestamp),
                            created_at: Math.floor(timestamp),
                            expires_at: Math.floor(timestamp + 3600)
                        };
                    });

                // Convert Cashu invoices to NIP-47 transactions
                const cashuInvoiceTransactions: Nip47Transaction[] =
                    cashuInvoices.map((invoice) => {
                        const timestamp =
                            Number(invoice.getTimestamp) || Date.now() / 1000;
                        const expiresAt =
                            Number(invoice.expires_at) || timestamp + 3600;
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
                            amount: Math.floor((invoice.getAmount || 0) * 1000), // Convert to msats
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
                            amount: Math.floor((token.getAmount || 0) * 1000), // Convert to msats
                            fees_paid: 0,
                            settled_at: Math.floor(receivedAt),
                            created_at: Math.floor(createdAt),
                            expires_at: Math.floor(createdAt + 3600)
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
                            amount: Math.floor((token.getAmount || 0) * 1000), // Convert to msats
                            fees_paid: 0,
                            settled_at: token.spent
                                ? Math.floor(Date.now() / 1000)
                                : 0,
                            created_at: Math.floor(createdAt),
                            expires_at: Math.floor(createdAt + 3600)
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
                        const amountMsats = Math.abs(amount) * 1000;
                        const feesMsats = Math.floor(
                            (Number(tx.total_fees) || 0) * 1000
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
                            expires_at: timestamp + 3600,
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
            return this.handleError(error, 'INTERNAL_ERROR');
        }
    }

    private async handlePayKeysend(
        connection: NWCConnection,
        request: Nip47PayKeysendRequest
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        this.markConnectionUsed(connection.id);
        console.log('calling handlePayKeysend for connection', connection.name);
        try {
            const amountSats = Math.floor(request.amount / 1000);
            await this.manageBudget(connection.id, amountSats, 'validate');

            let result;
            if (this.isCashuProperlyConfigured()) {
                return this.handleError(
                    new Error(
                        localeString(
                            'views.Settings.NostrWalletConnect.errors.keysendNotSupportedForCashu'
                        )
                    ),
                    'NOT_IMPLEMENTED'
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
                    fees_paid: Math.floor((result.fee || 0) * 1000),
                    settled_at: Math.floor(Date.now() / 1000),
                    created_at: Math.floor(Date.now() / 1000),
                    expires_at: Math.floor(Date.now() / 1000) + 3600
                },
                error: undefined
            };
        } catch (error: any) {
            return this.handleError(error, 'SEND_KEYSEND_FAILED');
        }
    }

    private async handleSignMessage(
        connection: NWCConnection,
        request: Nip47SignMessageRequest
    ): NWCWalletServiceResponsePromise<Nip47SignMessageResponse> {
        this.markConnectionUsed(connection.id);
        try {
            if (this.isCashuProperlyConfigured()) {
                const selectedMintUrl = this.cashuStore.selectedMintUrl;
                const wallet = this.cashuStore.cashuWallets[selectedMintUrl];

                if (!wallet || !wallet.wallet) {
                    return this.handleError(
                        new Error(
                            localeString(
                                'views.Settings.NostrWalletConnect.errors.cashuWalletNotInitialized'
                            )
                        ),
                        'INTERNAL_ERROR'
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
            return this.handleError(error, 'INTERNAL_ERROR');
        }
    }

    private async unsubscribeFromConnection(
        connectionId: string
    ): Promise<void> {
        const unsub = this.activeSubscriptions.get(connectionId);
        if (unsub) {
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

    @action
    public retryRelayConnection = async (): Promise<boolean> => {
        runInAction(() => {
            this.relayConnected = false;
            this.relayConnectionAttempts = 0;
            this.error = false;
            this.errorMessage = '';
        });

        try {
            await this.initializeServiceWithRetry();
            return this.relayConnected;
        } catch (error: any) {
            console.error('Manual retry failed:', error);
            return false;
        }
    };

    private showPaymentSentNotification(
        amountSats: number,
        connectionName: string
    ): void {
        const value = amountSats.toString();
        const value_commas = value.replace(
            /\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g,
            ','
        );
        const title = 'Payment Sent via Nostr Wallet Connect';
        const body = `Sent ${value_commas} ${
            value_commas === '1' ? 'sat' : 'sats'
        } via ${connectionName}`;

        if (Platform.OS === 'android') {
            // @ts-ignore:next-line
            Notifications.postLocalNotification({
                title,
                body
            });
        }

        if (Platform.OS === 'ios') {
            // @ts-ignore:next-line
            Notifications.postLocalNotification({
                title,
                body,
                sound: 'chime.aiff'
            });
        }
    }

    private showInvoiceCreatedNotification(
        amountSats: number,
        connectionName: string,
        description?: string
    ): void {
        const value = amountSats.toString();
        const value_commas = value.replace(
            /\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g,
            ','
        );

        const title = 'Invoice Created via Nostr Wallet Connect';
        const body = description
            ? `Invoice for ${value_commas} ${
                  value_commas === '1' ? 'sat' : 'sats'
              } created by ${connectionName}: ${description}`
            : `Invoice for ${value_commas} ${
                  value_commas === '1' ? 'sat' : 'sats'
              } created by ${connectionName}`;

        if (Platform.OS === 'android') {
            // @ts-ignore:next-line
            Notifications.postLocalNotification({
                title,
                body
            });
        }

        if (Platform.OS === 'ios') {
            // @ts-ignore:next-line
            Notifications.postLocalNotification({
                title,
                body,
                sound: 'chime.aiff'
            });
        }
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
    private handleError(
        error: any,
        defaultCode: string = 'INTERNAL_ERROR'
    ): {
        result: undefined;
        error: {
            code: string;
            message: string;
        };
    } {
        const errorCode = defaultCode || error.code;
        const errorMessage = String(error) || error.message;

        console.warn('NWC Error:', errorCode, errorMessage);

        return {
            result: undefined,
            error: {
                code: errorCode,
                message: errorMessage
            }
        };
    }
}
