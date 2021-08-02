import { action, reaction, observable } from 'mobx';
import Transaction from './../models/Transaction';
import TransactionRequest from './../models/TransactionRequest';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';
import { randomBytes } from 'react-native-randombytes';
import { sha256 } from 'js-sha256';
import { Buffer } from 'buffer';
import Base64Utils from './../utils/Base64Utils';

const keySendPreimageType = '5482373484';
const preimageByteLength = 32;

export default class TransactionsStore {
    @observable loading: boolean = false;
    @observable error: boolean = false;
    @observable error_msg: string | null;
    @observable transactions: Array<Transaction> = [];
    @observable transaction: Transaction | null;
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
        amount?: string | null,
        pubkey?: string | null,
        max_parts?: string | null,
        timeout_seconds?: string | null,
        fee_limit_sat?: string | null,
        outgoing_chan_ids?: Array<string> | null,
        last_hop_pubkey?: string | null
    ) => {
        this.loading = true;
        this.error_msg = null;
        this.error = false;
        this.payment_route = null;
        this.payment_preimage = null;
        this.payment_hash = null;
        this.payment_error = null;
        this.status = null;

        let data: any = {};
        if (payment_request) {
            data.payment_request = payment_request;
        }
        if (amount) {
            data.amt = amount;
        }
        if (pubkey) {
            const preimage = randomBytes(preimageByteLength);
            const secret = preimage.toString('base64');
            const payment_hash = Buffer.from(sha256(preimage), 'hex').toString(
                'base64'
            );

            data.dest_string = pubkey;
            data.dest_custom_records = { [keySendPreimageType]: secret };
            data.payment_hash = payment_hash;
        }

        // multi-path payments
        if (max_parts) {
            data.max_parts = max_parts;
            data.timeout_seconds = timeout_seconds;
            data.fee_limit_sat = Number(fee_limit_sat);
        }

        // first hop
        if (outgoing_chan_ids) {
            data.outgoing_chan_ids = outgoing_chan_ids;
        }
        // last hop
        if (last_hop_pubkey) {
            // must be base64 encoded (bytes)
            data.last_hop_pubkey = Base64Utils.hexToBase64(last_hop_pubkey);
        }

        const payFunc = max_parts
            ? RESTUtils.payLightningInvoiceV2
            : RESTUtils.payLightningInvoice;

        // backwards compatibility with v1
        if (!max_parts && outgoing_chan_ids) {
            data.outgoing_chan_id = outgoing_chan_ids[0];
        }

        payFunc(data)
            .then((response: any) => {
                const result = response.result || response;
                this.loading = false;
                this.payment_route = result.payment_route;
                this.payment_preimage = result.payment_preimage;
                this.payment_hash = result.payment_hash;
                if (
                    result.status !== 'complete' &&
                    result.status !== 'SUCCEEDED' &&
                    result.payment_error !== ''
                ) {
                    this.error = true;
                    this.payment_error =
                        result.payment_error || result.failure_reason;
                }
                // lndhub
                if (result.error) {
                    this.error = true;
                    this.error_msg = result.message;
                } else {
                    this.status = result.status || 'complete';
                }
            })
            .catch((err: Error) => {
                this.error = true;
                this.loading = false;
                this.error_msg = err.message || 'Error sending payment';
            });
    };
}
