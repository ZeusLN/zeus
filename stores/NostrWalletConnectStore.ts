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
import { Platform } from 'react-native';
import { Notifications } from 'react-native-notifications';

import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import { localeString } from '../utils/LocaleUtils';
import NostrConnectUtils from '../utils/NostrConnectUtils';

import NWCConnection, { BudgetRenewalType } from '../models/NWCConnection';
import Transaction from '../models/Transaction';
import Invoice from '../models/Invoice';

import Storage from '../storage';

import SettingsStore, { DEFAULT_NOSTR_RELAYS } from './SettingsStore';
import BalanceStore from './BalanceStore';
import NodeInfoStore from './NodeInfoStore';
import TransactionsStore from './TransactionsStore';
import CashuStore from './CashuStore';
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
    @observable public initializing = false;
    @observable public loadingMsg?: string;
    @observable public waitingForConnection = false;
    @observable public currentConnectionId?: string;
    @observable public connectionJustSucceeded = false;
    @observable public relayConnectionAttempts: number = 0;
    @observable public relayConnected: boolean = false;
    @observable private walletServiceKeys: WalletServiceKeys | null = null;
    @observable public cashuEnabled: boolean = false;
    @observable private failedRelays: Set<string> = new Set();
    @observable private relayFailureCounts: Map<string, number> = new Map();

    settingsStore: SettingsStore;
    balanceStore: BalanceStore;
    nodeInfoStore: NodeInfoStore;
    transactionsStore: TransactionsStore;
    cashuStore: CashuStore;

    constructor(
        settingsStore: SettingsStore,
        balanceStore: BalanceStore,
        nodeInfoStore: NodeInfoStore,
        transactionsStore: TransactionsStore,
        cashuStore: CashuStore
    ) {
        this.settingsStore = settingsStore;
        this.balanceStore = balanceStore;
        this.nodeInfoStore = nodeInfoStore;
        this.transactionsStore = transactionsStore;
        this.cashuStore = cashuStore;
        this.initializeServiceWithRetry();
    }

    @action
    public reset = () => {
        this.connections = [];
        this.activeSubscriptions.clear();
        this.nwcWalletServices.clear();
        this.error = false;
        this.errorMessage = '';
        this.loading = false;
        this.initializing = false;
        this.loadingMsg = undefined;
        this.relayConnected = false;
        this.relayConnectionAttempts = 0;
        this.walletServiceKeys = null;
        this.cashuEnabled = false;
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
                const keys = this.generateWalletServiceKeys();
                await this.saveWalletServiceKeys(keys);
                return keys;
            }
            return JSON.parse(storedKeys);
        } catch (error) {
            console.error('Failed to load wallet service keys:', error);
            throw new Error('Failed to load wallet service keys');
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
        });
    }

    @action
    private initializeServiceWithRetry = async () => {
        const maxAttempts = 10;
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
                        console.error(
                            `Failed to initialize relay ${relayUrl}:`,
                            relayError
                        );
                    }
                }

                if (successfulRelays === 0) {
                    throw new Error('Failed to initialize any NWC relays');
                }

                await this.initializeService();

                runInAction(() => {
                    this.relayConnected = true;
                });
                return;
            } catch (error: any) {
                console.error(`Failed to connect to relay:`, error);

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
                    // Add longer delay for rate limiting issues
                    const delay = this.isRateLimitedError(error)
                        ? Math.pow(2, attempt) * 2000 // 2x longer delay for rate limiting
                        : Math.pow(2, attempt) * 1000;

                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
    };

    @action
    public initializeService = async () => {
        runInAction(() => {
            this.initializing = true;
            this.loadingMsg = localeString(
                'views.Settings.NostrWalletConnect.initializingService'
            );
        });

        try {
            await this.initializeWalletServiceKeys();
            await this.loadCashuSetting();
            await this.loadConnections();
            await this.checkAndResetAllBudgetsOnInit();
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
                throw new Error(`Wallet service key not found`);
            }

            let successfulPublishes = 0;
            const publishPromises = Array.from(
                this.nwcWalletServices.entries()
            ).map(async ([relayUrl, nwcWalletService]) => {
                try {
                    const success = await this.publishWithRetry(
                        nwcWalletService,
                        relayUrl,
                        this.walletServiceKeys!.privateKey
                    );
                    if (success) {
                        successfulPublishes++;
                        console.log(
                            `Successfully published to relay: ${relayUrl}`
                        );
                    }
                } catch (publishError: any) {
                    const errorMessage =
                        publishError?.message || String(publishError);
                    console.warn(
                        `Failed to publish to relay ${relayUrl}:`,
                        errorMessage
                    );
                    if (this.isRateLimitedError(publishError)) {
                        console.warn(
                            `Relay ${relayUrl} is rate limiting requests`
                        );
                    } else if (this.isRestrictedRelayError(publishError)) {
                        console.warn(
                            `Relay ${relayUrl} requires payment or registration`
                        );
                    } else if (this.isTimeoutError(publishError)) {
                        console.warn(`Relay ${relayUrl} timed out`);
                    }
                }
            });

            await Promise.allSettled(publishPromises);
            if (successfulPublishes === 0) {
                throw new Error(
                    'Failed to publish wallet service info to any relay'
                );
            }

            console.log(
                `Successfully published to ${successfulPublishes}/${this.nwcWalletServices.size} relays`
            );
            await this.subscribeToAllConnections();
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

    @action
    public stopService = async (): Promise<boolean> => {
        try {
            runInAction(() => {
                this.loading = true;
                this.error = false;
            });

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
                if (this.isRateLimitedError(error)) {
                    console.warn(
                        `Relay ${relayUrl} rate limited (attempt ${
                            attempt + 1
                        }/${maxRetries})`
                    );
                    if (attempt < maxRetries - 1) {
                        const delay = Math.pow(2, attempt) * 1000;
                        await new Promise((resolve) =>
                            setTimeout(resolve, delay)
                        );
                        continue;
                    }
                }
                throw error;
            }
        }
        return false;
    }

    private generateConnectionId(): string {
        return (
            Date.now().toString(36) + Math.random().toString(36).substring(2)
        );
    }

    private generateConnectionString(
        connectionPrivateKey: string,
        relayUrl: string
    ): string {
        return `nostr+walletconnect://${this.walletServiceKeys?.publicKey}?relay=${relayUrl}&secret=${connectionPrivateKey}`;
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
                    `Relay ${
                        params.relayUrl
                    } is not available. Available relays: ${this.availableRelays.join(
                        ', '
                    )}`
                );
            }

            const connectionId = this.generateConnectionId();
            const connectionPrivateKey = generatePrivateKey();
            const connectionPublicKey = getPublicKey(connectionPrivateKey);
            const nostrUrl = this.generateConnectionString(
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
                const oldMaxAmountSats = connection.maxAmountSats;
                const newBudgetRenewal = updates.budgetRenewal;
                const newMaxAmountSats = updates.maxAmountSats;

                Object.assign(connection, updates);

                const hadBudget =
                    oldMaxAmountSats !== undefined && oldMaxAmountSats > 0;
                const hasBudget =
                    newMaxAmountSats !== undefined && newMaxAmountSats > 0;
                const budgetRenewalChanged =
                    newBudgetRenewal !== undefined &&
                    newBudgetRenewal !== oldBudgetRenewal;

                if (!hadBudget && hasBudget) {
                    connection.lastBudgetReset = new Date();
                } else if (hadBudget && !hasBudget) {
                    connection.lastBudgetReset = undefined;
                    connection.totalSpendSats = 0;
                } else if (hasBudget && budgetRenewalChanged) {
                    connection.lastBudgetReset = new Date();
                    connection.totalSpendSats = 0;
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
    public markConnectionUsed = async (connectionId: string) => {
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
    public checkAndResetBudgetIfNeeded = async (
        connectionId: string
    ): Promise<void> => {
        const connection = this.getConnection(connectionId);
        if (!connection) return;

        if (connection.needsBudgetReset) {
            connection.resetBudget();
            await this.saveConnections();
        }
    };

    @action
    public checkAndResetAllBudgetsOnInit = async (): Promise<void> => {
        await this.checkAndResetAllBudgets();
    };

    @action
    public checkAndResetAllBudgets = async (): Promise<void> => {
        let budgetsReset = 0;

        runInAction(() => {
            for (const connection of this.connections) {
                if (connection.needsBudgetReset) {
                    budgetsReset++;
                    connection.resetBudget();
                }
            }
        });

        if (budgetsReset > 0) {
            await this.saveConnections();
        }
    };

    @action
    public trackSpending = async (
        connectionId: string,
        amountSats: number
    ): Promise<void> => {
        const connection = this.getConnection(connectionId);
        if (!connection) return;

        await this.checkAndResetBudgetIfNeeded(connectionId);

        connection.totalSpendSats =
            Number(connection.totalSpendSats) + Number(amountSats);
        await this.saveConnections();
    };

    public validateBudgetForPayment = async (
        connectionId: string,
        amountSats: number
    ): Promise<{ canProceed: boolean; error?: string }> => {
        const connection = this.getConnection(connectionId);
        if (!connection) {
            return {
                canProceed: false,
                error: localeString(
                    'views.Settings.NostrWalletConnect.connectionNotFound'
                )
            };
        }

        await this.checkAndResetBudgetIfNeeded(connectionId);

        if (!connection.hasBudgetLimit) {
            return { canProceed: true };
        }

        if (!connection.canSpend(amountSats)) {
            const remainingBudget = connection.remainingBudget;
            return {
                canProceed: false,
                error: localeString(
                    'views.Settings.NostrWalletConnect.errors.paymentExceedsBudget'
                )
                    .replace('{amount}', amountSats.toString())
                    .replace('{remaining}', remainingBudget.toString())
            };
        }

        return { canProceed: true };
    };

    private async subscribeToAllConnections(): Promise<void> {
        const activeConnections = this.connections.filter((c) => !c.isExpired);
        for (const connection of activeConnections) {
            await this.subscribeToConnection(connection);
        }
    }

    private hasPermission(
        connection: NWCConnection,
        permission: Nip47SingleMethod
    ): boolean {
        return connection.permissions.includes(permission);
    }

    private async subscribeToConnection(
        connection: NWCConnection
    ): Promise<void> {
        // Check if relay is marked as failed
        if (this.isRelayFailed(connection.relayUrl)) {
            console.log(
                `Skipping failed relay ${connection.relayUrl} for connection ${connection.name}`
            );
            return;
        }

        if (!this.shouldRetryRelay(connection.relayUrl)) {
            console.log(
                `Max retries exceeded for relay ${connection.relayUrl}, skipping connection ${connection.name}`
            );
            return;
        }
        try {
            await this.unsubscribeFromConnection(connection.id);
            const serviceSecretKey = this.walletServiceKeys?.privateKey;

            if (!serviceSecretKey) {
                throw new Error(`Wallet service key not found`);
            }

            const keypair = new nwc.NWCWalletServiceKeyPair(
                serviceSecretKey,
                connection.pubkey
            );
            const handler: NWCWalletServiceRequestHandler = {};

            if (this.hasPermission(connection, 'get_info')) {
                handler.getInfo = () => this.handleGetInfo(connection);
            }

            if (this.hasPermission(connection, 'get_balance')) {
                handler.getBalance = () => this.handleGetBalance(connection);
            }

            if (this.hasPermission(connection, 'pay_invoice')) {
                handler.payInvoice = (request: Nip47PayInvoiceRequest) =>
                    this.handlePayInvoice(connection, request);
            }

            if (this.hasPermission(connection, 'make_invoice')) {
                handler.makeInvoice = (request: Nip47MakeInvoiceRequest) =>
                    this.handleMakeInvoice(connection, request);
            }

            if (this.hasPermission(connection, 'lookup_invoice')) {
                handler.lookupInvoice = (request: Nip47LookupInvoiceRequest) =>
                    this.handleLookupInvoice(connection, request);
            }

            if (this.hasPermission(connection, 'list_transactions')) {
                handler.listTransactions = (
                    request: Nip47ListTransactionsRequest
                ) => this.handleListTransactions(connection, request);
            }

            if (this.hasPermission(connection, 'pay_keysend')) {
                handler.payKeysend = (request: Nip47PayKeysendRequest) =>
                    this.handlePayKeysend(connection, request);
            }

            if (this.hasPermission(connection, 'sign_message')) {
                handler.signMessage = (request: Nip47SignMessageRequest) =>
                    this.handleSignMessage(connection, request);
            }

            const nwcWalletService = this.nwcWalletServices.get(
                connection.relayUrl
            );
            if (!nwcWalletService) {
                throw new Error(
                    `NWC Wallet Service not found for relay: ${connection.relayUrl}`
                );
            }
            const unsubscribe = await nwcWalletService.subscribe(
                keypair,
                handler
            );
            runInAction(() => {
                this.activeSubscriptions.set(connection.id, unsubscribe);
            });

            console.log(
                `NWC: Successfully subscribed to connection ${connection.name}`
            );

            // Reset failure count on successful connection
            this.relayFailureCounts.delete(connection.relayUrl);
            this.failedRelays.delete(connection.relayUrl);
        } catch (error: any) {
            const errorMessage = error?.message || String(error);
            console.error(
                `Failed to subscribe to connection ${connection.name}:`,
                errorMessage
            );

            // Mark relay as failed and implement backoff
            this.markRelayAsFailed(connection.relayUrl);

            if (this.isRateLimitedError(error)) {
                await this.handleRateLimitedConnection(connection, error);
            } else {
                // For other errors, implement backoff
                const backoffDelay = this.getRelayBackoffDelay(
                    connection.relayUrl
                );
                console.log(
                    `Scheduling retry for connection ${connection.name} in ${
                        backoffDelay / 1000
                    } seconds`
                );

                setTimeout(async () => {
                    if (this.shouldRetryRelay(connection.relayUrl)) {
                        await this.subscribeToConnection(connection);
                    }
                }, backoffDelay);
            }
        }
    }

    private async handleGetInfo(
        connection: NWCConnection
    ): NWCWalletServiceResponsePromise<Nip47GetInfoResponse> {
        console.log('handleGetInfo', connection.id);
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
            return {
                result: undefined,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: localeString(
                        'views.Settings.NostrWalletConnect.errors.failedToGetNodeInfo'
                    ).replace('{error}', String(error))
                }
            };
        }
    }

    private async handleGetBalance(
        connection: NWCConnection
    ): NWCWalletServiceResponsePromise<Nip47GetBalanceResponse> {
        this.markConnectionUsed(connection.id);
        console.log('handleGetBalance', connection.id);
        try {
            const balance = this.cashuEnabled
                ? this.cashuStore.totalBalanceSats
                : (await this.balanceStore.getLightningBalance(true))
                      ?.lightningBalance;
            console.log('balance', balance);
            return {
                result: {
                    balance: Number(balance) * 1000
                },
                error: undefined
            };
        } catch (error) {
            return {
                result: undefined,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: localeString(
                        'views.Settings.NostrWalletConnect.errors.failedToGetBalance'
                    ).replace('{error}', String(error))
                }
            };
        }
    }

    private async handlePayInvoice(
        connection: NWCConnection,
        request: Nip47PayInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47PayResponse> {
        this.markConnectionUsed(connection.id);
        console.log('handlePayInvoice', connection.id);
        try {
            if (this.cashuEnabled) {
                if (!this.cashuStore.selectedMintUrl) {
                    return {
                        result: undefined,
                        error: {
                            code: 'INTERNAL_ERROR',
                            message: localeString(
                                'views.Settings.NostrWalletConnect.errors.noCashuMintSelected'
                            )
                        }
                    };
                }

                await this.cashuStore.getPayReq(request.invoice);
                const invoice = this.cashuStore.payReq;
                const error = this.cashuStore.getPayReqError;

                if (error) {
                    return {
                        result: undefined,
                        error: {
                            code: 'INVALID_INVOICE',
                            message: error
                        }
                    };
                }
                if (!invoice) {
                    return {
                        result: undefined,
                        error: {
                            code: 'INVALID_INVOICE',
                            message: localeString(
                                'views.Settings.NostrWalletConnect.errors.failedToDecodeInvoice'
                            )
                        }
                    };
                }
                if (!invoice) {
                    return {
                        result: undefined,
                        error: {
                            code: 'INVALID_INVOICE',
                            message: localeString(
                                'views.Settings.NostrWalletConnect.errors.invoiceNotFound'
                            )
                        }
                    };
                }
                if (invoice.isPaid) {
                    return {
                        result: undefined,
                        error: {
                            code: 'INVALID_INVOICE',
                            message: localeString(
                                'views.Settings.NostrWalletConnect.errors.invoiceAlreadyPaid'
                            )
                        }
                    };
                }
                if (invoice.isExpired) {
                    return {
                        result: undefined,
                        error: {
                            code: 'INVALID_INVOICE',
                            message: localeString(
                                'views.Settings.NostrWalletConnect.errors.invoiceExpired'
                            )
                        }
                    };
                }
                if (
                    !invoice.getPaymentRequest ||
                    invoice.getPaymentRequest.trim() === ''
                ) {
                    return {
                        result: undefined,
                        error: {
                            code: 'INVALID_INVOICE',
                            message: localeString(
                                'views.Settings.NostrWalletConnect.errors.invalidPaymentRequest'
                            )
                        }
                    };
                }
                let amount = 0;
                if ((invoice as any).satoshis) {
                    amount = (invoice as any).satoshis;
                } else if ((invoice as any).millisatoshis) {
                    amount = Number((invoice as any).millisatoshis) / 1000;
                } else {
                    amount = invoice.getAmount || 0;
                }
                console.log('amount', amount);
                console.log('invoice.satoshis', (invoice as any).satoshis);
                console.log(
                    'invoice.millisatoshis',
                    (invoice as any).millisatoshis
                );
                console.log('invoice.getAmount', invoice.getAmount);
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
                const cashuInvoice =
                    await this.cashuStore.payLnInvoiceFromEcash({
                        amount: amount.toString()
                    });
                if (cashuInvoice?.preimage) {
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

            const budgetValidation = await this.validateBudgetForPayment(
                connection.id,
                amountSats
            );
            if (!budgetValidation.canProceed) {
                return {
                    result: undefined,
                    error: {
                        code: 'QUOTA_EXCEEDED',
                        message:
                            budgetValidation.error ||
                            localeString(
                                'views.Settings.NostrWalletConnect.errors.budgetLimitExceeded'
                            )
                    }
                };
            }

            const result = await BackendUtils.payLightningInvoice({
                payment_request: request.invoice,
                timeout_seconds: 120,
                fee_limit_sat: 1000,
                allow_self_payment: true
            });

            if (result.payment_error) {
                return {
                    result: undefined,
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: localeString(
                            'views.Settings.NostrWalletConnect.errors.failedToPayInvoice'
                        ).replace('{error}', result.payment_error)
                    }
                };
            }

            if (result.result && result.result.status === 'FAILED') {
                const failureReason =
                    result.result.failure_reason ||
                    localeString(
                        'views.Settings.NostrWalletConnect.errors.unknownFailure'
                    );

                let errorMessage = localeString(
                    'views.Settings.NostrWalletConnect.errors.paymentFailed'
                ).replace('{reason}', failureReason);

                if (failureReason === 'FAILURE_REASON_NO_ROUTE') {
                    errorMessage = localeString(
                        'views.Settings.NostrWalletConnect.errors.paymentFailedNoRoute'
                    );
                }

                return {
                    result: undefined,
                    error: {
                        code: 'PAYMENT_FAILED',
                        message: errorMessage
                    }
                };
            }

            if (result.result && result.result.status === 'SUCCEEDED') {
                await this.trackSpending(connection.id, amountSats);
                this.showPaymentSentNotification(amountSats, connection.name);
                return {
                    result: {
                        preimage: result.result.payment_preimage,
                        fees_paid: Math.floor((result.result.fee || 0) * 1000)
                    },
                    error: undefined
                };
            }

            if (result.payment_preimage && !result.payment_error) {
                await this.trackSpending(connection.id, amountSats);
                this.showPaymentSentNotification(amountSats, connection.name);
                return {
                    result: {
                        preimage: result.payment_preimage,
                        fees_paid: Math.floor((result.fee || 0) * 1000)
                    },
                    error: undefined
                };
            }

            return {
                result: undefined,
                error: {
                    code: 'PAYMENT_FAILED',
                    message: localeString(
                        'views.Settings.NostrWalletConnect.errors.paymentFailedUnknown'
                    )
                }
            };
        } catch (error) {
            return {
                result: undefined,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: localeString(
                        'views.Settings.NostrWalletConnect.errors.failedToPayInvoice'
                    ).replace('{error}', String(error))
                }
            };
        }
    }

    private async handleMakeInvoice(
        connection: NWCConnection,
        request: Nip47MakeInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        this.markConnectionUsed(connection.id);
        try {
            if (this.cashuEnabled) {
                try {
                    const cashuInvoice = await this.cashuStore.createInvoice({
                        value: Math.floor(request.amount / 1000).toString(),
                        memo: request.description || ''
                    });
                    if (!cashuInvoice || !cashuInvoice.paymentRequest) {
                        throw new Error(
                            'Failed to create Cashu invoice - no payment request returned'
                        );
                    }
                    let paymentHash = '';
                    let descriptionHash = '';
                    try {
                        const decoded = bolt11.decode(
                            cashuInvoice.paymentRequest
                        );
                        for (const tag of decoded.tags) {
                            if (tag.tagName === 'payment_hash') {
                                paymentHash = String(tag.data);
                            } else if (tag.tagName === 'purpose_commit_hash') {
                                descriptionHash = String(tag.data);
                            }
                        }
                    } catch (decodeError) {
                        console.warn(
                            'Failed to decode bolt11 invoice for payment hash:',
                            decodeError
                        );
                    }
                    const quoteId = this.cashuStore.quoteId;
                    let isPaid = false;
                    if (quoteId) {
                        try {
                            const processedQuoteId =
                                this.convertQuoteIdToHex(quoteId);
                            const paymentCheck =
                                await this.cashuStore.checkInvoicePaid(
                                    processedQuoteId,
                                    undefined,
                                    false,
                                    true
                                );
                            isPaid = paymentCheck?.isPaid || false;
                        } catch (checkError) {
                            console.warn(
                                'Failed to check initial payment status:',
                                checkError
                            );
                        }
                    }

                    if (!isPaid) {
                        this.setupCashuInvoicePaymentListener(
                            connection.name,
                            request.amount,
                            quoteId
                        );
                    } else {
                        // Show notification for immediate payment
                        this.showPaymentReceivedNotification(
                            Math.floor(request.amount / 1000),
                            connection.name
                        );
                    }

                    return {
                        result: {
                            type: 'incoming',
                            state: isPaid ? 'settled' : 'pending',
                            invoice: cashuInvoice.paymentRequest,
                            description: request.description || '',
                            description_hash: descriptionHash,
                            preimage: '',
                            payment_hash: paymentHash,
                            amount: request.amount,
                            fees_paid: 0,
                            settled_at: isPaid
                                ? Math.floor(Date.now() / 1000)
                                : 0,
                            created_at: Math.floor(Date.now() / 1000),
                            expires_at:
                                Math.floor(Date.now() / 1000) +
                                (request.expiry || 3600)
                        },
                        error: undefined
                    };
                } catch (cashuError) {
                    throw new Error(
                        `Cashu invoice creation failed: ${cashuError}`
                    );
                }
            }
            const invoice = await BackendUtils.createInvoice({
                value: Math.floor(request.amount / 1000),
                memo: request.description || '',
                expiry: request.expiry || 3600
            });

            this.setupInvoicePaymentListener(
                invoice.r_hash,
                connection.name,
                request.amount
            );

            return {
                result: {
                    type: 'incoming' as const,
                    state: 'pending' as const, // pending for regular invoices
                    invoice: invoice.payment_request,
                    description: request.description || '',
                    description_hash: invoice.description_hash,
                    preimage: invoice.r_preimage,
                    payment_hash: invoice.r_hash,
                    amount: request.amount,
                    fees_paid: 0,
                    settled_at: 0, // Will be set when payment is received
                    created_at: Math.floor(Date.now() / 1000),
                    expires_at:
                        Math.floor(Date.now() / 1000) + (request.expiry || 3600)
                },
                error: undefined
            };
        } catch (error) {
            return {
                result: undefined,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: localeString(
                        'views.Settings.NostrWalletConnect.errors.failedToCreateInvoice'
                    ).replace('{error}', String(error))
                }
            };
        }
    }

    private async handleLookupInvoice(
        connection: NWCConnection,
        request: Nip47LookupInvoiceRequest
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        this.markConnectionUsed(connection.id);
        try {
            let paymentHash = request.payment_hash!;
            paymentHash = this.convertPaymentHashToHex(paymentHash);
            if (this.cashuEnabled) {
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
                    let amtSat = matchingInvoice.getAmount || 0;

                    if (!isPaid) {
                        cashuInvoice = await this.cashuStore.checkInvoicePaid(
                            matchingInvoice.quote
                        );
                        console.log(
                            'handleLookupInvoice - cashuInvoice:',
                            cashuInvoice
                        );
                        isPaid = cashuInvoice?.isPaid || false;
                        amtSat = cashuInvoice?.amtSat || 0;
                    }

                    const result = {
                        type: 'incoming' as const,
                        state: isPaid
                            ? ('settled' as const)
                            : ('pending' as const),
                        invoice:
                            cashuInvoice?.paymentRequest ||
                            matchingInvoice.getPaymentRequest,
                        description: '',
                        description_hash: '',
                        preimage: '',
                        payment_hash: request.payment_hash!,
                        amount: Math.floor(amtSat * 1000),
                        fees_paid: 0,
                        settled_at: isPaid
                            ? Math.floor(Date.now() / 1000)
                            : Math.floor(Date.now() / 1000),
                        created_at: Math.floor(Date.now() / 1000),
                        expires_at: Math.floor(Date.now() / 1000) + 3600
                    };
                    return {
                        result,
                        error: undefined
                    };
                } else {
                    return {
                        result: undefined,
                        error: {
                            code: 'NOT_FOUND',
                            message: localeString(
                                'views.Settings.NostrWalletConnect.errors.invoiceNotFound'
                            )
                        }
                    };
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
                    amount: Math.floor(invoice.getAmount * 1000), // Convert to msats
                    fees_paid: 0,
                    settled_at: invoice.isPaid
                        ? Math.floor(invoice.settleDate.getTime() / 1000)
                        : Math.floor(Date.now() / 1000),
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
            return {
                result: undefined,
                error: {
                    code: 'NOT_FOUND',
                    message: localeString(
                        'views.Settings.NostrWalletConnect.errors.invoiceNotFound'
                    ).replace('{error}', String(error))
                }
            };
        }
    }

    private async handleListTransactions(
        connection: NWCConnection,
        request: Nip47ListTransactionsRequest
    ): NWCWalletServiceResponsePromise<Nip47ListTransactionsResponse> {
        this.markConnectionUsed(connection.id);
        console.log('handleListTransactions', connection.id);
        try {
            await this.transactionsStore.getTransactions();
            const transactions = this.transactionsStore.transactions;

            let nip47Transactions: Nip47Transaction[] = (
                transactions || []
            ).map((tx: Transaction) => {
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
            });

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
            return {
                result: undefined,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: localeString(
                        'views.Settings.NostrWalletConnect.errors.failedToGetTransactions'
                    ).replace('{error}', String(error))
                }
            };
        }
    }

    private async handlePayKeysend(
        connection: NWCConnection,
        request: Nip47PayKeysendRequest
    ): NWCWalletServiceResponsePromise<Nip47Transaction> {
        this.markConnectionUsed(connection.id);
        console.log('handlePayKeysend', connection.id);
        try {
            const amountSats = Math.floor(request.amount / 1000);
            const budgetValidation = await this.validateBudgetForPayment(
                connection.id,
                amountSats
            );

            if (!budgetValidation.canProceed) {
                return {
                    result: undefined,
                    error: {
                        code: 'QUOTA_EXCEEDED',
                        message:
                            budgetValidation.error ||
                            localeString(
                                'views.Settings.NostrWalletConnect.errors.budgetLimitExceeded'
                            )
                    }
                };
            }

            const result = await BackendUtils.payLightningInvoice({
                payment_request: request.pubkey,
                amt: request.amount
            });

            await this.trackSpending(connection.id, amountSats);
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
        } catch (error) {
            return {
                result: undefined,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: localeString(
                        'views.Settings.NostrWalletConnect.errors.failedToSendKeysend'
                    ).replace('{error}', String(error))
                }
            };
        }
    }

    private async handleSignMessage(
        connection: NWCConnection,
        request: Nip47SignMessageRequest
    ): NWCWalletServiceResponsePromise<Nip47SignMessageResponse> {
        console.log('handleSignMessage', connection.id);
        this.markConnectionUsed(connection.id);
        try {
            const signature = await BackendUtils.signMessage(request.message);
            return {
                result: {
                    message: request.message,
                    signature
                },
                error: undefined
            };
        } catch (error) {
            return {
                result: undefined,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: localeString(
                        'views.Settings.NostrWalletConnect.errors.failedToSignMessage'
                    ).replace('{error}', String(error))
                }
            };
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
        return this.connections.filter((c) => !c.isExpired);
    }

    public get expiredConnections(): NWCConnection[] {
        return this.connections.filter((c) => c.isExpired);
    }

    public get availableRelays(): string[] {
        return Array.from(this.nwcWalletServices.keys());
    }

    public get recommendedRelays(): string[] {
        // Return relays that are less likely to rate limit or require payment
        return this.availableRelays.filter(
            (relay) =>
                !this.isDamusRelay(relay) && !this.isRestrictedRelay(relay)
        );
    }

    public getRelayHealthStatus(relayUrl: string): {
        isRateLimited: boolean;
        isDamus: boolean;
        isRestricted: boolean;
        recommendation: string;
    } {
        const isDamus = this.isDamusRelay(relayUrl);
        const isRestricted = this.isRestrictedRelay(relayUrl);

        let recommendation = 'Relay appears to be stable';
        if (isDamus) {
            recommendation = 'Known to rate limit frequently';
        } else if (isRestricted) {
            recommendation = 'Requires payment or registration';
        }

        return {
            isRateLimited: isDamus,
            isDamus,
            isRestricted,
            recommendation
        };
    }
    private async handleRateLimitedConnection(
        connection: NWCConnection,
        _error: any
    ): Promise<void> {
        console.warn(
            `Relay ${connection.relayUrl} is rate limiting connection ${connection.name}.`
        );

        if (this.isDamusRelay(connection.relayUrl)) {
            console.warn(
                'Damus relay is known to have strict rate limits. Consider:'
            );
            console.warn('1. Using a different relay for new connections');
            console.warn('2. Reducing the frequency of requests');
            console.warn('3. Waiting before retrying');
        }

        await this.implementBackoffForConnection(connection);
    }

    private async implementBackoffForConnection(
        connection: NWCConnection
    ): Promise<void> {
        const backoffKey = `backoff_${connection.id}`;
        const currentBackoff = await Storage.getItem(backoffKey);
        const backoffCount = currentBackoff ? parseInt(currentBackoff) : 0;
        const maxBackoff = 5; // Maximum 5 backoff attempts

        if (backoffCount >= maxBackoff) {
            console.error(
                `Connection ${connection.name} has exceeded maximum backoff attempts. Consider recreating the connection.`
            );
            return;
        }

        const backoffMinutes = Math.pow(2, backoffCount);
        const backoffMs = backoffMinutes * 60 * 1000;

        console.log(
            `Implementing ${backoffMinutes} minute backoff for connection ${connection.name}`
        );

        await Storage.setItem(backoffKey, (backoffCount + 1).toString());

        setTimeout(async () => {
            try {
                console.log(
                    `Retrying connection ${connection.name} after backoff`
                );
                await this.subscribeToConnection(connection);

                // Reset backoff on successful connection
                await Storage.removeItem(backoffKey);
            } catch (retryError) {
                console.error(
                    `Retry failed for connection ${connection.name}:`,
                    retryError
                );
            }
        }, backoffMs);
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

    private showPaymentReceivedNotification(
        amountSats: number,
        connectionName: string
    ): void {
        const value = amountSats.toString();
        const value_commas = value.replace(
            /\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g,
            ','
        );

        const title = 'Payment Received via Nostr Wallet Connect';
        const body = `Received ${value_commas} ${
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

    private setupInvoicePaymentListener(
        paymentHash: string,
        connectionName: string,
        amountMsats: number
    ): void {
        // Check for invoice settlement every 3 seconds for up to 5 minutes
        const checkInterval = setInterval(async () => {
            try {
                const processedPaymentHash =
                    this.convertPaymentHashToHex(paymentHash);
                const invoice = await BackendUtils.lookupInvoice({
                    r_hash: processedPaymentHash
                });

                if (invoice.settled || invoice.state === 'SETTLED') {
                    clearInterval(checkInterval);
                    this.showPaymentReceivedNotification(
                        Math.floor(amountMsats / 1000),
                        connectionName
                    );
                }
            } catch (error) {
                console.error('Error checking invoice settlement:', error);
            }
        }, 3000);

        setTimeout(() => {
            clearInterval(checkInterval);
        }, 5 * 60 * 1000);
    }

    private setupCashuInvoicePaymentListener(
        connectionName: string,
        amountMsats: number,
        quoteId?: string
    ): void {
        if (!quoteId) {
            console.warn(
                'setupCashuInvoicePaymentListener: No quote ID provided, skipping listener setup'
            );
            return;
        }
        console.log(
            `setupCashuInvoicePaymentListener: Setting up listener for quote ID: ${quoteId}`
        );
        console.log(
            `setupCashuInvoicePaymentListener: Quote ID type: ${typeof quoteId}, length: ${
                quoteId?.length
            }`
        );

        const checkInterval = setInterval(async () => {
            try {
                console.log(
                    `Checking Cashu invoice status for quote ID: ${quoteId}`
                );

                const processedQuoteId = this.convertQuoteIdToHex(quoteId);
                const invoice = await this.cashuStore.checkInvoicePaid(
                    processedQuoteId,
                    undefined,
                    false,
                    true
                );

                if (invoice?.isPaid) {
                    clearInterval(checkInterval);
                    console.log(`Cashu invoice paid for quote ID: ${quoteId}`);
                    this.showPaymentReceivedNotification(
                        Math.floor(amountMsats / 1000),
                        connectionName
                    );
                }
            } catch (error) {
                console.error(
                    'Error checking Cashu invoice settlement:',
                    error
                );
                if (
                    error instanceof Error &&
                    error.message.includes('encoding/hex')
                ) {
                    console.error(
                        `Hex encoding error for quote ID: ${quoteId}`
                    );
                    clearInterval(checkInterval);
                }
            }
        }, 3000);

        setTimeout(() => {
            clearInterval(checkInterval);
            console.log(
                `Cashu invoice listener timeout for quote ID: ${quoteId}`
            );
        }, 5 * 60 * 1000);
    }
    private isRestrictedRelay(relayUrl: string): boolean {
        return (
            relayUrl.includes('nostr.land') || relayUrl.includes('nostr.wine')
        );
    }

    private isRateLimitedError(error: any): boolean {
        return (
            error?.message?.includes('rate-limited') ||
            error?.message?.includes('rate limit') ||
            error?.message?.includes('too much') ||
            error?.message?.includes('noting too much')
        );
    }

    private isRestrictedRelayError(error: any): boolean {
        return (
            error?.message?.includes('restricted') ||
            error?.message?.includes('pay') ||
            error?.message?.includes('sign up') ||
            error?.message?.includes('access')
        );
    }

    private isTimeoutError(error: any): boolean {
        return (
            error?.message?.includes('timeout') ||
            error?.message?.includes('timed out')
        );
    }

    private isDamusRelay(relayUrl: string): boolean {
        return relayUrl.includes('damus.io');
    }

    private markRelayAsFailed(relayUrl: string): void {
        const currentFailures = this.relayFailureCounts.get(relayUrl) || 0;
        const newFailures = currentFailures + 1;
        this.relayFailureCounts.set(relayUrl, newFailures);

        if (newFailures >= 3) {
            this.failedRelays.add(relayUrl);
            console.warn(
                `Relay ${relayUrl} marked as failed after ${newFailures} attempts`
            );
        }
    }

    private isRelayFailed(relayUrl: string): boolean {
        return this.failedRelays.has(relayUrl);
    }

    private getRelayBackoffDelay(relayUrl: string): number {
        const failures = this.relayFailureCounts.get(relayUrl) || 0;
        // Exponential backoff: 2^failures minutes, max 30 minutes
        return Math.min(Math.pow(2, failures) * 60 * 1000, 30 * 60 * 1000);
    }

    private shouldRetryRelay(relayUrl: string): boolean {
        const failures = this.relayFailureCounts.get(relayUrl) || 0;
        return failures < 5;
    }

    private convertQuoteIdToHex(quoteId: string): string {
        try {
            if (
                quoteId.includes('+') ||
                quoteId.includes('/') ||
                quoteId.includes('=')
            ) {
                return Base64Utils.base64ToHex(quoteId);
            }
        } catch (error) {
            console.warn(
                'Failed to convert quote ID from base64 to hex:',
                error
            );
        }
        return quoteId;
    }

    private convertPaymentHashToHex(paymentHash: string): string {
        try {
            if (
                typeof paymentHash === 'string' &&
                paymentHash.startsWith('{')
            ) {
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
                    .map((key) => hashObj[key]);
                return Base64Utils.bytesToHex(hashArray);
            }
            if (
                typeof paymentHash === 'string' &&
                (paymentHash.includes('+') ||
                    paymentHash.includes('/') ||
                    paymentHash.includes('='))
            ) {
                return Base64Utils.base64ToHex(paymentHash);
            }

            return paymentHash;
        } catch (error) {
            console.warn('Failed to convert payment hash to hex:', error);
            return paymentHash;
        }
    }
}
