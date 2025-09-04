import { action, observable, runInAction } from 'mobx';

// LN
import Payment from './../models/Payment';
import Invoice from './../models/Invoice';
import WithdrawalRequest from '../models/WithdrawalRequest';
// on-chain
import Transaction from './../models/Transaction';

import SettingsStore from './SettingsStore';
import PaymentsStore from './PaymentsStore';
import InvoicesStore from './InvoicesStore';
import TransactionsStore from './TransactionsStore';
import CashuStore from './CashuStore';
import SwapStore from './SwapStore';

import BackendUtils from './../utils/BackendUtils';
import ActivityFilterUtils from '../utils/ActivityFilterUtils';

import Swap from '../models/Swap';

import Storage from '../storage';

export const LEGACY_ACTIVITY_FILTERS_KEY = 'zeus-activity-filters';
export const ACTIVITY_FILTERS_KEY = 'zeus-activity-filters-v2';

export interface Filter {
    [index: string]: any;
    lightning: boolean;
    onChain: boolean;
    cashu: boolean;
    sent: boolean;
    swaps: boolean;
    received: boolean;
    unpaid: boolean;
    inTransit: boolean;
    isFailed: boolean;
    unconfirmed: boolean;
    zeusPay: boolean;
    keysend: boolean;
    minimumAmount: number;
    maximumAmount?: number;
    startDate?: Date;
    endDate?: Date;
    memo: string;
}

export const DEFAULT_FILTERS = {
    lightning: true,
    onChain: true,
    cashu: true,
    sent: true,
    swaps: true,
    received: true,
    unpaid: true,
    inTransit: false,
    isFailed: false,
    unconfirmed: true,
    standardInvoices: true,
    ampInvoices: true,
    zeusPay: true,
    keysend: true,
    minimumAmount: 0,
    maximumAmount: undefined,
    startDate: undefined,
    endDate: undefined,
    memo: ''
};

export default class ActivityStore {
    @observable public error = false;
    @observable public activity: Array<
        Invoice | Payment | Transaction | WithdrawalRequest | Swap
    > = [];
    @observable public filteredActivity: Array<
        Invoice | Payment | Transaction | WithdrawalRequest | Swap
    > = [];
    @observable public filters: Filter = DEFAULT_FILTERS;
    settingsStore: SettingsStore;
    paymentsStore: PaymentsStore;
    invoicesStore: InvoicesStore;
    transactionsStore: TransactionsStore;
    cashuStore: CashuStore;
    swapStore: SwapStore;

    constructor(
        settingsStore: SettingsStore,
        paymentsStore: PaymentsStore,
        invoicesStore: InvoicesStore,
        transactionsStore: TransactionsStore,
        cashuStore: CashuStore,
        swapStore: SwapStore
    ) {
        this.settingsStore = settingsStore;
        this.paymentsStore = paymentsStore;
        this.transactionsStore = transactionsStore;
        this.invoicesStore = invoicesStore;
        this.cashuStore = cashuStore;
        this.swapStore = swapStore;
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
            sent: false,
            received: true,
            unpaid: false,
            inTransit: false,
            isFailed: false,
            unconfirmed: true,
            zeusPay: true,
            keysend: true,
            minimumAmount: 0,
            maximumAmount: undefined,
            startDate: undefined,
            endDate: undefined,
            memo: '',
            swaps: true
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

    getSortedActivity = async () => {
        const activity: any[] = [];
        const payments = this.paymentsStore.payments;
        const transactions = this.transactionsStore.transactions;
        const invoices = this.invoicesStore.invoices;
        const withdrawalRequests = this.invoicesStore.withdrawalRequests;
        const swaps = this.swapStore.swaps;

        let additions = payments.concat(invoices);
        additions = additions.concat(withdrawalRequests);
        additions = additions.concat(swaps);
        if (BackendUtils.supportsOnchainSends()) {
            additions = additions.concat(transactions);
        }

        if (
            BackendUtils.supportsCashuWallet() &&
            this.settingsStore.settings?.ecash?.enableCashu
        ) {
            const cashuInvoices = this.cashuStore.invoices;
            const cashuPayments = this.cashuStore.payments;
            const cashuReceivedTokens = this.cashuStore.receivedTokens;
            const cashuSentTokens = this.cashuStore.sentTokens;

            additions = additions
                .concat(cashuInvoices)
                .concat(cashuPayments)
                .concat(cashuReceivedTokens)
                .concat(cashuSentTokens);
        }

        // push payments, txs, invoices and withdrawal requests to one array
        activity.push.apply(activity, additions);
        // sort activity by timestamp
        const resolvedTuples = await Promise.all(
            activity.map(async (item: any) => {
                let timestamp: number;

                if (!item.getTimestamp && item.bolt12) {
                    const ts = await Storage.getItem(
                        `withdrawalRequest_${item.bolt12}`
                    );
                    timestamp = Math.round(Number(ts) / 1000);
                } else {
                    timestamp = item.getTimestamp;
                }
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
        if (BackendUtils.supportsWithdrawalRequests()) {
            await this.invoicesStore.getWithdrawalRequests();
            await this.invoicesStore.getRedeemedWithdrawalRequests();
        }
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

    public updateWithdrawalRequest = async (locale: string | undefined) => {
        if (BackendUtils.supportsWithdrawalRequests())
            await this.invoicesStore.getWithdrawalRequests();
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
                this.filters = { ...DEFAULT_FILTERS, ...parsedFilters };
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
        this.filters = { ...DEFAULT_FILTERS, ...filters };
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
        await this.getActivity();
        await this.setFilters(filters, locale);
    };
}
