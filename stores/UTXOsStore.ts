import { action, observable } from 'mobx';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';
import Utxo from './../models/Utxo';

export default class UTXOsStore {
    // utxos
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public errorMsg: string;
    @observable public utxos: Utxo = [];
    // accounts
    @observable public loadingAccounts: boolean = false;
    @observable public accounts: any = [];
    //
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
    public getUTXOs = data => {
        this.errorMsg = '';
        this.loading = true;
        RESTUtils.getUTXOs(data)
            .then((data: any) => {
                this.loading = false;
                this.utxos = data.utxos.map((utxo: any) => new Utxo(utxo));
                this.error = false;
            })
            .catch((error: any) => {
                // handle error
                this.errorMsg = error.toString();
                this.getUtxosError();
            });
    };

    @action
    public listAccounts = data => {
        this.errorMsg = '';
        this.loadingAccounts = true;
        RESTUtils.listAccounts(data)
            .then((data: any) => {
                this.loadingAccounts = false;
                this.accounts = data.accounts;
                this.error = false;
            })
            .catch((error: any) => {
                // handle error
                this.errorMsg = error.toString();
                this.getUtxosError();
            });
    };
}
