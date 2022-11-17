// TODO pull in all typings
import LNC from '@lightninglabs/lnc-rn';
import stores from '../stores/Stores';
import CredentialStore from './LNC/credentialStore';
import OpenChannelRequest from './../models/OpenChannelRequest';
import Base64Utils from './../utils/Base64Utils';
import VersionUtils from './../utils/VersionUtils';
import { snakeCase, isArray, isObject, transform } from 'lodash';

const snakeize = (obj) =>
    transform(obj, (acc, value, key, target) => {
        const snakeKey = isArray(target) ? key : snakeCase(key);
        acc[snakeKey] = isObject(value) ? snakeize(value) : value;
    });

export default class LightningNodeConnect {
    lnc: any;

    initLNC = () => {
        const { pairingPhrase, mailboxServer, customMailboxServer } =
            stores.settingsStore;

        lnc = new LNC({
            credentialStore: new CredentialStore()
        });

        lnc.credentials.pairingPhrase = pairingPhrase;
        lnc.credentials.serverHost =
            mailboxServer === 'custom-defined'
                ? customMailboxServer
                : mailboxServer;
    };

    connect = async () => await lnc.connect();

    // getTransactions = () =>
    //     this.getRequest('/v1/transactions').then((data: any) => ({
    //         transactions: data.transactions.reverse()
    //     }));
    getChannels = async () =>
        await lnc.lnd.lightning
            .listChannels({})
            .then((data: any) => snakeize(data));
    // getChannelInfo = (chanId: string) =>
    //     this.getRequest(`/v1/graph/edge/${chanId}`);
    getBlockchainBalance = async () =>
        await lnc.lnd.lightning
            .walletBalance({})
            .then((data: any) => snakeize(data));
    getLightningBalance = async () =>
        await lnc.lnd.lightning
            .channelBalance({})
            .then((data: any) => snakeize(data));
    // sendCoins = (data: any) =>
    //     this.postRequest('/v1/transactions', {
    //         addr: data.addr,
    //         sat_per_byte: data.sat_per_byte,
    //         amount: data.amount,
    //         spend_unconfirmed: data.spend_unconfirmed
    //     });
    getMyNodeInfo = async () =>
        await lnc.lnd.lightning.getInfo({}).then((data: any) => snakeize(data));
    // getInvoices = () =>
    //     this.getRequest('/v1/invoices?reversed=true&num_max_invoices=100');
    // createInvoice = (data: any) => this.postRequest('/v1/invoices', data);
    // getPayments = () => this.getRequest('/v1/payments');
    // getNewAddress = (data: any) => this.getRequest('/v1/newaddress', data);
    // openChannel = (data: OpenChannelRequest) =>
    //     this.postRequest('/v1/channels', {
    //         private: data.privateChannel,
    //         local_funding_amount: data.local_funding_amount,
    //         min_confs: data.min_confs,
    //         node_pubkey_string: data.node_pubkey_string,
    //         sat_per_byte: data.sat_per_byte,
    //         spend_unconfirmed: data.spend_unconfirmed
    //     });
    // openChannelStream = (data: OpenChannelRequest) =>
    //     this.wsReq('/v1/channels/stream', 'POST', data);
    // connectPeer = (data: any) => this.postRequest('/v1/peers', data);
    // listNode = () => this.getRequest('/v1/network/listNode');
    // decodePaymentRequest = (urlParams?: Array<string>) =>
    //     this.getRequest(`/v1/payreq/${urlParams && urlParams[0]}`);
    // payLightningInvoice = (data: any) => {
    //     if (data.pubkey) delete data.pubkey;
    //     return this.postRequest('/v2/router/send', {
    //         ...data,
    //         // Tor timeout is 60 seconds so make sure LND times out first
    //         timeout_seconds: 57,
    //         allow_self_payment: true
    //     });
    // };
    // closeChannel = (urlParams?: Array<string>) => {
    //     if (urlParams && urlParams.length === 4) {
    //         return this.deleteRequest(
    //             `/v1/channels/${urlParams && urlParams[0]}/${
    //                 urlParams && urlParams[1]
    //             }?force=${urlParams && urlParams[2]}&sat_per_byte=${
    //                 urlParams && urlParams[3]
    //             }`
    //         );
    //     }
    //     return this.deleteRequest(
    //         `/v1/channels/${urlParams && urlParams[0]}/${
    //             urlParams && urlParams[1]
    //         }?force=${urlParams && urlParams[2]}`
    //     );
    // };
    getNodeInfo = async (urlParams?: Array<string>) =>
        await lnc.lnd.lightning
            .getNodeInfo({ pub_key: urlParams && urlParams[0] })
            .then((data: any) => snakeize(data));
    getFees = async () =>
        await lnc.lnd.lightning
            .feeReport({})
            .then((data: any) => snakeize(data));
    // setFees = (data: any) => {
    //     // handle commas in place of decimals
    //     const base_fee_msat = data.base_fee_msat.replace(/,/g, '.');
    //     const fee_rate = data.fee_rate.replace(/,/g, '.');
    //
    //     if (data.global) {
    //         return this.postRequest('/v1/chanpolicy', {
    //             base_fee_msat,
    //             fee_rate: `${Number(fee_rate) / 100}`,
    //             global: true,
    //             time_lock_delta: Number(data.time_lock_delta),
    //             min_htlc_msat: data.min_htlc
    //                 ? `${Number(data.min_htlc) * 1000}`
    //                 : null,
    //             max_htlc_msat: data.max_htlc
    //                 ? `${Number(data.max_htlc) * 1000}`
    //                 : null,
    //             min_htlc_msat_specified: data.min_htlc ? true : false
    //         });
    //     }
    //     return this.postRequest('/v1/chanpolicy', {
    //         base_fee_msat,
    //         fee_rate: `${Number(fee_rate) / 100}`,
    //         chan_point: {
    //             funding_txid_str: data.chan_point.funding_txid_str,
    //             output_index: data.chan_point.output_index
    //         },
    //         time_lock_delta: Number(data.time_lock_delta),
    //         min_htlc_msat: data.min_htlc
    //             ? `${Number(data.min_htlc) * 1000}`
    //             : null,
    //         max_htlc_msat: data.max_htlc
    //             ? `${Number(data.max_htlc) * 1000}`
    //             : null,
    //         min_htlc_msat_specified: data.min_htlc ? true : false
    //     });
    // };
    // getRoutes = (urlParams?: Array<string>) =>
    //     this.getRequest(
    //         `/v1/graph/routes/${urlParams && urlParams[0]}/${
    //             urlParams && urlParams[1]
    //         }`
    //     );
    getForwardingHistory = async (hours = 24) => {
        const req = {
            num_max_events: 10000000,
            start_time: Math.round(
                new Date(Date.now() - hours * 60 * 60 * 1000).getTime() / 1000
            ).toString(),
            end_time: Math.round(new Date().getTime() / 1000).toString()
        };
        return await lnc.lnd.lightning
            .getInfo(req)
            .then((data: any) => snakeize(data));
    };
    // Coin Control
    // fundPsbt = (data: any) => this.postRequest('/v2/wallet/psbt/fund', data);
    // finalizePsbt = (data: any) =>
    //     this.postRequest('/v2/wallet/psbt/finalize', data);
    // publishTransaction = (data: any) => this.postRequest('/v2/wallet/tx', data);
    // getUTXOs = () => this.getRequest('/v1/utxos?min_confs=0&max_confs=200000');
    // bumpFee = (data: any) => this.postRequest('/v2/wallet/bumpfee', data);
    listAccounts = async () =>
        await lnc.lnd.walletKit
            .listAccounts({})
            .then((data: any) => snakeize(data));
    // importAccount = (data: any) =>
    //     this.postRequest('/v2/wallet/accounts/import', data);
    // signMessage = (message: string) =>
    //     this.postRequest('/v1/signmessage', {
    //         msg: Base64Utils.btoa(message)
    //     });
    // verifyMessage = (data: any) =>
    //     this.postRequest('/v1/verifymessage', {
    //         msg: Base64Utils.btoa(data.msg),
    //         signature: data.signature
    //     });
    // subscribeInvoice = (r_hash: string) =>
    //     this.getRequest(`/v2/invoices/subscribe/${r_hash}`);

    supports = (minVersion: string, eosVersion?: string) => {
        const { nodeInfo } = stores.nodeInfoStore;
        const { version } = nodeInfo;
        const { isSupportedVersion } = VersionUtils;
        return isSupportedVersion(version, minVersion, eosVersion);
    };

    supportsMessageSigning = () => true;
    supportsOnchainSends = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsMPP = () => this.supports('v0.10.0');
    supportsAMP = () => this.supports('v0.13.0');
    supportsHopPicking = () => this.supports('v0.11.0');
    supportsRouting = () => true;
    supportsNodeInfo = () => true;
    supportsCoinControl = () => this.supports('v0.12.0');
    supportsAccounts = () => this.supports('v0.13.0');
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => true;
    supportsTaproot = () => this.supports('v0.15.0');
}
