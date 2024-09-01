const bitcoin = require('bitcoinjs-lib');

import { action, reaction, observable } from 'mobx';
import { randomBytes } from 'react-native-randombytes';
import { sha256 } from 'js-sha256';
import ReactNativeBlobUtil from 'react-native-blob-util';

import FundedPsbt from '../models/FundedPsbt';
import Transaction from '../models/Transaction';
import TransactionRequest from '../models/TransactionRequest';
import Payment from '../models/Payment';

import SettingsStore from './SettingsStore';

import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import { errorToUserFriendly } from '../utils/ErrorUtils';
import { localeString } from '../utils/LocaleUtils';

import { lnrpc } from '../proto/lightning';
import NodeInfoStore from './NodeInfoStore';
import ChannelsStore from './ChannelsStore';

const keySendPreimageType = '5482373484';
const keySendMessageType = '34349334';
const preimageByteLength = 32;

export interface SendPaymentReq {
    payment_request?: string;
    amount?: string;
    pubkey?: string;
    max_parts?: string;
    max_shard_amt?: string;
    fee_limit_sat?: string;
    max_fee_percent?: string;
    outgoing_chan_id?: string;
    last_hop_pubkey?: string;
    message?: string;
    amp?: boolean;
    timeout_seconds?: string;
}

export default class TransactionsStore {
    @observable loading = false;
    @observable crafting = false;
    @observable error = false;
    @observable error_msg: string | null;
    @observable transactions: Array<Transaction> = [];
    @observable transaction: Transaction | null;
    @observable payment_route: any; // Route
    @observable payment_preimage: string | null;
    @observable isIncomplete: boolean | null;
    @observable payment_hash: any;
    @observable payment_error: any;
    @observable onchain_address: string;
    @observable txid: string | null;
    @observable status: string | number | null;
    // in lieu of receiving txid on LND's publishTransaction
    @observable publishSuccess = false;
    @observable broadcast_txid: string;
    @observable broadcast_err: string | null;
    // coin control
    @observable funded_psbt: string = '';

    settingsStore: SettingsStore;
    nodeInfoStore: NodeInfoStore;
    channelsStore: ChannelsStore;

    constructor(
        settingsStore: SettingsStore,
        nodeInfoStore: NodeInfoStore,
        channelsStore: ChannelsStore
    ) {
        this.settingsStore = settingsStore;
        this.nodeInfoStore = nodeInfoStore;
        this.channelsStore = channelsStore;

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
        this.isIncomplete = null;
        this.payment_hash = null;
        this.payment_error = null;
        this.onchain_address = '';
        this.txid = null;
        this.publishSuccess = false;
        this.status = null;
        this.broadcast_txid = '';
        this.broadcast_err = null;
        this.funded_psbt = '';
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

    @action
    public broadcast = (raw_final_tx: string) => {
        this.loading = true;

        const tx_hex = raw_final_tx.includes('=')
            ? Base64Utils.base64ToHex(raw_final_tx)
            : raw_final_tx;

        // Decode the raw transaction hex string
        let txid: string;
        try {
            const tx = bitcoin.Transaction.fromHex(tx_hex);
            // Get the transaction ID (txid)
            txid = tx.getId();
        } catch (e) {}

        return BackendUtils.publishTransaction({
            tx_hex
        })
            .then((data: any) => {
                if (data.publish_error) {
                    this.error_msg = errorToUserFriendly(data.publish_error);
                    this.error = true;
                    this.loading = false;
                } else {
                    this.txid = txid;
                    this.publishSuccess = true;
                    this.loading = false;
                    this.channelsStore.resetOpenChannel();
                }
            })
            .catch((error: any) => {
                // handle error
                this.error_msg = errorToUserFriendly(
                    error.publish_error || error.message
                );
                this.error = true;
                this.loading = false;
            });
    };

    @action
    public finalizePsbtAndBroadcast = (funded_psbt: string) => {
        this.funded_psbt = '';
        this.loading = true;
        return BackendUtils.finalizePsbt({ funded_psbt })
            .then((data: any) => {
                const raw_final_tx = data.raw_final_tx;

                this.broadcast(raw_final_tx);
            })
            .catch((error: any) => {
                // handle error
                this.error_msg = errorToUserFriendly(error.message);
                this.error = true;
                this.loading = false;
            });
    };

    @action
    public finalizePsbtAndBroadcastChannel = async (
        signed_psbt: string,
        pending_chan_ids: Array<string>
    ) => {
        this.loading = true;

        return BackendUtils.fundingStateStep({
            psbt_finalize: {
                signed_psbt,
                pending_chan_id: pending_chan_ids[pending_chan_ids.length - 1]
            }
        })
            .then((data: any) => {
                if (data.publish_error) {
                    this.error_msg = errorToUserFriendly(data.publish_error);
                    this.error = true;
                    this.loading = false;
                } else {
                    try {
                        // Parse the PSBT
                        const psbt = bitcoin.Psbt.fromBase64(signed_psbt);

                        // Extract the finalized transaction from the PSBT
                        const finalizedTx = psbt.extractTransaction();

                        // Serialize the transaction and calculate its hash to obtain the txid
                        const txid = finalizedTx.getId();
                        this.txid = txid;
                    } catch (e) {}
                    this.publishSuccess = true;
                    this.loading = false;
                    this.channelsStore.resetOpenChannel();
                }
            })
            .catch((error: any) => {
                // handle error
                this.error_msg = errorToUserFriendly(error.message);
                this.error = true;
                this.loading = false;
            });
    };

    @action
    public finalizeTxHexAndBroadcastChannel = async (
        tx_hex: string,
        pending_chan_ids: Array<string>
    ) => {
        this.loading = true;

        return BackendUtils.fundingStateStep({
            psbt_finalize: {
                final_raw_tx: tx_hex,
                pending_chan_id: pending_chan_ids[pending_chan_ids.length - 1]
            }
        })
            .then((data: any) => {
                if (data.publish_error) {
                    this.error_msg = errorToUserFriendly(data.publish_error);
                    this.error = true;
                    this.loading = false;
                } else {
                    try {
                        // Parse the tx
                        const tx = bitcoin.Transaction.fromHex(tx_hex);

                        // Serialize the transaction and calculate its hash
                        const txid = tx.getId();
                        this.txid = txid;
                    } catch (e) {}
                    this.publishSuccess = true;
                    this.loading = false;
                    this.channelsStore.resetOpenChannel();
                }
            })
            .catch((error: any) => {
                // handle error
                this.error_msg = errorToUserFriendly(error.message);
                this.error = true;
                this.loading = false;
            });
    };

    public sendCoinsLNDCoinControl = (
        transactionRequest: TransactionRequest
    ) => {
        const {
            utxos,
            addr,
            amount,
            sat_per_vbyte,
            account,
            additional_outputs
        } = transactionRequest;
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

        additional_outputs.map((output) => {
            outputs[output.address] = Number(output.satAmount);
        });

        const fundPsbtRequest = {
            raw: {
                outputs,
                inputs
            },
            sat_per_vbyte: Number(sat_per_vbyte),
            spend_unconfirmed: true,
            account
        };

        BackendUtils.fundPsbt(fundPsbtRequest)
            .then((data: any) => {
                this.crafting = false;
                const funded_psbt: string = new FundedPsbt(
                    data.funded_psbt
                ).getFormatted();

                if (account !== 'default') {
                    this.funded_psbt = funded_psbt;
                    this.loading = false;
                } else {
                    this.finalizePsbtAndBroadcast(funded_psbt);
                }
            })
            .catch((error: any) => {
                // handle error
                this.error_msg = errorToUserFriendly(error.message);
                this.error = true;
                this.crafting = false;
                this.loading = false;
            });
    };

    @action
    public sendCoins = (transactionRequest: TransactionRequest) => {
        this.funded_psbt = '';
        this.error = false;
        this.error_msg = null;
        this.txid = null;
        this.publishSuccess = false;
        this.crafting = true;
        this.loading = true;

        if (
            (BackendUtils.isLNDBased() &&
                transactionRequest.utxos &&
                transactionRequest.utxos.length > 0) ||
            transactionRequest?.additional_outputs?.length > 0
        ) {
            return this.sendCoinsLNDCoinControl(transactionRequest);
        }

        this.crafting = false;

        BackendUtils.sendCoins(transactionRequest)
            .then((data: any) => {
                this.txid = data.txid;
                this.publishSuccess = true;
                this.loading = false;
            })
            .catch((error: Error) => {
                // handle error
                this.error_msg = errorToUserFriendly(error);
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
        amp,
        timeout_seconds
    }: SendPaymentReq) => {
        this.loading = true;
        this.error_msg = null;
        this.error = false;
        this.payment_route = null;
        this.payment_preimage = null;
        this.isIncomplete = null;
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
                    Base64Utils.utf8ToHex(message)
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
        if (
            max_fee_percent &&
            (this.settingsStore.implementation === 'c-lightning-REST' ||
                this.settingsStore.implementation === 'cln-rest')
        ) {
            data.max_fee_percent = max_fee_percent;
        }

        // payment timeout for LND
        if (BackendUtils.isLNDBased()) {
            data.timeout_seconds = Number(timeout_seconds) || 60;
        }

        const payFunc =
            (this.settingsStore.implementation === 'c-lightning-REST' ||
                this.settingsStore.implementation === 'cln-rest' ||
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

        const payment = new Payment(result);
        this.payment_preimage = payment.getPreimage;
        this.payment_hash = payment.paymentHash;
        this.isIncomplete = payment.isIncomplete;

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
                    ? errorToUserFriendly(
                          lnrpc.PaymentFailureReason[result.failure_reason]
                      )
                    : errorToUserFriendly(result.failure_reason)) ||
                errorToUserFriendly(result.payment_error);
        }
        // lndhub
        if (result.error) {
            this.error = true;
            this.error_msg = errorToUserFriendly(result.message);
        } else {
            this.status = result.status || 'complete';
        }
    };

    @action
    public handlePaymentError = (err: Error) => {
        this.error = true;
        this.loading = false;
        this.error_msg =
            errorToUserFriendly(err) || localeString('error.sendingPayment');
    };

    @action resetBroadcast = () => {
        this.error = true;
        this.loading = false;
        this.broadcast_txid = '';
        this.broadcast_err = null;
    };

    @action
    public broadcastRawTxToMempoolSpace = (raw_tx_hex: string) => {
        this.resetBroadcast();
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/plain'
        };
        return ReactNativeBlobUtil.fetch(
            'POST',
            `https://mempool.space/${
                this.nodeInfoStore.nodeInfo.isTestNet ? 'testnet/' : ''
            }api/tx`,
            headers,
            raw_tx_hex
        )
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    const data = response.data;
                    this.loading = false;
                    this.broadcast_txid = data;
                    return data;
                } else {
                    const data = response.data;
                    this.broadcast_err = data;
                    this.loading = false;
                    this.error = true;
                }
            })
            .catch((err) => {
                this.broadcast_err = err.error || err.toString();
                this.loading = false;
            });
    };
}
