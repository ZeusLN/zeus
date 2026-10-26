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
import {
    isNodeResponse,
    isPaymentLookupInconclusive,
    isPaymentRefusedAsDuplicate,
    paymentCreationTimeMs
} from '../utils/PaymentLookupUtils';
import { sleep } from '../utils/SleepUtils';
import UrlUtils from '../utils/UrlUtils';
import { RATING_MODAL_TRIGGER_DELAY } from '../utils/RatingUtils';
import {
    findSentTransaction,
    isRequestTimeout,
    makeSendLabel
} from '../utils/OnchainSendUtils';

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
// guard the way the timed backstop used to. Only applies until the node has
// answered a lookup: once one has, lookups demonstrably work and later
// failures are transient, so only the ceiling ends tracking
export const PAYMENT_TRACK_MAX_FAILURES = 3;
// consecutive "node answered, no record" results required before concluding
// the dispatch never reached the node: a single lookup can miss a payment
// whose dispatch request is still in transit (e.g. a slow Tor circuit).
// When the node itself rejected the send request, the request isn't in
// transit and one such answer is enough
export const PAYMENT_TRACK_MAX_NOT_FOUND = 3;
// how far before the recorded dispatch time lookupPayment's
// creation_date_start filter reaches, to absorb clock skew between the
// device and the node
export const PAYMENT_LOOKUP_CREATION_SLACK_MS = 10 * 60 * 1000;
// a terminal record created more than this before the recorded dispatch
// time belongs to an earlier attempt for the same payment hash, so it's no
// record of this attempt. LND overwrites a FAILED record when the new
// attempt reaches it, and refuses a new attempt for a SUCCEEDED one (already
// paid). Tighter than the lookup slack because the costs of a skewed node
// clock are bounded here: a genuine failure loses its specific reason, and
// a genuine invoice success shows as not sent, where a retry is refused by
// the node as already paid. Keysend records are never treated as stale (see
// inFlightIsKeysend).
export const PAYMENT_STALE_ATTEMPT_SLACK_MS = 60 * 1000;

export interface SendPaymentReq {
    payment_request?: string;
    amount?: string;
    pubkey?: string;
    // BOLT 12 offer (direct-pay backends only): the backend dispatches the
    // offer payment itself, so it must only be set from the offer review
    // screen after the user has confirmed the decoded offer
    offer?: string;
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

// Outcome of one payment, keyed like the observables handlePayment assigns
// it to. Keys that don't apply to the outcome are left unset.
export interface PaymentOutcome {
    noteKey: string;
    payment_preimage: string;
    payment_hash?: string;
    payment_fee: string;
    isIncomplete: boolean;
    status?: string | number;
    error?: boolean;
    error_msg?: string;
    payment_error?: string;
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

    // in lieu of receiving txid on LND's publishTransaction
    @observable publishSuccess = false;
    // an on-chain send timed out and was not found among the wallet's
    // transactions; it may still have been broadcast, so no retry is offered
    @observable sendOutcomeUnknown = false;
    @observable broadcast_txid: string;
    @observable broadcast_err: string | null;
    // coin control
    @observable funded_psbt: string = '';

    // set when payment tracking stopped before observing a terminal state:
    // the payment may still settle, so the send screen warns against retrying
    @observable public paymentOutcomeUnverified = false;
    // true once the node has reported the guard-owning payment as in
    // flight. Only then may the user release the guard to send something
    // else (releasePaymentInFlight): before that, a retry is most likely
    // the same payment sent twice by mistake
    @observable public paymentInFlightConfirmed = false;

    // monotonic id assigned to each dispatched payment
    private paymentSequence = 0;
    // id of the current on-chain send; reset() and the next send change it,
    // so a late result (e.g. a timeout lookup) for an earlier send is dropped
    private sendCoinsSeq = 0;
    // sequence of the payment that set paymentInFlight (null when none);
    // completion callbacks and the backstop timer only clear the flag on
    // behalf of that payment, so overlapping payments (e.g. one that
    // outlived its backstop finishing while the next is still in flight)
    // can't disarm each other's guard
    private inFlightOwnerSeq: number | null = null;
    // payment hash (hex) of the guard-owning payment, when known; lets an
    // ambiguous outcome be tracked to a terminal state via lookupPayment
    private inFlightPaymentHash: string | null = null;
    // when the guard-owning payment was dispatched (ms); bounds lookupPayment
    // scans so a busy node's newer payments can't evict ours from the page
    private inFlightDispatchTime: number | null = null;
    // whether the guard-owning payment is a keysend. Its hash comes from a
    // preimage generated for this attempt, so any record of it is this
    // attempt's, and a skewed clock must not make a success look stale: a
    // keysend retry gets a fresh hash and would pay again.
    private inFlightIsKeysend = false;
    // sequence currently being tracked to a terminal state (null when none)
    private trackingSeq: number | null = null;
    // payments the user released the guard for, whose late results must
    // not overwrite the send screen of a payment made after them
    private releasedSeqs = new Set<number>();
    // payments whose send request hasn't answered yet, released ones
    // included. `loading` is shared by all of them, so releasing one may
    // only clear it when none of the others is still waiting on it.
    private pendingSendSeqs = new Set<number>();

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
        this.sendCoinsSeq++;
        this.loading = false;
        this.sendOutcomeUnknown = false;
        this.paymentInFlight = false;
        this.inFlightOwnerSeq = null;
        this.inFlightPaymentHash = null;
        this.inFlightDispatchTime = null;
        this.inFlightIsKeysend = false;
        this.paymentInFlightConfirmed = false;
        this.paymentOutcomeUnverified = false;
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
        const seq = this.sendCoinsSeq;
        const isCurrent = () => seq === this.sendCoinsSeq;
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
            .catch(async (error: any) => {
                // a timed out publish may still have gone out, and Try Again
                // would fund a new transaction from other inputs
                if (isRequestTimeout(error)) {
                    const found =
                        txid && isCurrent()
                            ? await this.findTimedOutSend(
                                  (tx: any) => tx.tx_hash === txid
                              )
                            : undefined;
                    runInAction(() => {
                        if (!isCurrent()) return;
                        if (found) {
                            this.txid = found;
                            this.publishSuccess = true;
                            this.channelsStore.resetOpenChannel();
                        } else {
                            this.error_msg = localeString(
                                'stores.TransactionsStore.sendOutcomeUnknown'
                            );
                            this.error = true;
                            this.sendOutcomeUnknown = true;
                        }
                        this.loading = false;
                    });
                    return;
                }
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

        // fundPsbt takes one amount per address, so an address entered more
        // than once is paid the sum of its amounts, as VerifyOnChain totals
        // them. Assigning would pay only the last of them.
        const addOutput = (address: string, sats: any) => {
            outputs[address] = (outputs[address] || 0) + Number(sats);
        };

        if (addr) {
            addOutput(addr, amount);
        }

        if (additional_outputs) {
            additional_outputs.forEach((output) =>
                addOutput(output.address, output.satAmount)
            );
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
        // also invalidates a lookup still running for an earlier send,
        // including when this send takes the coin control path
        const seq = ++this.sendCoinsSeq;
        const isCurrent = () => seq === this.sendCoinsSeq;

        this.funded_psbt = '';
        this.error = false;
        this.sendOutcomeUnknown = false;
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
            BackendUtils.supportsOnchainSendMax() &&
            // SendCoins pays a single address; batched sends have to go
            // through fundPsbt below or the additional outputs are dropped
            !transactionRequest.additional_outputs?.length
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

        // lets a timed out send be found among the wallet's transactions;
        // only the LND backends label sends
        const label = BackendUtils.isLNDBased() ? makeSendLabel() : undefined;

        const onSent = (txid: string) =>
            runInAction(() => {
                if (!isCurrent()) return;
                this.txid = txid;
                this.publishSuccess = true;
                this.loading = false;
                this.balanceStore.getCombinedBalance();
            });

        BackendUtils.sendCoins(
            label ? { ...transactionRequest, label } : transactionRequest
        )
            .then((data: any) => onSent(data.txid))
            .catch(async (error: Error) => {
                // a timed out send may still have been broadcast on any
                // backend (e.g. CLN's withdraw past the 30s REST timeout);
                // only labeled sends can be looked up
                if (isRequestTimeout(error)) {
                    const txid =
                        label && isCurrent()
                            ? await this.findTimedOutSend(
                                  (tx: any) => tx.label === label
                              )
                            : undefined;
                    if (txid) {
                        onSent(txid);
                        return;
                    }
                    runInAction(() => {
                        if (!isCurrent()) return;
                        this.error_msg = localeString(
                            'stores.TransactionsStore.sendOutcomeUnknown'
                        );
                        this.error = true;
                        this.sendOutcomeUnknown = true;
                        this.loading = false;
                    });
                    return;
                }
                const errorMsg = errorToUserFriendly(error);
                runInAction(() => {
                    if (!isCurrent()) return;
                    this.error_msg = errorMsg;
                    this.error = true;
                    this.loading = false;
                });
            });
    };

    // The send may have been broadcast before its request timed out. Only
    // recent blocks and unconfirmed transactions can hold it.
    private findTimedOutSend = (isSent: (tx: any) => boolean) => {
        const height = Number(
            this.nodeInfoStore.nodeInfo?.currentBlockHeight || 0
        );
        return findSentTransaction(
            () =>
                BackendUtils.getTransactions(
                    height > 6 ? { start_height: height - 6 } : undefined
                ),
            isSent
        );
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
        offer,
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
        // Guard against double-submission: if a payment is already in flight,
        // ignore the new request. Without this a rapid double-tap (or a
        // re-fired swipe) dispatches two payments, and keysend in particular
        // generates a fresh preimage per call, defeating every backend's
        // same-hash duplicate protection. Service-initiated payments (e.g.
        // the NWC service) don't come through here: they pay via
        // sendPaymentSilently, which leaves this store's state alone.
        if (this.paymentInFlight) {
            return;
        }

        const seq = ++this.paymentSequence;
        this.pendingSendSeqs.add(seq);
        this.paymentInFlight = true;
        this.inFlightOwnerSeq = seq;
        this.inFlightPaymentHash = null;
        this.inFlightDispatchTime = Date.now();
        this.inFlightIsKeysend = !!pubkey;
        this.paymentInFlightConfirmed = false;
        this.paymentStartTime = Date.now();
        this.paymentDuration = null;
        this.paymentOutcomeUnverified = false;
        this.loading = true;
        this.error_msg = null;
        this.error = false;
        this.payment_route = null;
        this.payment_preimage = null;
        this.isIncomplete = null;
        this.payment_hash = null;
        this.payment_error = null;
        this.status = null;

        // The offer path dispatches via payOffer, which only direct-pay
        // backends implement; anywhere else the dispatcher returns false
        // and the .then() below would throw. The offer review screen is
        // gated on this capability, but fail fast in case a future caller
        // passes an offer on another backend
        if (offer && !BackendUtils.supportsOffersDirectPay()) {
            this.handlePaymentError(
                new Error(
                    localeString('views.Send.payBolt12.offersNotSupported')
                ),
                seq
            );
            return;
        }

        const data: any = {};
        if (payment_request) {
            data.payment_request = payment_request;
        }
        if (offer) {
            data.offer = offer;
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
        this.inFlightPaymentHash =
            deriveExpectedPaymentHash({
                payment_hash: data.payment_hash,
                payment_request,
                amp
            }) || null;

        // Backstop for the in-flight guard: if the completion callback is
        // lost (e.g. a dropped LNC stream, or a hung request on a backend
        // that gets no timeout_seconds), the flag would otherwise stay set
        // and block all sends until the next reconnect. Once the payment's
        // timeout plus a grace period has elapsed, try to observe the
        // payment's actual terminal state before releasing the flag.
        const backstopMs = ((data.timeout_seconds ?? 300) + 60) * 1000;
        setTimeout(() => this.backstopPaymentInFlight(seq), backstopMs);

        const payFunc = offer
            ? BackendUtils.payOffer
            : (this.settingsStore.implementation === 'cln-rest' ||
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
        this.inFlightIsKeysend = false;
        this.paymentInFlightConfirmed = false;
    };

    // Lets the user send another payment while the guard-owning payment is
    // still pending on the node, e.g. a hold invoice that stays unsettled
    // by design. Only allowed once the node has reported the payment in
    // flight, so the user has been shown it is pending, not failed.
    // Tracking of the released payment stops: its outcome shows in
    // Activity, and its late results are ignored so they can't overwrite
    // the next payment's send screen. Returns whether the guard was
    // released.
    @action
    public releasePaymentInFlight = (): boolean => {
        const seq = this.inFlightOwnerSeq;
        if (seq === null || !this.paymentInFlightConfirmed) return false;
        this.releasedSeqs.add(seq);
        this.clearPaymentInFlight(seq);
        // the released payment's send request may still be open (a hung
        // LNC stream or Tor request). Its late result is ignored, so it
        // would otherwise leave `loading` set for other screens that read
        // it. Another payment still waiting on its request owns the flag,
        // so leave it to that payment's result.
        this.pendingSendSeqs.delete(seq);
        if (this.pendingSendSeqs.size === 0) this.loading = false;
        return true;
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
            // the send never settled, so its request may still reach the
            // node: a no-record answer can't prove it was never dispatched
            this.trackPaymentToTerminal(seq, null);
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
    // after PAYMENT_TRACK_MAX_FAILURES failed lookups before the node has
    // answered any, or at the
    // PAYMENT_TRACK_MAX_MS ceiling. A release without a terminal state
    // updates the send screen: never-dispatched shows as not sent, any other
    // exit leaves the outcome flagged as unverified.
    //
    // `neverDispatchedAfter` is the time (ms) after which the send request
    // can no longer reach the node, so a no-record answer from then on is
    // evidence it never will. Answers before it don't count. null means the
    // request has no such deadline (e.g. an LNC stream that is never
    // cancelled): repeated no-record answers then end tracking as
    // unverified, never as not sent.
    //
    // `requiredNotFound` is how many consecutive no-record answers conclude
    // the payment never reached the node.
    private trackPaymentToTerminal = async (
        seq: number,
        neverDispatchedAfter: number | null,
        requiredNotFound: number = PAYMENT_TRACK_MAX_NOT_FOUND
    ) => {
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
        const dispatchTime = this.inFlightDispatchTime;
        const isKeysend = this.inFlightIsKeysend;
        this.trackingSeq = seq;
        const deadline = Date.now() + PAYMENT_TRACK_MAX_MS;
        let failures = 0;
        let notFound = 0;
        let answered = false;
        let neverDispatched = false;
        try {
            while (this.inFlightOwnerSeq === seq && Date.now() < deadline) {
                let payment: any = null;
                let lookupFailed = false;
                let inconclusive = false;
                try {
                    payment = await BackendUtils.lookupPayment({
                        payment_hash,
                        creation_date_start
                    });
                } catch (e) {
                    if (isPaymentLookupInconclusive(e)) inconclusive = true;
                    else lookupFailed = true;
                }
                if (this.inFlightOwnerSeq !== seq) return;
                if (!lookupFailed) answered = true;

                // embedded-lnd statuses are numeric protobuf enums
                let status =
                    typeof payment?.status === 'number'
                        ? lnrpc.Payment.PaymentStatus[payment.status]
                        : payment?.status;

                if (
                    (status === 'FAILED' ||
                        (status === 'SUCCEEDED' && !isKeysend)) &&
                    dispatchTime
                ) {
                    const createdAt = paymentCreationTimeMs(payment);
                    if (
                        createdAt !== null &&
                        createdAt <
                            dispatchTime - PAYMENT_STALE_ATTEMPT_SLACK_MS
                    ) {
                        // an earlier attempt's outcome, not this one's:
                        // treat it as no record of this attempt
                        payment = null;
                        status = undefined;
                    }
                }

                if (status === 'SUCCEEDED' || status === 'FAILED') {
                    // clear any transport error shown while the outcome
                    // was unknown; handlePayment re-derives error state
                    // from the payment's actual terminal result
                    this.clearPaymentError();
                    this.handlePayment(payment, seq);
                    return;
                }

                if (payment) {
                    notFound = 0;
                    if (status === 'IN_FLIGHT') {
                        // outcome is pending, not failed: don't leave a
                        // stale timeout/transport error on screen
                        this.markPaymentInTransit();
                    }
                } else if (inconclusive) {
                    // the node answered, but the scan may have missed the
                    // payment on a truncated page: neither a sighting nor a
                    // no-record answer, so keep polling until the ceiling
                } else if (!lookupFailed) {
                    // the node answered and has no record of the payment.
                    // Unless the node rejected the send request, one such
                    // answer isn't proof the dispatch never reached it: the
                    // request may still be in transit (a slow Tor circuit
                    // can deliver it after a fresh-connection lookup
                    // returns). Only conclude never-dispatched after
                    // requiredNotFound no-record answers with no sighting
                    // between, all given once the request's deadline has
                    // passed.
                    if (
                        neverDispatchedAfter !== null &&
                        Date.now() < neverDispatchedAfter
                    ) {
                        // the request may still arrive: not evidence yet
                    } else if (++notFound >= requiredNotFound) {
                        neverDispatched = neverDispatchedAfter !== null;
                        return;
                    }
                } else if (
                    !answered &&
                    ++failures >= PAYMENT_TRACK_MAX_FAILURES
                ) {
                    // lookups have never worked on this node: holding the
                    // guard to the ceiling would lock out sends for nothing.
                    // Once the node has answered (e.g. reported the payment
                    // IN_FLIGHT), a short outage must not release the guard
                    // while an HTLC may be pending (a keysend retry can't be
                    // deduplicated by the node)
                    return;
                }
                await sleep(PAYMENT_TRACK_POLL_MS);
            }
        } finally {
            // a newer payment may have started its own tracking
            if (this.trackingSeq === seq) this.trackingSeq = null;
            // still the owner means tracking gave up without a terminal
            // state (a terminal result or a new send has already moved the
            // guard on)
            if (this.inFlightOwnerSeq === seq) {
                this.markTrackingStopped(neverDispatched);
            }
            this.clearPaymentInFlight(seq);
        }
    };

    // Replaces the in-transit state the tracker was maintaining once it
    // stops without a terminal result, so the send screen doesn't keep
    // presenting the payment as being followed. A never-dispatched payment
    // is shown as not sent (retrying is safe). Otherwise the payment may
    // still settle (e.g. a held HTLC past the tracking ceiling), so it must
    // not be shown as failed, which invites a retry that can double-pay.
    @action
    private markTrackingStopped = (neverDispatched: boolean) => {
        if (neverDispatched) {
            if (!this.error) {
                this.error = true;
                this.error_msg = localeString(
                    'views.SendingLightning.paymentNotSent'
                );
            }
            if (this.status === 'IN_FLIGHT') this.status = null;
        } else {
            this.paymentOutcomeUnverified = true;
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
        this.paymentInFlightConfirmed = true;
    };

    public sendPaymentSilently = async ({
        payment_request,
        amount,
        fee_limit_sat,
        max_parts,
        timeout_seconds
    }: {
        payment_request: string;
        amount?: string;
        fee_limit_sat?: number;
        max_parts?: string;
        timeout_seconds?: number;
    }) => {
        const data: any = {};

        if (payment_request) {
            data.payment_request = payment_request;
        }
        if (amount) {
            data.amt = Number(amount);
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
            // a cap of 0 is valid (e.g. an NWC budget with no room left
            // for fees), so only a missing cap gets the default
            data.fee_limit_sat =
                fee_limit_sat != null && !isNaN(Number(fee_limit_sat))
                    ? Number(fee_limit_sat)
                    : 100;
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

    // TODO modify enum settings for embedded LND
    private getResultStatus = (result: any) =>
        this.settingsStore.implementation === 'embedded-lnd'
            ? lnrpc.Payment.PaymentStatus[result.status]
            : result.status;

    @action
    public handlePayment = (result: any, seq?: number) => {
        if (seq !== undefined) this.pendingSendSeqs.delete(seq);
        if (seq !== undefined && this.releasedSeqs.has(seq)) return;
        this.loading = false;

        const status = this.getResultStatus(result);

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
            if (status === 'IN_FLIGHT') this.paymentInFlightConfirmed = true;
            // a timed-out send may still be on its way to the node; the
            // backend reports when its request can no longer arrive. An
            // IN_FLIGHT result means the node already has the payment.
            this.trackPaymentToTerminal(
                seq,
                result.payment_timed_out &&
                    typeof result.dispatch_deadline_ms === 'number'
                    ? result.dispatch_deadline_ms
                    : null
            );
            return;
        }

        this.clearPaymentInFlight(seq);
        this.payment_route = result.payment_route;
        // keys the outcome leaves unset keep their current values
        Object.assign(this, this.getPaymentOutcome(result));

        const isSuccess = status === 'complete' || status === 'SUCCEEDED';

        if (isSuccess) {
            setTimeout(() => {
                this.modalStore.checkAndTriggerRatingModal();
            }, RATING_MODAL_TRIGGER_DELAY);
        }

        if (isSuccess && this.paymentStartTime && !this.paymentDuration) {
            this.paymentDuration = (Date.now() - this.paymentStartTime) / 1000;
        }
    };

    // Derives a payment's outcome from the backend's response without
    // writing to this store's observables, which belong to the payment the
    // user is watching. Service-initiated payments (e.g. NWC) pay via
    // sendPaymentSilently and take their outcome from here.
    public getPaymentOutcome = (result: any): PaymentOutcome => {
        const payment = new Payment(result);
        const outcome: PaymentOutcome = {
            noteKey: payment.getNoteKey,
            payment_preimage: payment.getPreimage,
            payment_hash: payment.resolvedPaymentHash,
            payment_fee: payment.getFee,
            isIncomplete: payment.isIncomplete
        };

        const implementation = this.settingsStore.implementation;
        const status = this.getResultStatus(result);

        const isKeysend =
            result?.htlcs?.[0]?.route?.hops?.[0]?.custom_records?.[
                keySendPreimageType
            ] != null;

        // TODO add message for in-flight transactions
        if (
            (status &&
                status !== 'complete' &&
                status !== 'SUCCEEDED' &&
                status !== 'IN_FLIGHT') ||
            (status && status === 'FAILED') ||
            (result.payment_error && result.payment_error !== '')
        ) {
            outcome.error = true;
            outcome.payment_error =
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
            outcome.error = true;
            outcome.error_msg = errorToUserFriendly(result.message);
        } else {
            outcome.status = result.status || 'complete';
        }

        return outcome;
    };

    @action
    public handlePaymentError = (err: Error, seq?: number) => {
        if (seq !== undefined) this.pendingSendSeqs.delete(seq);
        if (seq !== undefined && this.releasedSeqs.has(seq)) return;
        this.error = true;
        this.loading = false;
        // A rejected dispatch (dropped connection, Tor timeout) doesn't
        // prove the payment failed on the node: the request may have gone
        // through before transport was lost. Surface the error, but verify
        // via lookup before releasing the double-submission guard; if the
        // payment turns out to be pending or terminal after all, the
        // tracker replaces this error with the real outcome.
        if (isPaymentRefusedAsDuplicate(err)) {
            // the node refused the request because it already has a
            // payment for this hash, before sending anything for it. The
            // existing record is an earlier attempt's, so tracking it would
            // show that attempt's outcome (e.g. an earlier success for an
            // already-paid invoice) as this one's.
            this.clearPaymentInFlight(seq);
        } else if (seq !== undefined && this.canTrackPayment(seq)) {
            // the rejection settled the request, so no-record answers
            // count from now on. A rejection from the node itself (e.g. an
            // expired invoice) means the request was processed, and LND
            // records a payment before dispatching it, so one no-record
            // answer shows it was never sent. A transport failure may
            // still deliver the request, so it needs repeated answers.
            this.trackPaymentToTerminal(
                seq,
                Date.now(),
                isNodeResponse(err) ? 1 : PAYMENT_TRACK_MAX_NOT_FOUND
            );
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
