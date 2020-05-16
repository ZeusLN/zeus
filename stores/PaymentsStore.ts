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

    constructor(settingsStore: SettingsStore, channelsStore: ChannelsStore) {
        this.settingsStore = settingsStore;
        this.channelsStore = channelsStore;
    }

    resetPayments = () => {
        this.payments = [];
        this.loading = false;
    };

    @action
    public getPayments = () => {
        this.loading = true;
        RESTUtils.getPayments(this.settingsStore)
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    // handle success
                    const data = response.json();
                    const payments = data.transaction || data.payments;
                    this.payments = payments
                        .slice()
                        .reverse()
                        .map(
                            (payment: any) =>
                                new Payment(payment, this.channelsStore.nodes)
                        );
                    this.loading = false;
                } else {
                    this.resetPayments();
                }
            })
            .catch(() => {
                this.resetPayments();
            });
    };
}
