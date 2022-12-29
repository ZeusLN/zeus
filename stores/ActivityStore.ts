import { action, observable } from 'mobx';
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

interface ActivityFilter {
    [index: string]: any;
    lightning: boolean;
    onChain: boolean;
    channels: boolean;
    sent: boolean;
    received: boolean;
    minimumAmount: number;
    startDate: any;
    endDate: any;
}

export default class ActivityStore {
    @observable public loading = false;
    @observable public error = false;
    @observable public activity: Array<Invoice | Payment | Transaction> = [];
    @observable public filteredActivity: Array<
        Invoice | Payment | Transaction
    > = [];
    @observable public filters: ActivityFilter = {
        lightning: true,
        onChain: true,
        channels: true,
        sent: true,
        received: true,
        startDate: null,
        endDate: null
    };
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
        const activity: any = [];
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
    public getActivity = async () => {
        this.loading = true;
        this.activity = [];
        await this.paymentsStore.getPayments();
        if (BackendUtils.supportsOnchainSends())
            await this.transactionsStore.getTransactions();
        await this.invoicesStore.getInvoices();

        this.activity = this.getSortedActivity();
        this.filteredActivity = this.activity;

        this.loading = false;
    };

    @action
    public updateInvoices = async () => {
        await this.invoicesStore.getInvoices();
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
    public resetFilters = async () => {
        this.filters = {
            lightning: true,
            onChain: true,
            channels: true,
            sent: true,
            received: true,
            minimumAmount: 0,
            startDate: null,
            endDate: null
        };
    };

    @action
    public setFilters = async (filters: any) => {
        this.loading = true;

        this.filters = filters;

        let filteredActivity = this.activity;
        if (filters.channels == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        activity.model ===
                            localeString('general.transaction') &&
                        activity.getAmount == 0
                    )
            );
        }

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
                        activity.model === localeString('views.Invoice.title')
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

        this.loading = false;
    };

    @action
    public getActivityAndFilter = async (filters: any = this.filters) => {
        await this.getActivity();
        await this.setFilters(filters);
    };
}
