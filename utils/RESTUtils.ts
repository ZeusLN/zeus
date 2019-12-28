import axios from 'axios';
import SettingsStore from './../stores/SettingsStore';

const lndRoutes = {
    getTransactions: '/v1/transactions',
    getBlockchainBalance: '/v1/balance/blockchain',
    getLightningBalance: '/v1/balance/channels',
    getChannels: '/v1/channels',
    sendCoins: '/v1/transactions',
    getNodeInfo: '/v1/getinfo',
    getInvoices: '/v1/invoices?reversed=true&num_max_invoices=100',
    createInvoice: '/v1/invoices',
    getPayments: '/v1/payments',
    getNewAddress: '/v1/newaddress',
    openChannel: '/v1/channels',
    connectPeer: '/v1/peers',
    listNode: '/v1/network/listNode',
    closeChannel: '/v1/channel/closeChannel/'
};

const clightningRoutes = {
    getTransactions: '/v1/listFunds',
    getBlockchainBalance: '/v1/getBalance',
    getLightningBalance: '/v1/channel/localremotebal',
    getChannels: '/v1/channel/listChannels',
    sendCoins: '/v1/withdraw',
    getNodeInfo: '/v1/getinfo',
    // getInvoices: '/v1/pay/listPayments',
    getInvoices: '/v1/invoice/listInvoices/',
    createInvoice: '/v1/invoice/genInvoice/',
    getPayments: '/v1/pay/listPays/',
    getNewAddress: '/v1/newaddr',
    openChannel: '/v1/channel/openChannel/',
    connectPeer: '/v1/peer/connect',
    listNode: '/v1/network/listNode',
    closeChannel: '/v1/channel/closeChannel/'
};

interface Headers {
    macaroon?: string;
    encodingtype?: string;
    'Grpc-Metadata-macaroon'?: string;
};

const getTransactionsToken = axios.CancelToken.source().token;
const getChannelsToken = axios.CancelToken.source().token;
const getBlockchainBalanceToken = axios.CancelToken.source().token;
const getLightningBalanceToken = axios.CancelToken.source().token;
const getNodeInfoToken = axios.CancelToken.source().token;
const getInvoicesToken = axios.CancelToken.source().token;
const getPaymentsToken = axios.CancelToken.source().token;

class RESTUtils {
    axiosReq = (headers: Headers, url: string, method: string, cancelToken?: any, data?: any) => {
        return axios
            .request({
                method,
                url,
                headers,
                cancelToken,
                data
            });
    };

    getHeaders = (implementation: string, macaroonHex: string) => {
        if (implementation === 'c-lightning-REST') {
            return {
                'macaroon': macaroonHex,
                'encodingtype': 'hex'
            };
        }
        return {
            'Grpc-Metadata-macaroon': macaroonHex
        };
    };

    getURL = (host: string, port: string|number, route: string) => {
        const baseUrl = `https://${host}${port ? ':' + port : ''}`;
        return `${baseUrl}${route}`;
    };

    request = (settingsStore: SettingsStore, request: string, method: string, cancelToken?: any, data?: any) => {
        const { host, port, macaroonHex, implementation } = settingsStore;
        const route: string = implementation === 'c-lightning-REST' ? clightningRoutes[request] : lndRoutes[request];
        const headers = this.getHeaders(implementation, macaroonHex);
        const url = this.getURL(host, port, route);
        return this.axiosReq(headers, url, method, cancelToken, data);
    };

    getRequest = (settingsStore: SettingsStore, request: string, cancelToken?: any) => {
        return this.request(settingsStore, request, 'get', cancelToken);
    };

    postRequest = (settingsStore: SettingsStore, request: string, data?: any) => {
        return this.request(settingsStore, request, 'post', null, data);
    };

    getTransactions = (settingsStore: SettingsStore) => this.getRequest(settingsStore, 'getTransactions', getTransactionsToken);
    getChannels = (settingsStore: SettingsStore) => this.getRequest(settingsStore, 'getChannels', getChannelsToken);
    getBlockchainBalance = (settingsStore: SettingsStore) => this.getRequest(settingsStore, 'getBlockchainBalance', getBlockchainBalanceToken);
    getLightningBalance = (settingsStore: SettingsStore) => this.getRequest(settingsStore, 'getLightningBalance', getLightningBalanceToken);
    sendCoins = (settingsStore: SettingsStore, data: any) => this.postRequest(settingsStore, 'sendCoins', data);
    getNodeInfo = (settingsStore: SettingsStore) => this.getRequest(settingsStore, 'getNodeInfo', getNodeInfoToken);
    getInvoices = (settingsStore: SettingsStore) => this.getRequest(settingsStore, 'getInvoices', getInvoicesToken);
    createInvoice = (settingsStore: SettingsStore, data: any) => this.postRequest(settingsStore, 'createInvoice', data);
    getPayments = (settingsStore: SettingsStore) => this.getRequest(settingsStore, 'getPayments', getPaymentsToken);
    getNewAddress = (settingsStore: SettingsStore) => this.getRequest(settingsStore, 'getNewAddress');
    openChannel = (settingsStore: SettingsStore, data: any) => this.postRequest(settingsStore, 'openChannel', data);
    connectPeer = (settingsStore: SettingsStore, data: any) => this.postRequest(settingsStore, 'connectPeer', data);
    listNode = (settingsStore: SettingsStore) => this.getRequest(settingsStore, 'listNode');
}

const restUtils = new RESTUtils();
export default restUtils;
