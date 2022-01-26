import { action, observable } from 'mobx';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';
import Utxo from './../models/Utxo';

export default class UTXOsStore {
    // utxos
    @observable public loading = false;
    @observable public success = false;
    @observable public error = false;
    @observable public errorMsg: string;
    @observable public utxos: Array<Utxo> = [];
    // accounts
    @observable public loadingAccounts = false;
    @observable public importingAccount = false;
    @observable public accounts: any = [];
    @observable public accountToImport: any | null;
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
        RESTUtils.getUTXOs()
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
    public listAccounts = (data: any) => {
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

    @action
    public importAccount = (data: any) => {
        this.errorMsg = '';
        this.success = false;
        this.importingAccount = true;
        const request = {
            name: data.name,
            extended_public_key: data.extended_public_key,
            dry_run: data.dry_run
        };

        if (data.master_key_fingerprint) {
            request.master_key_fingerprint = data.master_key_fingerprint;
        }

        RESTUtils.importAccount(request)
            .then((response) => {
                this.importingAccount = false;
                this.error = false;
                if (response === this.accountToImport && !data.dry_run) {
                    this.success = true;
                    this.accountToImport = null;
                } else {
                    this.accountToImport = response;
                }
            })
            .catch((error: any) => {
                // handle error
                this.errorMsg = error.toString();
                this.success = false;
                this.importingAccount = false;
                this.getUtxosError();
            });
    };
}
