//PaymentStore.tsx
import { action, observable, runInAction } from 'mobx';
import Payment from './../models/Payment';
import SettingsStore from './SettingsStore';
import ChannelsStore from './ChannelsStore';
import BackendUtils from './../utils/BackendUtils';
import { LndPaymentListParams } from '../utils/LndUtils';

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

    public getPayments = async (params?: LndPaymentListParams) => {
        this.loading = true;
        try {
            const payments = await this.fetchPayments(params);
            runInAction(() => {
                this.payments = payments;
                this.loading = false;
            });
            return this.payments;
        } catch (error) {
            this.resetPayments();
            throw error;
        }
    };

    public fetchPayments = async (params?: LndPaymentListParams) => {
        const data = await BackendUtils.getPayments(params);
        return data.payments
            .slice()
            .reverse()
            .map(
                (payment: any) => new Payment(payment, this.channelsStore.nodes)
            );
    };
}
