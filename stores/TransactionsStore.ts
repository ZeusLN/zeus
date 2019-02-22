import { action, reaction, observable } from 'mobx';
import axios from 'axios';
import Transaction from './../models/Transaction';
import TransactionRequest from './../models/TransactionRequest';
import ErrorUtils from './../utils/ErrorUtils';
import SettingsStore from './SettingsStore';

export default class TransactionsStore {
    @observable loading: boolean = false;
    @observable error: boolean = false;
    @observable error_msg: string | null;
    @observable transactions: Array<Transaction> = [];
    @observable transaction: Transaction;

    @observable payment_route: any; // Route
    @observable payment_preimage: string | null;
    @observable payment_hash: string | null;
    @observable payment_error: string | null;

    @observable onchain_address: string;

    @observable txid: string | null;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;

        reaction(
            () => this.settingsStore.settings,
            () => {
                this.getTransactions()
            }
        );
    }

    @action
    public getTransactions = () => {
        const { settings } = this.settingsStore;
        const { host, port, macaroonHex } = settings;

        this.loading = true;
        axios.request({
            method: 'get',
            url: `https://${host}${port ? ':' + port : ''}/v1/transactions`,
            headers: {
                'Grpc-Metadata-macaroon': macaroonHex
            }
        }).then((response: any) => {
            // handle success
            const data = response.data;
            this.transactions = data.transactions.reverse();
            this.loading = false;
        })
        .catch(() => {
            // handle error
            this.transactions = [];
            this.loading = false;
        });
    }

    @action
    public sendCoins = (transactionRequest: TransactionRequest) => {
        const { settings } = this.settingsStore;
        const { host, port, macaroonHex } = settings;

        this.error = false;
        this.error_msg = null;
        this.txid = null;
        this.loading = true;

        axios.request({
            method: 'post',
            url: `https://${host}${port ? ':' + port : ''}/v1/transactions`,
            headers: {
                'Grpc-Metadata-macaroon': macaroonHex
            },
            data: {
                ...transactionRequest
            }
        }).then((response: any) => {
            // handle success
            const data = response.data;
            this.txid = data.txid;
            this.loading = false;
        })
        .catch((error: any) => {
            // handle error
            const errorInfo = error.response.data;
            this.error_msg = errorInfo.error;
            this.error = true;
            this.loading = false;
        });
    }

    sendPayment = (payment_request: string) => {
        const { settings } = this.settingsStore;
        const { host, port, macaroonHex } = settings;

        this.loading = true;
        this.error_msg = null;
        this.error = false;
        this.payment_route = null;
        this.payment_preimage = null;
        this.payment_hash = null;
        this.payment_error = null;

        axios.request({
            method: 'post',
            url: `https://${host}${port ? ':' + port : ''}/v1/channels/transactions`,
            headers: {
                'Grpc-Metadata-macaroon': macaroonHex
            },
            data: {
                payment_request: payment_request
            }
        }).then((response: any) => {
            // handle success
            const data = response.data;
            this.loading = false;
            this.payment_route = data.payment_route;
            this.payment_preimage = data.payment_preimage;
            this.payment_hash = data.payment_hash;
            this.payment_error = data.payment_error;
        })
        .catch((error: any)=> {
            // handle error
            const errorInfo = error.response.data;
            const code = errorInfo.code;
            this.error = true;
            this.loading = false;
            this.error_msg = ErrorUtils.errorToUserFriendly(code) || errorInfo.error || 'Error sending payment';
        });
    }
}