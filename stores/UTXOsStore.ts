import { action, observable } from 'mobx';
import SettingsStore from './SettingsStore';
import BackendUtils from './../utils/BackendUtils';
import Base64Utils from './../utils/Base64Utils';
import Utxo from './../models/Utxo';

export default class UTXOsStore {
    // utxos
    @observable public loading = false;
    @observable public error = false;
    @observable public errorMsg: string;
    @observable public utxos: Array<Utxo> = [];
    // accounts
    @observable public loadingAccounts = false;
    @observable public importingAccount = false;
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
    public getUTXOs = () => {
        this.errorMsg = '';
        this.loading = true;
        BackendUtils.getUTXOs()
            .then((data: any) => {
                this.loading = false;
                const utxos = data.utxos || data.outputs;
                this.utxos = utxos.map((utxo: any) => new Utxo(utxo));
                this.error = false;
            })
            .catch((error: any) => {
                // handle error
                this.errorMsg = error.toString();
                this.getUtxosError();
            });
    };

    @action
    public listAccounts = (data?: any) => {
        this.errorMsg = '';
        this.loadingAccounts = true;
        BackendUtils.listAccounts(data)
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

    @action
    public importAccount = (data: any) => {
        this.errorMsg = '';
        this.importingAccount = true;
        const mfk = Base64Utils.hexToBase64(data.master_key_fingerprint);
        const newData = {
            name: data.name,
            extended_public_key: data.extended_public_key,
            master_key_fingerprint: mfk,
            dry_run: true
        };
        BackendUtils.importAccount(newData)
            .then(() => {
                this.importingAccount = false;
                this.error = false;
            })
            .catch((error: any) => {
                // handle error
                this.errorMsg = error.toString();
                this.getUtxosError();
            });
    };
}
