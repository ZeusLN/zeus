import RNFetchBlob from 'rn-fetch-blob';
import SettingsStore from './../stores/SettingsStore';

const lndRoutes: any = {
    getTransactions: '/v1/transactions',
    getBlockchainBalance: '/v1/balance/blockchain',
    getLightningBalance: '/v1/balance/channels',
    getChannels: '/v1/channels',
    sendCoins: '/v1/transactions',
    getMyNodeInfo: '/v1/getinfo',
    getInvoices: '/v1/invoices?reversed=true&num_max_invoices=100',
    createInvoice: '/v1/invoices',
    getPayments: '/v1/payments',
    getNewAddress: '/v1/newaddress',
    openChannel: '/v1/channels',
    connectPeer: '/v1/peers',
    listNode: '/v1/network/listNode',
    closeChannel: function(urlParams: Array<string | boolean>) {
        if (urlParams.length === 4) {
            return `/v1/channels/${urlParams[0]}/${urlParams[1]}?force=${urlParams[2]}&sat_per_byte=${urlParams[3]}`;
        }

        return `/v1/channels/${urlParams[0]}/${urlParams[1]}?force=${urlParams[2]}`;
    },
    decodePaymentRequest: function(urlParams: Array<string>) {
        return `/v1/payreq/${urlParams[0]}`;
    },
    payLightningInvoice: '/v1/channels/transactions',
    getNodeInfo: function(urlParams: Array<string>) {
        return `/v1/graph/node/${urlParams[0]}`;
    },
    getFees: '/v1/fees',
    setFees: '/v1/chanpolicy',
    getRoutes: function(urlParams: Array<string>) {
        return `/v1/graph/routes/${urlParams[0]}/${urlParams[1]}`;
    }
};

const clightningRoutes: any = {
    getTransactions: '/v1/listFunds',
    getBlockchainBalance: '/v1/getBalance',
    getLightningBalance: '/v1/channel/localremotebal',
    getChannels: '/v1/channel/listChannels',
    sendCoins: '/v1/withdraw',
    getMyNodeInfo: '/v1/getinfo',
    getInvoices: '/v1/invoice/listInvoices/',
    createInvoice: '/v1/invoice/genInvoice/',
    getPayments: '/v1/pay/listPayments',
    getNewAddress: '/v1/newaddr',
    openChannel: '/v1/channel/openChannel/',
    connectPeer: '/v1/peer/connect',
    listNode: '/v1/network/listNode',
    closeChannel: function(urlParams: Array<string>) {
        return `/v1/channel/closeChannel/${urlParams[0]}/`;
    },
    decodePaymentRequest: function(urlParams: Array<string>) {
        return `/v1/pay/decodePay/${urlParams[0]}`;
    },
    payLightningInvoice: '/v1/pay',
    getNodeInfo: 'N/A',
    getFees: '/v1/getFees/',
    setFees: '/v1/channel/setChannelFee/',
    getRoutes: 'N/A'
};

interface Headers {
    macaroon?: string;
    encodingtype?: string;
    'Grpc-Metadata-macaroon'?: string;
}

class RESTUtils {
    restReq = (
        headers: Headers,
        url: string,
        method: any,
        data?: any,
        sslVerification?: boolean
    ) =>
        RNFetchBlob.config({
            trusty: !sslVerification || true
        }).fetch(method, url, headers, data ? JSON.stringify(data) : data);

    getHeaders = (implementation: string, macaroonHex: string) => {
        if (implementation === 'c-lightning-REST') {
            return {
                macaroon: macaroonHex,
                encodingtype: 'hex'
            };
        }
        return {
            'Grpc-Metadata-macaroon': macaroonHex
        };
    };

    getURL = (host: string, port: string | number, route: string) => {
        const baseUrl = `https://${host}${port ? ':' + port : ''}`;
        return `${baseUrl}${route}`;
    };

    request = (
        settingsStore: SettingsStore,
        request: string,
        method: string,
        data?: any,
        urlParams?: Array<string>
    ) => {
        const {
            host,
            port,
            macaroonHex,
            implementation,
            sslVerification
        } = settingsStore;

        let route: string;
        if (urlParams) {
            route =
                implementation === 'c-lightning-REST'
                    ? clightningRoutes[request](urlParams)
                    : lndRoutes[request](urlParams);
        } else {
            route =
                implementation === 'c-lightning-REST'
                    ? clightningRoutes[request]
                    : lndRoutes[request];
        }

        const headers = this.getHeaders(implementation, macaroonHex);
        const url = this.getURL(host, port, route);
        return this.restReq(headers, url, method, data, sslVerification);
    };

    getRequest = (
        settingsStore: SettingsStore,
        request: string,
        urlParams?: Array<string>
    ) => this.request(settingsStore, request, 'get', null, urlParams);

    postRequest = (settingsStore: SettingsStore, request: string, data?: any) =>
        this.request(settingsStore, request, 'post', data);

    deleteRequest = (
        settingsStore: SettingsStore,
        request: string,
        urlParams?: Array<string>
    ) => this.request(settingsStore, request, 'delete', null, urlParams);

    getTransactions = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getTransactions');
    getChannels = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getChannels');
    getBlockchainBalance = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getBlockchainBalance');
    getLightningBalance = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getLightningBalance');
    sendCoins = (settingsStore: SettingsStore, data: any) =>
        this.postRequest(settingsStore, 'sendCoins', data);
    getMyNodeInfo = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getMyNodeInfo');
    getInvoices = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getInvoices');
    createInvoice = (settingsStore: SettingsStore, data: any) =>
        this.postRequest(settingsStore, 'createInvoice', data);
    getPayments = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getPayments');
    getNewAddress = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getNewAddress');
    openChannel = (settingsStore: SettingsStore, data: any) =>
        this.postRequest(settingsStore, 'openChannel', data);
    connectPeer = (settingsStore: SettingsStore, data: any) =>
        this.postRequest(settingsStore, 'connectPeer', data);
    listNode = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'listNode');
    decodePaymentRequest = (
        settingsStore: SettingsStore,
        urlParams?: Array<string>
    ) => this.getRequest(settingsStore, 'decodePaymentRequest', urlParams);
    payLightningInvoice = (settingsStore: SettingsStore, data: any) =>
        this.postRequest(settingsStore, 'payLightningInvoice', data);
    closeChannel = (settingsStore: SettingsStore, urlParams?: Array<string>) =>
        this.deleteRequest(settingsStore, 'closeChannel', urlParams);
    getNodeInfo = (settingsStore: SettingsStore, urlParams?: Array<string>) =>
        this.getRequest(settingsStore, 'getNodeInfo', urlParams);
    getFees = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getFees');
    setFees = (settingsStore: SettingsStore, data: any) =>
        this.postRequest(settingsStore, 'setFees', data);
    getRoutes = (settingsStore: SettingsStore, urlParams?: Array<string>) =>
        this.getRequest(settingsStore, 'getRoutes', urlParams);
}

const restUtils = new RESTUtils();
export default restUtils;
