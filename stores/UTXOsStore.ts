import { action, observable } from 'mobx';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';

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
    public getUTXOs = (req: any) => {
        this.errorMsg = '';
        this.loading = true;
        RESTUtils.getUTXOs(req)
            .then((data: any) => {
                this.loading = false;
                this.utxos = data.outputs || data.utxos || data;
                this.error = false;
            })
            .catch((error: any) => {
                // handle error
                this.errorMsg = error.toString();
                this.getUtxosError();
            });
    };
}
