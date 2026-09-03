const bitcoin = require('bitcoinjs-lib');

import { action, observable, runInAction } from 'mobx';
import { randomBytes } from 'react-native-randombytes';
import { sha256 } from 'js-sha256';
import ReactNativeBlobUtil from 'react-native-blob-util';

import FundedPsbt from '../models/FundedPsbt';
import Transaction from '../models/Transaction';
import TransactionRequest, { OutPoint } from '../models/TransactionRequest';
import Payment from '../models/Payment';

import SettingsStore from './SettingsStore';

import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import { errorToUserFriendly } from '../utils/ErrorUtils';
import { localeString } from '../utils/LocaleUtils';
import { checkGraphSyncBeforePayment } from '../utils/GraphSyncUtils';
import { deriveExpectedPaymentHash } from '../utils/LncPayUtils';
import { sleep } from '../utils/SleepUtils';
import UrlUtils from '../utils/UrlUtils';
import { RATING_MODAL_TRIGGER_DELAY } from '../utils/RatingUtils';

import { lnrpc } from '../proto/lightning';
import NodeInfoStore from './NodeInfoStore';
import ChannelsStore from './ChannelsStore';
import BalanceStore from './BalanceStore';
import ModalStore from './ModalStore';

const keySendPreimageType = '5482373484';
const keySendMessageType = '34349334';
const preimageByteLength = 32;

// how often to poll lookupPayment while a payment's outcome is unknown
export const PAYMENT_TRACK_POLL_MS = 5000;
// ceiling on how long tracking may hold the send guard: a stuck HTLC can
// pend until CLTV expiry (hours), and holding the guard that long would
// lock the user out of all sends
export const PAYMENT_TRACK_MAX_MS = 10 * 60 * 1000;
// consecutive failed lookups tolerated before giving up and releasing the
// guard the way the timed backstop used to
export const PAYMENT_TRACK_MAX_FAILURES = 3;
// consecutive "node answered, no record" results required before concluding
// the dispatch never reached the node: a single lookup can miss a payment
// whose dispatch request is still in transit (e.g. a slow Tor circuit)
export const PAYMENT_TRACK_MAX_NOT_FOUND = 3;
// how far before the recorded dispatch time lookupPayment's
// creation_date_start filter reaches, to absorb clock skew between the
// device and the node
export const PAYMENT_LOOKUP_CREATION_SLACK_MS = 10 * 60 * 1000;

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
    // service-initiated payments (e.g. the NWC service path) neither set nor
    // clear paymentInFlight, so the double-submission guard stays scoped to
    // user-initiated sends
    background?: boolean;
}

export default class TransactionsStore {
    @observable loading = false;
    // true only while a Lightning payment dispatched via sendPaymentInternal
    // is in flight; `loading` is shared with other operations (getTransactions,
    // sendCoins, broadcast) so it can't serve as the double-submission guard
    @observable paymentInFlight = false;
    @observable crafting = false;
    @observable error = false;
    @observable error_msg: string | null;
    @observable transactions: Array<Transaction> = [];
    @observable transaction: Transaction | null;
    @observable showGraphSyncPrompt = false;
    @observable pendingPaymentData: SendPaymentReq | null = null;
    @observable payment_route: any; // Route
    @observable payment_preimage: string | null;
    @observable payment_fee: string | null;
    @observable isIncomplete: boolean | null;
    @observable payment_hash: any;
    @observable payment_error: any;
    @observable onchain_address: string;
    @observable txid: string | null;
    @observable status: string | number | null;
    @observable noteKey: string;
    @observable paymentStartTime: number | null = null;
    @observable paymentDuration: number | null = null;
    @observable donationIsPaid: boolean = false;

    // in lieu of receiving txid on LND's publishTransaction
    @observable publishSuccess = false;
    @observable broadcast_txid: string;
    @observable broadcast_err: string | null;
    // coin control
    @observable funded_psbt: string = '';

    // monotonic id assigned to each dispatched payment
    private paymentSequence = 0;
    // sequence of the payment that set paymentInFlight (null when none);
    // completion callbacks and the backstop timer only clear the flag on
    // behalf of that payment, so overlapping payments (e.g. a background
    // NWC payment finishing while a user payment is still in flight)
    // can't disarm each other's guard
    private inFlightOwnerSeq: number | null = null;
    // payment hash (hex) of the guard-owning payment, when known; lets an
    // ambiguous outcome be tracked to a terminal state via lookupPayment
    private inFlightPaymentHash: string | null = null;
    // when the guard-owning payment was dispatched (ms); bounds lookupPayment
    // scans so a busy node's newer payments can't evict ours from the page
    private inFlightDispatchTime: number | null = null;
    // sequence currently being tracked to a terminal state (null when none)
    private trackingSeq: number | null = null;

    settingsStore: SettingsStore;
    nodeInfoStore: NodeInfoStore;
    channelsStore: ChannelsStore;
    balanceStore: BalanceStore;
    modalStore: ModalStore;

    constructor(
        settingsStore: SettingsStore,
        nodeInfoStore: NodeInfoStore,
        channelsStore: ChannelsStore,
        balanceStore: BalanceStore,
        modalStore: ModalStore
    ) {
        this.settingsStore = settingsStore;
        this.nodeInfoStore = nodeInfoStore;
        this.channelsStore = channelsStore;
        this.balanceStore = balanceStore;
        this.modalStore = modalStore;
    }

    @action
    public reset = () => {
        this.loading = false;
        this.paymentInFlight = false;
        this.inFlightOwnerSeq = null;
        this.inFlightPaymentHash = null;
        this.inFlightDispatchTime = null;
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
        this.paymentStartTime = null;
        this.paymentDuration = null;
    };

    public getTransactions = async () => {
        this.loading = true;
        await BackendUtils.getTransactions()
            .then((data: any) => {
                runInAction(() => {
                    this.transactions = data.transactions
                        .slice()
                        .reverse()
                        .map((tx: any) => new Transaction(tx));
                    this.loading = false;
                });
            })
            .catch(() => {
                runInAction(() => {
                    this.transactions = [];
                    this.loading = false;
                });
            });
    };

    @action
    public broadcast = async (raw_final_tx: string) => {
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

        // Backends without publishTransaction fall back to mempool.space
        if (!(BackendUtils.getClass() as any)?.publishTransaction) {
            const headers = {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'text/plain'
            } as any;

            const url = `${UrlUtils.getMempoolApiUrl(
                this.nodeInfoStore.nodeInfo
            )}/tx`;

            return ReactNativeBlobUtil.fetch('POST', url, headers, tx_hex)
                .then((response: any) => {
                    const status = response.info().status;
                    const data = response.data;
                    if (status == 200) {
                        runInAction(() => {
                            this.txid = data || txid;
                            this.publishSuccess = true;
                            this.loading = false;
                            this.channelsStore.resetOpenChannel();
                        });
                        return data;
                    } else {
                        const errorMsg = errorToUserFriendly(data);
                        runInAction(() => {
                            this.error_msg = errorMsg;
                            this.error = true;
                            this.loading = false;
                        });
                    }
                })
                .catch((err: any) => {
                    const errorMsg = errorToUserFriendly(
                        err?.error || err?.message || err?.toString()
                    );
                    runInAction(() => {
                        this.error_msg = errorMsg;
                        this.error = true;
                        this.loading = false;
                    });
                });
        }

        return BackendUtils.publishTransaction({
            tx_hex
        })
            .then((data: any) => {
                if (data.publish_error) {
                    const errorMsg = errorToUserFriendly(data.publish_error);
                    runInAction(() => {
                        this.error_msg = errorMsg;
                        this.error = true;
                        this.loading = false;
                    });
                } else {
                    runInAction(() => {
                        this.txid = txid;
                        this.publishSuccess = true;
                        this.loading = false;
                        this.channelsStore.resetOpenChannel();
                    });
                }
            })
            .catch((error: any) => {
                const errorMsg = errorToUserFriendly(
                    error.publish_error || error.message
                );
                runInAction(() => {
                    this.error_msg = errorMsg;
                    this.error = true;
                    this.loading = false;
                });
            });
    };

    @action
    public finalizePsbtAndBroadcast = (
        funded_psbt: string,
        defaultAccount?: boolean
    ) => {
        this.funded_psbt = '';
        this.loading = true;

        if (defaultAccount) {
            return BackendUtils.finalizePsbt({ funded_psbt })
                .then((data: any) => this.broadcast(data.raw_final_tx))
                .catch((error: any) => {
                    const errorMsg = errorToUserFriendly(error.message);
                    runInAction(() => {
                        this.error_msg = errorMsg;
                        this.error = true;
                        this.loading = false;
                    });
                });
        } else {
            return new Promise((resolve) => {
                try {
                    // Parse the PSBT
                    const psbt = bitcoin.Psbt.fromBase64(funded_psbt);
                    // Step 2: Finalize each input
                    psbt.data.inputs.forEach((input: any, index: number) => {
                        if (
                            !input.finalScriptSig &&
                            !input.finalScriptWitness
                        ) {
                            psbt.finalizeInput(index); // This finalizes the input
                        }
                    });

                    // Step 3: Extract the transaction
                    const txHex = psbt.extractTransaction().toHex();

                    this.broadcast(txHex);

                    resolve(true);
                } catch (error: any) {
                    const errorMsg = errorToUserFriendly(
                        error?.message || error
                    );
                    runInAction(() => {
                        this.error_msg = errorMsg;
                        this.error = true;
                        this.loading = false;
                    });

                    resolve(true);
                }
            });
        }
    };

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
                    const errorMsg = errorToUserFriendly(data.publish_error);
                    runInAction(() => {
                        this.error_msg = errorMsg;
                        this.error = true;
                        this.loading = false;
                    });
                } else {
                    runInAction(() => {
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
                    });
                }
            })
            .catch((error: any) => {
                const errorMsg = errorToUserFriendly(error.message);
                runInAction(() => {
                    this.error_msg = errorMsg;
                    this.error = true;
                    this.loading = false;
                });
            });
    };

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
                    const errorMsg = errorToUserFriendly(data.publish_error);
                    runInAction(() => {
                        this.error_msg = errorMsg;
                        this.error = true;
                        this.loading = false;
                    });
                } else {
                    runInAction(() => {
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
                    });
                }
            })
            .catch((error: any) => {
                const errorMsg = errorToUserFriendly(error.message);
                runInAction(() => {
                    this.error_msg = errorMsg;
                    this.error = true;
                    this.loading = false;
                });
            });
    };

    private sendCoinsLNDCoinControl = (
        transactionRequest: TransactionRequest,
        defaultAccount?: boolean
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

        if (additional_outputs) {
            additional_outputs.map((output) => {
                outputs[output.address] = Number(output.satAmount);
            });
        }

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
                runInAction(() => {
                    this.crafting = false;
                    const funded_psbt: string = new FundedPsbt(
                        data.funded_psbt
                    ).getFormatted();

                    if (account !== 'default') {
                        this.funded_psbt = funded_psbt;
                        this.loading = false;
                    } else {
                        this.finalizePsbtAndBroadcast(
                            funded_psbt,
                            defaultAccount
                        );
                    }
                });
            })
            .catch((error: any) => {
                const errorMsg = errorToUserFriendly(error.message);
                runInAction(() => {
                    this.error_msg = errorMsg;
                    this.error = true;
                    this.crafting = false;
                    this.loading = false;
                });
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

        if (transactionRequest.send_all) {
            delete transactionRequest.amount;
        }

        if (
            BackendUtils.isLNDBased() &&
            transactionRequest.utxos &&
            transactionRequest.utxos.length > 0 &&
            transactionRequest.account === 'default' &&
            BackendUtils.supportsOnchainSendMax()
        ) {
            const outpoints: OutPoint[] = [];
            transactionRequest.utxos.forEach((input) => {
                const [txid_str, output_index] = input.split(':');
                outpoints.push({
                    txid_str,
                    output_index: Number(output_index)
                });
            });
            transactionRequest.outpoints = outpoints;
        } else if (
            (BackendUtils.isLNDBased() &&
                transactionRequest.utxos &&
                transactionRequest.utxos.length > 0) ||
            (transactionRequest?.additional_outputs?.length &&
                transactionRequest?.additional_outputs?.length > 0)
        ) {
            return this.sendCoinsLNDCoinControl(
                transactionRequest,
                transactionRequest.account === 'default'
            );
        }

        this.crafting = false;

        BackendUtils.sendCoins(transactionRequest)
            .then((data: any) => {
                runInAction(() => {
                    this.txid = data.txid;
                    this.publishSuccess = true;
                    this.loading = false;
                    this.balanceStore.getCombinedBalance();
                });
            })
            .catch((error: Error) => {
                const errorMsg = errorToUserFriendly(error);
                runInAction(() => {
                    this.error_msg = errorMsg;
                    this.error = true;
                    this.loading = false;
                });
            });
    };

    @action
    public checkGraphSyncBeforePayment = (
        paymentData: SendPaymentReq
    ): boolean => {
        const { settings, implementation } = this.settingsStore;
        return checkGraphSyncBeforePayment(
            settings,
            implementation,
            paymentData,
            this
        );
    };

    @action
    public hideGraphSyncPrompt = () => {
        this.showGraphSyncPrompt = false;
    };

    @action
    public proceedWithPayment = async () => {
        if (this.pendingPaymentData) {
            this.hideGraphSyncPrompt();
            this.sendPaymentInternal(this.pendingPaymentData);
            this.pendingPaymentData = null;
        }
    };

    @action
    public sendPayment = (paymentData: SendPaymentReq) => {
        // Check graph sync before proceeding with payment
        if (!this.checkGraphSyncBeforePayment(paymentData)) {
            return;
        }

        return this.sendPaymentInternal(paymentData);
    };

    @action
    private sendPaymentInternal = ({
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
        timeout_seconds,
        background
    }: SendPaymentReq) => {
        // Guard against double-submission: if a payment is already in flight,
        // ignore the new request. Without this a rapid double-tap (or a
        // re-fired swipe) dispatches two payments, and keysend in particular
        // generates a fresh preimage per call, defeating every backend's
        // same-hash duplicate protection. Background (service-initiated)
        // payments bypass the guard and never own the flag: their concurrency
        // control lives in the service (e.g. the NWC payment queue).
        if (this.paymentInFlight && !background) {
            return;
        }

        const seq = ++this.paymentSequence;
        if (!background) {
            this.paymentInFlight = true;
            this.inFlightOwnerSeq = seq;
            this.inFlightPaymentHash = null;
            this.inFlightDispatchTime = Date.now();
        }
        this.paymentStartTime = Date.now();
        this.paymentDuration = null;
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
        data.max_parts = max_parts ? max_parts : '1';

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
            data.outgoing_chan_ids = [outgoing_chan_id];
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
            this.settingsStore.implementation === 'cln-rest'
        ) {
            data.max_fee_percent = max_fee_percent;
        }

        // payment timeout for LND, CLN, and ldk-node
        if (
            BackendUtils.isLNDBased() ||
            this.settingsStore.implementation === 'cln-rest' ||
            this.settingsStore.implementation === 'ldk-node'
        ) {
            data.timeout_seconds = Number(timeout_seconds) || 60;
        }

        // Record the dispatched payment's hash (lowercase hex) so an
        // ambiguous outcome can be tracked to a terminal state. Undefined
        // for AMP payments, which settle under per-attempt hashes and stay
        // on the timed backstop.
        if (!background) {
            this.inFlightPaymentHash =
                deriveExpectedPaymentHash({
                    payment_hash: data.payment_hash,
                    payment_request,
                    amp
                }) || null;
        }

        // Backstop for the in-flight guard: if the completion callback is
        // lost (e.g. a dropped LNC stream, or a hung request on a backend
        // that gets no timeout_seconds), the flag would otherwise stay set
        // and block all sends until the next reconnect. Once the payment's
        // timeout plus a grace period has elapsed, try to observe the
        // payment's actual terminal state before releasing the flag.
        if (!background) {
            const backstopMs = ((data.timeout_seconds ?? 300) + 60) * 1000;
            setTimeout(() => this.backstopPaymentInFlight(seq), backstopMs);
        }

        const payFunc =
            (this.settingsStore.implementation === 'cln-rest' ||
                this.settingsStore.implementation === 'embedded-lnd' ||
                this.settingsStore.implementation === 'ldk-node') &&
            pubkey
                ? BackendUtils.sendKeysend
                : BackendUtils.payLightningInvoice;

        payFunc(data)
            .then((response: any) => {
                const result = response.result || response;
                this.handlePayment(result, seq);
            })
            .catch((err: Error) => {
                this.handlePaymentError(err, seq);
            });
    };

    // Clears the in-flight guard on behalf of payment `seq`. Callers that
    // can't identify their payment omit `seq` and clear unconditionally,
    // matching the pre-ownership behavior.
    @action
    private clearPaymentInFlight = (seq?: number) => {
        if (seq !== undefined && this.inFlightOwnerSeq !== seq) return;
        this.paymentInFlight = false;
        this.inFlightOwnerSeq = null;
        this.inFlightPaymentHash = null;
        this.inFlightDispatchTime = null;
    };

    // true when payment `seq` still owns the guard and its terminal state
    // can be observed via lookupPayment on the active backend
    private canTrackPayment = (seq: number) =>
        this.inFlightOwnerSeq === seq &&
        !!this.inFlightPaymentHash &&
        !!BackendUtils.supportsPaymentLookup();

    // Fires when the backstop timer elapses without a completion callback
    // having cleared the guard (dropped LNC stream, hung request). Rather
    // than blindly releasing the guard while an HTLC may still settle, try
    // to track the payment to its terminal state first.
    private backstopPaymentInFlight = (seq: number) => {
        if (this.inFlightOwnerSeq !== seq) return;
        if (this.trackingSeq === seq) return; // tracking owns the release
        if (this.canTrackPayment(seq)) {
            this.trackPaymentToTerminal(seq);
        } else {
            this.clearPaymentInFlight(seq);
        }
    };

    // Polls lookupPayment until the guard-owning payment reaches SUCCEEDED
    // or FAILED, then surfaces the real outcome through handlePayment
    // (which also releases the guard). This closes the double-pay window
    // left by releasing the guard on timers while HTLCs are still pending:
    // a keysend retry generates a fresh preimage, so node-side same-hash
    // dedup can't protect against it (issue #4317). Exits released: on a
    // terminal state, when the payment provably never reached the node,
    // after PAYMENT_TRACK_MAX_FAILURES unobservable polls, or at the
    // PAYMENT_TRACK_MAX_MS ceiling.
    private trackPaymentToTerminal = async (seq: number) => {
        if (this.trackingSeq === seq) return;
        const payment_hash = this.inFlightPaymentHash;
        if (!payment_hash) return;
        // bound the scan to payments created around dispatch, so a not-found
        // answer means "no record" rather than "evicted from the newest page
        // by other clients' payments" (the guard only serializes this app's
        // sends, not a shared node's)
        const creation_date_start = this.inFlightDispatchTime
            ? Math.max(
                  0,
                  Math.floor(
                      (this.inFlightDispatchTime -
                          PAYMENT_LOOKUP_CREATION_SLACK_MS) /
                          1000
                  )
              )
            : undefined;
        this.trackingSeq = seq;
        const deadline = Date.now() + PAYMENT_TRACK_MAX_MS;
        let failures = 0;
        let notFound = 0;
        try {
            while (this.inFlightOwnerSeq === seq && Date.now() < deadline) {
                let payment: any = null;
                let lookupFailed = false;
                try {
                    payment = await BackendUtils.lookupPayment({
                        payment_hash,
                        creation_date_start
                    });
                } catch (e) {
                    lookupFailed = true;
                }
                if (this.inFlightOwnerSeq !== seq) return;

                // embedded-lnd statuses are numeric protobuf enums
                const status =
                    typeof payment?.status === 'number'
                        ? lnrpc.Payment.PaymentStatus[payment.status]
                        : payment?.status;

                if (status === 'SUCCEEDED' || status === 'FAILED') {
                    // clear any transport error shown while the outcome
                    // was unknown; handlePayment re-derives error state
                    // from the payment's actual terminal result
                    this.clearPaymentError();
                    this.handlePayment(payment, seq);
                    return;
                }

                if (payment) {
                    failures = 0;
                    notFound = 0;
                    if (status === 'IN_FLIGHT') {
                        // outcome is pending, not failed: don't leave a
                        // stale timeout/transport error on screen
                        this.markPaymentInTransit();
                    }
                } else if (!lookupFailed) {
                    // the node answered and has no record of the payment.
                    // One such answer isn't proof the dispatch never reached
                    // it: the send request may still be in transit (a slow
                    // Tor circuit can deliver it after a fresh-connection
                    // lookup returns). Only conclude never-dispatched after
                    // repeated no-record answers with no sighting between.
                    failures = 0;
                    if (++notFound >= PAYMENT_TRACK_MAX_NOT_FOUND) return;
                } else if (++failures >= PAYMENT_TRACK_MAX_FAILURES) {
                    return;
                }
                await sleep(PAYMENT_TRACK_POLL_MS);
            }
        } finally {
            this.trackingSeq = null;
            this.clearPaymentInFlight(seq);
        }
    };

    @action
    private clearPaymentError = () => {
        this.error = false;
        this.error_msg = null;
        this.payment_error = null;
    };

    @action
    private markPaymentInTransit = () => {
        this.clearPaymentError();
        this.status = 'IN_FLIGHT';
    };

    public sendPaymentSilently = async ({
        payment_request,
        fee_limit_sat,
        max_parts,
        timeout_seconds
    }: {
        payment_request: string;
        fee_limit_sat?: number;
        max_parts?: string;
        timeout_seconds?: number;
    }) => {
        const data: any = {};

        if (payment_request) {
            data.payment_request = payment_request;
        }

        if (max_parts) {
            data.max_parts = max_parts || '16';
        }

        // payment timeout and fee limit for LND, CLN, and ldk-node
        if (
            BackendUtils.isLNDBased() ||
            this.settingsStore.implementation === 'cln-rest' ||
            this.settingsStore.implementation === 'ldk-node'
        ) {
            data.fee_limit_sat = Number(fee_limit_sat) || 100;
            data.timeout_seconds = Number(timeout_seconds) || 60;
        }

        if (this.settingsStore.enableTor) {
            data.no_inflight_updates = true;
        }

        const payFunc = BackendUtils.payLightningInvoice;

        return payFunc(data)
            .then((response: any) => {
                const result = response.result || response;
                return result;
            })
            .catch((err: any) => {
                console.error('Payment error:', err);
                throw err;
            });
    };

    @action
    public handlePayment = (result: any, seq?: number) => {
        this.loading = false;

        const implementation = this.settingsStore.implementation;

        // TODO modify enum settings for embedded LND
        const status =
            implementation === 'embedded-lnd'
                ? lnrpc.Payment.PaymentStatus[result.status]
                : result.status;

        // A non-terminal result (the send stream ended while HTLCs are
        // still pending) or a client-side timeout (outcome unknown on the
        // node) must not release the double-submission guard: a keysend
        // retry generates a fresh preimage and can double-pay if the
        // original HTLC later settles. Hold the guard and track the
        // payment to its terminal state instead (issue #4317).
        if (
            seq !== undefined &&
            (status === 'IN_FLIGHT' || result.payment_timed_out) &&
            this.canTrackPayment(seq)
        ) {
            this.status = 'IN_FLIGHT';
            this.trackPaymentToTerminal(seq);
            return;
        }

        this.clearPaymentInFlight(seq);
        this.payment_route = result.payment_route;

        const payment = new Payment(result);
        this.noteKey = payment.getNoteKey;
        this.payment_preimage = payment.getPreimage;
        this.payment_hash = payment.paymentHash;
        this.payment_fee = payment.getFee;
        this.isIncomplete = payment.isIncomplete;

        const isKeysend =
            result?.htlcs?.[0]?.route?.hops?.[0]?.custom_records?.[
                keySendPreimageType
            ] != null;

        const isSuccess = status === 'complete' || status === 'SUCCEEDED';

        if (isSuccess) {
            setTimeout(() => {
                this.modalStore.checkAndTriggerRatingModal();
            }, RATING_MODAL_TRIGGER_DELAY);
        }

        if (isSuccess && this.paymentStartTime && !this.paymentDuration) {
            this.paymentDuration = (Date.now() - this.paymentStartTime) / 1000;
        }

        // TODO add message for in-flight transactions
        if (
            (status &&
                status !== 'complete' &&
                status !== 'SUCCEEDED' &&
                status !== 'IN_FLIGHT') ||
            (status && status === 'FAILED') ||
            (result.payment_error && result.payment_error !== '')
        ) {
            this.error = true;
            this.payment_error =
                (implementation === 'embedded-lnd'
                    ? errorToUserFriendly(
                          lnrpc.PaymentFailureReason[result.failure_reason]
                              ? new Error(
                                    lnrpc.PaymentFailureReason[
                                        result.failure_reason
                                    ]
                                )
                              : result.payment_error
                      )
                    : errorToUserFriendly(
                          result.failure_reason,
                          isKeysend ? ['Keysend'] : undefined
                      )) || errorToUserFriendly(result.payment_error);
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
    public handlePaymentError = (err: Error, seq?: number) => {
        this.error = true;
        this.loading = false;
        // A rejected dispatch (dropped connection, Tor timeout) doesn't
        // prove the payment failed on the node: the request may have gone
        // through before transport was lost. Surface the error, but verify
        // via lookup before releasing the double-submission guard; if the
        // payment turns out to be pending or terminal after all, the
        // tracker replaces this error with the real outcome.
        if (seq !== undefined && this.canTrackPayment(seq)) {
            this.trackPaymentToTerminal(seq);
        } else {
            this.clearPaymentInFlight(seq);
        }
        this.error_msg =
            errorToUserFriendly(err) || localeString('error.sendingPayment');
    };

    @action
    public resetBroadcast = () => {
        this.error = true;
        this.loading = false;
        this.broadcast_txid = '';
        this.broadcast_err = null;
    };

    public broadcastRawTxToMempoolSpace = (raw_tx_hex: string) => {
        this.resetBroadcast();
        runInAction(() => {
            this.loading = true;
        });
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/plain'
        };
        return ReactNativeBlobUtil.fetch(
            'POST',
            `${UrlUtils.getMempoolApiUrl(this.nodeInfoStore.nodeInfo)}/tx`,
            headers,
            raw_tx_hex
        )
            .then((response: any) => {
                const status = response.info().status;
                const data = response.data;
                if (status == 200) {
                    runInAction(() => {
                        this.loading = false;
                        this.broadcast_txid = data;
                    });
                    return data;
                } else {
                    runInAction(() => {
                        this.broadcast_err = data;
                        this.loading = false;
                        this.error = true;
                    });
                }
            })
            .catch((err) => {
                runInAction(() => {
                    this.broadcast_err = err.error || err.toString();
                    this.loading = false;
                });
            });
    };
}
