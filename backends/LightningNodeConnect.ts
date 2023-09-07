import LNC, { lnrpc, walletrpc } from '../zeus_modules/@lightninglabs/lnc-rn';

import stores from '../stores/Stores';
import CredentialStore from './LNC/credentialStore';
import OpenChannelRequest from './../models/OpenChannelRequest';
import Base64Utils from './../utils/Base64Utils';
import { snakeize } from './../utils/DataFormatUtils';
import VersionUtils from './../utils/VersionUtils';
import { Hash as sha256Hash } from 'fast-sha256';

const ADDRESS_TYPES = [
    'WITNESS_PUBKEY_HASH',
    'NESTED_PUBKEY_HASH',
    'UNUSED_WITNESS_PUBKEY_HASH',
    'UNUSED_NESTED_PUBKEY_HASH',
    'TAPROOT_PUBKEY',
    'UNUSED_TAPROOT_PUBKEY'
];

export default class LightningNodeConnect {
    lnc: any;

    permOpenChannel: boolean;
    permSendCoins: boolean;
    permNewAddress: boolean;
    permImportAccount: boolean;
    permForwardingHistory: boolean;
    permSignMessage: boolean;

    initLNC = async () => {
        const { pairingPhrase, mailboxServer, customMailboxServer } =
            stores.settingsStore;

        this.lnc = new LNC({
            credentialStore: new CredentialStore()
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
    disconnect = () => this.lnc.disconnect();

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
        const request: lnrpc.ChanInfoRequest = { chanId };
        return await this.lnc.lnd.lightning
            .getChanInfo(request)
            .then((data: lnrpc.ChannelEdge) => snakeize(data));
    };
    getBlockchainBalance = async () =>
        await this.lnc.lnd.lightning
            .walletBalance({})
            .then((data: lnrpc.WalletBalanceResponse) => snakeize(data));
    getLightningBalance = async () =>
        await this.lnc.lnd.lightning
            .channelBalance({})
            .then((data: lnrpc.ChannelBalanceResponse) => snakeize(data));
    sendCoins = async (data: any) =>
        await this.lnc.lnd.lightning
            .sendCoins({
                addr: data.addr,
                sat_per_vbyte: data.sat_per_vbyte,
                amount: data.amount,
                spend_unconfirmed: data.spend_unconfirmed
            })
            .then((data: lnrpc.SendCoinsResponse) => snakeize(data));
    getMyNodeInfo = async () =>
        await this.lnc.lnd.lightning
            .getInfo({})
            .then((data: lnrpc.GetInfoResponse) => snakeize(data));
    getInvoices = async () =>
        await this.lnc.lnd.lightning
            .listInvoices({ reversed: true, num_max_invoices: 100 })
            .then((data: lnrpc.ListInvoiceResponse) => snakeize(data));
    createInvoice = async (data: any) =>
        await this.lnc.lnd.lightning
            .addInvoice({
                memo: data.memo,
                value_msat: Number(data.value) * 1000,
                expiry: data.expiry,
                is_amp: data.is_amp,
                private: data.private
            })
            .then((data: lnrpc.AddInvoiceResponse) => snakeize(data));
    getPayments = async () =>
        await this.lnc.lnd.lightning
            .listPayments({})
            .then((data: lnrpc.ListPaymentsResponse) => snakeize(data));
    getNewAddress = async (data: any) =>
        await this.lnc.lnd.lightning
            .newAddress({ type: ADDRESS_TYPES[data.type] })
            .then((data: lnrpc.NewAddressResponse) => snakeize(data));

    openChannel = async (data: OpenChannelRequest) =>
        await this.lnc.lnd.lightning
            .openChannelSync(
                data.simpleTaprootChannel
                    ? {
                          private: data.privateChannel,
                          scid_alias: data.scidAlias,
                          local_funding_amount: data.local_funding_amount,
                          min_confs: data.min_confs,
                          node_pubkey_string: data.node_pubkey_string,
                          sat_per_vbyte: data.sat_per_vbyte,
                          spend_unconfirmed: data.spend_unconfirmed,
                          fund_max: data.fundMax,
                          outpoints:
                              data.utxos && data.utxos.length > 0
                                  ? data.utxos.map((utxo: string) => {
                                        const [txid_str, output_index] =
                                            utxo.split(':');
                                        return {
                                            txid_str,
                                            output_index: Number(output_index)
                                        };
                                    })
                                  : undefined,
                          commitment_type:
                              lnrpc.CommitmentType['SIMPLE_TAPROOT']
                      }
                    : {
                          private: data.privateChannel,
                          scid_alias: data.scidAlias,
                          local_funding_amount: data.local_funding_amount,
                          min_confs: data.min_confs,
                          node_pubkey_string: data.node_pubkey_string,
                          sat_per_vbyte: data.sat_per_vbyte,
                          spend_unconfirmed: data.spend_unconfirmed,
                          fund_max: data.fundMax,
                          outpoints:
                              data.utxos && data.utxos.length > 0
                                  ? data.utxos.map((utxo: string) => {
                                        const [txid_str, output_index] =
                                            utxo.split(':');
                                        return {
                                            txid_str,
                                            output_index: Number(output_index)
                                        };
                                    })
                                  : undefined
                      }
            )
            .then((data: lnrpc.ChannelPoint) => snakeize(data));
    // TODO add with external accounts
    // openChannelStream = (data: OpenChannelRequest) =>
    //     this.wsReq('/v1/channels/stream', 'POST', data);
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
        let params;
        if (urlParams && urlParams.length === 4) {
            params = {
                channel_point: {
                    funding_txid_str: urlParams && urlParams[0],
                    output_index:
                        urlParams && urlParams[1] && Number(urlParams[1])
                },
                force: urlParams && urlParams[2],
                sat_per_vbyte: urlParams && urlParams[3] && Number(urlParams[3])
            };
        }
        params = {
            channel_point: {
                funding_txid_str: urlParams && urlParams[0],
                output_index: urlParams && urlParams[1] && Number(urlParams[1])
            },
            force: urlParams && urlParams[2]
        };
        return await this.lnc.lnd.lightning
            .closeChannel(params)
            .then((data: lnrpc.CloseStatusUpdate) => snakeize(data));
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
        }
        params = {
            base_fee_msat,
            fee_rate: `${Number(fee_rate) / 100}`,
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
        const req: lnrpc.ForwardingHistoryRequest = {
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
    finalizePsbt = async (req: walletrpc.FinalizePsbtRequest) =>
        await this.lnc.lnd.walletKit
            .finalizePsbt(req)
            .then((data: walletrpc.FinalizePsbtResponse) => snakeize(data));
    publishTransaction = async (req: walletrpc.Transaction) =>
        await this.lnc.lnd.walletKit
            .publishTransaction(req)
            .then((data: walletrpc.PublishResponse) => snakeize(data));
    getUTXOs = async () =>
        await this.lnc.lnd.walletKit
            .listUnspent({ min_confs: 0, max_confs: 200000 })
            .then((data: walletrpc.ListUnspentResponse) => snakeize(data));
    bumpFee = async (req: walletrpc.BumpFeeRequest) =>
        await this.lnc.lnd.walletKit
            .bumpFee(snakeize(req))
            .then((data: walletrpc.BumpFeeResponse) => snakeize(data));
    listAccounts = async () =>
        await this.lnc.lnd.walletKit
            .listAccounts({})
            .then((data: walletrpc.ListAccountsResponse) => snakeize(data));
    importAccount = async (req: walletrpc.ImportAccountRequest) =>
        await this.lnc.lnd.walletKit
            .importAccount(req)
            .then((data: walletrpc.ImportAccountResponse) => snakeize(data));
    signMessage = async (message: string) =>
        await this.lnc.lnd.lightning
            .signMessage({ msg: Base64Utils.btoa(message) })
            .then((data: lnrpc.SignMessageResponse) => snakeize(data));
    verifyMessage = async (req: lnrpc.VerifyMessageRequest) =>
        await this.lnc.lnd.lightning
            .verifyMessage({
                msg:
                    typeof req.msg === 'string'
                        ? Base64Utils.btoa(req.msg)
                        : req.msg,
                signature: req.signature
            })
            .then((data: lnrpc.VerifyMessageResponse) => snakeize(data));
    lnurlAuth = async (r_hash: string) => {
        const signed = await this.signMessage(r_hash);
        return {
            signature: new sha256Hash()
                .update(Base64Utils.stringToUint8Array(signed.signature))
                .digest()
        };
    };
    subscribeInvoice = (r_hash: string) =>
        this.lnc.lnd.invoices.subscribeSingleInvoice({ r_hash });
    subscribeInvoices = () => this.lnc.lnd.lightning.subscribeInvoices();
    subscribeTransactions = () =>
        this.lnc.lnd.lightning.subscribeTransactions();

    supports = (minVersion: string, eosVersion?: string) => {
        const { nodeInfo } = stores.nodeInfoStore;
        const { version } = nodeInfo;
        const { isSupportedVersion } = VersionUtils;
        return isSupportedVersion(version, minVersion, eosVersion);
    };

    supportsMessageSigning = () => this.permSignMessage;
    supportsLnurlAuth = () => true;
    supportsOnchainSends = () => this.permSendCoins;
    supportsOnchainReceiving = () => this.permNewAddress;
    supportsKeysend = () => true;
    supportsChannelManagement = () => this.permOpenChannel;
    supportsPendingChannels = () => true;
    supportsMPP = () => this.supports('v0.10.0');
    supportsAMP = () => this.supports('v0.13.0');
    supportsCoinControl = () => this.permNewAddress;
    supportsHopPicking = () => this.permOpenChannel;
    supportsAccounts = () => this.permImportAccount;
    supportsRouting = () => this.permForwardingHistory;
    supportsNodeInfo = () => true;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => true;
    supportsTaproot = () => this.supports('v0.15.0');
    supportsBumpFee = () => true;
    supportsLSPs = () => false;
    supportsNetworkInfo = () => false;
    supportsSimpleTaprootChannels = () => this.supports('v0.17.0');
    isLNDBased = () => true;
}
