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

interface ActivityFilter {
    lightning: boolean;
    onChain: boolean;
    channels: boolean;
    sent: boolean;
    received: boolean;
    startDate: any;
    endDate: any;
}

export default class ActivityStore {
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
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

    @action
    public getActivity = async () => {
        this.loading = true;
        this.activity = [];
        await this.paymentsStore.getPayments();
        await this.transactionsStore.getTransactions();
        await this.invoicesStore.getInvoices();
        const activity = [];
        const payments = this.paymentsStore.payments;
        const transactions = this.transactionsStore.transactions;
        const invoices = this.invoicesStore.invoices;

        // push payments, txs, invoices to one array
        activity.push.apply(
            activity,
            payments.concat(transactions).concat(invoices)
        );
        // sort activity by timestamp
        const sortedActivity = activity.sort((a, b) =>
            a.getTimestamp < b.getTimestamp ? 1 : -1
        );

        this.activity = sortedActivity;
        this.filteredActivity = this.activity;

        this.loading = false;
    };

    @action
    public resetFilters = async () => {
        this.filters = {
            lightning: true,
            onChain: true,
            channels: true,
            sent: true,
            received: true
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
                        activity.model === 'Transaction' &&
                        activity.getAmount == 0
                    )
            );
        }

        if (filters.lightning == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        activity.model === 'Invoice' ||
                        activity.model === 'Payment'
                    )
            );
        }

        if (filters.onChain == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        activity.model === 'Transaction' &&
                        activity.getAmount != 0
                    )
            );
        }

        if (filters.sent == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        (activity.model === 'Transaction' &&
                            activity.getAmount < 0) ||
                        activity.model === 'Payment'
                    )
            );
        }

        if (filters.received == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        (activity.model === 'Transaction' &&
                            activity.getAmount > 0) ||
                        activity.model === 'Invoice'
                    )
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
