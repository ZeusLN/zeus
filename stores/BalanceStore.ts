import { action, computed, observable, runInAction } from 'mobx';
import BigNumber from 'bignumber.js';

import BackendUtils from './../utils/BackendUtils';
import {
    CooperativeClose,
    ExternalUnconfirmedTransaction,
    ForceClose,
    getCooperativeCloseOverlap,
    getExternalUnconfirmedBalance,
    getForceCloseSweepOverlap
} from './../utils/BalanceUtils';

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
    // txids of the transactions counted in externalUnconfirmedBalance
    @observable public externalUnconfirmedTxids: string[] = [];
    // the same transactions with their amounts and the txids they spend
    @observable
    public externalUnconfirmedTransactions: ExternalUnconfirmedTransaction[] = [];
    @observable public loadingBlockchainBalance = false;
    @observable public loadingLightningBalance = false;
    // a failed fetch keeps its flag until the same fetch succeeds again,
    // so a successful fetch of one balance can't hide a failure of the other
    @observable private lightningError = false;
    @observable private blockchainError = false;
    @observable public pendingOpenBalance: number | string | any;
    // Sats locked up in pending close, force close, and waiting close
    // channels — i.e. funds in close-side limbo. Mirrors pendingOpenBalance
    // semantics but for the closing side. Populated by ChannelsStore from
    // PendingChannelsResponse.total_limbo_balance (or the LDK-node analogue).
    @observable public pendingCloseBalance: number | string | any;
    // waiting close channels being closed cooperatively, used to find
    // limbo balance that is also reported as unconfirmed on-chain funds
    @observable public cooperativeCloses: CooperativeClose[] = [];
    // pending force closes, used to find limbo balance whose sweep is
    // also reported as unconfirmed on-chain funds
    @observable public forceCloses: ForceClose[] = [];
    @observable public lightningBalance: number | string;
    @observable public otherAccounts: any = {};

    @action
    public reset = () => {
        this.resetLightningBalance();
        this.resetBlockchainBalance();
        this.lightningError = false;
        this.blockchainError = false;
    };

    @computed public get error(): boolean {
        return this.lightningError || this.blockchainError;
    }

    @action
    public resetBlockchainBalance = () => {
        this.unconfirmedBlockchainBalance = 0;
        this.externalUnconfirmedBalance = 0;
        this.externalUnconfirmedTxids = [];
        this.externalUnconfirmedTransactions = [];
        this.confirmedBlockchainBalance = 0;
        this.totalBlockchainBalance = 0;
        this.otherAccounts = {};
        this.loadingBlockchainBalance = false;
    };

    private resetLightningBalance = () => {
        this.pendingOpenBalance = 0;
        this.pendingCloseBalance = 0;
        this.cooperativeCloses = [];
        this.forceCloses = [];
        this.lightningBalance = 0;
        this.loadingLightningBalance = false;
    };

    @action
    public setPendingCloseBalance = (
        value: number | string,
        cooperativeCloses: CooperativeClose[] = [],
        forceCloses: ForceClose[] = []
    ) => {
        this.pendingCloseBalance = Number(value || 0);
        this.cooperativeCloses = cooperativeCloses;
        this.forceCloses = forceCloses;
    };

    // limbo balance of unconfirmed cooperative closes whose closing output
    // is already counted in externalUnconfirmedBalance
    @computed public get cooperativeCloseOverlap(): number {
        return getCooperativeCloseOverlap(
            this.cooperativeCloses,
            this.externalUnconfirmedTxids,
            this.pendingCloseBalance
        );
    }

    // limbo balance of force closes whose unconfirmed sweep is already
    // counted in externalUnconfirmedBalance. Clamped to what the
    // cooperative close overlap leaves, so together they never exceed
    // pendingCloseBalance
    @computed public get forceCloseSweepOverlap(): number {
        return getForceCloseSweepOverlap(
            this.forceCloses,
            this.externalUnconfirmedTransactions,
            new BigNumber(this.pendingCloseBalance || 0)
                .minus(this.cooperativeCloseOverlap)
                .toNumber()
        );
    }

    // on-chain balance without external unconfirmed deposits, which are
    // shown on the pending line instead. Used for the on-chain part of the
    // combined balance and for the On-chain row so the two agree
    @computed public get settledBlockchainBalance(): number {
        return new BigNumber(this.totalBlockchainBalance || 0)
            .minus(this.externalUnconfirmedBalance || 0)
            .toNumber();
    }

    @action
    private balanceError = (type: 'lightning' | 'blockchain') => {
        // only the failed fetch is done: the other one may still be loading
        // (e.g. both fetched in parallel in Accounts)
        if (type === 'lightning') {
            this.lightningError = true;
            this.loadingLightningBalance = false;
        } else {
            this.blockchainError = true;
            this.loadingBlockchainBalance = false;
        }
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
            let externalUnconfirmedTxids: string[] = [];
            let externalUnconfirmedTransactions: ExternalUnconfirmedTransaction[] =
                [];
            if (
                unconfirmedBlockchainBalance > 0 &&
                BackendUtils.supportsUnconfirmedTransactionOrigin()
            ) {
                try {
                    const txData = await BackendUtils.getTransactions();
                    const external = getExternalUnconfirmedBalance(
                        txData?.transactions || [],
                        unconfirmedBlockchainBalance
                    );
                    externalUnconfirmedBalance = external.amount;
                    externalUnconfirmedTxids = external.txids;
                    externalUnconfirmedTransactions = external.transactions;
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
                    this.externalUnconfirmedTxids = externalUnconfirmedTxids;
                    this.externalUnconfirmedTransactions =
                        externalUnconfirmedTransactions;
                    this.confirmedBlockchainBalance =
                        confirmedBlockchainBalance;
                    this.totalBlockchainBalance = totalBlockchainBalance;
                    this.totalBlockchainBalanceAccounts =
                        totalBlockchainBalanceAccounts;
                }
                this.blockchainError = false;
                this.loadingBlockchainBalance = false;
            });
            return {
                unconfirmedBlockchainBalance,
                externalUnconfirmedBalance,
                externalUnconfirmedTxids,
                externalUnconfirmedTransactions,
                confirmedBlockchainBalance,
                totalBlockchainBalance,
                accounts
            };
        } catch {
            this.balanceError('blockchain');
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

                this.lightningError = false;
                this.loadingLightningBalance = false;
            });

            return {
                pendingOpenBalance,
                lightningBalance
            };
        } catch {
            this.balanceError('lightning');
        }
    };

    @action
    public getCombinedBalance = async (reset: boolean = false) => {
        if (reset) this.reset();
        let lightning, onChain: any;
        lightning = await this.getLightningBalance(false);
        const supportsOnchainBalance = BackendUtils.supportsOnchainBalance();
        if (supportsOnchainBalance) {
            onChain = await this.getBlockchainBalance(false, false);
        }

        // a failed fetch keeps the last known values instead of writing 0:
        // views other than the wallet view don't check `error` and would
        // treat the wallet as empty until the next successful refresh
        runInAction(() => {
            // LN
            if (lightning) {
                this.pendingOpenBalance = lightning.pendingOpenBalance || 0;
                this.lightningBalance = lightning.lightningBalance || 0;
            }
            // on-chain
            if (onChain || !supportsOnchainBalance) {
                this.otherAccounts = onChain?.accounts || [];
                this.unconfirmedBlockchainBalance =
                    onChain?.unconfirmedBlockchainBalance || 0;
                this.externalUnconfirmedBalance =
                    onChain?.externalUnconfirmedBalance || 0;
                this.externalUnconfirmedTxids =
                    onChain?.externalUnconfirmedTxids || [];
                this.externalUnconfirmedTransactions =
                    onChain?.externalUnconfirmedTransactions || [];
                this.confirmedBlockchainBalance =
                    onChain?.confirmedBlockchainBalance || 0;
                this.totalBlockchainBalance =
                    onChain?.totalBlockchainBalance || 0;
            }
        });

        return {
            onChain,
            lightning
        };
    };
}
