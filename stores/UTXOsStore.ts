import { action, observable } from 'mobx';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';
import Utxo from './../models/Utxo';

export default class UTXOsStore {
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public errorMsg: string;
    @observable public utxos: any = [];
    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    getUtxosError = () => {
        this.error = true;
        this.loading = false;
        this.utxos = [];
    };

    @action
    public getUTXOs = () => {
        this.errorMsg = '';
        this.loading = true;
        RESTUtils.getUTXOs({ max_confs: 10 })
            .then((data: any) => {
                this.loading = false;
                this.utxos = data.utxos.map(
                    (utxo: any) => new Utxo(utxo)
                );
                this.error = false;
            })
            .catch((error: any) => {
                // handle error
                this.errorMsg = error.toString();
                this.getUtxosError();
            });
    };
}
