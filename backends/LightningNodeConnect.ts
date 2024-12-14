import {
    NativeModules,
    NativeEventEmitter,
    EventSubscription
} from 'react-native';

import LNC, { lnrpc, walletrpc } from '../zeus_modules/@lightninglabs/lnc-rn';

import { settingsStore, nodeInfoStore } from '../stores/storeInstances';
import CredentialStore from './LNC/credentialStore';

import OpenChannelRequest from '../models/OpenChannelRequest';

import Base64Utils from '../utils/Base64Utils';
import { snakeize } from '../utils/DataFormatUtils';
import VersionUtils from '../utils/VersionUtils';

import { Hash as sha256Hash } from 'fast-sha256';

const ADDRESS_TYPES: lnrpc.AddressType[] = [
    lnrpc.AddressType.WITNESS_PUBKEY_HASH,
    lnrpc.AddressType.NESTED_PUBKEY_HASH,
    lnrpc.AddressType.UNUSED_WITNESS_PUBKEY_HASH,
    lnrpc.AddressType.UNUSED_NESTED_PUBKEY_HASH,
    lnrpc.AddressType.TAPROOT_PUBKEY,
    lnrpc.AddressType.UNUSED_TAPROOT_PUBKEY
];
interface ChanPoint {
    funding_txid_str: string;
    output_index: number;
}

interface Params {
    base_fee_msat: string;
    fee_rate: string;
    global?: boolean;
    chan_point?: ChanPoint;
    time_lock_delta: number;
    min_htlc_msat?: string | null;
    max_htlc_msat?: string | null;
    min_htlc_msat_specified?: boolean;
}

const NEXT_ADDR_MAP: any = {
    WITNESS_PUBKEY_HASH: 0,
    NESTED_PUBKEY_HASH: 1,
    UNUSED_WITNESS_PUBKEY_HASH: 2,
    UNUSED_NESTED_PUBKEY_HASH: 3,
    TAPROOT_PUBKEY: 4,
    UNUSED_TAPROOT_PUBKEY: 5
};

export default class LightningNodeConnect {
    lnc: LNC;
    listener: EventSubscription | null = null;

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
    async checkPerms(): Promise<void> {
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
    }
    isConnected = async () => await this.lnc.isConnected();
    disconnect = () => this.lnc.disconnect();
    async getTransactions(): Promise<{ transactions: lnrpc.Transaction[] }> {
        const data = await this.lnc.lnd.lightning.getTransactions({});
        const formatted = snakeize(data);
        return {
            transactions: formatted.transactions.reverse()
        };
    }
    async getChannels(): Promise<lnrpc.ListChannelsResponse> {
        const data = await this.lnc.lnd.lightning.listChannels({});
        return snakeize(data);
    }

    async getPendingChannels(): Promise<lnrpc.PendingChannelsResponse> {
        const data = await this.lnc.lnd.lightning.pendingChannels({});
        return snakeize(data);
    }

    async getClosedChannels(): Promise<lnrpc.ClosedChannelsResponse> {
        const data = await this.lnc.lnd.lightning.closedChannels({});
        return snakeize(data);
    }
    async getChannelInfo(chanId: string): Promise<lnrpc.ChannelEdge> {
        const request: lnrpc.ChanInfoRequest = { chanId };
        const data = await this.lnc.lnd.lightning.getChanInfo(request);
        return snakeize(data);
    }

    async getBlockchainBalance(
        req: lnrpc.WalletBalanceRequest
    ): Promise<lnrpc.WalletBalanceResponse> {
        const data = await this.lnc.lnd.lightning.walletBalance(req);
        return snakeize(data);
    }

    async getLightningBalance(
        req: lnrpc.ChannelBalanceRequest
    ): Promise<lnrpc.ChannelBalanceResponse> {
        const data = await this.lnc.lnd.lightning.channelBalance(req);
        return snakeize(data);
    }
    async sendCoins(data: {
        addr: string;
        sat_per_vbyte: number;
        amount: string;
        spend_unconfirmed: boolean;
        send_all: boolean;
    }): Promise<lnrpc.SendCoinsResponse> {
        const response = await this.lnc.lnd.lightning.sendCoins(data);
        return snakeize(response);
    }

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
        const request: lnrpc.ChanInfoRequest = { chanId };
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
    async getMyNodeInfo(): Promise<lnrpc.GetInfoResponse> {
        const data = await this.lnc.lnd.lightning.getInfo({});
        return snakeize(data);
    }

    async getInvoices(): Promise<lnrpc.ListInvoiceResponse> {
        const data = await this.lnc.lnd.lightning.listInvoices({
            reversed: true,
            numMaxInvoices: '100'
        });
        return snakeize(data);
    }

    async createInvoice(data: {
        memo?: string;
        value_msat: any;
        value?: number;
        expiry: string;
        is_amp?: boolean;
        private?: boolean;
        preimage?: string;
        route_hints?: any[];
    }): Promise<lnrpc.AddInvoiceResponse> {
        const response = await this.lnc.lnd.lightning.addInvoice({
            memo: data.memo,
            valueMsat: data.value_msat || Number(data.value) * 1000,
            expiry: data.expiry,
            isAmp: data.is_amp,
            private: data.private,
            rPreimage: data.preimage
                ? Base64Utils.hexToBase64(data.preimage)
                : undefined,
            routeHints: data.route_hints
        });
        return snakeize(response);
    }
    getMyNodeInfo = async () =>
        await this.lnc.lnd.lightning
            .getInfo({})
            .then((data: lnrpc.GetInfoResponse) => snakeize(data));
    getNetworkInfo = async () =>
        await this.lnc.lnd.lightning
            .getNetworkInfo({})
            .then((data: lnrpc.NetworkInfo) => snakeize(data));
    getInvoices = async () =>
        await this.lnc.lnd.lightning
            .listInvoices({ reversed: true, num_max_invoices: 100 })
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
    getPayments = async () =>
        await this.lnc.lnd.lightning
            .listPayments({
                include_incomplete: true
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

    async getNetworkInfo(): Promise<lnrpc.NetworkInfo> {
        const info = await this.lnc.lnd.lightning.getNetworkInfo({});
        return snakeize(info);
    }

    async getPayments(): Promise<lnrpc.ListPaymentsResponse> {
        const data = await this.lnc.lnd.lightning.listPayments({
            includeIncomplete: true
        });
        return snakeize(data);
    }

    async getNewAddress(data: {
        type: number;
        account?: string;
    }): Promise<lnrpc.NewAddressResponse> {
        const response = await this.lnc.lnd.lightning.newAddress({
            type: ADDRESS_TYPES[data.type],
            account: data.account || 'default'
        });
        return snakeize(response);
    }
    openChannelSync = async (data: OpenChannelRequest) => {
        const request: lnrpc.OpenChannelRequest =
            this.createOpenChannelRequest(data);
        const response = await this.lnc.lnd.lightning.openChannelSync(request);
        return snakeize(response);
    };

    openChannelStream = (data: OpenChannelRequest) => {
        const request: lnrpc.OpenChannelRequest =
            this.createOpenChannelRequest(data);
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

        this.lnc.lnd.lightning.openChannel(request);
        return new Promise((resolve, reject) => {
            const { LncModule } = NativeModules;
            const eventEmitter = new NativeEventEmitter(LncModule);
            this.listener = eventEmitter.addListener(
                'OpenChannelStream',
                this.handleStreamEvent(resolve, reject)
            );
        });
    };
    private handleStreamEvent(
        resolve: (value: { result: any }) => void,
        reject: (reason: any) => void
    ) {
        return (event: any) => {
            if (event.result && event.result !== 'EOF') {
                try {
                    const result = JSON.parse(event.result);
                    resolve({ result });
                } catch (e) {
                    const result = JSON.parse(event);
                    reject(result);
                } finally {
                    this.listener?.remove();
                }
            }
        };
    }

    private createOpenChannelRequest(
        data: OpenChannelRequest
    ): lnrpc.OpenChannelRequest {
        const request: lnrpc.OpenChannelRequest = {
            private: data.privateChannel ?? false,
            scidAlias: data.scidAlias ?? false,
            localFundingAmount: data.localFundingAmount,
            minConfs: data.minConfs,
            nodePubkey: data.nodePubkey,
            satPerVbyte: data.satPerVbyte,
            spendUnconfirmed: data.spendUnconfirmed,
            nodePubkeyString: data.nodePubkeyString,
            pushSat: data.pushSat,
            targetConf: data.targetConf,
            satPerByte: data.satPerByte,
            minHtlcMsat: data.minHtlcMsat,
            remoteCsvDelay: data.remoteCsvDelay,
            closeAddress: data.closeAddress,
            fundingShim: data.fundingShim as lnrpc.FundingShim,
            remoteMaxValueInFlightMsat: data.remoteMaxValueInFlightMsat,
            remoteMaxHtlcs: data.remoteMaxHtlcs,
            maxLocalCsv: data.maxLocalCsv,
            commitmentType: data.simpleTaprootChannel
                ? lnrpc.CommitmentType.SIMPLE_TAPROOT
                : lnrpc.CommitmentType.UNKNOWN_COMMITMENT_TYPE,
            zeroConf: data.zeroConf ?? false,
            baseFee: data.baseFee,
            feeRate: data.feeRate,
            useBaseFee: false,
            useFeeRate: false,
            remoteChanReserveSat: '',
            fundMax: data.fundMax ?? false,
            memo: '',
            outpoints: []
        };

        if (data.utxos && data.utxos.length > 0) {
            request.outpoints = data.utxos.map(this.parseUtxo);
        }

        return request;
    }

    private parseUtxo(utxo: string): lnrpc.OutPoint {
        const [txidBytes, txidStr, outputIndex] = utxo.split(':');
        return {
            txidBytes,
            txidStr,
            outputIndex: Number(outputIndex)
        };
    }

    async connectPeer(data: any): Promise<lnrpc.ConnectPeerResponse> {
        const result = this.lnc.lnd.lightning.connectPeer(data);
        return snakeize(result);
    }
    decodePaymentRequest = async (urlParams?: Array<string>) =>
        await this.lnc.lnd.lightning
            .decodePayReq({ payReq: urlParams && urlParams[0] })
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
            .getNodeInfo({ pubKey: urlParams && urlParams[0] })
            .then((data: lnrpc.NodeInfo) => snakeize(data));
    getFees = async () =>
        await this.lnc.lnd.lightning
            .feeReport({})
            .then((data: lnrpc.FeeReportResponse) => snakeize(data));
    setFees = async (data: any) => {
        // handle commas in place of decimals
        const base_fee_msat = data.base_fee_msat.replace(/,/g, '.');
        const fee_rate = data.fee_rate.replace(/,/g, '.');

        let params: Params;

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
                pubKey: urlParams && urlParams[0],
                amt: urlParams && urlParams[1]
            })
            .then((data: lnrpc.QueryRoutesResponse) => snakeize(data));
    getForwardingHistory = async (hours = 24) => {
        const req: any = {
            numMaxEvents: 10000000,
            startTime: Math.round(
                new Date(Date.now() - hours * 60 * 60 * 1000).getTime() / 1000
            ).toString(),
            endTime: Math.round(new Date().getTime() / 1000).toString(),
            indexOffset: 0,
            peerAliasLookup: false
        };
        return await this.lnc.lnd.lightning
            .forwardingHistory(req)
            .then((data: lnrpc.ForwardingHistoryResponse) => snakeize(data));
    };
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
    publishTransaction = async (req: walletrpc.Transaction) => {
        if (req.txHex) req.txHex = Base64Utils.hexToBase64(req.txHex as string);
    publishTransaction = async (req: any) => {
        if (req.tx_hex) req.tx_hex = Base64Utils.hexToBase64(req.tx_hex);
        return await this.lnc.lnd.walletKit
            .publishTransaction(req)
            .then((data: walletrpc.PublishResponse) => snakeize(data));
    };
    fundingStateStep = async (req: any) => {
        // Finalize
        if (req.psbtFinalize?.finalRawTx)
            req.psbtFinalize.finalRawTx = Base64Utils.hexToBase64(
                req.psbtFinalize.finalRawTx as string
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
            .lookupInvoice({
                rHash: Base64Utils.hexToBase64(data.rHash as string)
            })
            .then((data: lnrpc.Invoice) => snakeize(data));
    subscribeInvoice = (rHash: string) =>
        this.lnc.lnd.invoices.subscribeSingleInvoice({ rHash });
    subscribeInvoices = () => this.lnc.lnd.lightning.subscribeInvoices();
    subscribeTransactions = () =>
        this.lnc.lnd.lightning.subscribeTransactions();

    supports(minVersion: string, eosVersion?: string): boolean {
        const { nodeInfo } = stores.nodeInfoStore;
    supports = (minVersion: string, eosVersion?: string) => {
        const { nodeInfo } = nodeInfoStore;
        const { version } = nodeInfo;
        const { isSupportedVersion } = VersionUtils;
        return isSupportedVersion(version, minVersion, eosVersion);
    }

    supportsMessageSigning = (): boolean => this.permSignMessage;
    supportsLnurlAuth = (): boolean => true;
    supportsOnchainSends = (): boolean => this.permSendCoins;
    supportsOnchainReceiving = (): boolean => this.permNewAddress;
    supportsLightningSends = (): boolean => this.permSendLN;
    supportsKeysend = (): boolean => true;
    supportsChannelManagement = (): boolean => this.permOpenChannel;
    supportsPendingChannels = (): boolean => true;
    supportsMPP = (): boolean => this.supports('v0.10.0');
    supportsAMP = (): boolean => this.supports('v0.13.0');
    supportsCoinControl = (): boolean => this.permNewAddress;
    supportsChannelCoinControl = (): boolean =>
        this.permNewAddress && this.supports('v0.17.0');
    supportsHopPicking = (): boolean => this.permOpenChannel;
    supportsAccounts = (): boolean => this.permImportAccount;
    supportsRouting = (): boolean => this.permForwardingHistory;
    supportsNodeInfo = (): boolean => true;
    singleFeesEarnedTotal = (): boolean => false;
    supportsAddressTypeSelection = (): boolean => true;
    supportsTaproot = (): boolean => this.supports('v0.15.0');
    supportsBumpFee = (): boolean => true;
    supportsLSPs = (): boolean => false;
    supportsNetworkInfo = (): boolean => false;
    supportsSimpleTaprootChannels = (): boolean => this.supports('v0.17.0');
    supportsCustomPreimages = (): boolean => true;
    supportsSweep = (): boolean => true;
    supportsOnchainBatching = (): boolean => true;
    supportsChannelBatching = (): boolean => true;
    isLNDBased = (): boolean => true;
    supportsLSPS1customMessage = (): boolean => true;
    supportsLSPS1rest = (): boolean => false;
    supportsOffers = () => false;
    supportsHopPicking = () => this.permOpenChannel;
    supportsAccounts = () => this.permImportAccount;
    supportsRouting = () => this.permForwardingHistory;
    supportsNodeInfo = () => true;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => true;
    supportsTaproot = () => this.supports('v0.15.0');
    supportsBumpFee = () => true;
    supportsLSPs = () => false;
    supportsNetworkInfo = () => true;
    supportsSimpleTaprootChannels = () => this.supports('v0.17.0');
    supportsCustomPreimages = () => true;
    supportsSweep = () => true;
    supportsOnchainSendMax = () => this.supports('v0.18.3');
    supportsOnchainBatching = () => true;
    supportsChannelBatching = () => true;
    supportsLSPS1customMessage = () => false;
    supportsLSPS1rest = () => true;
    supportsOffers = () => false;
    supportsBolt11BlindedRoutes = () => this.supports('v0.18.3');
    supportsAddressesWithDerivationPaths = () => this.supports('v0.18.0');
    isLNDBased = () => true;
    supportInboundFees = () => this.supports('v0.18.0');
}
