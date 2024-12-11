//PaymentStore.tsx
import { action, observable } from 'mobx';
import Payment from './../models/Payment';
import SettingsStore from './SettingsStore';
import ChannelsStore from './ChannelsStore';
import BackendUtils from './../utils/BackendUtils';

export default class PaymentsStore {
    @observable loading = false;
    @observable error = false;
    @observable error_msg: string;
    @observable payments: Array<Payment | any> = [];
    @observable last_index_offset: number;
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
    public getPayments = async (indexOffSet: any = undefined) => {
        this.loading = true;
        try {
            if (!indexOffSet) {
                console.log('Fetching all payments..');
            } else console.log('Fetching the last payment', indexOffSet);

            const data = await BackendUtils.getPayments({
                indexOffSet
            });
            const payments = data.payments;
            this.payments = payments
                .slice()
                .reverse()
                .map(
                    (payment: any) =>
                        new Payment(payment, this.channelsStore.nodes)
                );
            this.last_index_offset = data.last_index_offset;
            this.loading = false;
            return this.payments;
        } catch (error) {
            this.resetPayments();
            throw error;
        }
    };
}
