import { action, observable } from 'mobx';
import RNFetchBlob from 'rn-fetch-blob';
import SettingsStore from './SettingsStore';

export default class FiatStore {
    @observable public fiatRates: any = {};
    @observable public loading: boolean = false;
    @observable public error: boolean = false;

    getFiatRatesToken: any;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @action
    public getFiatRates = () => {
        this.loading = true;
        RNFetchBlob.fetch('get', 'https://blockchain.info/ticker')
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    const data = response.json();
                    this.loading = false;
                    this.fiatRates = data;
                } else {
                    this.fiatRates = {};
                    this.loading = false;
                }
            })
            .catch(() => {
                this.fiatRates = {};
                this.loading = false;
            });
    };
}
