import { action, observable, runInAction } from 'mobx';

// LN
import Payment from './../models/Payment';
import Invoice from './../models/Invoice';
// on-chain
import Transaction from './../models/Transaction';

import SettingsStore from './SettingsStore';
import PaymentsStore from './PaymentsStore';
import InvoicesStore from './InvoicesStore';
import TransactionsStore from './TransactionsStore';

import BackendUtils from './../utils/BackendUtils';
import ActivityFilterUtils from '../utils/ActivityFilterUtils';

import Storage from '../storage';

export const LEGACY_ACTIVITY_FILTERS_KEY = 'zeus-activity-filters';
export const ACTIVITY_FILTERS_KEY = 'zeus-activity-filters-v2';

export interface Filter {
    [index: string]: any;
    lightning: boolean;
    onChain: boolean;
    sent: boolean;
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
    sent: true,
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
    @observable public activity: Array<Invoice | Payment | Transaction> = [];
    @observable public filteredActivity: Array<
        Invoice | Payment | Transaction
    > = [];
    @observable public filters: Filter = DEFAULT_FILTERS;
    settingsStore: SettingsStore;
    paymentsStore: PaymentsStore;
    invoicesStore: InvoicesStore;
    transactionsStore: TransactionsStore;

    constructor(
        settingsStore: SettingsStore,
        paymentsStore: PaymentsStore,
        invoicesStore: InvoicesStore,
        transactionsStore: TransactionsStore
    ) {
        this.settingsStore = settingsStore;
        this.paymentsStore = paymentsStore;
        this.transactionsStore = transactionsStore;
        this.invoicesStore = invoicesStore;
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
            memo: ''
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

    getSortedActivity = () => {
        const activity: any[] = [];
        const payments = this.paymentsStore.payments;
        const transactions = this.transactionsStore.transactions;
        const invoices = this.invoicesStore.invoices;

        // push payments, txs, invoices to one array
        activity.push.apply(
            activity,
            BackendUtils.supportsOnchainSends()
                ? payments.concat(transactions).concat(invoices)
                : payments.concat(invoices)
        );
        // sort activity by timestamp
        const sortedActivity = activity.sort((a: any, b: any) =>
            a.getTimestamp < b.getTimestamp ? 1 : -1
        );

        return sortedActivity;
    };

    private getActivity = async () => {
        this.activity = [];
        await this.paymentsStore.getPayments();
        if (BackendUtils.supportsOnchainSends())
            await this.transactionsStore.getTransactions();
        await this.invoicesStore.getInvoices();

        runInAction(() => {
            this.activity = this.getSortedActivity();
            this.filteredActivity = this.activity;
        });
    };

    public updateInvoices = async (locale: string | undefined) => {
        await this.invoicesStore.getInvoices();
        await runInAction(async () => {
            this.activity = this.getSortedActivity();
            await this.setFilters(this.filters, locale);
        });
    };

    public updateTransactions = async (locale: string | undefined) => {
        if (BackendUtils.supportsOnchainSends())
            await this.transactionsStore.getTransactions();
        await runInAction(async () => {
            this.activity = this.getSortedActivity();
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
