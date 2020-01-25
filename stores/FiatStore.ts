import { action, observable } from 'mobx';
import axios from 'axios';
import SettingsStore from './SettingsStore';

export default class FiatStore {
    @observable public fiatRates: any = {};
    @observable public loading: boolean = false;
    @observable public error: boolean = false;

    getFiatRatesToken: any;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.getFiatRatesToken = axios.CancelToken.source().token;
        this.settingsStore = settingsStore;
    }

    @action
    public getFiatRates = () => {
        this.loading = true;
        axios
            .request({
                method: 'get',
                url: 'https://blockchain.info/ticker',
                cancelToken: this.getFiatRatesToken
            })
            .then((response: any) => {
                // handle success
                this.loading = false;
                const data = response.data;
                this.fiatRates = data;
            })
            .catch(() => {
                // handle error
                this.fiatRates = {};
                this.loading = false;
            });
    };
}
