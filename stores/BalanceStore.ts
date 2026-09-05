import { action, reaction, observable, runInAction } from 'mobx';
import BigNumber from 'bignumber.js';

import SettingsStore from './SettingsStore';
import BackendUtils from './../utils/BackendUtils';
import { getExternalUnconfirmedBalance } from './../utils/BalanceUtils';

export default class BalanceStore {
    @observable public totalBlockchainBalance: number | string;
    // total blockchain balance including external accounts
    @observable public totalBlockchainBalanceAccounts: number | string;
    @observable public confirmedBlockchainBalance: number | string;
    @observable public unconfirmedBlockchainBalance: number | string;
    // portion of unconfirmedBlockchainBalance that came from transactions
    // the wallet did not create itself (external deposits). Change from the
    // wallet's own spends (e.g. channel funding change) is excluded so it
    // isn't shown as pending on top of a total that already includes it (#2167)
    @observable public externalUnconfirmedBalance: number;
    @observable public loadingBlockchainBalance = false;
    @observable public loadingLightningBalance = false;
    @observable public error = false;
    @observable public pendingOpenBalance: number | string | any;
    // Sats locked up in pending close, force close, and waiting close
    // channels — i.e. funds in close-side limbo. Mirrors pendingOpenBalance
    // semantics but for the closing side. Populated by ChannelsStore from
    // PendingChannelsResponse.total_limbo_balance (or the LDK-node analogue).
    @observable public pendingCloseBalance: number | string | any;
    @observable public lightningBalance: number | string;
    @observable public otherAccounts: any = {};
    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;

        reaction(
            () => this.settingsStore.settings,
            () => {
                if (this.settingsStore.hasCredentials()) {
                    this.getBlockchainBalance(false, false);
                    this.getLightningBalance(false);
                }
            }
        );
    }

    @action
    public reset = () => {
        this.resetLightningBalance();
        this.resetBlockchainBalance();
        this.error = false;
    };

    @action
    public resetBlockchainBalance = () => {
        this.unconfirmedBlockchainBalance = 0;
        this.externalUnconfirmedBalance = 0;
        this.confirmedBlockchainBalance = 0;
        this.totalBlockchainBalance = 0;
        this.otherAccounts = {};
        this.loadingBlockchainBalance = false;
    };

    private resetLightningBalance = () => {
        this.pendingOpenBalance = 0;
        this.pendingCloseBalance = 0;
        this.lightningBalance = 0;
        this.loadingLightningBalance = false;
    };

    @action
    public setPendingCloseBalance = (value: number | string) => {
        this.pendingCloseBalance = Number(value || 0);
    };

    @action
    private balanceError = () => {
        this.error = true;
        this.loadingBlockchainBalance = false;
        this.loadingLightningBalance = false;
    };

    @action
    public getBlockchainBalance = async (set: boolean, reset: boolean) => {
        if (reset) this.resetBlockchainBalance();
        this.loadingBlockchainBalance = true;
        try {
            const data = await BackendUtils.getBlockchainBalance({});
            // process external accounts
            const accounts = data?.account_balance;

            const unconfirmedBlockchainBalance = Number(
                accounts?.default
                    ? accounts.default.unconfirmed_balance || 0
                    : data.unconfirmed_balance || 0
            );

            const confirmedBlockchainBalance = Number(
                accounts?.default
                    ? accounts?.default.confirmed_balance || 0
                    : data.confirmed_balance || 0
            );

            const totalBlockchainBalance = new BigNumber(
                unconfirmedBlockchainBalance
            )
                .plus(confirmedBlockchainBalance)
                .toNumber();

            const totalBlockchainBalanceAccounts = Number(
                data.total_balance || 0
            );

            // where the backend can tell where unconfirmed funds came from,
            // split out external deposits so the view can show them as
            // pending on top of the total instead of counting them twice.
            // Change from the wallet's own spends stays in the total (#2167)
            let externalUnconfirmedBalance = 0;
            if (
                unconfirmedBlockchainBalance > 0 &&
                BackendUtils.supportsUnconfirmedTransactionOrigin()
            ) {
                try {
                    const txData = await BackendUtils.getTransactions();
                    externalUnconfirmedBalance = getExternalUnconfirmedBalance(
                        txData?.transactions || [],
                        unconfirmedBlockchainBalance
                    );
                } catch {
                    // if classification fails, treat unconfirmed funds as
                    // the wallet's own: they stay in the total balance and
                    // off the pending line
                }
            }

            runInAction(() => {
                if (set) {
                    if (accounts && accounts.default && data.confirmed_balance)
                        delete accounts.default;
                    this.otherAccounts = accounts;

                    this.unconfirmedBlockchainBalance =
                        unconfirmedBlockchainBalance;
                    this.externalUnconfirmedBalance =
                        externalUnconfirmedBalance;
                    this.confirmedBlockchainBalance =
                        confirmedBlockchainBalance;
                    this.totalBlockchainBalance = totalBlockchainBalance;
                    this.totalBlockchainBalanceAccounts =
                        totalBlockchainBalanceAccounts;
                }
                this.loadingBlockchainBalance = false;
            });
            return {
                unconfirmedBlockchainBalance,
                externalUnconfirmedBalance,
                confirmedBlockchainBalance,
                totalBlockchainBalance,
                accounts
            };
        } catch {
            this.balanceError();
        }
    };

    @action
    public getLightningBalance = async (set: boolean, reset?: boolean) => {
        if (reset) this.resetLightningBalance();
        this.loadingLightningBalance = true;
        try {
            const data = await BackendUtils.getLightningBalance();
            const pendingOpenBalance = Number(data.pending_open_balance || 0);
            const lightningBalance = Number(data.balance || 0);

            runInAction(() => {
                if (set) {
                    this.pendingOpenBalance = pendingOpenBalance;
                    this.lightningBalance = lightningBalance;
                }

                this.loadingLightningBalance = false;
            });

            return {
                pendingOpenBalance,
                lightningBalance
            };
        } catch {
            this.balanceError();
        }
    };

    @action
    public getCombinedBalance = async (reset: boolean = false) => {
        if (reset) this.reset();
        let lightning, onChain: any;
        lightning = await this.getLightningBalance(false);
        if (BackendUtils.supportsOnchainBalance()) {
            onChain = await this.getBlockchainBalance(false, false);
        }

        runInAction(() => {
            // LN
            this.pendingOpenBalance = lightning?.pendingOpenBalance || 0;
            this.lightningBalance = lightning?.lightningBalance || 0;
            // on-chain
            this.otherAccounts = onChain?.accounts || [];
            this.unconfirmedBlockchainBalance =
                onChain?.unconfirmedBlockchainBalance || 0;
            this.externalUnconfirmedBalance =
                onChain?.externalUnconfirmedBalance || 0;
            this.confirmedBlockchainBalance =
                onChain?.confirmedBlockchainBalance || 0;
            this.totalBlockchainBalance = onChain?.totalBlockchainBalance || 0;
        });

        return {
            onChain,
            lightning
        };
    };
}
