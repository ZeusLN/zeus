import RNFetchBlob from 'rn-fetch-blob';
import stores from '../stores/Stores';
import OpenChannelRequest from './../models/OpenChannelRequest';
import LoginRequest from './../models/LoginRequest';
import ErrorUtils from './../utils/ErrorUtils';

interface Headers {
    macaroon?: string;
    encodingtype?: string;
    'Grpc-Metadata-macaroon'?: string;
}

// keep track of all active calls so we can cancel when appropriate
const calls: any = {};

export class LND {
    restReq = (
        headers: Headers,
        url: string,
        method: any,
        data?: any,
        certVerification?: boolean
    ) => {
        // use body data as an identifier too, we don't want to cancel when we
        // are making multiples calls to get all the node names, for example
        const id = data ? `${url}${JSON.stringify(data)}` : url;
        if (calls[id]) {
            return calls[id];
        }

        calls[id] = RNFetchBlob.config({
            trusty: !certVerification
        })
            .fetch(method, url, headers, data ? JSON.stringify(data) : data)
            .then(response => {
                delete calls[id];
                if (response.info().status < 300) {
                    return response.json();
                } else {
                    const errorInfo = response.json();
                    throw new Error(
                        (errorInfo.error && errorInfo.error.message) ||
                            ErrorUtils.errorToUserFriendly(errorInfo.code) ||
                            errorInfo.message ||
                            errorInfo.error
                    );
                }
            });

        return calls[id];
    };

    getHeaders = (macaroonHex: string) => {
        return {
            'Grpc-Metadata-macaroon': macaroonHex
        };
    };

    getURL = (host: string, port: string | number, route: string) => {
        const baseUrl = this.supportsCustomHostProtocol()
            ? `${host}${port ? ':' + port : ''}`
            : `https://${host}${port ? ':' + port : ''}`;
        return `${baseUrl}${route}`;
    };

    request = (route: string, method: string, data?: any) => {
        const {
            host,
            lndhubUrl,
            port,
            macaroonHex,
            accessToken,
            certVerification
        } = stores.settingsStore;

        const headers = this.getHeaders(macaroonHex || accessToken);
        headers['Content-Type'] = 'application/json';
        const url = this.getURL(host || lndhubUrl, port, route);
        return this.restReq(headers, url, method, data, certVerification);
    };

    getRequest = (route: string) => this.request(route, 'get', null);
    postRequest = (route: string, data?: any) =>
        this.request(route, 'post', data);
    deleteRequest = (route: string) => this.request(route, 'delete', null);

    getTransactions = () => this.getRequest('/v1/transactions');
    getChannels = () => this.getRequest('/v1/channels');
    getBlockchainBalance = () => this.getRequest('/v1/balance/blockchain');
    getLightningBalance = () => this.getRequest('/v1/balance/channels');
    sendCoins = (data: any) => this.postRequest('/v1/transactions', data);
    getMyNodeInfo = () => this.getRequest('/v1/getinfo');
    getInvoices = () =>
        this.getRequest('/v1/invoices?reversed=true&num_max_invoices=100');
    createInvoice = (data: any) => this.postRequest('/v1/invoices', data);
    getPayments = () => this.getRequest('/v1/payments');
    getNewAddress = () => this.getRequest('/v1/newaddress');
    openChannel = (data: OpenChannelRequest) =>
        this.postRequest('/v1/channels', data);
    connectPeer = (data: any) => this.postRequest('/v1/peers', data);
    listNode = () => this.getRequest('/v1/network/listNode');
    decodePaymentRequest = (urlParams?: Array<string>) =>
        this.getRequest(`/v1/payreq/${urlParams[0]}`, urlParams);
    payLightningInvoice = (data: any) =>
        this.postRequest('/v1/channels/transactions', data);
    closeChannel = (urlParams?: Array<string>) => {
        if (urlParams.length === 4) {
            return `/v1/channels/${urlParams[0]}/${urlParams[1]}?force=${urlParams[2]}&sat_per_byte=${urlParams[3]}`;
        }
        return this.deleteRequest(
            '`/v1/channels/${urlParams[0]}/${urlParams[1]}?force=${urlParams[2]}`;',
            urlParams
        );
    };
    getNodeInfo = (urlParams?: Array<string>) =>
        this.getRequest(`/v1/graph/node/${urlParams[0]}`);
    getFees = () => this.getRequest('/v1/fees');
    setFees = (data: any) => this.postRequest('/v1/chanpolicy', data);
    getRoutes = (urlParams?: Array<string>) =>
        this.getRequest(`/v1/graph/routes/${urlParams[0]}/${urlParams[1]}`);

    // LndHub
    createAccount = (host: string, certVerification: boolean) => {
        const url: string = `${host}/create`;
        return this.restReq(
            {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            url,
            'POST',
            {
                partnerid: 'bluewallet',
                accounttype: 'common'
            },
            certVerification
        );
    };

    supportsOnchainSends = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsCustomHostProtocol = () => false;
}
