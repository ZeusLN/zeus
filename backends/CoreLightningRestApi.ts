import stores from '../stores/Stores';
import LND from './LND';
import TransactionRequest from '../models/TransactionRequest';
import OpenChannelRequest from '../models/OpenChannelRequest';
import VersionUtils from '../utils/VersionUtils';
import Base64Utils from '../utils/Base64Utils';
import { Hash as sha256Hash } from 'fast-sha256';
import BigNumber from 'bignumber.js';
import {
    getBalance,
    getOffchainBalance,
    listPeers
} from './CoreLightningRequestHandler';

export default class CoreLightningRestApi extends LND {
    getHeaders = (rune: string): any => {
        return {
            Rune: rune
        };
    };

    supports = (
        minVersion: string,
        eosVersion?: string,
        minApiVersion?: string
    ) => {
        const { nodeInfo } = stores.nodeInfoStore;
        const { version, api_version } = nodeInfo;
        const { isSupportedVersion } = VersionUtils;
        if (minApiVersion) {
            return (
                isSupportedVersion(version, minVersion, eosVersion) &&
                isSupportedVersion(api_version, minApiVersion)
            );
        }
        return isSupportedVersion(version, minVersion, eosVersion);
    };

    request = (route: string, method: string, data?: any, params?: any) => {
        const { host, port, rune, certVerification, enableTor } =
            stores.settingsStore;

        if (params) {
            route = `${route}?${Object.keys(params)
                .map((key: string) => key + '=' + params[key])
                .join('&')}`;
        }

        const headers: any = this.getHeaders(rune);
        headers['Content-Type'] = 'application/json';

        const url = this.getURL(host, port, route);

        return this.restReq(
            headers,
            url,
            method,
            data,
            certVerification,
            enableTor
        );
    };

    getRequest = (route: string, data?: any) =>
        this.request(route, 'get', null, data);
    postRequest = (route: string, data?: any) =>
        this.request(route, 'post', data);
    deleteRequest = (route: string) => this.request(route, 'delete', null);

    getNode = (data: any) =>
        this.postRequest('/v1/listnodes', { id: data.id }).then((res) => {
            return res;
        });
    getTransactions = () =>
        this.postRequest('/v1/listfunds').then((res) => ({
            transactions: res.outputs
        }));
    getChannels = async () => {
        const channels = await this.postRequest('/v1/listpeerchannels');
        return await listPeers(channels);
    };
    getBlockchainBalance = () =>
        this.postRequest('/v1/listfunds').then((res) => {
            return getBalance(res);
        });
    getLightningBalance = () =>
        this.postRequest('/v1/listfunds').then((res) => {
            return getOffchainBalance(res);
        });
    sendCoins = (data: TransactionRequest) => {
        let request: any;
        if (data.utxos) {
            request = {
                address: data.addr,
                feeRate: `${Number(data.sat_per_vbyte) * 1000}perkb`,
                satoshis: data.amount,
                utxos: data.utxos
            };
        } else {
            request = {
                address: data.addr,
                feeRate: `${Number(data.sat_per_vbyte) * 1000}perkb`,
                satoshis: data.amount
            };
        }
        return this.postRequest('/v1/withdraw', request);
    };
    getMyNodeInfo = () => this.postRequest('/v1/getinfo');
    getInvoices = () => this.postRequest('/v1/listinvoices');
    createInvoice = (data: any) =>
        this.postRequest('/v1/invoice', {
            description: data.memo,
            label: 'zeus.' + Math.random() * 1000000,
            amount_msat: Number(data.value) * 1000,
            expiry: Number(data.expiry),
            exposeprivatechannels: true
        });

    getPayments = () =>
        this.postRequest('/v1/listpays').then((data: any) => ({
            payments: data.pays
        }));
    getNewAddress = () => this.postRequest('/v1/newaddr');
    openChannelSync = (data: OpenChannelRequest) => {
        let request: any;
        const feeRate = `${new BigNumber(data.sat_per_vbyte)
            .times(1000)
            .toString()}perkb`;
        if (data.utxos && data.utxos.length > 0) {
            request = {
                id: data.id,
                amount: data.satoshis,
                feerate: feeRate,
                announce: !data.privateChannel ? true : false,
                minconf: data.min_confs,
                utxos: data.utxos
            };
        } else {
            request = {
                id: data.id,
                amount: data.satoshis,
                feerate: feeRate,
                announce: !data.privateChannel ? true : false,
                minconf: data.min_confs
            };
        }

        return this.postRequest('/v1/fundchannel', request);
    };
    connectPeer = (data: any) => {
        const [host, port] = data.addr.host.split(':');

        return this.postRequest('/v1/connect', {
            id: data.addr.pubkey,
            host,
            port
        });
    };
    decodePaymentRequest = (urlParams?: Array<string>) =>
        this.postRequest('/v1/decode', {
            string: urlParams && urlParams[0]
        });

    payLightningInvoice = (data: any) =>
        this.postRequest('/v1/pay', {
            bolt11: data.payment_request,
            amount_msat: Number(data.amt && data.amt * 1000),
            maxfeepercent: data.max_fee_percent
        });
    sendKeysend = (data: any) => {
        return this.postRequest('/v1/keysend', {
            destination: data.pubkey,
            amount_msat: Number(data.amt && data.amt * 1000),
            maxfeepercent: data.max_fee_percent
        });
    };
    closeChannel = (urlParams?: Array<string>) => {
        const request = {
            id: urlParams && urlParams[0],
            unilateraltimeout: urlParams && urlParams[1] ? 2 : 0
        };
        return this.postRequest('/v1/close', request);
    };
    getNodeInfo = () => this.getRequest('N/A');
    getFees = () =>
        this.getRequest('/v1/getFees/').then(({ feeCollected }: any) => ({
            total_fee_sum: feeCollected / 1000
        }));
    setFees = (data: any) =>
        this.postRequest('/v1/channel/setChannelFee/', {
            id: data.global ? 'all' : data.channelId,
            base: data.base_fee_msat,
            ppm: data.fee_rate
        });
    getRoutes = () => this.getRequest('N/A');
    getUTXOs = () => this.postRequest('/v1/listfunds');
    signMessage = (message: string) =>
        this.postRequest('/v1/utility/signMessage', {
            message
        });
    verifyMessage = (data: any) =>
        this.getRequest(
            `/v1/utility/checkMessage/${data.msg}/${data.signature}`
        );
    lnurlAuth = async (r_hash: string) => {
        const signed = await this.signMessage(r_hash);
        return {
            signature: new sha256Hash()
                .update(Base64Utils.stringToUint8Array(signed.signature))
                .digest()
        };
    };

    // BOLT 12 / Offers
    listOffers = () => this.getRequest('/v1/offers/listOffers');
    createOffer = ({
        description,
        label,
        singleUse
    }: {
        description?: string;
        label?: string;
        singleUse?: boolean;
    }) =>
        this.postRequest('/v1/offers/offer', {
            amount: 'any',
            description,
            label,
            single_use: singleUse || false
        });
    disableOffer = ({ offer_id }: { offer_id: string }) =>
        this.deleteRequest(`/v1/offers/disableOffer/${offer_id}`);
    fetchInvoiceFromOffer = async (bolt12: string, amountSatoshis: string) => {
        return await this.postRequest('/v1/offers/fetchInvoice', {
            offer: bolt12,
            msatoshi: Number(amountSatoshis) * 1000,
            timeout: 60
        });
    };

    supportsMessageSigning = () => true;
    supportsLnurlAuth = () => true;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsLightningSends = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsPendingChannels = () => false;
    supportsMPP = () => false;
    supportsAMP = () => false;
    supportsCoinControl = () => this.supports('v0.8.2', undefined, 'v0.4.0');
    supportsChannelCoinControl = () =>
        this.supports('v0.8.2', undefined, 'v0.4.0');
    supportsHopPicking = () => false;
    supportsAccounts = () => false;
    supportsRouting = () => true;
    supportsNodeInfo = () => true;
    singleFeesEarnedTotal = () => true;
    supportsAddressTypeSelection = () => false;
    supportsTaproot = () => false;
    supportsBumpFee = () => false;
    supportsLSPs = () => false;
    supportsNetworkInfo = () => false;
    supportsSimpleTaprootChannels = () => false;
    supportsCustomPreimages = () => false;
    supportsSweep = () => true;
    supportsOnchainBatching = () => false;
    supportsChannelBatching = () => false;
    supportsLSPS1customMessage = () => false;
    supportsLSPS1rest = () => true;
    supportsOffers = async () => {
        const { configs } = await this.postRequest('/v1/listconfigs');

        const supportsOffers: boolean = configs['experimental-offers']
            ? true
            : false;

        return supportsOffers;
    };
    isLNDBased = () => false;
}
