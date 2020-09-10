import RNFetchBlob from 'rn-fetch-blob';
import stores from '../stores/Stores';
import OpenChannelRequest from './../models/OpenChannelRequest';
import ErrorUtils from './../utils/ErrorUtils';
import VersionUtils from './../utils/VersionUtils';

interface Headers {
    macaroon?: string;
    encodingtype?: string;
    'Grpc-Metadata-Macaroon'?: string;
    'Grpc-Metadata-macaroon'?: string;
}

// keep track of all active calls so we can cancel when appropriate
const calls: any = {};

export default class LND {
    restReq = (
        headers: Headers | any,
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
            .then((response: any) => {
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

    supports = (supportedVersion: string, apiVersion?: string) => {
        const { nodeInfo } = stores.nodeInfoStore;
        const { version, api_version } = nodeInfo;
        const { isSupportedVersion } = VersionUtils;
        if (apiVersion) {
            return (
                isSupportedVersion(version, supportedVersion) &&
                isSupportedVersion(api_version, apiVersion)
            );
        }
        return isSupportedVersion(version, supportedVersion);
    };

    wsReq = (route: string, method: string, data?: any) => {
        const {
            host,
            lndhubUrl,
            port,
            macaroonHex,
            accessToken
        } = stores.settingsStore;

        const auth = macaroonHex || accessToken;
        const headers: any = this.getHeaders(auth, true);
        const methodRoute = `${route}?method=${method}`;
        const url = this.getURL(host || lndhubUrl, port, methodRoute, true);

        return new Promise(function(resolve, reject) {
            const ws: any = new WebSocket(url, null, {
                headers
            });

            // keep pulling in responses until the socket closes
            let resp: any;

            ws.addEventListener('open', () => {
                // connection opened
                ws.send(JSON.stringify(data)); // send a message
            });

            ws.addEventListener('message', (e: any) => {
                // a message was received
                const data = JSON.parse(e.data);
                if (data.error) {
                    reject(data.error);
                } else {
                    resp = e.data;
                }
            });

            ws.addEventListener('error', (e: any) => {
                // an error occurred
                reject(e.message);
            });

            ws.addEventListener('close', () => {
                // connection closed
                resolve(JSON.parse(resp));
            });
        });
    };

    getHeaders = (macaroonHex: string, ws?: boolean): any => {
        if (ws) {
            return {
                'Grpc-Metadata-Macaroon': macaroonHex
            };
        }
        return {
            'Grpc-Metadata-macaroon': macaroonHex
        };
    };

    getURL = (
        host: string,
        port: string | number,
        route: string,
        ws?: boolean
    ) => {
        let baseUrl = this.supportsCustomHostProtocol()
            ? `${host}${port ? ':' + port : ''}`
            : `https://${host}${port ? ':' + port : ''}`;

        if (ws) {
            baseUrl = baseUrl.replace('https', 'wss');
        }
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

        const auth = macaroonHex || accessToken;
        const headers: any = this.getHeaders(auth);
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
        this.getRequest(`/v1/payreq/${urlParams && urlParams[0]}`);
    payLightningInvoice = (data: any) =>
        this.postRequest('/v1/channels/transactions', data);
    payLightningInvoiceV2 = (data: any) =>
        this.wsReq('/v2/router/send', 'POST', data);
    closeChannel = (urlParams?: Array<string>) => {
        if (urlParams && urlParams.length === 4) {
            return this.deleteRequest(
                `/v1/channels/${urlParams && urlParams[0]}/${urlParams &&
                    urlParams[1]}?force=${urlParams &&
                    urlParams[2]}&sat_per_byte=${urlParams && urlParams[3]}`
            );
        }
        return this.deleteRequest(
            `/v1/channels/${urlParams && urlParams[0]}/${urlParams &&
                urlParams[1]}?force=${urlParams && urlParams[2]}`
        );
    };
    getNodeInfo = (urlParams?: Array<string>) =>
        this.getRequest(`/v1/graph/node/${urlParams && urlParams[0]}`);
    getFees = () => this.getRequest('/v1/fees');
    setFees = (data: any) => this.postRequest('/v1/chanpolicy', data);
    getRoutes = (urlParams?: Array<string>) =>
        this.getRequest(
            `/v1/graph/routes/${urlParams && urlParams[0]}/${urlParams &&
                urlParams[1]}`
        );

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
    supportsMPP = () => this.supports('v0.11.0');
    supportsCoinControl = () => false;
}
