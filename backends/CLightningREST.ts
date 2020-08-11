import LND from './LND';

export class CLightningREST extends LND {
    getHeaders = (macaroonHex: string) => {
        return {
            macaroon: macaroonHex,
            encodingtype: 'hex'
        };
    };

    getTransactions = () =>
        this.getRequest('/v1/listFunds').then(data => ({
            transactions: data.outputs
        }));
    getChannels = () =>
        this.getRequest('/v1/channel/listChannels').then(data => ({
            channels: data
        }));
    getBlockchainBalance = () =>
        this.getRequest('/v1/getBalance').then(
            ({ totalBalance, confBalance, unconfBalance }) => ({
                total_balance: totalBalance,
                confirmed_balance: confBalance,
                unconfirmed_balance: unconfBalance
            })
        );
    getLightningBalance = () =>
        this.getRequest('/v1/channel/localremotebal').then(
            ({ localBalance, pendingBalance }) => ({
                balance: localBalance,
                pending_open_balance: pendingBalance
            })
        );
    sendCoins = (data: TransactionRequest) =>
        this.postRequest('/v1/withdraw', {
            address: data.addr,
            feeRate: `${Number(data.sat_per_byte) * 1000}perkb`,
            satoshis: data.amount
        });
    getMyNodeInfo = () => this.getRequest('/v1/getinfo');
    getInvoices = () => this.getRequest('/v1/invoice/listInvoices/');
    createInvoice = (data: any) =>
        this.postRequest('/v1/invoice/genInvoice/', {
            description: data.memo,
            label: 'zeus.' + parseInt(Math.random() * 1000000),
            amount: Number(data.value) * 1000,
            expiry: data.expiry,
            private: true
        });
    getPayments = () => this.getRequest('/v1/pay/listPayments');
    getNewAddress = () => this.getRequest('/v1/newaddr');
    openChannel = (data: OpenChannelRequest) =>
        this.postRequest('/v1/channel/openChannel/', data);
    connectPeer = (data: any) =>
        this.postRequest('/v1/peer/connect', {
            id: `${data.addr.pubkey}@${data.addr.host}`
        });
    listNode = () => this.getRequest('/v1/network/listNode');
    decodePaymentRequest = (urlParams?: Array<string>) =>
        this.getRequest(`/v1/pay/decodePay/${urlParams[0]}`);
    payLightningInvoice = (data: any) =>
        this.postRequest('/v1/pay', {
            invoice: data.payment_request,
            amount: Number(data.amt && data.amt * 1000)
        });
    closeChannel = (urlParams?: Array<string>) =>
        this.deleteRequest(`/v1/channel/closeChannel/${urlParams[0]}/`);
    getNodeInfo = () => this.getRequest('N/A');
    getFees = () =>
        this.getRequest('/v1/getFees/').then(({ feeCollected }) => ({
            total_fee_sum: parseInt(feeCollected / 1000)
        }));
    setFees = (data: any) =>
        this.postRequest('/v1/channel/setChannelFee/', {
            id: data.global ? 'all' : data.channelId,
            base: data.base_fee_msat,
            ppm: data.fee_rate
        });
    getRoutes = () => this.getRequest('N/A');
}
