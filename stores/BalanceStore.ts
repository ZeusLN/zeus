import { action, reaction, observable } from 'mobx';
import axios from 'axios';
import Transaction from './../models/Transaction';
import SettingsStore from './SettingsStore';

export default class BalanceStore {
    @observable public totalBlockchainBalance: number = 0;
    @observable public confirmedBlockchainBalance: number = 0;
    @observable public unconfirmedBlockchainBalance: number = 0;
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public transactions: Array<Transaction> = [];
    @observable public pendingOpenBalance: number = 0;
    @observable public lightningBalance: number = 0;
    settingsStore: SettingsStore;
    getBlockchainBalanceToken: any;
    getLightningBalanceToken: any;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
        this.getBlockchainBalanceToken = axios.CancelToken.source().token;
        this.getLightningBalanceToken = axios.CancelToken.source().token;

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
        const { host, port, macaroonHex } = this.settingsStore;

        this.loading = true;
        axios
            .request({
                method: 'get',
                url: `https://${host}${
                    port ? ':' + port : ''
                }/v1/getBalance`,
                headers: {
                    'macaroon': macaroonHex,
                    'encodingtype': 'hex'
                },
                cancelToken: this.getBlockchainBalanceToken
            })
            .then((response: any) => {
                // handle success
                const data = response.data;
                this.unconfirmedBlockchainBalance =
                    Number(data.unconfBalance) || 0;
                this.confirmedBlockchainBalance = Number(
                    data.confBalance || 0
                );
                this.totalBlockchainBalance = Number(data.totalBalance || 0);
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
        const { host, port, macaroonHex } = this.settingsStore;

        this.loading = true;
        axios
            .request({
                method: 'get',
                url: `https://${host}${
                    port ? ':' + port : ''
                }/v1/channel/localremotebal`,
                headers: {
                    'macaroon': macaroonHex,
                    'encodingtype': 'hex'
                },
                cancelToken: this.getLightningBalanceToken
            })
            .then((response: any) => {
                // handle success
                const data = response.data;
                this.pendingOpenBalance = Number(
                    data.pending_open_balance || 0
                );
                this.lightningBalance = Number(data.localBalance) + Number(data.remoteBalance) || 0;
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
