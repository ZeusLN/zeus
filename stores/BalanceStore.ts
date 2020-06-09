import { action, reaction, observable } from 'mobx';
import Transaction from './../models/Transaction';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';

export default class BalanceStore {
    @observable public totalBlockchainBalance: number | string = 0;
    @observable public confirmedBlockchainBalance: number | string = 0;
    @observable public unconfirmedBlockchainBalance: number | string = 0;
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public pendingOpenBalance: number | string = 0;
    @observable public lightningBalance: number | string = 0;
    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;

        reaction(
            () => this.settingsStore.settings,
            () => {
                if (this.settingsStore.hasCredentials()) {
                    this.getBlockchainBalance();
                    this.getLightningBalance();
                }
            }
        );
    }

    reset = () => {
        this.resetLightningBalance();
        this.resetBlockchainBalance();
        this.error = false;
    };

    resetBlockchainBalance = () => {
        this.unconfirmedBlockchainBalance = 0;
        this.confirmedBlockchainBalance = 0;
        this.totalBlockchainBalance = 0;
        this.loading = false;
    };

    resetLightningBalance = () => {
        this.pendingOpenBalance = 0;
        this.lightningBalance = 0;
        this.loading = false;
    };

    @action
    public getBlockchainBalance = () => {
        this.loading = true;
        RESTUtils.getBlockchainBalance()
            .then((data: any) => {
                this.unconfirmedBlockchainBalance = Number(
                    data.unconfirmed_balance
                );
                this.confirmedBlockchainBalance = Number(
                    data.confirmed_balance
                );
                this.totalBlockchainBalance = Number(data.total_balance);
                this.loading = false;
            })
            .catch(() => {
                this.resetBlockchainBalance();
            });
    };

    @action
    public getLightningBalance = () => {
        this.loading = true;
        RESTUtils.getLightningBalance()
            .then((data: any) => {
                this.pendingOpenBalance = Number(data.pending_open_balance);
                this.lightningBalance = Number(data.balance);
                this.loading = false;
            })
            .catch(() => {
                this.resetLightningBalance();
            });
    };
}
