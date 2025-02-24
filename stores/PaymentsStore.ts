//PaymentStore.tsx
import { action, observable, runInAction } from 'mobx';
import Payment from './../models/Payment';
import SettingsStore from './SettingsStore';
import ChannelsStore from './ChannelsStore';
import BackendUtils from './../utils/BackendUtils';

export default class PaymentsStore {
    @observable loading = false;
    @observable error = false;
    @observable error_msg: string;
    @observable payments: Array<Payment | any> = [];
    settingsStore: SettingsStore;
    channelsStore: ChannelsStore;

    constructor(settingsStore: SettingsStore, channelsStore: ChannelsStore) {
        this.settingsStore = settingsStore;
        this.channelsStore = channelsStore;
    }

    @action
    private resetPayments = () => {
        this.payments = [];
        this.loading = false;
    };

    public getPayments = async (params?: {
        maxPayments?: number;
        reversed?: boolean;
    }) => {
        this.loading = true;
        try {
            const data = await BackendUtils.getPayments(params);
            const payments = data.payments;
            runInAction(() => {
                this.payments = payments
                    .slice()
                    .reverse()
                    .map(
                        (payment: any) =>
                            new Payment(payment, this.channelsStore.nodes)
                    );
                this.loading = false;
            });
            return this.payments;
        } catch (error) {
            this.resetPayments();
            throw error;
        }
    };
}
