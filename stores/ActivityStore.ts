import { action, observable, runInAction } from 'mobx';

// LN
import Payment from './../models/Payment';
import Invoice from './../models/Invoice';

import Swap, { SwapState } from './../models/Swap';

//on-chain
import Transaction from './../models/Transaction';

import { LSPActivity, LSPOrderState } from './../models/LSP';

import SettingsStore from './SettingsStore';
import PaymentsStore from './PaymentsStore';
import InvoicesStore from './InvoicesStore';
import TransactionsStore from './TransactionsStore';
import CashuStore from './CashuStore';
import SwapStore from './SwapStore';
import NodeInfoStore from './NodeInfoStore';

import BackendUtils from './../utils/BackendUtils';
import ActivityFilterUtils from '../utils/ActivityFilterUtils';
import DateTimeUtils from '../utils/DateTimeUtils';

import Storage from '../storage';

import { LSPS_ORDERS_KEY } from './LSPStore';

export const LEGACY_ACTIVITY_FILTERS_KEY = 'zeus-activity-filters';
export const ACTIVITY_FILTERS_KEY = 'zeus-activity-filters-v2';

export const SERVICES_CONFIG = {
    swaps: 'swapFilter',
    lsps1: 'lsps1State',
    lsps7: 'lsps7State'
};

const createSwapStateRecord = (
    initialValue: boolean
): Record<SwapState, boolean> => {
    return Object.values(SwapState).reduce((acc, state) => {
        acc[state] = initialValue;
        return acc;
    }, {} as Record<SwapState, boolean>);
};

type ActivityItem = Invoice | Payment | Transaction | Swap | LSPActivity;

export interface Filter {
    [index: string]: any;
    lightning: boolean;
    onChain: boolean;
    cashu: boolean;
    sent: boolean;
    swaps: boolean;
    submarine: boolean;
    reverse: boolean;
    lsps1: boolean;
    lsps7: boolean;
    received: boolean;
    unpaid: boolean;
    inTransit: boolean;
    isFailed: boolean;
    unconfirmed: boolean;
    zeusPay: boolean;
    keysend: boolean;
    circularRebalance: boolean;
    minimumAmount: number;
    maximumAmount?: number;
    startDate?: Date;
    endDate?: Date;
    memo: string;
    swapFilter: {
        submarine: Record<SwapState, boolean>;
        reverse: Record<SwapState, boolean>;
    };
    lsps1State: Record<LSPOrderState, boolean>;
    lsps7State: Record<LSPOrderState, boolean>;
}

export const DEFAULT_FILTERS = {
    lightning: true,
    onChain: true,
    cashu: true,
    sent: true,
    swaps: true,
    submarine: true,
    reverse: true,
    lsps1: true,
    lsps7: true,
    received: true,
    unpaid: true,
    inTransit: false,
    isFailed: false,
    unconfirmed: true,
    standardInvoices: true,
    ampInvoices: true,
    zeusPay: true,
    keysend: true,
    circularRebalance: true,
    minimumAmount: 0,
    maximumAmount: undefined,
    startDate: undefined,
    endDate: undefined,
    memo: '',
    swapFilter: {
        submarine: createSwapStateRecord(true),
        reverse: createSwapStateRecord(true)
    },
    lsps1State: {
        [LSPOrderState.CREATED]: true,
        [LSPOrderState.COMPLETED]: true,
        [LSPOrderState.FAILED]: true
    },
    lsps7State: {
        [LSPOrderState.CREATED]: true,
        [LSPOrderState.COMPLETED]: true,
        [LSPOrderState.FAILED]: true
    }
};

export default class ActivityStore {
    @observable public error = false;
    @observable public activity: Array<ActivityItem> = [];
    @observable public filteredActivity: Array<ActivityItem> = [];
    @observable public filters: Filter = DEFAULT_FILTERS;
    settingsStore: SettingsStore;
    paymentsStore: PaymentsStore;
    invoicesStore: InvoicesStore;
    transactionsStore: TransactionsStore;
    cashuStore: CashuStore;
    swapStore: SwapStore;
    nodeInfoStore: NodeInfoStore;

    constructor(
        settingsStore: SettingsStore,
        paymentsStore: PaymentsStore,
        invoicesStore: InvoicesStore,
        transactionsStore: TransactionsStore,
        cashuStore: CashuStore,
        swapStore: SwapStore,
        nodeInfoStore: NodeInfoStore
    ) {
        this.settingsStore = settingsStore;
        this.paymentsStore = paymentsStore;
        this.transactionsStore = transactionsStore;
        this.invoicesStore = invoicesStore;
        this.cashuStore = cashuStore;
        this.swapStore = swapStore;
        this.nodeInfoStore = nodeInfoStore;
    }

    public resetFilters = async () => {
        this.filters = DEFAULT_FILTERS;
        await Storage.setItem(ACTIVITY_FILTERS_KEY, this.filters);
        this.setFilters(this.filters);
    };

    public setFiltersPos = async () => {
        this.filters = {
            lightning: true,
            onChain: true,
            cashu: true,
            swaps: true,
            submarine: true,
            reverse: true,
            lsps1: true,
            lsps7: true,
            sent: false,
            received: true,
            unpaid: false,
            inTransit: false,
            isFailed: false,
            unconfirmed: true,
            zeusPay: true,
            keysend: true,
            circularRebalance: true,
            minimumAmount: 0,
            maximumAmount: undefined,
            startDate: undefined,
            endDate: undefined,
            memo: '',
            swapFilter: { ...DEFAULT_FILTERS.swapFilter },
            lsps1State: { ...DEFAULT_FILTERS.lsps1State },
            lsps7State: { ...DEFAULT_FILTERS.lsps7State }
        };
        await Storage.setItem(ACTIVITY_FILTERS_KEY, this.filters);
    };

    @action
    public setAmountFilter = (filter: any) => {
        this.filters.minimumAmount = filter;
        this.setFilters(this.filters);
    };

    @action
    public setKeysendFilter = (filter: any) => {
        this.filters.keysend = filter;
        this.setFilters(this.filters);
    };

    @action
    public setMaximumAmountFilter = (filter: any) => {
        this.filters.maximumAmount = filter;
        this.setFilters(this.filters);
    };

    @action
    public setStartDateFilter = (filter: any) => {
        this.filters.startDate = filter;
        this.setFilters(this.filters);
    };

    @action
    public setEndDateFilter = (filter: any) => {
        this.filters.endDate = filter;
        this.setFilters(this.filters);
    };

    @action
    public clearStartDateFilter = () => {
        this.filters.startDate = undefined;
        this.setFilters(this.filters);
    };

    @action
    public clearEndDateFilter = () => {
        this.filters.endDate = undefined;
        this.setFilters(this.filters);
    };

    @action
    public setMemoFilter = (filter: any) => {
        this.filters.memo = filter;
        this.setFilters(this.filters);
    };

    private async getLSPOrders(): Promise<any[]> {
        try {
            const responseArrayString = await Storage.getItem(LSPS_ORDERS_KEY);
            if (!responseArrayString) return [];

            const responseArray = JSON.parse(responseArrayString);
            const decodedResponses = responseArray.map((res: string) =>
                JSON.parse(res)
            );

            const currentNodeId = this.nodeInfoStore.nodeInfo.nodeId;
            const selectedOrders = decodedResponses.filter(
                (res: any) => res.clientPubkey === currentNodeId
            );

            return selectedOrders.map((res: any) => {
                const orderData = res?.order?.result || res?.order;
                const createdAt = orderData?.created_at;
                const timestamp = createdAt
                    ? new Date(createdAt).getTime() / 1000
                    : 0;

                if (res.service === 'LSPS7') {
                    const payment = orderData?.payment;
                    const fee =
                        payment?.bolt11?.order_total_sat ||
                        payment?.fee_total_sat ||
                        0;
                    return {
                        model: 'LSPS7Order',
                        id: orderData?.order_id,
                        state: orderData?.order_state,
                        getAmount: Number(fee),
                        getTimestamp: timestamp,
                        getDate: new Date(createdAt),
                        getDisplayTimeShort:
                            DateTimeUtils.listFormattedDateShort(timestamp)
                    };
                }

                return {
                    model: 'LSPS1Order',
                    id: orderData?.order_id,
                    state: orderData?.order_state,
                    getAmount: Number(orderData?.lsp_balance_sat) || 0,
                    getTimestamp: timestamp,
                    getDate: new Date(createdAt),
                    getDisplayTimeShort:
                        DateTimeUtils.listFormattedDateShort(timestamp)
                };
            });
        } catch (error) {
            console.error(
                'Error fetching LSP Orders for activity list:',
                error
            );
            return [];
        }
    }

    getSortedActivity = async () => {
        const activity: any[] = [];
        const payments = this.paymentsStore.payments;
        const transactions = this.transactionsStore.transactions;
        const invoices = this.invoicesStore.invoices;
        const swaps = this.swapStore.swaps;
        const lspOrders = await this.getLSPOrders();

        let additions = payments.concat(invoices);

        additions = additions.concat(swaps);
        additions = additions.concat(lspOrders);

        if (BackendUtils.supportsOnchainSends()) {
            additions = additions.concat(transactions);
        }

        if (
            BackendUtils.supportsCashuWallet() &&
            this.settingsStore.settings?.ecash?.enableCashu
        ) {
            // CDK transaction history (completed)
            additions = additions.concat(this.cashuStore.cdkInvoices);
            additions = additions.concat(this.cashuStore.cdkPayments);

            // Include pending/unpaid Cashu invoices (from local storage)
            const pendingCashuInvoices = this.cashuStore.invoices?.filter(
                (invoice) => !invoice.isPaid
            );
            if (pendingCashuInvoices) {
                additions = additions.concat(pendingCashuInvoices);
            }

            // Include Cashu tokens (sent and received)
            if (this.cashuStore.sentTokens) {
                additions = additions.concat(this.cashuStore.sentTokens);
            }
            if (this.cashuStore.receivedTokens) {
                additions = additions.concat(this.cashuStore.receivedTokens);
            }
        }

        // push payments, txs, invoices to one array
        activity.push.apply(activity, additions);
        // sort activity by timestamp
        const resolvedTuples = await Promise.all(
            activity.map(async (item: any) => {
                let timestamp = item.getTimestamp;
                return [item, timestamp] as const;
            })
        );

        const sortedActivity = resolvedTuples
            .sort((a, b) => b[1] - a[1])
            .map(([item]) => item);

        return sortedActivity;
    };

    private getActivity = async () => {
        this.activity = [];
        await this.paymentsStore.getPayments();
        if (BackendUtils.supportsOnchainSends())
            await this.transactionsStore.getTransactions();
        await this.invoicesStore.getInvoices();

        await this.swapStore.fetchAndUpdateSwaps();
        const sortedActivity = await this.getSortedActivity();

        runInAction(() => {
            this.activity = sortedActivity;
            this.filteredActivity = this.activity;
        });
    };

    public updateInvoices = async (locale: string | undefined) => {
        await this.invoicesStore.getInvoices();
        await runInAction(async () => {
            this.activity = await this.getSortedActivity();
            await this.setFilters(this.filters, locale);
        });
    };

    public updateTransactions = async (locale: string | undefined) => {
        if (BackendUtils.supportsOnchainSends())
            await this.transactionsStore.getTransactions();
        await runInAction(async () => {
            this.activity = await this.getSortedActivity();
            await this.setFilters(this.filters, locale);
        });
    };

    public async getFilters() {
        try {
            const filters = await Storage.getItem(ACTIVITY_FILTERS_KEY);
            if (filters) {
                const parsedFilters = JSON.parse(filters, (key, value) =>
                    (key === 'startDate' || key === 'endDate') && value
                        ? new Date(value)
                        : value
                );
                this.filters = {
                    ...DEFAULT_FILTERS,
                    ...parsedFilters,
                    swapFilter: {
                        submarine: {
                            ...DEFAULT_FILTERS.swapFilter.submarine,
                            ...(parsedFilters.swapFilter?.submarine || {})
                        },
                        reverse: {
                            ...DEFAULT_FILTERS.swapFilter.reverse,
                            ...(parsedFilters.swapFilter?.reverse || {})
                        }
                    },
                    lsps1State: {
                        ...DEFAULT_FILTERS.lsps1State,
                        ...(parsedFilters.lsps1State || {})
                    },
                    lsps7State: {
                        ...DEFAULT_FILTERS.lsps7State,
                        ...(parsedFilters.lsps7State || {})
                    }
                };
            } else {
                console.log('No activity filters stored');
                this.filters = DEFAULT_FILTERS;
            }
        } catch (error) {
            console.log('Loading activity filters failed', error);
        }

        return this.filters;
    }

    @action
    public setFilters = async (filters: Filter, locale?: string) => {
        this.filters = {
            ...DEFAULT_FILTERS,
            ...filters,
            swapFilter: {
                submarine: {
                    ...DEFAULT_FILTERS.swapFilter.submarine,
                    ...filters.swapFilter?.submarine
                },
                reverse: {
                    ...DEFAULT_FILTERS.swapFilter.reverse,
                    ...filters.swapFilter?.reverse
                }
            },
            lsps1State: {
                ...DEFAULT_FILTERS.lsps1State,
                ...filters.lsps1State
            },
            lsps7State: {
                ...DEFAULT_FILTERS.lsps7State,
                ...filters.lsps7State
            }
        };
        this.filteredActivity = ActivityFilterUtils.filterActivities(
            this.activity,
            this.filters
        );
        this.filteredActivity.forEach((activity) => {
            if (activity instanceof Invoice) {
                activity.determineFormattedRemainingTimeUntilExpiry(locale);
            }
        });
        Storage.setItem(ACTIVITY_FILTERS_KEY, this.filters);
    };

    public getActivityAndFilter = async (
        locale: string | undefined,
        filters: Filter = this.filters
    ) => {
        // Check pending Cashu items (invoices and tokens) in background
        this.cashuStore.checkPendingItems();

        await this.getActivity();
        await this.setFilters(filters, locale);
    };
}
