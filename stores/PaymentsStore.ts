import { action, observable } from 'mobx';
import Payment from './../models/Payment';
import SettingsStore from './SettingsStore';
import ChannelsStore from './ChannelsStore';
import RESTUtils from './../utils/RESTUtils';

export default class PaymentsStore {
    @observable loading: boolean = false;
    @observable error: boolean = false;
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
    public getPayments = () => {
        this.loading = true;
        RESTUtils.getPayments()
            .then((data: any) => {
                const payments = data.transaction || data.payments || data;
                this.payments = payments
                    .slice()
                    .reverse()
                    .map(
                        (payment: any) =>
                            new Payment(payment, this.channelsStore.nodes)
                    );
                this.loading = false;
            })
            .catch(() => {
                this.resetPayments();
            });
    };
}
