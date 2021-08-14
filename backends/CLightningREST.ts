import LND from './LND';
import TransactionRequest from './../models/TransactionRequest';
import OpenChannelRequest from './../models/OpenChannelRequest';

export default class CLightningREST extends LND {
    getHeaders = (macaroonHex: string): any => {
        return {
            macaroon: macaroonHex,
            encodingtype: 'hex'
        };
    };

    getTransactions = () =>
        this.getRequest('/v1/listFunds').then((data: any) => ({
            transactions: data.outputs
        }));
    getChannels = () =>
        this.getRequest('/v1/channel/listChannels').then((data: any) => ({
            channels: data
        }));
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
                feeRate: `${Number(data.sat_per_byte) * 1000}perkb`,
                satoshis: data.amount,
                utxos: data.utxos
            };
        } else {
            request = {
                address: data.addr,
                feeRate: `${Number(data.sat_per_byte) * 1000}perkb`,
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
            expiry: data.expiry,
            private: true
        });
    getPayments = () => this.getRequest('/v1/pay/listPayments');
    getNewAddress = () => this.getRequest('/v1/newaddr');
    openChannel = (data: OpenChannelRequest) => {
        let request: any;
        if (data.utxos && data.utxos.length > 0) {
            request = {
                id: data.id,
                satoshis: data.satoshis,
                feeRate: data.sat_per_byte,
                annnounce: data.announce,
                minfConf: data.min_confs,
                utxos: data.utxos
            };
        } else {
            request = {
                id: data.id,
                satoshis: data.satoshis,
                feeRate: data.sat_per_byte,
                annnounce: data.announce,
                minfConf: data.min_confs
            };
        }

        return this.postRequest('/v1/channel/openChannel/', request);
    };
    connectPeer = (data: any) =>
        this.postRequest('/v1/peer/connect', {
            id: `${data.addr.pubkey}@${data.addr.host}`
        });
    listNode = () => this.getRequest('/v1/network/listNode');
    decodePaymentRequest = (urlParams?: Array<string>) =>
        this.getRequest(`/v1/pay/decodePay/${urlParams && urlParams[0]}`);
    payLightningInvoice = (data: any) =>
        this.postRequest('/v1/pay', {
            invoice: data.payment_request,
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
            message: message
        });

    supportsMessageSigning = () => true;
    supportsMPP = () => false;
    supportsAMP = () => false;
    supportsCoinControl = () => this.supports('v0.8.2', undefined, 'v0.4.0');
    supportsHopPicking = () => false;
    supportsRouting = () => true;
    supportsNodeInfo = () => true;
}
