import { action, reaction, observable } from 'mobx';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';

export default class BalanceStore {
    @observable public totalBlockchainBalance: number | string;
    @observable public confirmedBlockchainBalance: number | string;
    @observable public unconfirmedBlockchainBalance: number | string;
    @observable public loadingBlockchainBalance = false;
    @observable public loadingLightningBalance = false;
    @observable public error = false;
    @observable public pendingOpenBalance: number | string;
    @observable public lightningBalance: number | string;
    @observable public otherAccounts: any = {};
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

    @action
    public resetBlockchainBalance = () => {
        this.unconfirmedBlockchainBalance = 0;
        this.confirmedBlockchainBalance = 0;
        this.totalBlockchainBalance = 0;
        this.otherAccounts = {};
    };

    resetLightningBalance = () => {
        this.pendingOpenBalance = 0;
        this.lightningBalance = 0;
    };

    balanceError = () => {
        this.error = true;
        this.loadingBlockchainBalance = false;
        this.loadingLightningBalance = false;
    };

    @action
    public getBlockchainBalance = () => {
        this.loadingBlockchainBalance = true;
        this.resetBlockchainBalance();
        return RESTUtils.getBlockchainBalance()
            .then((data: any) => {
                // process external accounts
                const accounts = data.account_balance;
                delete accounts.default;
                this.otherAccounts = accounts;

                this.unconfirmedBlockchainBalance = Number(
                    data.unconfirmed_balance
                );
                this.confirmedBlockchainBalance = Number(
                    data.confirmed_balance
                );
                this.totalBlockchainBalance = Number(data.total_balance);
                this.loadingBlockchainBalance = false;
                return {
                    unconfirmedBlockchainBalance:
                        this.unconfirmedBlockchainBalance,
                    confirmedBlockchainBalance: this.confirmedBlockchainBalance,
                    totalBlockchainBalance: this.totalBlockchainBalance
                };
            })
            .catch(() => {
                this.balanceError();
            });
    };

    @action
    public getLightningBalance = () => {
        this.loadingLightningBalance = true;
        this.resetLightningBalance();
        return RESTUtils.getLightningBalance()
            .then((data: any) => {
                this.pendingOpenBalance = Number(data.pending_open_balance);
                this.lightningBalance = Number(data.balance);
                this.loadingLightningBalance = false;
                return {
                    pendingOpenBalance: this.pendingOpenBalance,
                    lightningBalance: this.lightningBalance
                };
            })
            .catch(() => {
                this.balanceError();
            });
    };
}
