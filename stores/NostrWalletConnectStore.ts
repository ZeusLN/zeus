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
const RELAY_URL = 'wss://relay.getalby.com/v1';

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

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
        this.nwcWalletService = new nwc.NWCWalletService({
            relayUrl: RELAY_URL
        });
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
            // Load connections
            await this.loadConnections();

            await this.startService();
            runInAction(() => {
                this.loadingMsg = undefined;
                this.initializing = false;
            });

            const completionTime =
                (new Date().getTime() - start.getTime()) / 1000 + 's';
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

    private generateServiceKey(): string {
        try {
            const privateKey = generatePrivateKey();
            return privateKey;
        } catch (error) {
            return Array.from({ length: 64 }, () =>
                Math.floor(Math.random() * 16).toString(16)
            ).join('');
        }
    }

    private derivePublicKey(privateKeyHex: string): string {
        try {
            return getPublicKey(privateKeyHex);
        } catch (error) {
            return 'npub' + privateKeyHex.substring(0, 60);
        }
    }

    private generateConnectionId(): string {
        return (
            Date.now().toString(36) + Math.random().toString(36).substring(2)
        );
    }

    private generateConnectionString(connectionPrivateKey: string): string {
        const relay = 'wss://relay.getalby.com/v1';
        const connectionPublicKey = this.derivePublicKey(connectionPrivateKey);
        const connectionString = `nostr+walletconnect://${connectionPublicKey}?relay=${encodeURIComponent(
            relay
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
            const connectionPrivateKey = this.generateServiceKey();
            const connectionPublicKey =
                this.derivePublicKey(connectionPrivateKey);

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
                    'list_transactions',
                    'pay_keysend'
                ],
                createdAt: new Date(),
                budgetAmount: params.budgetAmount,
                budgetRenewal: params.budgetRenewal || 'never',
                expiresAt: params.expiresAt
            };

            const connection = new NWCConnection(connectionData);

            // Store the private key separately
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
                Object.assign(connection, updates);
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
            connection.lastUsed = new Date();
            await this.saveConnections();
            if (
                wasNeverUsed &&
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
        this.waitingForConnection = false;
        this.currentConnectionId = undefined;
    };

    private async subscribeToAllConnections(): Promise<void> {
        const activeConnections = this.connections.filter(
            (c) => c.isolated && !c.isExpired
        );

        for (const connection of activeConnections) {
            await this.subscribeToConnection(connection);
        }
    }

    private async subscribeToConnection(
        connection: NWCConnection
    ): Promise<void> {
        try {
            await this.unsubscribeFromConnection(connection.id);

            // Get the private key for this connection
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

            const unsubscribe = await this.nwcWalletService.subscribe(keypair, {
                getInfo: () => {
                    this.markConnectionUsed(connection.id);
                    try {
                        return BackendUtils.getMyNodeInfo().then(
                            (nodeInfo: any) => ({
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
                                    methods: ['get_info']
                                },
                                error: undefined
                            })
                        );
                    } catch (error) {
                        return Promise.resolve({
                            result: undefined,
                            error: {
                                code: 'INTERNAL_ERROR',
                                message: `Failed to get node info: ${error}`
                            }
                        });
                    }
                },
                getBalance: () => {
                    this.markConnectionUsed(connection.id);
                    try {
                        return BackendUtils.getLightningBalance().then(
                            (lightningBalance: any) => {
                                const balanceSats =
                                    lightningBalance?.balance || 0;
                                const balanceMsats = Math.floor(
                                    balanceSats * 1000
                                );
                                return {
                                    result: {
                                        balance: balanceMsats
                                    },
                                    error: undefined
                                };
                            }
                        );
                    } catch (error) {
                        return Promise.resolve({
                            result: undefined,
                            error: {
                                code: 'INTERNAL_ERROR',
                                message: `Failed to get balance: ${error}`
                            }
                        });
                    }
                },
                payInvoice: (params: { invoice: string }) => {
                    this.markConnectionUsed(connection.id);
                    try {
                        return BackendUtils.payLightningInvoice({
                            payment_request: params.invoice
                        }).then((result: any) => ({
                            result: {
                                preimage: result.payment_preimage,
                                fees_paid: Math.floor((result.fee || 0) * 1000)
                            },
                            error: undefined
                        }));
                    } catch (error) {
                        return Promise.resolve({
                            result: undefined,
                            error: {
                                code: 'INTERNAL_ERROR',
                                message: `Failed to pay invoice: ${error}`
                            }
                        });
                    }
                },
                makeInvoice: (params: any) => {
                    this.markConnectionUsed(connection.id);
                    try {
                        return BackendUtils.createInvoice({
                            value: Math.floor(params.amount / 1000),
                            memo: params.description || '',
                            expiry: params.expiry || 3600
                        }).then((invoice: any) => ({
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
                        }));
                    } catch (error) {
                        return Promise.resolve({
                            result: undefined,
                            error: {
                                code: 'INTERNAL_ERROR',
                                message: `Failed to create invoice: ${error}`
                            }
                        });
                    }
                },
                listTransactions: () => {
                    this.markConnectionUsed(connection.id);
                    try {
                        return BackendUtils.getTransactions().then(
                            (transactions: any) => ({
                                result: {
                                    transactions: transactions || [],
                                    total_count: transactions?.length || 0
                                },
                                error: undefined
                            })
                        );
                    } catch (error) {
                        return Promise.resolve({
                            result: undefined,
                            error: {
                                code: 'INTERNAL_ERROR',
                                message: `Failed to get transactions: ${error}`
                            }
                        });
                    }
                },
                payKeysend: (request: {
                    amount: number;
                    pubkey: string;
                    preimage?: string;
                    tlv_records?: Array<{ type: number; value: string }>;
                }) => {
                    this.markConnectionUsed(connection.id);
                    try {
                        return BackendUtils.payLightningInvoice({
                            payment_request: request.pubkey,
                            amt: request.amount
                        }).then((result: any) => ({
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
                        }));
                    } catch (error) {
                        return Promise.resolve({
                            result: undefined,
                            error: {
                                code: 'INTERNAL_ERROR',
                                message: `Failed to send keysend payment: ${error}`
                            }
                        });
                    }
                }
            });

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
            relay: 'wss://relay.getalby.com/v1',
            supportedMethods: [
                'get_info',
                'get_balance',
                'pay_invoice',
                'make_invoice',
                'list_transactions',
                'pay_keysend'
            ]
        };
    }

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
}
