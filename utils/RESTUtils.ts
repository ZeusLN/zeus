import axios from 'axios';
import SettingsStore from './../stores/SettingsStore';

const lndRoutes = {
    getTransactions: '/v1/transactions',
    getBlockchainBalance: '/v1/balance/blockchain',
    getLightningBalance: '/v1/balance/channels',
    getChannels: '/v1/channels',
    sendCoins: '/v1/transactions',
    getNodeInfo: '/v1/getinfo'
};

const clightningRoutes = {
    getTransactions: '/v1/listFunds',
    getBlockchainBalance: '/v1/getBalance',
    getLightningBalance: '/v1/channel/localremotebal',
    getChannels: '/v1/channel/listChannels',
    sendCoins: '/v1/withdraw',
    getNodeInfo: '/v1/getinfo'
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
}

const restUtils = new RESTUtils();
export default restUtils;
