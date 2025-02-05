import { action, observable } from 'mobx';
import Payment from './../models/Payment';
import SettingsStore from './SettingsStore';
import ChannelsStore from './ChannelsStore';
import BackendUtils from './../utils/BackendUtils';
import { AbortSignal } from 'abort-controller';

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

    reset = () => {
        this.resetPayments();
        this.error = false;
        this.error_msg = '';
    };

    resetPayments = () => {
        this.payments = [];
        this.loading = false;
    };

    @action
    public getPayments = async (
        abortSignal: AbortSignal,
        params?: {
            maxPayments?: number;
            reversed?: boolean;
        }
    ) => {
        this.loading = true;
        try {
            const data = await BackendUtils.getPayments(params, abortSignal);
            const payments = data.payments;
            this.payments = payments
                .slice()
                .reverse()
                .map(
                    (payment: any) =>
                        new Payment(payment, this.channelsStore.nodes)
                );
            this.loading = false;
            return this.payments;
        } catch (error) {
            this.resetPayments();
            throw error;
        }
    };
}
