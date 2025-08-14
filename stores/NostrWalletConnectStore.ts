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
import NWCConnection from '../models/NWCConnection';
import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import { localeString } from '../utils/LocaleUtils';

import SettingsStore from './SettingsStore';
import BalanceStore from './BalanceStore';
import NodeInfoStore from './NodeInfoStore';
import InvoicesStore from './InvoicesStore';
import PaymentsStore from './PaymentsStore';
import TransactionsStore from './TransactionsStore';
import Storage from '../storage';
import Transaction from '../models/Transaction';

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

export const NWC_CONNECTIONS_KEY = 'zeus-nwc-connections';
export const NWC_CLIENT_KEYS = 'zeus-nwc-client-keys';
export const NWC_SERVICE_KEYS = 'zeus-nwc-service-keys';

const PRIMARY_RELAY_URL = 'wss://relay.getalby.com/v1';

const ALL_RELAY_URLS = [PRIMARY_RELAY_URL];

interface ClientKeys {
    [pubkey: string]: string;
}

interface WalletServiceKeys {
    privateKey: string;
    publicKey: string;
}

export interface CreateConnectionParams {
    name: string;
    permissions?: string[];
    budgetAmount?: number;
    budgetRenewal?: 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    expiresAt?: Date;
    isolated?: boolean;
}

export default class NostrWalletConnectStore {
    @observable public loading = false;
    @observable public error = false;
    @observable public errorMessage = '';
    @observable public connections: NWCConnection[] = [];
    @observable public nwcWalletServiceKeyPair: nwc.NWCWalletServiceKeyPair;
    @observable private nwcWalletService: nwc.NWCWalletService;
    @observable public nostrUrl: string;
    @observable private activeSubscriptions: Map<string, () => void> =
        new Map();
    @observable public initializing = false;
    @observable public loadingMsg?: string;
    @observable public waitingForConnection = false;
    @observable public currentConnectionId?: string;
    @observable public connectionJustSucceeded = false;
    @observable public currentRelayUrl: string = PRIMARY_RELAY_URL;
    @observable public relayConnectionAttempts: number = 0;
    @observable public relayConnected: boolean = false;
    @observable private walletServiceKeys: WalletServiceKeys | null = null;
    settingsStore: SettingsStore;
    balanceStore: BalanceStore;
    nodeInfoStore: NodeInfoStore;
    invoicesStore: InvoicesStore;
    paymentsStore: PaymentsStore;
    transactionsStore: TransactionsStore;

    constructor(
        settingsStore: SettingsStore,
        balanceStore: BalanceStore,
        nodeInfoStore: NodeInfoStore,
        transactionsStore: TransactionsStore
    ) {
        this.settingsStore = settingsStore;
        this.balanceStore = balanceStore;
        this.nodeInfoStore = nodeInfoStore;
        this.transactionsStore = transactionsStore;
        this.initializeServiceWithRetry();
    }

    @action
    public reset = () => {
        this.connections = [];
        this.activeSubscriptions.clear();
        this.error = false;
        this.errorMessage = '';
        this.loading = false;
        this.initializing = false;
        this.loadingMsg = undefined;
        this.relayConnected = false;
        this.relayConnectionAttempts = 0;
        this.walletServiceKeys = null;
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
            console.log('storedKeys', storedKeys);
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
        const maxAttempts =
            this.settingsStore.settings.lightningAddress.nostrRelays.length;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const relayUrl = ALL_RELAY_URLS[attempt];
            console.log(
                `Attempting to connect to NWC relay ${
                    attempt + 1
                }/${maxAttempts}: ${relayUrl}`
            );
            runInAction(() => {
                this.currentRelayUrl = relayUrl;
                this.relayConnectionAttempts = attempt + 1;
            });
            try {
                this.nwcWalletService = new nwc.NWCWalletService({
                    relayUrl
                });
                await this.initializeService();
                runInAction(() => {
                    this.relayConnected = true;
                });
                return;
            } catch (error: any) {
                console.error(`Failed to connect to relay ${relayUrl}:`, error);
                if (attempt === maxAttempts - 1) {
                    runInAction(() => {
                        this.error = true;
                        this.errorMessage = localeString(
                            'views.Settings.NostrWalletConnect.errors.failedToConnectToRelay'
                        ).replace('{error}', error.message);
                        this.relayConnected = false;
                    });
                } else {
                    // Wait before trying next relay (exponential backoff)
                    await new Promise((resolve) =>
                        setTimeout(resolve, Math.pow(2, attempt) * 1000)
                    );
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
                    error.message ||
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
            await this.nwcWalletService.publishWalletServiceInfoEvent(
                this.walletServiceKeys.privateKey,
                [
                    'get_info',
                    'get_balance',
                    'pay_invoice',
                    'make_invoice',
                    'lookup_invoice',
                    'list_transactions',
                    'pay_keysend',
                    'sign_message'
                ],
                ['hold_invoice_accepted', 'payment_received', 'payment_sent']
            );
            await this.subscribeToAllConnections();
            console.log('NWC service started ------------->');
        } catch (error: any) {
            console.error('Failed to start NWC service:', error);
            this.setError(
                true,
                error.message ||
                    localeString(
                        'views.Settings.NostrWalletConnect.failedToStartService'
                    )
            );
            return false;
        } finally {
            this.setLoading(false);
        }
    };

    @action
    public stopService = async (): Promise<boolean> => {
        try {
            this.setLoading(true);
            this.setError(false);
            await this.unsubscribeFromAllConnections();
            return true;
        } catch (error: any) {
            console.error('Failed to stop NWC service:', error);
            this.setError(
                true,
                error.message ||
                    localeString(
                        'views.Settings.NostrWalletConnect.failedToStopService'
                    )
            );
            return false;
        } finally {
            this.setLoading(false);
        }
    };

    private generateConnectionId(): string {
        return (
            Date.now().toString(36) + Math.random().toString(36).substring(2)
        );
    }

    private generateConnectionString(connectionPrivateKey: string): string {
        const connectionString = `nostr+walletconnect://${
            this.walletServiceKeys?.publicKey
        }?relay=${encodeURIComponent(
            this.currentRelayUrl
        )}&secret=${connectionPrivateKey}`;
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
    @action
    public setLoading = (loading: boolean) => {
        this.loading = loading;
    };
    @action
    public setError = (error: boolean, errorMessage?: string) => {
        this.error = error;
        this.errorMessage = errorMessage || '';
    };

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
            }
        } catch (error: any) {
            console.error('Failed to load NWC connections:', error);
            this.setError(
                true,
                localeString(
                    'views.Settings.NostrWalletConnect.failedToLoadConnections'
                )
            );
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
            this.setError(
                true,
                localeString(
                    'views.Settings.NostrWalletConnect.failedToSaveConnections'
                )
            );
        }
    };

    @action
    public createConnection = async (
        params: CreateConnectionParams
    ): Promise<string | null> => {
        try {
            this.setLoading(true);
            this.setError(false);

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
            const connectionId = this.generateConnectionId();
            const connectionPrivateKey = generatePrivateKey();
            const connectionPublicKey = getPublicKey(connectionPrivateKey);
            const nostrUrl =
                this.generateConnectionString(connectionPrivateKey);

            const connectionData = {
                id: connectionId,
                name: params.name.trim(),
                pubkey: connectionPublicKey,
                permissions: params.permissions || [
                    'get_info',
                    'get_balance',
                    'pay_invoice',
                    'make_invoice',
                    'lookup_invoice',
                    'list_transactions',
                    'pay_keysend'
                ],
                totalSpendSats: 0,
                createdAt: new Date(),
                maxAmountSats: params.budgetAmount,
                budgetRenewal: params.budgetRenewal || 'never',
                expiresAt: params.expiresAt,
                lastBudgetReset: params.budgetAmount ? new Date() : undefined,
                isolated: params.isolated || false
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
            console.error('Failed to create NWC connection:', error);
            this.setError(
                true,
                error.message ||
                    localeString(
                        'views.Settings.NostrWalletConnect.failedToCreateConnection'
                    )
            );
            return null;
        } finally {
            this.setLoading(false);
        }
    };

    @action
    public deleteConnection = async (
        connectionId: string
    ): Promise<boolean> => {
        try {
            this.setLoading(true);
            this.setError(false);

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

            await this.unsubscribeFromConnection(connectionId);

            runInAction(() => {
                this.connections.splice(connectionIndex, 1);
            });

            await this.saveConnections();
            return true;
        } catch (error: any) {
            console.error('Failed to delete NWC connection:', error);
            this.setError(
                true,
                error.message ||
                    localeString(
                        'views.Settings.NostrWalletConnect.failedToDeleteConnection'
                    )
            );
            return false;
        } finally {
            this.setLoading(false);
        }
    };

    @action
    public updateConnection = async (
        connectionId: string,
        updates: Partial<NWCConnection>
    ): Promise<boolean> => {
        try {
            this.setLoading(true);
            this.setError(false);

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
            this.setError(
                true,
                error.message ||
                    localeString(
                        'views.Settings.NostrWalletConnect.failedToUpdateConnection'
                    )
            );
            return false;
        } finally {
            this.setLoading(false);
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

    // Helper method to check if connection has permission
    private hasPermission(
        connection: NWCConnection,
        permission: Nip47SingleMethod
    ): boolean {
        return connection.permissions.includes(permission);
    }

    private async subscribeToConnection(
        connection: NWCConnection
    ): Promise<void> {
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

            const unsubscribe = await this.nwcWalletService.subscribe(
                keypair,
                handler
            );

            runInAction(() => {
                this.activeSubscriptions.set(connection.id, unsubscribe);
            });
        } catch (error) {
            console.error(
                `Failed to subscribe to connection ${connection.name}:`,
                error
            );
        }
    }

    private async handleGetInfo(
        connection: NWCConnection
    ): NWCWalletServiceResponsePromise<Nip47GetInfoResponse> {
        console.log('handleGetInfo', connection);
        this.markConnectionUsed(connection.id);
        try {
            if (!this.nodeInfoStore.nodeInfo?.identity_pubkey) {
                await this.nodeInfoStore.getNodeInfo();
            }
            const nodeInfo = this.nodeInfoStore.nodeInfo;
            return {
                result: {
                    alias:
                        nodeInfo?.alias ||
                        localeString(
                            'views.Settings.NostrWalletConnect.zeusWallet'
                        ),
                    color: nodeInfo?.color || '#3399FF',
                    pubkey: nodeInfo?.identity_pubkey,
                    network: 'mainnet',
                    block_height: nodeInfo?.block_height,
                    block_hash: nodeInfo?.block_hash,
                    methods: connection.permissions
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
        try {
            await this.balanceStore.getLightningBalance(false);
            console.log('handleGetBalance', connection);
            const { balance } = await BackendUtils.getLightningBalance();
            console.log('lightningBalance', balance);
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
        console.log('handlePayInvoice', connection);
        this.markConnectionUsed(connection.id);
        try {
            const invoiceInfo = await BackendUtils.decodePaymentRequest([
                request.invoice
            ]);

            console.log('invoiceInfo', invoiceInfo);
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
            console.log(error);
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
        console.log('handleMakeInvoice', connection);
        this.markConnectionUsed(connection.id);
        try {
            const invoice = await BackendUtils.createInvoice({
                value: Math.floor(request.amount / 1000),
                memo: request.description || '',
                expiry: request.expiry || 3600
            });
            console.log('invoice', invoice);
            return {
                result: {
                    type: 'incoming' as const,
                    state: 'settled' as const,
                    invoice: invoice.payment_request,
                    description: request.description || '',
                    description_hash: invoice.description_hash,
                    preimage: invoice.r_preimage,
                    payment_hash: invoice.r_hash,
                    amount: request.amount,
                    fees_paid: 0,
                    settled_at: Math.floor(Date.now() / 1000),
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
        console.log('handleLookupInvoice', connection);
        try {
            let paymentHash = request.payment_hash!;
            if (
                paymentHash.includes('+') ||
                paymentHash.includes('/') ||
                paymentHash.includes('=')
            ) {
                try {
                    paymentHash = Base64Utils.base64ToHex(paymentHash);
                } catch (error) {
                    console.log(
                        'Failed to convert base64 payment hash to hex:',
                        error
                    );
                }
            }
            const invoice = await BackendUtils.lookupInvoice({
                r_hash: paymentHash
            });
            console.log('invoice', invoice);
            return {
                result: {
                    type: 'incoming' as const,
                    state:
                        invoice.settled || invoice.state === 'SETTLED'
                            ? ('settled' as const)
                            : ('pending' as const),
                    invoice: invoice.payment_request || '',
                    description: invoice.memo || '',
                    description_hash: invoice.description_hash || '',
                    preimage: invoice.r_preimage || '',
                    payment_hash: invoice.r_hash || request.payment_hash!,
                    amount: Math.floor(Number(invoice.value_msat) || 0),
                    fees_paid: 0,
                    settled_at:
                        invoice.settle_date && invoice.settle_date !== '0'
                            ? Math.floor(Number(invoice.settle_date))
                            : Math.floor(Date.now() / 1000),
                    created_at: invoice.creation_date
                        ? Math.floor(Number(invoice.creation_date))
                        : Math.floor(Date.now() / 1000),
                    expires_at:
                        invoice.creation_date && invoice.expiry
                            ? Math.floor(
                                  Number(invoice.creation_date) +
                                      Number(invoice.expiry)
                              )
                            : Math.floor(Date.now() / 1000) + 3600
                },
                error: undefined
            };
        } catch (error) {
            console.log(error);
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
        console.log('handleListTransactions', connection);
        try {
            await this.transactionsStore.getTransactions();
            const transactions = this.transactionsStore.transactions;
            console.log('transactions', transactions);
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

            console.log('Final nip47Transactions:', nip47Transactions);
            console.log('Total count:', totalCount);
            console.log('Returned count:', nip47Transactions.length);
            console.log('Request filters applied:', {
                type: request.type,
                from: request.from,
                until: request.until,
                unpaid: request.unpaid,
                offset: request.offset,
                limit: request.limit
            });

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
        _request: Nip47SignMessageRequest
    ): NWCWalletServiceResponsePromise<Nip47SignMessageResponse> {
        this.markConnectionUsed(connection.id);
        try {
            const signature = await BackendUtils.signMessage(_request.message);
            console.log(signature);
            return {
                result: {
                    message: _request.message,
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
}
