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
        console.log('reset called');
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
        this.loadingBlockchainBalance = false;
    };

    resetLightningBalance = () => {
        this.pendingOpenBalance = 0;
        this.lightningBalance = 0;
        this.loadingLightningBalance = false;
    };

    balanceError = () => {
        this.error = true;
        this.loadingBlockchainBalance = false;
        this.loadingLightningBalance = false;
    };

    @action
    public getBlockchainBalance = (set: boolean, reset: boolean) => {
        this.loadingBlockchainBalance = true;
        if (reset) this.resetBlockchainBalance();
        return RESTUtils.getBlockchainBalance()
            .then((data: any) => {
                // process external accounts
                const accounts = data.account_balance;
                if (accounts && accounts.default) delete accounts.default;

                const unconfirmedBlockchainBalance = Number(
                    data.unconfirmed_balance || 0
                );

                const confirmedBlockchainBalance = Number(
                    data.confirmed_balance || 0
                );

                const totalBlockchainBalance = Number(data.total_balance || 0);

                if (set) {
                    this.otherAccounts = accounts;

                    this.unconfirmedBlockchainBalance =
                        unconfirmedBlockchainBalance;
                    this.confirmedBlockchainBalance =
                        confirmedBlockchainBalance;
                    this.totalBlockchainBalance = totalBlockchainBalance;
                }
                this.loadingBlockchainBalance = false;
                return {
                    unconfirmedBlockchainBalance,
                    confirmedBlockchainBalance,
                    totalBlockchainBalance,
                    accounts
                };
            })
            .catch(() => {
                this.balanceError();
            });
    };

    @action
    public getLightningBalance = (set: boolean, reset: boolean) => {
        this.loadingLightningBalance = true;
        if (reset) this.resetLightningBalance();
        return RESTUtils.getLightningBalance()
            .then((data: any) => {
                const pendingOpenBalance = Number(
                    data.pending_open_balance || 0
                );
                const lightningBalance = Number(data.balance || 0);

                if (set) {
                    this.pendingOpenBalance = pendingOpenBalance;
                    this.lightningBalance = lightningBalance;
                }

                this.loadingLightningBalance = false;

                return {
                    pendingOpenBalance,
                    lightningBalance
                };
            })
            .catch(() => {
                this.balanceError();
            });
    };

    @action
    public getCombinedBalance = async (reset: boolean) => {
        if (reset) this.reset();
        const lightning = await this.getLightningBalance();
        const onChain = await this.getBlockchainBalance();

        // LN
        this.pendingOpenBalance =
            (lightning && lightning.pendingOpenBalance) || 0;
        this.lightningBalance = (lightning && lightning.lightningBalance) || 0;
        // on-chain
        this.otherAccounts = (onChain && onChain.accounts) || [];
        this.unconfirmedBlockchainBalance =
            (onChain && onChain.unconfirmedBlockchainBalance) || 0;
        this.confirmedBlockchainBalance =
            (onChain && onChain.confirmedBlockchainBalance) || 0;
        this.totalBlockchainBalance =
            (onChain && onChain.totalBlockchainBalance) || 0;

        return {
            onChain,
            lightning
        };
    };
}
