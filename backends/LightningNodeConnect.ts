import {
    NativeModules,
    NativeEventEmitter,
    EmitterSubscription
} from 'react-native';

import LNC from '../zeus_modules/@lightninglabs/lnc-rn';
import { lnrpc, walletrpc } from '../zeus_modules/@lightninglabs/lnc-core';

import { settingsStore, nodeInfoStore } from '../stores/Stores';
import CredentialStore from './LNC/credentialStore';

import OpenChannelRequest from '../models/OpenChannelRequest';

import Base64Utils from '../utils/Base64Utils';
import { snakeize } from '../utils/DataFormatUtils';
import {
    decideLncPayEvent,
    deriveExpectedPaymentHash
} from '../utils/LncPayUtils';
import { localeString } from '../utils/LocaleUtils';
import { toLnrpcAddressType } from '../utils/LndUtils';
import VersionUtils from '../utils/VersionUtils';

import { Hash as sha256Hash } from 'fast-sha256';
import BigNumber from 'bignumber.js';

const NEXT_ADDR_MAP: any = {
    WITNESS_PUBKEY_HASH: 0,
    NESTED_PUBKEY_HASH: 1,
    UNUSED_WITNESS_PUBKEY_HASH: 2,
    UNUSED_NESTED_PUBKEY_HASH: 3,
    TAPROOT_PUBKEY: 4,
    UNUSED_TAPROOT_PUBKEY: 5
};

export default class LightningNodeConnect {
    lnc: any;
    listener: any;

    permOpenChannel: boolean;
    permSendCoins: boolean;
    permSendLN: boolean;
    permNewAddress: boolean;
    permImportAccount: boolean;
    permForwardingHistory: boolean;
    // Default true so NWC subscribe-before-checkPerms (app resume) does
    // not drop sign_message. checkPerms currently forces all perms true
    // (ZEUS-3642); restore hasPerms there before relying on this flag.
    permSignMessage: boolean = true;

    initLNC = async () => {
        const { pairingPhrase, mailboxServer, customMailboxServer } =
            settingsStore;

        this.lnc = new LNC({
            credentialStore: await new CredentialStore(
                pairingPhrase
            ).initialize()
        });

        this.lnc.credentials.pairingPhrase = pairingPhrase;
        this.lnc.credentials.serverHost =
            mailboxServer === 'custom-defined'
                ? customMailboxServer
                : mailboxServer;

        return await this.lnc.credentials.load(pairingPhrase);
    };

    connect = async () => await this.lnc.connect();
    checkPerms = async () => {
        // ZEUS-3642: we are temporarily returning all perms
        // as true until resolved
        // https://github.com/ZeusLN/zeus/issues/3642
        //
        // this.permOpenChannel = await this.lnc.hasPerms(
        //     'lnrpc.Lightning.OpenChannel'
        // );
        // this.permSendCoins = await this.lnc.hasPerms(
        //     'lnrpc.Lightning.SendCoins'
        // );
        // this.permSendLN = await this.lnc.hasPerms(
        //     'routerrpc.Router.SendPaymentV2'
        // );
        // this.permNewAddress = await this.lnc.hasPerms(
        //     'lnrpc.Lightning.NewAddress'
        // );
        // this.permImportAccount = await this.lnc.hasPerms(
        //     'walletrpc.WalletKit.ImportAccount'
        // );
        // this.permForwardingHistory = await this.lnc.hasPerms(
        //     'lnrpc.Lightning.ForwardingHistory'
        // );
        // this.permSignMessage = await this.lnc.hasPerms(
        //     'signrpc.Signer.SignMessage'
        // );
        this.permOpenChannel = true;
        this.permSendCoins = true;
        this.permSendLN = true;
        this.permNewAddress = true;
        this.permImportAccount = true;
        this.permForwardingHistory = true;
        this.permSignMessage = true;
    };
    isConnected = async () => await this.lnc.isConnected();
    disconnect = () => this.lnc && this.lnc.disconnect();

    getTransactions = async (data: any) =>
        await this.lnc.lnd.lightning
            .getTransactions({
                maxTransactions: data?.max_transactions || 500
            })
            .then((data: lnrpc.TransactionDetails) => {
                const formatted = snakeize(data);
                return {
                    transactions: formatted.transactions.reverse()
                };
            });
    getChannels = async () =>
        await this.lnc.lnd.lightning
            .listChannels({})
            .then((data: lnrpc.ListChannelsResponse) => snakeize(data));
    getPendingChannels = async () =>
        await this.lnc.lnd.lightning
            .pendingChannels({})
            .then((data: lnrpc.PendingChannelsResponse) => snakeize(data));
    getClosedChannels = async () =>
        await this.lnc.lnd.lightning
            .closedChannels({})
            .then((data: lnrpc.ClosedChannelsResponse) => snakeize(data));
    getChannelInfo = async (chanId: string) => {
        const request = { chanId, chanPoint: '' };
        return await this.lnc.lnd.lightning
            .getChanInfo(request)
            .then((data: lnrpc.ChannelEdge) => snakeize(data));
    };
    getBlockchainBalance = async (req: lnrpc.WalletBalanceRequest) =>
        await this.lnc.lnd.lightning
            .walletBalance(req)
            .then((data: lnrpc.WalletBalanceResponse) => snakeize(data));
    getLightningBalance = async (req: lnrpc.ChannelBalanceRequest) =>
        await this.lnc.lnd.lightning
            .channelBalance(req)
            .then((data: lnrpc.ChannelBalanceResponse) => snakeize(data));
    sendCoins = async (data: any) =>
        await this.lnc.lnd.lightning
            .sendCoins({
                addr: data.addr,
                sat_per_vbyte: data.sat_per_vbyte,
                amount: data.amount,
                spend_unconfirmed: data.spend_unconfirmed,
                send_all: data.send_all,
                outpoints: data.outpoints
            })
            .then((data: lnrpc.SendCoinsResponse) => snakeize(data));
    sendCustomMessage = async (data: any) =>
        await this.lnc.lnd.lightning
            .sendCustomMessage({
                peer: Base64Utils.hexToBase64(data.peer),
                type: data.type,
                data: Base64Utils.hexToBase64(data.data)
            })
            .then((data: lnrpc.SendCustomMessageResponse) => snakeize(data));
    subscribeCustomMessages = () =>
        this.lnc.lnd.lightning.subscribeCustomMessages({});
    getMyNodeInfo = async () =>
        await this.lnc.lnd.lightning
            .getInfo({})
            .then((data: lnrpc.GetInfoResponse) => snakeize(data));
    getNetworkInfo = async () =>
        await this.lnc.lnd.lightning
            .getNetworkInfo({})
            .then((data: lnrpc.NetworkInfo) => snakeize(data));
    getInvoices = async (
        params: { limit?: number; reversed?: boolean } = {
            limit: 500,
            reversed: true
        }
    ) =>
        await this.lnc.lnd.lightning
            .listInvoices({
                reversed:
                    params?.reversed !== undefined ? params.reversed : true,
                ...(params?.limit && {
                    num_max_invoices: params.limit
                })
            })
            .then((data: lnrpc.ListInvoiceResponse) => snakeize(data));
    createInvoice = async (data: any) =>
        await this.lnc.lnd.lightning
            .addInvoice({
                memo: data.memo,
                value_msat: data.value_msat || Number(data.value) * 1000,
                expiry: data.expiry_seconds,
                is_amp: data.is_amp,
                is_blinded: data.is_blinded,
                private: data.private,
                r_preimage: data.preimage
                    ? Base64Utils.hexToBase64(data.preimage)
                    : undefined,
                route_hints: data.route_hints
            })
            .then((data: lnrpc.AddInvoiceResponse) => snakeize(data));
    getPayments = async (
        params: {
            maxPayments?: number;
            reversed?: boolean;
            creationDateStart?: number;
        } = {
            maxPayments: 500,
            reversed: true
        }
    ) =>
        await this.lnc.lnd.lightning
            .listPayments({
                include_incomplete: true,
                ...(params?.maxPayments && {
                    max_payments: params.maxPayments
                }),
                reversed:
                    params?.reversed !== undefined ? params.reversed : true,
                ...(params?.creationDateStart && {
                    creation_date_start: params.creationDateStart
                })
            })
            .then((data: lnrpc.ListPaymentsResponse) => snakeize(data));
    // scans a payments page; trackPaymentV2 over LNC is a stream and would
    // need view-level event plumbing. With a creation_date_start bound the
    // page is anchored at the dispatch time (ascending), so newer payments
    // from other clients can't evict the target; without one, fall back to
    // the newest page.
    lookupPayment = async (data: {
        payment_hash: string;
        creation_date_start?: number;
    }) =>
        await this.getPayments(
            data.creation_date_start
                ? {
                      maxPayments: 50,
                      reversed: false,
                      creationDateStart: data.creation_date_start
                  }
                : { maxPayments: 50, reversed: true }
        ).then(
            (response: any) =>
                response?.payments?.find(
                    (payment: any) =>
                        payment.payment_hash?.toLowerCase() ===
                        data.payment_hash.toLowerCase()
                ) ?? null
        );
    getNewAddress = async (data: any) =>
        await this.lnc.lnd.lightning
            .newAddress({
                type: toLnrpcAddressType(data.type),
                account: data.account || 'default'
            })
            .then((data: walletrpc.AddrRequest) => snakeize(data));
    getNewChangeAddress = async (data: any) =>
        await this.lnc.lnd.walletKit
            .nextAddr({
                type: NEXT_ADDR_MAP[data.type],
                account: data.account || 'default',
                change: true
            })
            .then((data: walletrpc.AddrResponse) => snakeize(data));
    openChannelSync = async (data: OpenChannelRequest) => {
        let request: any = {
            private: data.privateChannel,
            scid_alias: data.scidAlias,
            local_funding_amount: data.local_funding_amount || 0,
            min_confs: data.min_confs,
            node_pubkey_string: data.node_pubkey_string,
            sat_per_vbyte: data.sat_per_vbyte,
            spend_unconfirmed: data.spend_unconfirmed,
            close_address: data.close_address
        };

        if (data.fundMax) {
            request.fund_max = true;
            delete request.local_funding_amount;
        }

        if (data.simpleTaprootChannel) {
            request.commitment_type = lnrpc.CommitmentType['SIMPLE_TAPROOT'];
        }

        if (data.utxos && data.utxos.length > 0) {
            request.outpoints = data.utxos.map((utxo: string) => {
                const [txid_str, output_index] = utxo.split(':');
                return {
                    txid_str,
                    output_index: Number(output_index)
                };
            });
        }
        return await this.lnc.lnd.lightning
            .openChannelSync(request)
            .then((data: lnrpc.ChannelPoint) => snakeize(data));
    };

    openChannelStream = (data: OpenChannelRequest) => {
        let request: any = {
            private: data.privateChannel || false,
            scid_alias: data.scidAlias,
            local_funding_amount: data.local_funding_amount,
            min_confs: data.min_confs,
            node_pubkey: Base64Utils.hexToBase64(data.node_pubkey_string),
            sat_per_vbyte: !data.funding_shim ? data.sat_per_vbyte : undefined,
            spend_unconfirmed: data.spend_unconfirmed,
            funding_shim: data.funding_shim
        };

        if (data.fundMax) {
            request.fund_max = true;
        }

        if (data.simpleTaprootChannel) {
            request.commitment_type = lnrpc.CommitmentType['SIMPLE_TAPROOT'];
        }

        if (data.utxos && data.utxos.length > 0) {
            request.outpoints = data.utxos.map((utxo: string) => {
                const [txid_str, output_index] = utxo.split(':');
                return {
                    txid_str,
                    output_index: Number(output_index)
                };
            });
        }

        if (data.funding_shim) {
            request.funding_shim = data.funding_shim;
            delete request.sat_per_vbyte;
        }

        const streamingCall = this.lnc.lnd.lightning.openChannel(request);

        const { LncModule } = NativeModules;
        const eventEmitter = new NativeEventEmitter(LncModule);
        return new Promise((resolve, reject) => {
            this.listener = eventEmitter.addListener(
                streamingCall,
                (event: any) => {
                    if (event.result && event.result !== 'EOF') {
                        let result;
                        try {
                            result = JSON.parse(event.result);

                            resolve({ result });
                            this.listener.remove();
                        } catch (e) {
                            try {
                                result = JSON.parse(event);
                            } catch (e2) {
                                result = event.result || event;
                            }

                            reject(result);
                            this.listener.remove();
                        }
                    }
                }
            );
        });
    };
    connectPeer = async (data: any) =>
        await this.lnc.lnd.lightning
            .connectPeer(data)
            .then((data: lnrpc.ConnectPeerRequest) => snakeize(data));
    decodePaymentRequest = async (urlParams?: Array<string>) =>
        await this.lnc.lnd.lightning
            .decodePayReq({ pay_req: urlParams && urlParams[0] })
            .then((data: lnrpc.PayReq) => snakeize(data));
    payLightningInvoice = (data: any) => {
        // sendPaymentV2 is a streaming RPC: the call returns the event name
        // ('routerrpc.Router.SendPaymentV2') and results arrive on a channel
        // shared by every concurrent payment, with no request correlation.
        // Resolve with this payment's terminal result so callers get the
        // same promise contract as every other backend. The expected hash
        // must be derived before pubkey is stripped.
        const expectedHash = deriveExpectedPaymentHash(data);
        if (data.pubkey) delete data.pubkey;

        const streamingCall = this.lnc.lnd.router.sendPaymentV2({
            ...data,
            allow_self_payment: true
        });

        const { LncModule } = NativeModules;
        const eventEmitter = new NativeEventEmitter(LncModule);
        return new Promise((resolve, reject) => {
            let settled = false;
            let subscription: EmitterSubscription;

            const settle = (fn: () => void) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                subscription.remove();
                fn();
            };

            // If the stream dies without a terminal event, resolve with the
            // designed in-transit shape rather than rejecting: the payment
            // may still settle node-side, and a hard failure here invites a
            // retry (a double-send on keysend, where every attempt carries
            // a fresh preimage).
            const timeoutMs =
                ((Number(data.timeout_seconds) || 60) + 60) * 1000;
            const timer = setTimeout(
                () =>
                    settle(() =>
                        resolve({
                            payment_error: localeString(
                                'views.SendingLightning.paymentTimedOut'
                            ),
                            // outcome unknown on the node: lets the caller
                            // track the payment to a terminal state
                            // instead of reporting failure
                            payment_timed_out: true
                        })
                    ),
                timeoutMs
            );

            subscription = eventEmitter.addListener(
                streamingCall,
                (event: any) => {
                    const decision = decideLncPayEvent(
                        event?.result,
                        expectedHash
                    );
                    if (decision.kind === 'terminal') {
                        settle(() => resolve(decision.result));
                    } else if (decision.kind === 'error') {
                        settle(() => reject(decision.error));
                    }
                    // 'ignore': EOF, a non-terminal status, or another payment's event
                }
            );
        });
    };
    closeChannel = async (urlParams?: Array<string>) => {
        let params: any = {
            channel_point: {
                funding_txid_str: urlParams && urlParams[0],
                output_index: urlParams && urlParams[1] && Number(urlParams[1])
            },
            force: urlParams && urlParams[2]
        };

        if (urlParams && urlParams[3] && !urlParams[2]) {
            params.sat_per_vbyte = Number(urlParams[3]);
        }

        if (urlParams && urlParams[4]) {
            params.delivery_address = urlParams[4];
        }

        return this.lnc.lnd.lightning.closeChannel(params);
    };
    abandonChannel = async (
        urlParams?: Array<string | boolean | undefined>
    ) => {
        const fundingTxidStr =
            urlParams && typeof urlParams[0] === 'string'
                ? urlParams[0]
                : undefined;
        const outputIndex =
            urlParams && typeof urlParams[1] === 'string'
                ? Number(urlParams[1])
                : 0;

        const params: any = {
            channelPoint: {
                fundingTxidStr,
                fundingTxidBytes: undefined,
                outputIndex
            }
        };

        // Only include boolean parameters if they are explicitly set (not undefined)
        if (urlParams && urlParams[2]) {
            params.pendingFundingShimOnly = Boolean(urlParams[2]);
        }

        if (urlParams && urlParams[3]) {
            params.iKnowWhatIAmDoing = Boolean(urlParams[3]);
        }

        return this.lnc.lnd.lightning.abandonChannel(params);
    };
    getNodeInfo = async (urlParams?: Array<string>) =>
        await this.lnc.lnd.lightning
            .getNodeInfo({ pub_key: urlParams && urlParams[0] })
            .then((data: lnrpc.NodeInfo) => snakeize(data));
    getFees = async () =>
        await this.lnc.lnd.lightning
            .feeReport({})
            .then((data: lnrpc.FeeReportResponse) => snakeize(data));
    setFees = async (data: any) => {
        // handle commas in place of decimals
        const base_fee_msat = data.base_fee_msat.replace(/,/g, '.');
        const fee_rate = data.fee_rate.replace(/,/g, '.');

        let params;

        if (data.global) {
            params = {
                base_fee_msat,
                fee_rate: `${Number(fee_rate) / 100}`,
                ...(this.supportInboundFees() && {
                    inboundFee: {
                        ...(data.base_fee_msat_inbound !== '' && {
                            base_fee_msat: data.base_fee_msat_inbound
                        }),
                        ...(data.fee_rate_inbound !== '' &&
                            data.fee_rate_inbound !== undefined && {
                                fee_rate_ppm: `${new BigNumber(
                                    data.fee_rate_inbound
                                )
                                    .multipliedBy(10000)
                                    .toFixed(0)}`
                            })
                    }
                }),

                global: true,
                time_lock_delta: Number(data.time_lock_delta),
                min_htlc_msat: data.min_htlc
                    ? `${Number(data.min_htlc) * 1000}`
                    : null,
                max_htlc_msat: data.max_htlc
                    ? `${Number(data.max_htlc) * 1000}`
                    : null,
                min_htlc_msat_specified: data.min_htlc ? true : false
            };
        } else {
            params = {
                base_fee_msat,
                fee_rate: `${Number(fee_rate) / 100}`,
                ...(this.supportInboundFees() && {
                    inboundFee: {
                        ...(data.base_fee_msat_inbound !== '' && {
                            base_fee_msat: data.base_fee_msat_inbound
                        }),
                        ...(data.fee_rate_inbound !== '' &&
                            data.fee_rate_inbound !== undefined && {
                                fee_rate_ppm: `${new BigNumber(
                                    data.fee_rate_inbound
                                )
                                    .multipliedBy(10000)
                                    .toFixed(0)}`
                            })
                    }
                }),
                chan_point: {
                    funding_txid_str: data.chan_point.funding_txid_str,
                    output_index: data.chan_point.output_index
                },
                time_lock_delta: Number(data.time_lock_delta),
                min_htlc_msat: data.min_htlc
                    ? `${Number(data.min_htlc) * 1000}`
                    : null,
                max_htlc_msat: data.max_htlc
                    ? `${Number(data.max_htlc) * 1000}`
                    : null,
                min_htlc_msat_specified: data.min_htlc ? true : false
            };
        }

        return await this.lnc.lnd.lightning
            .updateChannelPolicy(params)
            .then((data: lnrpc.PolicyUpdateResponse) => snakeize(data));
    };
    // takes a raw PolicyUpdateRequest, used by Developer Tools
    updateChannelPolicy = async (data: any) =>
        await this.lnc.lnd.lightning
            .updateChannelPolicy(data)
            .then((res: lnrpc.PolicyUpdateResponse) => snakeize(res));
    getRoutes = async (urlParams?: Array<string>) =>
        await this.lnc.lnd.lightning
            .queryRoutes({
                pub_key: urlParams && urlParams[0],
                amt: urlParams && urlParams[1] && Number(urlParams[1])
            })
            .then((data: lnrpc.QueryRoutesResponse) => snakeize(data));
    getForwardingHistory = async (
        hours = 24,
        chanIdIn?: string,
        chanIdOut?: string
    ) => {
        const req: any = {
            numMaxEvents: 10000000,
            startTime: Math.round(
                new Date(Date.now() - hours * 60 * 60 * 1000).getTime() / 1000
            ).toString(),
            endTime: Math.round(new Date().getTime() / 1000).toString(),
            indexOffset: 0
        };
        if (this.supports('v0.20.0')) {
            if (chanIdIn) {
                req.incomingChanIds = [chanIdIn];
            }
            if (chanIdOut) {
                req.outgoingChanIds = [chanIdOut];
            }
        }
        return await this.lnc.lnd.lightning
            .forwardingHistory(req)
            .then((data: lnrpc.ForwardingHistoryResponse) => snakeize(data));
    };
    // Coin Control
    fundPsbt = async (req: walletrpc.FundPsbtRequest) =>
        await this.lnc.lnd.walletKit
            .fundPsbt(req)
            .then((data: walletrpc.FundPsbtResponse) => snakeize(data));
    signPsbt = async (req: walletrpc.SignPsbtRequest) =>
        await this.lnc.lnd.walletKit
            .signPsbt(req)
            .then((data: walletrpc.SignPsbtResponse) => snakeize(data));
    finalizePsbt = async (req: walletrpc.FinalizePsbtRequest) =>
        await this.lnc.lnd.walletKit
            .finalizePsbt(req)
            .then((data: walletrpc.FinalizePsbtResponse) => snakeize(data));
    publishTransaction = async (req: any) => {
        if (req.tx_hex) req.tx_hex = Base64Utils.hexToBase64(req.tx_hex);
        return await this.lnc.lnd.walletKit
            .publishTransaction(req)
            .then((data: walletrpc.PublishResponse) => snakeize(data));
    };
    fundingStateStep = async (req: any) => {
        // Finalize
        if (req.psbt_finalize?.final_raw_tx)
            req.psbt_finalize.final_raw_tx = Base64Utils.hexToBase64(
                req.psbt_finalize.final_raw_tx
            );

        return await this.lnc.lnd.lightning
            .fundingStateStep(req)
            .then((data: lnrpc.FundingStateStepResp) => snakeize(data));
    };
    getUTXOs = async (req: walletrpc.ListUnspentRequest) =>
        await this.lnc.lnd.walletKit
            .listUnspent(req)
            .then((data: walletrpc.ListUnspentResponse) => snakeize(data));
    bumpFee = async (req: walletrpc.BumpFeeRequest) =>
        await this.lnc.lnd.walletKit
            .bumpFee(snakeize(req))
            .then((data: walletrpc.BumpFeeResponse) => snakeize(data));
    bumpForceCloseFee = async (req: walletrpc.BumpForceCloseFeeRequest) =>
        await this.lnc.lnd.walletKit
            .bumpForceCloseFee(snakeize(req))
            .then((data: walletrpc.BumpForceCloseFeeResponse) =>
                snakeize(data)
            );
    listAccounts = async () =>
        await this.lnc.lnd.walletKit
            .listAccounts({})
            .then((data: walletrpc.ListAccountsResponse) => snakeize(data));
    listAddresses = async () =>
        await this.lnc.lnd.walletKit
            .listAddresses({})
            .then((data: walletrpc.ListAddressesResponse) => snakeize(data));
    importAccount = async (req: walletrpc.ImportAccountRequest) =>
        await this.lnc.lnd.walletKit
            .importAccount(req)
            .then((data: walletrpc.ImportAccountResponse) => snakeize(data));
    signMessage = async (message: string) =>
        await this.lnc.lnd.lightning
            .signMessage({ msg: Base64Utils.utf8ToBase64(message) })
            .then((data: lnrpc.SignMessageResponse) => snakeize(data));
    verifyMessage = async (req: lnrpc.VerifyMessageRequest) =>
        await this.lnc.lnd.lightning
            .verifyMessage({
                msg:
                    typeof req.msg === 'string'
                        ? Base64Utils.utf8ToBase64(req.msg)
                        : req.msg,
                signature: req.signature
            })
            .then((data: lnrpc.VerifyMessageResponse) => snakeize(data));
    signMessageWithAddr = async (msg: string, addr: string) =>
        await this.lnc.lnd.walletKit
            .signMessageWithAddr({
                msg:
                    typeof msg === 'string'
                        ? Base64Utils.utf8ToBase64(msg)
                        : Base64Utils.bytesToBase64(msg as Uint8Array),
                addr
            })
            .then((data: walletrpc.SignMessageWithAddrResponse) =>
                snakeize(data)
            );
    verifyMessageWithAddr = async (
        msg: string,
        signature: string,
        addr: string
    ) =>
        await this.lnc.lnd.walletKit
            .verifyMessageWithAddr({
                msg:
                    typeof msg === 'string'
                        ? Base64Utils.utf8ToBase64(msg)
                        : Base64Utils.bytesToBase64(msg as Uint8Array),
                signature,
                addr
            })
            .then((data: walletrpc.VerifyMessageWithAddrResponse) =>
                snakeize(data)
            );
    lnurlAuth = async (r_hash: string) => {
        const signed = await this.signMessage(r_hash);
        return {
            signature: new sha256Hash()
                .update(Base64Utils.stringToUint8Array(signed.signature))
                .digest()
        };
    };
    lookupInvoice = async (data: any) =>
        await this.lnc.lnd.lightning
            .lookupInvoice({ r_hash: Base64Utils.hexToBase64(data.r_hash) })
            .then((data: lnrpc.Invoice) => snakeize(data));
    subscribeInvoice = (r_hash: string) =>
        this.lnc.lnd.invoices.subscribeSingleInvoice({ r_hash });
    subscribeInvoices = () => this.lnc.lnd.lightning.subscribeInvoices();
    subscribeTransactions = () =>
        this.lnc.lnd.lightning.subscribeTransactions();
    watchInvoicePaid = (
        { rHash }: { rHash: string; value?: string | number },
        onPaid: (payload: {
            amountSat: number;
            tx?: string;
            preimage?: string;
        }) => void
    ): (() => void) => {
        const { LncModule } = NativeModules;
        const eventName = this.subscribeInvoice(rHash);
        const eventEmitter = new NativeEventEmitter(LncModule);
        const listener = eventEmitter.addListener(eventName, (event: any) => {
            if (event.result) {
                if (
                    typeof event.result === 'string' &&
                    event.result.includes('rpc error: code = Canceled')
                ) {
                    listener.remove();
                    return;
                }
                try {
                    const result = JSON.parse(event.result);
                    if (result === 'EOF') {
                        listener.remove();
                        return;
                    }
                    if (result.settled) {
                        listener.remove();
                        onPaid({
                            amountSat: Number(result.amt_paid_sat),
                            tx: result.payment_request,
                            preimage: result.r_preimage
                        });
                    }
                } catch (error) {
                    console.error(error);
                    listener.remove();
                }
            }
        });
        return () => listener.remove();
    };
    watchOnchainReceived = (
        {
            address,
            value,
            numConfPreference
        }: {
            address: string;
            value?: string | number;
            numConfPreference: number;
            blockHeight?: number;
        },
        onReceived: (payload: { amountSat: number; txid: string }) => void
    ): (() => void) => {
        const { LncModule } = NativeModules;
        const eventName = this.subscribeTransactions();
        const eventEmitter = new NativeEventEmitter(LncModule);
        const listener = eventEmitter.addListener(eventName, (event: any) => {
            if (event.result) {
                if (
                    typeof event.result === 'string' &&
                    event.result.includes('rpc error: code = Canceled')
                ) {
                    listener.remove();
                    return;
                }
                try {
                    const result = JSON.parse(event.result);
                    if (result === 'EOF') {
                        listener.remove();
                        return;
                    }
                    if (
                        result.dest_addresses.includes(address) &&
                        result.num_confirmations >= numConfPreference &&
                        Number(result.amount) >= Number(value)
                    ) {
                        listener.remove();
                        onReceived({
                            amountSat: Number(result.amount),
                            txid: result.tx_hash
                        });
                    }
                } catch (error) {
                    console.error(error);
                    listener.remove();
                }
            }
        });
        return () => listener.remove();
    };

    supports = (minVersion: string, eosVersion?: string) => {
        const { nodeInfo } = nodeInfoStore;
        const { version } = nodeInfo;
        const { isSupportedVersion } = VersionUtils;
        return isSupportedVersion(version, minVersion, eosVersion);
    };

    listPeers = async () => {
        try {
            const res = await this.lnc.lnd.lightning.listPeers({});
            return res.peers ?? [];
        } catch (err) {
            console.error('listPeers error:', err);
        }
    };

    disconnectPeer = async (pubkey: string) => {
        try {
            await this.lnc.lnd.lightning.disconnectPeer({ pubKey: pubkey });
            return true;
        } catch (error) {
            console.error(`Error disconnecting peer ${pubkey}:`, error);
            return null;
        }
    };

    getWatchtowerInfo = async (pubkey: string) =>
        await this.lnc.lnd.watchtowerClient
            .getTowerInfo({
                pubkey,
                includeSessions: true
            })
            .then((data: any) => snakeize(data));

    listWatchtowers = async (includeSessions = true) =>
        await this.lnc.lnd.watchtowerClient
            .listTowers({
                includeSessions,
                excludeExhaustedSessions: false
            })
            .then((data: any) => snakeize(data));

    removeWatchtower = async (pubkey: string, address?: string) =>
        await this.lnc.lnd.watchtowerClient
            .removeTower({
                pubkey,
                address
            })
            .then((data: any) => snakeize(data));

    deactivateWatchtower = async (pubkey: string) =>
        await this.lnc.lnd.watchtowerClient
            .deactivateTower({
                pubkey
            })
            .then((data: any) => snakeize(data));

    terminateWatchtowerSession = async (sessionId: string) =>
        await this.lnc.lnd.watchtowerClient
            .terminateSession({
                sessionId
            })
            .then((data: any) => snakeize(data));

    getWatchtowerStats = async () =>
        await this.lnc.lnd.watchtowerClient
            .stats({})
            .then((data: any) => snakeize(data));

    getWatchtowerPolicy = async (policyType: string) =>
        await this.lnc.lnd.watchtowerClient
            .policy({
                policyType
            })
            .then((data: any) => snakeize(data));

    supportsWatchtowerClient = () => true;
    supportsPeers = () => true;
    supportsMessageSigning = () => this.permSignMessage;
    supportsMessageVerification = () => true;
    requiresVerifyPubkey = () => false;
    supportsAddressMessageSigning = () => true;
    supportsLnurlAuth = () => true;
    supportsOnchainBalance = () => true;
    supportsOnchainSends = () => this.permSendCoins;
    supportsOnchainReceiving = () => this.permNewAddress;
    supportsLightningSends = () => this.permSendLN;
    supportsKeysend = () => true;
    supportsPaymentLookup = () => true;
    supportsChannelManagement = () => this.permOpenChannel;
    supportsCircularRebalancing = () => true;
    supportsForceClose = () => true;
    supportsPendingChannels = () => true;
    supportsClosedChannels = () => true;
    supportsMPP = () => this.supports('v0.10.0');
    supportsAMP = () => this.supports('v0.13.0');
    supportsCoinControl = () => this.permNewAddress;
    supportsChannelCoinControl = () =>
        this.permNewAddress && this.supports('v0.17.0');
    supportsHopPicking = () => this.permOpenChannel;
    supportsAccounts = () => this.permImportAccount;
    supportsRouting = () => this.permForwardingHistory;
    supportsNodeInfo = () => true;
    supportsWithdrawalRequests = () => false;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => true;
    supportsNestedSegWit = () => true;
    supportsTaproot = () => this.supports('v0.15.0');
    supportsBumpFee = () => true;
    supportsFlowLSP = () => false;
    supportsNetworkInfo = () => true;
    supportsSimpleTaprootChannels = () => this.supports('v0.17.0');
    supportsCustomPreimages = () => true;
    supportsSweep = () => true;
    supportsOnchainSendMax = () => this.supports('v0.18.3');
    supportsOnchainBatching = () => true;
    supportsChannelBatching = () => true;
    supportsChannelFundMax = () => true;
    supportsLSPScustomMessage = () => true;
    supportsLSPS1rest = () => true;
    supportsOffers = () => false;
    supportsListingOffers = () => false;
    supportsBolt12Address = () => false;
    supportsBolt11BlindedRoutes = () => this.supports('v0.18.3');
    supportsAddressesWithDerivationPaths = () => this.supports('v0.18.0');
    supportsCustomFeeLimit = () => true;
    isLNDBased = () => true;
    supportsForwardingHistory = () => true;
    supportInboundFees = () => this.supports('v0.18.0');
    supportsCashuWallet = () => false;
    supportsSettingInvoiceExpiration = () => true;
    supportsNostrWalletConnectService = () => true;
}
