import { action, reaction, observable } from 'mobx';
import Transaction from './../models/Transaction';
import TransactionRequest from './../models/TransactionRequest';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';
import { randomBytes } from 'react-native-randombytes';
import { sha256 } from 'js-sha256';
import { Buffer } from 'buffer';

const keySendPreimageType = '5482373484';
const preimageByteLength = 32;

export default class TransactionsStore {
    @observable loading: boolean = false;
    @observable error: boolean = false;
    @observable error_msg: string | null;
    @observable transactions: Array<Transaction> = [];
    @observable transaction: Transaction;
    @observable payment_route: any; // Route
    @observable payment_preimage: string | null;
    @observable payment_hash: any;
    @observable payment_error: any;
    @observable onchain_address: string;
    @observable txid: string | null;
    // c-lightning
    @observable status: string | null;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;

        reaction(
            () => this.settingsStore.settings,
            () => {
                if (this.settingsStore.hasCredentials()) {
                    this.getTransactions();
                }
            }
        );
    }

    reset = () => {
        this.loading = false;
        this.error = false;
        this.error_msg = null;
        this.transactions = [];
        this.transaction = null;
        this.payment_route = null;
        this.payment_preimage = null;
        this.payment_hash = null;
        this.payment_error = null;
        this.onchain_address = '';
        this.txid = null;
        this.status = null;
    };

    @action
    public getTransactions = () => {
        this.loading = true;
        RESTUtils.getTransactions()
            .then((data: any) => {
                this.transactions = data.transactions
                    .slice()
                    .reverse()
                    .map((tx: any) => new Transaction(tx));
                this.loading = false;
            })
            .catch(() => {
                // handle error
                this.transactions = [];
                this.loading = false;
            });
    };

    @action
    public sendCoins = (transactionRequest: TransactionRequest) => {
        this.error = false;
        this.error_msg = null;
        this.txid = null;
        this.loading = true;
        RESTUtils.sendCoins(transactionRequest)
            .then((data: any) => {
                this.txid = data.txid;
                this.loading = false;
            })
            .catch((error: any) => {
                // handle error
                this.error_msg = error.message;
                this.error = true;
                this.loading = false;
            });
    };

    sendPayment = (
        payment_request?: string | null,
        amount?: string,
        pubkey?: string
    ) => {
        this.loading = true;
        this.error_msg = null;
        this.error = false;
        this.payment_route = null;
        this.payment_preimage = null;
        this.payment_hash = null;
        this.payment_error = null;
        this.status = null;

        let data;
        if (pubkey) {
            const preimage = randomBytes(preimageByteLength);
            const secret = preimage.toString('base64');
            const payment_hash = Buffer.from(sha256(preimage), 'hex').toString(
                'base64'
            );

            data = {
                amt: amount,
                dest_string: pubkey,
                dest_custom_records: { [keySendPreimageType]: secret },
                payment_hash
            };
        } else {
            if (amount) {
                data = {
                    amt: amount,
                    payment_request
                };
            } else {
                data = {
                    payment_request
                };
            }
        }

        RESTUtils.payLightningInvoice(data)
            .then((data: any) => {
                this.loading = false;
                this.payment_route = data.payment_route;
                this.payment_preimage = data.payment_preimage;
                this.payment_hash = data.payment_hash;
                if (data.payment_error !== '') {
                    this.payment_error = data.payment_error;
                }
                // lndhub
                if (data.error) {
                    this.error = true;
                    this.error_msg = data.message;
                } else {
                    this.status = data.status || 'complete';
                }
            })
            .catch((err: Error) => {
                this.error = true;
                this.loading = false;
                this.error_msg = err.message || 'Error sending payment';
            });
    };
}
