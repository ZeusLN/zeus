import { action, observable } from 'mobx';
import axios from 'axios';
import Payment from './../models/Payment';
import SettingsStore from './SettingsStore';

export default class PaymentsStore {
    @observable loading: boolean = false;
    @observable error: boolean = false;
    @observable error_msg: string;
    @observable payments: Array<Payment> = [];
    settingsStore: SettingsStore

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @action
    public getPayments = () => {
        const { settings } = this.settingsStore;
        const { host, port, macaroonHex } = settings;

        this.loading = true;
        axios.request({
            method: 'get',
            url: `https://${host}${port ? ':' + port : ''}/v1/payments`,
            headers: {
                'Grpc-Metadata-macaroon': macaroonHex
            }
        }).then((response: any) => {
            // handle success
            const data = response.data;
            this.payments = data.payments;
            this.loading = false;
        })
        .catch(() => {
            // handle error
            this.payments = [];
            this.loading = false;
        });
    }
}