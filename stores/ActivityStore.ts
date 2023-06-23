import { action, observable } from 'mobx';
import EncryptedStorage from 'react-native-encrypted-storage';

// LN
import Payment from './../models/Payment';
import Invoice from './../models/Invoice';
// on-chain
import Transaction from './../models/Transaction';

import SettingsStore from './SettingsStore';
import PaymentsStore from './PaymentsStore';
import InvoicesStore from './InvoicesStore';
import TransactionsStore from './TransactionsStore';

import { localeString } from './../utils/LocaleUtils';
import BackendUtils from './../utils/BackendUtils';

const STORAGE_KEY = 'zeus-activity-filters';

export interface Filter {
    [index: string]: any;
    lightning: boolean;
    onChain: boolean;
    sent: boolean;
    received: boolean;
    unpaid: boolean;
    minimumAmount: number;
    startDate: any;
    endDate: any;
}

export const DEFAULT_FILTERS = {
    lightning: true,
    onChain: true,
    sent: true,
    received: true,
    unpaid: true,
    minimumAmount: 0,
    startDate: null,
    endDate: null
};

export default class ActivityStore {
    @observable public loading = false;
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

    @action
    public resetFilters = async () => {
        this.filters = DEFAULT_FILTERS;
        await EncryptedStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(this.filters)
        );
    };

    @action
    public setFiltersPos = async () => {
        this.filters = {
            lightning: true,
            onChain: true,
            sent: false,
            received: true,
            unpaid: false,
            minimumAmount: 0,
            startDate: null,
            endDate: null
        };
        await EncryptedStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(this.filters)
        );
    };

    @action
    public setAmountFilter = (filter: any) => {
        this.filters.minimumAmount = filter;
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
        this.filters.startDate = null;
    };

    @action
    public clearEndDateFilter = () => {
        this.filters.endDate = null;
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

    @action
    public getActivity = async (locale: string | undefined) => {
        this.loading = true;
        this.activity = [];
        await this.paymentsStore.getPayments();
        if (BackendUtils.supportsOnchainSends())
            await this.transactionsStore.getTransactions();
        await this.invoicesStore.getInvoices(locale);

        this.activity = this.getSortedActivity();
        this.filteredActivity = this.activity;

        this.loading = false;
    };

    @action
    public updateInvoices = async (locale: string | undefined) => {
        await this.invoicesStore.getInvoices(locale);
        this.activity = this.getSortedActivity();
        await this.setFilters(this.filters);
    };

    @action
    public updateTransactions = async () => {
        if (BackendUtils.supportsOnchainSends())
            await this.transactionsStore.getTransactions();
        this.activity = this.getSortedActivity();
        await this.setFilters(this.filters);
    };

    @action
    public async getFilters() {
        this.loading = true;
        try {
            // Retrieve the credentials
            const filters: any = await EncryptedStorage.getItem(STORAGE_KEY);
            if (filters) {
                this.filters = JSON.parse(filters);
            } else {
                console.log('No activity filters stored');
            }
        } catch (error) {
            console.log("Keychain couldn't be accessed!", error);
        } finally {
            this.loading = false;
        }

        return this.filters;
    }

    @action
    public setFilters = async (filters: Filter) => {
        this.loading = true;

        this.filters = filters;

        let filteredActivity = this.activity;

        if (filters.lightning == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        activity.model ===
                            localeString('views.Invoice.title') ||
                        activity.model === localeString('views.Payment.title')
                    )
            );
        }

        if (filters.onChain == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        activity.model ===
                            localeString('general.transaction') &&
                        activity.getAmount != 0
                    )
            );
        }

        if (filters.sent == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        (activity.model ===
                            localeString('general.transaction') &&
                            activity.getAmount < 0) ||
                        activity.model === localeString('views.Payment.title')
                    )
            );
        }

        if (filters.received == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        (activity.model ===
                            localeString('general.transaction') &&
                            activity.getAmount > 0) ||
                        (activity.model ===
                            localeString('views.Invoice.title') &&
                            activity.isPaid)
                    )
            );
        }

        if (filters.unpaid == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        activity.model ===
                            localeString('views.Invoice.title') &&
                        !activity.isPaid
                    )
            );
        }

        if (filters.minimumAmount > 0) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    Math.abs(activity.getAmount) >= filters.minimumAmount
            );
        }

        if (filters.startDate) {
            filteredActivity = filteredActivity.filter(
                (activity: any) => +activity.getDate >= +filters.startDate
            );
        }

        if (filters.endDate) {
            filteredActivity = filteredActivity.filter(
                (activity: any) => +activity.getDate <= +filters.endDate
            );
        }

        this.filteredActivity = filteredActivity;

        await EncryptedStorage.setItem(STORAGE_KEY, JSON.stringify(filters));

        this.loading = false;
    };

    @action
    public getActivityAndFilter = async (
        locale: string | undefined,
        filters: Filter = this.filters
    ) => {
        await this.getActivity(locale);
        await this.setFilters(filters);
    };
}
