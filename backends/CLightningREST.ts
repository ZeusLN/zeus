import stores from '../stores/Stores';
import LND from './LND';
import TransactionRequest from './../models/TransactionRequest';
import OpenChannelRequest from './../models/OpenChannelRequest';
import VersionUtils from './../utils/VersionUtils';
import Base64Utils from './../utils/Base64Utils';
import { Hash as sha256Hash } from 'fast-sha256';

export default class CLightningREST extends LND {
    getHeaders = (macaroonHex: string): any => {
        return {
            macaroon: macaroonHex,
            encodingtype: 'hex'
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

    getTransactions = () =>
        this.getRequest('/v1/listFunds').then((data: any) => ({
            transactions: data.outputs
        }));
    getChannels = () =>
        this.getRequest('/v1/peer/listPeers').then((data: any) => {
            const formattedChannels: any[] = [];
            data.filter((peer: any) => peer.channels.length).map(
                (peer: any) => {
                    peer.channels.forEach((channel: any) => {
                        if (
                            channel.state === 'ONCHAIN' ||
                            channel.state === 'CLOSED' ||
                            channel.state === 'CHANNELD_AWAITING_LOCKIN'
                        )
                            return;

                        // CLN v23.05 msat deprecations
                        const to_us_msat =
                            channel.to_us ||
                            channel.to_us_msat ||
                            channel.msatoshi_to_us ||
                            0;
                        const total_msat =
                            channel.total ||
                            channel.total_msat ||
                            channel.msatoshi_total ||
                            0;
                        const out_fulfilled_msat =
                            channel.out_fulfilled ||
                            channel.out_fulfilled_msat ||
                            channel.out_msatoshi_fulfilled ||
                            0;
                        const in_fulfilled_msat =
                            channel.in_fulfilled ||
                            channel.in_fulfilled_msat ||
                            channel.in_msatoshi_fulfilled ||
                            0;
                        const our_reserve_msat =
                            channel.our_reserve ||
                            channel.our_reserve_msat ||
                            channel.our_channel_reserve_satoshis ||
                            0;
                        const their_reserve_msat =
                            channel.their_reserve ||
                            channel.their_reserve_msat ||
                            channel.their_channel_reserve_satoshi ||
                            0;

                        formattedChannels.push({
                            active: peer.connected,
                            remote_pubkey: peer.id,
                            channel_point: channel.funding_txid,
                            chan_id: channel.channel_id,
                            alias: peer.alias,
                            capacity: Number(total_msat / 1000).toString(),
                            local_balance: Number(to_us_msat / 1000).toString(),
                            remote_balance: Number(
                                (total_msat - to_us_msat) / 1000
                            ).toString(),
                            total_satoshis_sent: Number(
                                out_fulfilled_msat / 1000
                            ).toString(),
                            total_satoshis_received: Number(
                                in_fulfilled_msat / 1000
                            ).toString(),
                            num_updates: (
                                channel.in_payments_offered +
                                channel.out_payments_offered
                            ).toString(),
                            csv_delay: channel.our_to_self_delay,
                            private: channel.private,
                            local_chan_reserve_sat: Number(
                                our_reserve_msat / 1000
                            ).toString(),
                            remote_chan_reserve_sat: Number(
                                their_reserve_msat / 1000
                            ).toString(),
                            close_address: channel.close_to_addr
                        });
                    });
                }
            );

            return {
                channels: formattedChannels
            };
        });
    getBlockchainBalance = () =>
        this.getRequest('/v1/getBalance').then(
            ({ totalBalance, confBalance, unconfBalance }: any) => ({
                total_balance: totalBalance,
                confirmed_balance: confBalance,
                unconfirmed_balance: unconfBalance
            })
        );
    getLightningBalance = () =>
        this.getRequest('/v1/channel/localremotebal').then(
            ({ localBalance, pendingBalance }: any) => ({
                balance: localBalance,
                pending_open_balance: pendingBalance
            })
        );
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
    getMyNodeInfo = () => this.getRequest('/v1/getinfo');
    getInvoices = () => this.getRequest('/v1/invoice/listInvoices/');
    createInvoice = (data: any) =>
        this.postRequest('/v1/invoice/genInvoice/', {
            description: data.memo,
            label: 'zeus.' + Math.random() * 1000000,
            amount: Number(data.value) * 1000,
            expiry: Number(data.expiry),
            private: true
        });
    getPayments = () =>
        this.getRequest('/v1/pay/listPays').then((data: any) => ({
            payments: data.pays
        }));
    getNewAddress = () => this.getRequest('/v1/newaddr');
    openChannel = (data: OpenChannelRequest) => {
        let request: any;
        if (data.utxos && data.utxos.length > 0) {
            request = {
                id: data.id,
                satoshis: data.satoshis,
                feeRate: data.sat_per_vbyte,
                announce: !data.privateChannel ? 'true' : 'false',
                minfConf: data.min_confs,
                utxos: data.utxos
            };
        } else {
            request = {
                id: data.id,
                satoshis: data.satoshis,
                feeRate: data.sat_per_vbyte,
                announce: !data.privateChannel ? 'true' : 'false',
                minfConf: data.min_confs
            };
        }

        return this.postRequest('/v1/channel/openChannel/', request);
    };
    connectPeer = (data: any) =>
        this.postRequest('/v1/peer/connect', {
            id: `${data.addr.pubkey}@${data.addr.host}`
        });
    decodePaymentRequest = (urlParams?: Array<string>) =>
        this.getRequest(`/v1/pay/decodePay/${urlParams && urlParams[0]}`);
    payLightningInvoice = (data: any) =>
        this.postRequest('/v1/pay', {
            invoice: data.payment_request,
            amount: Number(data.amt && data.amt * 1000),
            maxfeepercent: data.max_fee_percent
        });
    sendKeysend = (data: any) =>
        this.postRequest('/v1/pay/keysend', {
            pubkey: data.pubkey,
            amount: Number(data.amt && data.amt * 1000)
        });
    closeChannel = (urlParams?: Array<string>) =>
        this.deleteRequest(
            `/v1/channel/closeChannel/${urlParams && urlParams[0]}/`
        );
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
    getUTXOs = () => this.getRequest('/v1/listFunds');
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

    supportsMessageSigning = () => true;
    supportsLnurlAuth = () => true;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsPendingChannels = () => false;
    supportsMPP = () => false;
    supportsAMP = () => false;
    supportsCoinControl = () => this.supports('v0.8.2', undefined, 'v0.4.0');
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
    isLNDBased = () => false;
}
