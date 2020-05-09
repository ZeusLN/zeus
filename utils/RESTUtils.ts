import axios from 'axios';
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
    closeChannel: function(urlParams: Array<string>) {
        if (urlParams.length === 3) {
            return `/v1/channels/${urlParams[0]}/${urlParams[1]}?sat_per_byte=${urlParams[2]}`;
        }
        return `/v1/channels/${urlParams[0]}/${urlParams[1]}`;
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

const getTransactionsToken = axios.CancelToken.source().token;
const getChannelsToken = axios.CancelToken.source().token;
const getBlockchainBalanceToken = axios.CancelToken.source().token;
const getLightningBalanceToken = axios.CancelToken.source().token;
const getMyNodeInfoToken = axios.CancelToken.source().token;
const getInvoicesToken = axios.CancelToken.source().token;
const getPaymentsToken = axios.CancelToken.source().token;
const getNodeInfoToken = axios.CancelToken.source().token;

class RESTUtils {
    axiosReq = (
        headers: Headers,
        url: string,
        method: any,
        cancelToken?: any,
        data?: any
    ) =>
        axios.request({
            method,
            url,
            headers,
            cancelToken,
            data
        });

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
        cancelToken?: any,
        data?: any,
        urlParams?: Array<string>
    ) => {
        const { host, port, macaroonHex, implementation } = settingsStore;

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
        return this.axiosReq(headers, url, method, cancelToken, data);
    };

    getRequest = (
        settingsStore: SettingsStore,
        request: string,
        cancelToken?: any,
        urlParams?: Array<string>
    ) => {
        return this.request(
            settingsStore,
            request,
            'get',
            cancelToken,
            null,
            urlParams
        );
    };

    postRequest = (
        settingsStore: SettingsStore,
        request: string,
        data?: any
    ) => {
        return this.request(settingsStore, request, 'post', null, data);
    };

    deleteRequest = (
        settingsStore: SettingsStore,
        request: string,
        urlParams?: Array<string>
    ) => {
        return this.request(
            settingsStore,
            request,
            'delete',
            null,
            null,
            urlParams
        );
    };

    getTransactions = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getTransactions', getTransactionsToken);
    getChannels = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getChannels', getChannelsToken);
    getBlockchainBalance = (settingsStore: SettingsStore) =>
        this.getRequest(
            settingsStore,
            'getBlockchainBalance',
            getBlockchainBalanceToken
        );
    getLightningBalance = (settingsStore: SettingsStore) =>
        this.getRequest(
            settingsStore,
            'getLightningBalance',
            getLightningBalanceToken
        );
    sendCoins = (settingsStore: SettingsStore, data: any) =>
        this.postRequest(settingsStore, 'sendCoins', data);
    getMyNodeInfo = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getMyNodeInfo', getMyNodeInfoToken);
    getInvoices = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getInvoices', getInvoicesToken);
    createInvoice = (settingsStore: SettingsStore, data: any) =>
        this.postRequest(settingsStore, 'createInvoice', data);
    getPayments = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getPayments', getPaymentsToken);
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
    ) =>
        this.getRequest(settingsStore, 'decodePaymentRequest', null, urlParams);
    payLightningInvoice = (settingsStore: SettingsStore, data: any) =>
        this.postRequest(settingsStore, 'payLightningInvoice', data);
    closeChannel = (settingsStore: SettingsStore, urlParams?: Array<string>) =>
        this.deleteRequest(settingsStore, 'closeChannel', urlParams);
    getNodeInfo = (settingsStore: SettingsStore, urlParams?: Array<string>) =>
        this.getRequest(
            settingsStore,
            'getNodeInfo',
            getNodeInfoToken,
            urlParams
        );
    getFees = (settingsStore: SettingsStore) =>
        this.getRequest(settingsStore, 'getFees');
    setFees = (settingsStore: SettingsStore, data: any) =>
        this.postRequest(settingsStore, 'setFees', data);
    getRoutes = (settingsStore: SettingsStore, urlParams?: Array<string>) =>
        this.getRequest(settingsStore, 'getRoutes', null, urlParams);
}

const restUtils = new RESTUtils();
export default restUtils;
