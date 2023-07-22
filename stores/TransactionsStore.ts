import { action, reaction, observable } from 'mobx';
import { randomBytes } from 'react-native-randombytes';
import { sha256 } from 'js-sha256';
import Transaction from '../models/Transaction';
import TransactionRequest from '../models/TransactionRequest';
import SettingsStore from './SettingsStore';
import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';

import { lnrpc } from '../proto/lightning';

const keySendPreimageType = '5482373484';
const keySendMessageType = '34349334';
const preimageByteLength = 32;

export interface SendPaymentReq {
    payment_request?: string;
    amount?: string;
    pubkey?: string;
    max_parts?: string | null;
    max_shard_amt?: string | null;
    fee_limit_sat?: string | null;
    max_fee_percent?: string | null;
    outgoing_chan_id?: string | null;
    last_hop_pubkey?: string | null;
    message?: string | null;
    amp?: boolean;
}

export default class TransactionsStore {
    @observable loading = false;
    @observable error = false;
    @observable error_msg: string | null;
    @observable transactions: Array<Transaction> = [];
    @observable transaction: Transaction | null;
    @observable payment_route: any; // Route
    @observable payment_preimage: string | null;
    @observable payment_hash: any;
    @observable payment_error: any;
    @observable onchain_address: string;
    @observable txid: string | null;
    @observable status: string | number | null;
    // in lieu of receiving txid on LND's publishTransaction
    @observable publishSuccess = false;

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
        this.publishSuccess = false;
        this.status = null;
    };

    @action
    public getTransactions = async () => {
        this.loading = true;
        await BackendUtils.getTransactions()
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

    public sendCoinsLNDCoinControl = (
        transactionRequest: TransactionRequest
    ) => {
        const { utxos, addr, amount, sat_per_byte } = transactionRequest;
        const inputs: any = [];
        const outputs: any = {};

        if (utxos) {
            utxos.forEach((input) => {
                const [txid_str, output_index] = input.split(':');
                inputs.push({ txid_str, output_index: Number(output_index) });
            });
        }

        if (addr) {
            outputs[addr] = Number(amount);
        }

        const fundPsbtRequest = {
            raw: {
                outputs,
                inputs
            },
            sat_per_vbyte: Number(sat_per_byte),
            spend_unconfirmed: true
        };

        BackendUtils.fundPsbt(fundPsbtRequest)
            .then((data: any) => {
                const funded_psbt = data.funded_psbt;

                BackendUtils.finalizePsbt({ funded_psbt })
                    .then((data: any) => {
                        const raw_final_tx = data.raw_final_tx;

                        BackendUtils.publishTransaction({
                            tx_hex: raw_final_tx
                        })
                            .then(() => {
                                this.publishSuccess = true;
                                this.loading = false;
                            })
                            .catch((error: any) => {
                                // handle error
                                this.error_msg =
                                    error.publish_error || error.message;
                                this.error = true;
                                this.loading = false;
                            });
                    })
                    .catch((error: any) => {
                        // handle error
                        this.error_msg = error.message;
                        this.error = true;
                        this.loading = false;
                    });
            })
            .catch((error: any) => {
                // handle error
                this.error_msg = error.message;
                this.error = true;
                this.loading = false;
            });
    };

    @action
    public sendCoins = (transactionRequest: TransactionRequest) => {
        this.error = false;
        this.error_msg = null;
        this.txid = null;
        this.publishSuccess = false;
        this.loading = true;
        if (
            BackendUtils.isLNDBased() &&
            transactionRequest.utxos &&
            transactionRequest.utxos.length > 0
        ) {
            return this.sendCoinsLNDCoinControl(transactionRequest);
        }
        BackendUtils.sendCoins(transactionRequest)
            .then((data: any) => {
                this.txid = data.txid;
                this.publishSuccess = true;
                this.loading = false;
            })
            .catch((error: any) => {
                // handle error
                this.error_msg = error.message;
                this.error = true;
                this.loading = false;
            });
    };

    @action
    public sendPayment = ({
        payment_request,
        amount,
        pubkey,
        max_parts,
        max_shard_amt,
        fee_limit_sat,
        max_fee_percent,
        outgoing_chan_id,
        last_hop_pubkey,
        message,
        amp
    }: SendPaymentReq) => {
        this.loading = true;
        this.error_msg = null;
        this.error = false;
        this.payment_route = null;
        this.payment_preimage = null;
        this.payment_hash = null;
        this.payment_error = null;
        this.status = null;

        const data: any = {};
        if (payment_request) {
            data.payment_request = payment_request;
        }
        if (amount) {
            data.amt = Number(amount);
        }

        if (pubkey) {
            const preimage = randomBytes(preimageByteLength);
            const secret = preimage.toString('base64');
            const payment_hash = Base64Utils.hexToBase64(sha256(preimage));

            data.dest = Base64Utils.hexToBase64(pubkey);
            data.dest_custom_records = { [keySendPreimageType]: secret };
            data.payment_hash = payment_hash;
            data.pubkey = pubkey;

            if (message) {
                const hex_message = Base64Utils.hexToBase64(
                    Base64Utils.utf8ToHexString(message)
                );
                data.dest_custom_records![keySendMessageType] = hex_message;
            }
        }

        // multi-path payments
        if (max_parts) {
            data.max_parts = max_parts;
        }
        if (fee_limit_sat) {
            data.fee_limit_sat = Number(fee_limit_sat);
        }

        // atomic multi-path payments
        if (amp) {
            data.amp = true;
            data.no_inflight_updates = true;
        }
        if (max_shard_amt) {
            data.max_shard_size_msat = Number(max_shard_amt) * 1000;
        }

        // first hop
        if (outgoing_chan_id) {
            data.outgoing_chan_id = outgoing_chan_id;
        }
        // last hop
        if (last_hop_pubkey) {
            // must be base64 encoded (bytes)
            data.last_hop_pubkey = Base64Utils.hexToBase64(last_hop_pubkey);
        }

        // Tor can't handle streaming updates
        if (this.settingsStore.enableTor) {
            data.no_inflight_updates = true;
        }

        // max fee percent for c-lightning
        if (max_fee_percent) {
            data.max_fee_percent = max_fee_percent;
        }

        const payFunc =
            (this.settingsStore.implementation === 'c-lightning-REST' ||
                this.settingsStore.implementation === 'embedded-lnd') &&
            pubkey
                ? BackendUtils.sendKeysend
                : BackendUtils.payLightningInvoice;

        if (this.settingsStore.implementation === 'lightning-node-connect') {
            return payFunc(data);
        } else {
            payFunc(data)
                .then((response: any) => {
                    const result = response.result || response;
                    this.handlePayment(result);
                })
                .catch((err: Error) => {
                    this.handlePaymentError(err);
                });
        }
    };

    @action
    public handlePayment = (result: any) => {
        this.loading = false;
        this.payment_route = result.payment_route;
        this.payment_preimage = result.payment_preimage;
        this.payment_hash =
            result.payment_hash && typeof result.payment_hash === 'string'
                ? result.payment_hash
                : null;

        const implementation = this.settingsStore.implementation;

        // TODO modify enum settings for embedded LND
        const status =
            implementation === 'embedded-lnd'
                ? lnrpc.Payment.PaymentStatus[result.status]
                : result.status;

        // TODO add message for in-flight transactions
        if (
            (status !== 'complete' &&
                status !== 'SUCCEEDED' &&
                status !== 'IN_FLIGHT' &&
                result.payment_error !== '') ||
            status === 'FAILED'
        ) {
            this.error = true;
            this.payment_error =
                (implementation === 'embedded-lnd'
                    ? lnrpc.PaymentFailureReason[result.failure_reason]
                    : result.failure_reason) || result.payment_error;
        }
        // lndhub
        if (result.error) {
            this.error = true;
            this.error_msg = result.message;
        } else {
            this.status = result.status || 'complete';
        }
    };

    @action
    public handlePaymentError = (err: Error) => {
        this.error = true;
        this.loading = false;
        this.error_msg =
            typeof err === 'string'
                ? err
                : err.message || 'Error sending payment';
    };
}
