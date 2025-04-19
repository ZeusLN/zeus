import { NativeModules, NativeEventEmitter } from 'react-native';

import LNC from '../zeus_modules/@lightninglabs/lnc-rn';
import { lnrpc, walletrpc } from '../zeus_modules/@lightninglabs/lnc-core';

import { settingsStore, nodeInfoStore } from '../stores/storeInstances';
import CredentialStore from './LNC/credentialStore';

import OpenChannelRequest from '../models/OpenChannelRequest';

import Base64Utils from '../utils/Base64Utils';
import { snakeize } from '../utils/DataFormatUtils';
import VersionUtils from '../utils/VersionUtils';

import { Hash as sha256Hash } from 'fast-sha256';

const ADDRESS_TYPES = [
    'WITNESS_PUBKEY_HASH',
    'NESTED_PUBKEY_HASH',
    'UNUSED_WITNESS_PUBKEY_HASH',
    'UNUSED_NESTED_PUBKEY_HASH',
    'TAPROOT_PUBKEY',
    'UNUSED_TAPROOT_PUBKEY'
];

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
    permSignMessage: boolean;

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
        this.permOpenChannel = await this.lnc.hasPerms(
            'lnrpc.Lightning.OpenChannel'
        );
        this.permSendCoins = await this.lnc.hasPerms(
            'lnrpc.Lightning.SendCoins'
        );
        this.permSendLN = await this.lnc.hasPerms(
            'routerrpc.Router.SendPaymentV2'
        );
        this.permNewAddress = await this.lnc.hasPerms(
            'lnrpc.Lightning.NewAddress'
        );
        this.permImportAccount = await this.lnc.hasPerms(
            'walletrpc.WalletKit.ImportAccount'
        );
        this.permForwardingHistory = await this.lnc.hasPerms(
            'lnrpc.Lightning.ForwardingHistory'
        );
        this.permSignMessage = await this.lnc.hasPerms(
            'signrpc.Signer.SignMessage'
        );
    };
    isConnected = async () => await this.lnc.isConnected();
    disconnect = () => this.lnc && this.lnc.disconnect();

    getTransactions = async () =>
        await this.lnc.lnd.lightning
            .getTransactions({})
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
        const request: lnrpc.ChanInfoRequest = { chanId, chanPoint: '' };
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
                expiry: data.expiry,
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
                    params?.reversed !== undefined ? params.reversed : true
            })
            .then((data: lnrpc.ListPaymentsResponse) => snakeize(data));
    getNewAddress = async (data: any) =>
        await this.lnc.lnd.lightning
            .newAddress({
                type: ADDRESS_TYPES[data.type] || data.type,
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
            spend_unconfirmed: data.spend_unconfirmed
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
        if (data.pubkey) delete data.pubkey;
        return this.lnc.lnd.router.sendPaymentV2({
            ...data,
            allow_self_payment: true
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
                        base_fee_msat: data.base_fee_msat_inbound,
                        fee_rate_ppm: `${Number(data.fee_rate_inbound) * 10000}`
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
                        base_fee_msat: data.base_fee_msat_inbound,
                        fee_rate_ppm: `${Number(data.fee_rate_inbound) * 10000}`
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
    getRoutes = async (urlParams?: Array<string>) =>
        await this.lnc.lnd.lightning
            .queryRoutes({
                pub_key: urlParams && urlParams[0],
                amt: urlParams && urlParams[1] && Number(urlParams[1])
            })
            .then((data: lnrpc.QueryRoutesResponse) => snakeize(data));
    getForwardingHistory = async (hours = 24) => {
        const req: any = {
            numMaxEvents: 10000000,
            startTime: Math.round(
                new Date(Date.now() - hours * 60 * 60 * 1000).getTime() / 1000
            ).toString(),
            endTime: Math.round(new Date().getTime() / 1000).toString(),
            indexOffset: 0
        };
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

    supports = (minVersion: string, eosVersion?: string) => {
        const { nodeInfo } = nodeInfoStore;
        const { version } = nodeInfo;
        const { isSupportedVersion } = VersionUtils;
        return isSupportedVersion(version, minVersion, eosVersion);
    };

    supportsMessageSigning = () => this.permSignMessage;
    supportsAddressMessageSigning = () => true;
    supportsLnurlAuth = () => true;
    supportsOnchainSends = () => this.permSendCoins;
    supportsOnchainReceiving = () => this.permNewAddress;
    supportsLightningSends = () => this.permSendLN;
    supportsKeysend = () => true;
    supportsChannelManagement = () => this.permOpenChannel;
    supportsPendingChannels = () => true;
    supportsMPP = () => this.supports('v0.10.0');
    supportsAMP = () => this.supports('v0.13.0');
    supportsCoinControl = () => this.permNewAddress;
    supportsChannelCoinControl = () =>
        this.permNewAddress && this.supports('v0.17.0');
    supportsHopPicking = () => this.permOpenChannel;
    supportsAccounts = () => this.permImportAccount;
    supportsRouting = () => this.permForwardingHistory;
    supportsNodeInfo = () => true;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => true;
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
    supportsBolt11BlindedRoutes = () => this.supports('v0.18.3');
    supportsAddressesWithDerivationPaths = () => this.supports('v0.18.0');
    isLNDBased = () => true;
    supportInboundFees = () => this.supports('v0.18.0');
    supportsCashuWallet = () => false;
}
