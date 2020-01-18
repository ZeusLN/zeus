import { action, reaction, observable } from 'mobx';
import Transaction from './../models/Transaction';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';
import Balance from './../models/Balance';

export default class BalanceStore {
    @observable public totalBlockchainBalance: number | string = 0;
    @observable public confirmedBlockchainBalance: number | string = 0;
    @observable public unconfirmedBlockchainBalance: number | string = 0;
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public transactions: Array<Transaction> = [];
    @observable public pendingOpenBalance: number | string = 0;
    @observable public lightningBalance: number | string = 0;
    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;

        reaction(
            () => this.settingsStore.settings,
            () => {
                if (this.settingsStore.macaroonHex) {
                    this.getBlockchainBalance();
                    this.getLightningBalance();
                }
            }
        );
    }

    @action
    public getBlockchainBalance = () => {
        this.loading = true;
        RESTUtils.getBlockchainBalance(this.settingsStore)
            .then((response: any) => {
                // handle success
                const balance = new Balance(response.data);
                this.unconfirmedBlockchainBalance =
                    balance.unconfirmedBalance || 0;
                this.confirmedBlockchainBalance = balance.confirmedBalance || 0;
                this.totalBlockchainBalance = balance.getTotalBalance || 0;
                this.loading = false;
            })
            .catch(() => {
                // handle error
                this.unconfirmedBlockchainBalance = 0;
                this.confirmedBlockchainBalance = 0;
                this.totalBlockchainBalance = 0;
                this.loading = false;
            });
    };

    @action
    public getLightningBalance = () => {
        this.loading = true;
        RESTUtils.getLightningBalance(this.settingsStore)
            .then((response: any) => {
                // handle success
                const balance = new Balance(response.data);
                this.pendingOpenBalance = balance.pending_open_balance || 0;
                this.lightningBalance = balance.getTotalLightningBalance || 0;
                this.loading = false;
            })
            .catch(() => {
                // handle error
                this.pendingOpenBalance = 0;
                this.lightningBalance = 0;
                this.loading = false;
            });
    };
}
