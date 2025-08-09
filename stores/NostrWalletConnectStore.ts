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
import SettingsStore from './SettingsStore';
import BackendUtils from '../utils/BackendUtils';
import Storage from '../storage';
import { localeString } from '../utils/LocaleUtils';

export const NWC_CONNECTIONS_KEY = 'zeus-nwc-connections';
export const NWC_SERVICE_KEYS_KEY = 'zeus-nwc-service-keys';

const PRIMARY_RELAY_URL = 'wss://relay.damus.io';
const FALLBACK_RELAY_URLS = [
    'wss://relay.damus.io',
    'wss://nostr.wine',
    'wss://relay.getalby.com/v1',
    'wss://relay.snort.social',
    'wss://nos.lol'
];

const ALL_RELAY_URLS = [PRIMARY_RELAY_URL, ...FALLBACK_RELAY_URLS];

interface ServiceKeys {
    [pubkey: string]: string;
}

export interface CreateConnectionParams {
    name: string;
    permissions?: string[];
    budgetAmount?: number;
    budgetRenewal?: 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    expiresAt?: Date;
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

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
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
    };

    @action
    private initializeServiceWithRetry = async () => {
        const maxAttempts = ALL_RELAY_URLS.length;

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
                console.log(`Successfully connected to NWC relay: ${relayUrl}`);
                return;
            } catch (error: any) {
                console.error(`Failed to connect to relay ${relayUrl}:`, error);
                if (attempt === maxAttempts - 1) {
                    runInAction(() => {
                        this.error = true;
                        this.errorMessage = `Failed to connect to any NWC relay. Last error: ${error.message}`;
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
        const start = new Date();
        runInAction(() => {
            this.initializing = true;
            this.loadingMsg = localeString(
                'views.Settings.NostrWalletConnect.initializingService'
            );
        });

        try {
            await this.loadConnections();
            await this.checkAndResetAllBudgetsOnInit();
            await this.startService();
            runInAction(() => {
                this.loadingMsg = undefined;
                this.initializing = false;
            });
            const completionTime =
                (new Date().getTime() - start.getTime()) / 1000 + 's';
            console.log('done initializing nostr wallet connect  -----> ');
            console.log('NWC service initialization time:', completionTime);
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
            await this.subscribeToAllConnections();
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
        const connectionPublicKey = getPublicKey(connectionPrivateKey);
        const connectionString = `nostr+walletconnect://${connectionPublicKey}?relay=${encodeURIComponent(
            this.currentRelayUrl
        )}&secret=${connectionPrivateKey}`;
        return connectionString;
    }

    private async storePrivateKey(
        pubkey: string,
        privateKey: string
    ): Promise<void> {
        try {
            const storedKeys = await Storage.getItem(NWC_SERVICE_KEYS_KEY);
            const keys: ServiceKeys = storedKeys ? JSON.parse(storedKeys) : {};
            keys[pubkey] = privateKey;
            await Storage.setItem(NWC_SERVICE_KEYS_KEY, JSON.stringify(keys));
        } catch (error) {
            console.error('Failed to store private key:', error);
            throw new Error(
                localeString(
                    'views.Settings.NostrWalletConnect.failedToStorePrivateKey'
                )
            );
        }
    }

    private async getPrivateKey(pubkey: string): Promise<string | null> {
        try {
            const storedKeys = await Storage.getItem(NWC_SERVICE_KEYS_KEY);
            if (!storedKeys) return null;
            const keys: ServiceKeys = JSON.parse(storedKeys);
            return keys[pubkey] || null;
        } catch (error) {
            console.error('Failed to get private key:', error);
            return null;
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
                lastBudgetReset: params.budgetAmount ? new Date() : undefined
            };

            const connection = new NWCConnection(connectionData);

            await this.storePrivateKey(
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
                    console.log(
                        `Budget added to connection ${connection.name}, setting lastBudgetReset`
                    );
                } else if (hadBudget && !hasBudget) {
                    connection.lastBudgetReset = undefined;
                    connection.totalSpendSats = 0;
                    console.log(
                        `Budget removed from connection ${connection.name}, clearing budget data`
                    );
                } else if (hasBudget && budgetRenewalChanged) {
                    connection.lastBudgetReset = new Date();
                    connection.totalSpendSats = 0;
                    console.log(
                        `Budget renewal changed for connection ${connection.name} from ${oldBudgetRenewal} to ${newBudgetRenewal}, resetting budget`
                    );
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

            console.log('connection', connection);
            console.log('connection.lastUsed', connection.lastUsed);
            console.log('markConnectionUsed called for:', connectionId);
            console.log('wasNeverUsed:', wasNeverUsed);
            console.log('waitingForConnection:', this.waitingForConnection);
            console.log('currentConnectionId:', this.currentConnectionId);

            connection.lastUsed = new Date();
            await this.saveConnections();
            if (
                this.waitingForConnection &&
                this.currentConnectionId === connectionId
            ) {
                console.log('Calling stopWaitingForConnection...');
                this.stopWaitingForConnection();
            }
        }
    };

    @action
    public startWaitingForConnection = (connectionId: string) => {
        console.log('startWaitingForConnection called with:', connectionId);
        this.waitingForConnection = true;
        this.currentConnectionId = connectionId;
        console.log(
            'Set waitingForConnection to true, currentConnectionId to:',
            connectionId
        );
    };

    @action
    public stopWaitingForConnection = () => {
        console.log(
            'stopWaitingForConnection called - setting waitingForConnection to false'
        );
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
            console.log(`Budget reset for connection: ${connection.name}`);
        }
    };

    @action
    public checkAndResetAllBudgetsOnInit = async (): Promise<void> => {
        console.log(
            'Checking all connections for budget resets on service init...'
        );
        await this.checkAndResetAllBudgets('service initialization');
    };

    @action
    public checkAndResetAllBudgets = async (
        context: string = 'manual check'
    ): Promise<void> => {
        let budgetsReset = 0;
        let connectionsChecked = 0;

        runInAction(() => {
            for (const connection of this.connections) {
                connectionsChecked++;

                if (connection.needsBudgetReset) {
                    budgetsReset++;
                    const oldSpending = connection.totalSpendSats;
                    const renewalPeriod = connection.budgetRenewal;

                    connection.resetBudget();

                    console.log(
                        `Budget reset (${context}) for connection "${connection.name}": ` +
                            `${oldSpending} sats spending cleared, renewal: ${renewalPeriod}`
                    );
                }
            }
        });

        if (budgetsReset > 0) {
            await this.saveConnections();
            console.log(
                `Budget check complete (${context}): ${budgetsReset} budgets reset out of ${connectionsChecked} connections checked`
            );
        } else if (connectionsChecked > 0) {
            console.log(
                `Budget check complete (${context}): No budget resets needed for ${connectionsChecked} connections`
            );
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

        console.log(
            `Tracked ${amountSats} sats spending for connection: ${connection.name}. Total: ${connection.totalSpendSats} sats`
        );
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
                error: `Payment of ${amountSats} sats exceeds remaining budget of ${remainingBudget} sats`
            };
        }

        return { canProceed: true };
    };

    private async subscribeToAllConnections(): Promise<void> {
        const activeConnections = this.connections.filter((c) => !c.isExpired);
        console.log('activeConnections', activeConnections);
        for (const connection of activeConnections) {
            await this.subscribeToConnection(connection);
        }
    }

    // Helper method to check if connection has permission
    private hasPermission(
        connection: NWCConnection,
        permission: string
    ): boolean {
        return connection.permissions.includes(permission);
    }

    private async subscribeToConnection(
        connection: NWCConnection
    ): Promise<void> {
        try {
            await this.unsubscribeFromConnection(connection.id);
            const privateKey = await this.getPrivateKey(connection.pubkey);
            if (!privateKey) {
                throw new Error(
                    `Private key not found for connection ${connection.id}`
                );
            }
            const keypair = new nwc.NWCWalletServiceKeyPair(
                privateKey,
                connection.pubkey
            );
            const subscriptionMethods: any = {};
            if (this.hasPermission(connection, 'get_info')) {
                subscriptionMethods.getInfo = async () => {
                    console.log('requesting getInfo');
                    this.markConnectionUsed(connection.id);
                    try {
                        const nodeInfo = await BackendUtils.getMyNodeInfo();
                        console.log('nodeInfo', nodeInfo);
                        return {
                            result: {
                                alias:
                                    nodeInfo.alias ||
                                    localeString(
                                        'views.Settings.NostrWalletConnect.zeusWallet'
                                    ),
                                color: nodeInfo.color || '#3399FF',
                                pubkey: nodeInfo.identity_pubkey,
                                network: 'mainnet',
                                block_height: nodeInfo.block_height,
                                block_hash: nodeInfo.block_hash,
                                methods: connection.permissions
                            },
                            error: undefined
                        };
                    } catch (error) {
                        return {
                            result: undefined,
                            error: {
                                code: 'INTERNAL_ERROR',
                                message: `Failed to get node info: ${error}`
                            }
                        };
                    }
                };
            }
            if (this.hasPermission(connection, 'get_balance')) {
                subscriptionMethods.getBalance = async () => {
                    console.log('requesting getBalance');
                    this.markConnectionUsed(connection.id);
                    try {
                        const lightningBalance =
                            await BackendUtils.getLightningBalance();
                        console.log('lightningBalance', lightningBalance);
                        return {
                            result: {
                                balance: lightningBalance?.balance * 1000
                            },
                            error: undefined
                        };
                    } catch (error) {
                        return {
                            result: undefined,
                            error: {
                                code: 'INTERNAL_ERROR',
                                message: `Failed to get balance: ${error}`
                            }
                        };
                    }
                };
            }
            if (this.hasPermission(connection, 'pay_invoice')) {
                subscriptionMethods.payInvoice = async (params: {
                    invoice: string;
                }) => {
                    console.log('requesting payInvoice');
                    this.markConnectionUsed(connection.id);
                    try {
                        console.log('params.invoice', params.invoice);
                        console.log('About to decode payment request...');
                        const invoiceInfo =
                            await BackendUtils.decodePaymentRequest([
                                params.invoice
                            ]);
                        console.log('Decoded invoice info:', invoiceInfo);
                        const amountSats =
                            Number(invoiceInfo.num_satoshis) || 0;

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
                                        message: 'Invoice has expired'
                                    }
                                };
                            }
                            console.log(
                                `Invoice expires in ${Math.round(
                                    (expiryTime - now) / 1000
                                )} seconds`
                            );
                        }
                        const budgetValidation =
                            await this.validateBudgetForPayment(
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
                                        'Budget limit exceeded'
                                }
                            };
                        }
                        console.log('About to pay lightning invoice...');
                        const result = await BackendUtils.payLightningInvoice({
                            payment_request: params.invoice,
                            timeout_seconds: 120,
                            fee_limit_sat: 1000,
                            allow_self_payment: true
                        });
                        console.log('Payment result:', result);
                        if (result.payment_error) {
                            return {
                                result: undefined,
                                error: {
                                    code: 'INTERNAL_ERROR',
                                    message: `Failed to pay invoice: ${result.payment_error}`
                                }
                            };
                        }
                        if (
                            result.result &&
                            result.result.status === 'FAILED'
                        ) {
                            const failureReason =
                                result.result.failure_reason ||
                                'Unknown failure';
                            let errorMessage = `Payment failed: ${failureReason}`;
                            if (failureReason === 'FAILURE_REASON_NO_ROUTE') {
                                errorMessage =
                                    'Payment failed: No route found. Check if channels have sufficient liquidity and nodes are connected.';
                            }

                            console.log(
                                'Payment failed with reason:',
                                failureReason
                            );
                            console.log(
                                'Destination:',
                                invoiceInfo.destination
                            );
                            console.log('Amount:', amountSats, 'sats');

                            return {
                                result: undefined,
                                error: {
                                    code: 'PAYMENT_FAILED',
                                    message: errorMessage
                                }
                            };
                        }
                        if (
                            result.result &&
                            result.result.status === 'SUCCEEDED'
                        ) {
                            await this.trackSpending(connection.id, amountSats);
                            return {
                                result: {
                                    preimage: result.result.payment_preimage,
                                    fees_paid: Math.floor(
                                        (result.result.fee || 0) * 1000
                                    )
                                },
                                error: undefined
                            };
                        }
                        if (result.payment_preimage && !result.payment_error) {
                            await this.trackSpending(connection.id, amountSats);
                            return {
                                result: {
                                    preimage: result.payment_preimage,
                                    fees_paid: Math.floor(
                                        (result.fee || 0) * 1000
                                    )
                                },
                                error: undefined
                            };
                        }
                        return {
                            result: undefined,
                            error: {
                                code: 'PAYMENT_FAILED',
                                message: 'Payment failed for unknown reason'
                            }
                        };
                    } catch (error) {
                        return {
                            result: undefined,
                            error: {
                                code: 'INTERNAL_ERROR',
                                message: `Failed to pay invoice: ${error}`
                            }
                        };
                    }
                };
            }

            if (this.hasPermission(connection, 'make_invoice')) {
                console.log('requesting makeInvoice');
                subscriptionMethods.makeInvoice = async (params: any) => {
                    this.markConnectionUsed(connection.id);
                    try {
                        const invoice = await BackendUtils.createInvoice({
                            value: Math.floor(params.amount / 1000),
                            memo: params.description || '',
                            expiry: params.expiry || 3600
                        });
                        console.log('invoice', invoice);
                        return {
                            result: {
                                type: 'incoming' as const,
                                state: 'settled' as const,
                                invoice: invoice.payment_request,
                                description: params.description || '',
                                description_hash: invoice.description_hash,
                                preimage: invoice.r_preimage,
                                payment_hash: invoice.r_hash,
                                amount: params.amount,
                                fees_paid: 0,
                                settled_at: Math.floor(Date.now() / 1000),
                                created_at: Math.floor(Date.now() / 1000),
                                expires_at:
                                    Math.floor(Date.now() / 1000) +
                                    (params.expiry || 3600)
                            },
                            error: undefined
                        };
                    } catch (error) {
                        return Promise.resolve({
                            result: undefined,
                            error: {
                                code: 'INTERNAL_ERROR',
                                message: `Failed to create invoice: ${error}`
                            }
                        });
                    }
                };
            }

            if (this.hasPermission(connection, 'lookup_invoice')) {
                subscriptionMethods.lookupInvoice = async (params: {
                    payment_hash: string;
                }) => {
                    this.markConnectionUsed(connection.id);
                    try {
                        const invoice = await BackendUtils.lookupInvoice({
                            r_hash_str: params.payment_hash
                        });

                        return {
                            result: {
                                type: 'incoming' as const,
                                state: invoice.settled
                                    ? ('settled' as const)
                                    : ('pending' as const),
                                invoice: invoice.payment_request,
                                description: invoice.memo || '',
                                description_hash:
                                    invoice.description_hash || '',
                                preimage: invoice.r_preimage || '',
                                payment_hash:
                                    invoice.r_hash || params.payment_hash,
                                amount: Math.floor((invoice.value || 0) * 1000), // Convert to msats
                                fees_paid: 0, // No fees for incoming invoices
                                settled_at: invoice.settle_date
                                    ? Math.floor(invoice.settle_date)
                                    : Math.floor(Date.now() / 1000),
                                created_at: invoice.creation_date
                                    ? Math.floor(invoice.creation_date)
                                    : Math.floor(Date.now() / 1000),
                                expires_at: invoice.expiry
                                    ? Math.floor(
                                          invoice.creation_date + invoice.expiry
                                      )
                                    : Math.floor(Date.now() / 1000) + 3600
                            },
                            error: undefined
                        };
                    } catch (error) {
                        return {
                            result: undefined,
                            error: {
                                code: 'NOT_FOUND',
                                message: `Invoice not found: ${error}`
                            }
                        };
                    }
                };
            }

            if (this.hasPermission(connection, 'list_transactions')) {
                subscriptionMethods.listTransactions = async () => {
                    console.log('requesting listTransactions');
                    this.markConnectionUsed(connection.id);
                    try {
                        const transactions =
                            await BackendUtils.getTransactions();
                        console.log('transactions', transactions);
                        return {
                            result: {
                                transactions: transactions || [],
                                total_count: transactions?.length || 0
                            },
                            error: undefined
                        };
                    } catch (error) {
                        return Promise.resolve({
                            result: undefined,
                            error: {
                                code: 'INTERNAL_ERROR',
                                message: `Failed to get transactions: ${error}`
                            }
                        });
                    }
                };
            }

            if (this.hasPermission(connection, 'pay_keysend')) {
                subscriptionMethods.payKeysend = async (request: {
                    amount: number;
                    pubkey: string;
                    preimage?: string;
                    tlv_records?: Array<{ type: number; value: string }>;
                }) => {
                    this.markConnectionUsed(connection.id);
                    try {
                        const amountSats = Math.floor(request.amount / 1000);

                        const budgetValidation =
                            await this.validateBudgetForPayment(
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
                                        'Budget limit exceeded'
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
                                message: `Failed to send keysend payment: ${error}`
                            }
                        };
                    }
                };
            }

            const unsubscribe = await this.nwcWalletService.subscribe(
                keypair,
                subscriptionMethods
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
        return this.connections.filter((c) => c.isolated && !c.isExpired);
    }

    public get expiredConnections(): NWCConnection[] {
        return this.connections.filter((c) => c.isExpired);
    }

    public get serviceInfo() {
        return {
            connectionCount: this.activeConnections.length,
            totalConnections: this.connections.length,
            activeSubscriptions: this.activeSubscriptions.size,
            relay: this.currentRelayUrl,
            relayConnected: this.relayConnected,
            relayConnectionAttempts: this.relayConnectionAttempts,
            supportedMethods: [
                'get_info',
                'get_balance',
                'pay_invoice',
                'make_invoice',
                'lookup_invoice',
                'list_transactions',
                'pay_keysend'
            ]
        };
    }

    @action
    public retryRelayConnection = async (): Promise<boolean> => {
        console.log('Manually retrying NWC relay connection...');
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

    public async testConnection(connectionId: string): Promise<void> {
        const connection = this.getConnection(connectionId);
        if (!connection) {
            console.error(`Connection ${connectionId} not found`);
            return;
        }

        try {
            await this.subscribeToConnection(connection);
            console.log(`Successfully subscribed to ${connection.name}`);
        } catch (error) {
            console.error(`Failed to subscribe to ${connection.name}:`, error);
        }
    }

    public getBudgetStatus(connectionId: string): {
        hasBudgetLimit: boolean;
        totalSpent: number;
        budgetLimit?: number;
        remainingBudget: number;
        usagePercentage: number;
        budgetLimitReached: boolean;
        needsBudgetReset: boolean;
        budgetRenewal?: string;
    } | null {
        const connection = this.getConnection(connectionId);
        if (!connection) return null;

        return {
            hasBudgetLimit: connection.hasBudgetLimit,
            totalSpent: connection.totalSpendSats,
            budgetLimit: connection.maxAmountSats,
            remainingBudget: connection.remainingBudget,
            usagePercentage: connection.budgetUsagePercentage,
            budgetLimitReached: connection.budgetLimitReached,
            needsBudgetReset: connection.needsBudgetReset,
            budgetRenewal: connection.budgetRenewal
        };
    }
}
