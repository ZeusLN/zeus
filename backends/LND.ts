import ReactNativeBlobUtil from 'react-native-blob-util';
import stores from '../stores/Stores';
import { doTorRequest, RequestMethod } from '../utils/TorUtils';
import OpenChannelRequest from './../models/OpenChannelRequest';
import Base64Utils from './../utils/Base64Utils';
import VersionUtils from './../utils/VersionUtils';
import { localeString } from './../utils/LocaleUtils';
import { Hash as sha256Hash } from 'fast-sha256';

interface Headers {
    macaroon?: string;
    encodingtype?: string;
    'Grpc-Metadata-Macaroon'?: string;
    'Grpc-Metadata-macaroon'?: string;
}

// keep track of all active calls so we can cancel when appropriate
const calls = new Map<string, Promise<any>>();

export default class LND {
    torSocksPort?: number = undefined;

    clearCachedCalls = () => calls.clear();

    restReq = async (
        headers: Headers | any,
        url: string,
        method: any,
        data?: any,
        certVerification?: boolean,
        useTor?: boolean
    ) => {
        // use body data as an identifier too, we don't want to cancel when we
        // are making multiples calls to get all the node names, for example
        const id = data ? `${url}${JSON.stringify(data)}` : url;
        if (calls.has(id)) {
            return calls.get(id);
        }
        // API is a bit of a mess but
        // If tor enabled in setting, start up the daemon here
        if (useTor === true) {
            calls.set(
                id,
                doTorRequest(
                    url,
                    method as RequestMethod,
                    JSON.stringify(data),
                    headers
                ).then((response: any) => {
                    calls.delete(id);
                    return response;
                })
            );
        } else {
            calls.set(
                id,
                ReactNativeBlobUtil.config({
                    trusty: !certVerification
                })
                    .fetch(
                        method,
                        url,
                        headers,
                        data ? JSON.stringify(data) : data
                    )
                    .then((response: any) => {
                        calls.delete(id);
                        if (response.info().status < 300) {
                            // handle ws responses
                            if (response.data.includes('\n')) {
                                const split = response.data.split('\n');
                                const length = split.length;
                                // last instance is empty
                                return JSON.parse(split[length - 2]);
                            }
                            return response.json();
                        } else {
                            const errorInfo = response.json();
                            throw new Error(
                                (errorInfo.error && errorInfo.error.message) ||
                                    errorInfo.message ||
                                    errorInfo.error
                            );
                        }
                    })
            );
        }

        return await calls.get(id);
    };

    supports = (minVersion: string, eosVersion?: string) => {
        const { nodeInfo } = stores.nodeInfoStore;
        const { version } = nodeInfo;
        const { isSupportedVersion } = VersionUtils;
        return isSupportedVersion(version, minVersion, eosVersion);
    };

    wsReq = (route: string, method: string, data?: any) => {
        const { host, lndhubUrl, port, macaroonHex, accessToken } =
            stores.settingsStore;

        const auth = macaroonHex || accessToken;
        const headers: any = this.getHeaders(auth, true);
        const methodRoute = `${route}?method=${method}`;
        const url = this.getURL(host || lndhubUrl, port, methodRoute, true);

        return new Promise(function (resolve, reject) {
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
                const certWarning = localeString('backends.LND.wsReq.warning');
                // an error occurred
                reject(
                    e.message ? `${certWarning} (${e.message})` : certWarning
                );
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
        const hostPath = host.includes('://') ? host : `https://${host}`;
        let baseUrl = `${hostPath}${port ? ':' + port : ''}`;

        if (ws) {
            baseUrl = baseUrl.replace('https', 'wss').replace('http', 'ws');
        }

        if (baseUrl[baseUrl.length - 1] === '/') {
            baseUrl = baseUrl.slice(0, -1);
        }

        return `${baseUrl}${route}`;
    };

    request = (route: string, method: string, data?: any, params?: any) => {
        const {
            host,
            lndhubUrl,
            port,
            macaroonHex,
            accessToken,
            certVerification,
            enableTor
        } = stores.settingsStore;

        if (params) {
            route = `${route}?${Object.keys(params)
                .map((key: string) => key + '=' + params[key])
                .join('&')}`;
        }

        const auth = macaroonHex || accessToken;
        const headers: any = this.getHeaders(auth);
        headers['Content-Type'] = 'application/json';
        const url = this.getURL(host || lndhubUrl, port, route);
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

    getTransactions = (data: any) =>
        this.getRequest(
            data && data.start_height
                ? `/v1/transactions?end_height=-1&start_height=${data.start_height}`
                : '/v1/transactions?end_height=-1'
        ).then((data: any) => ({
            transactions: data.transactions
        }));
    getChannels = () => this.getRequest('/v1/channels');
    getPendingChannels = () => this.getRequest('/v1/channels/pending');
    getClosedChannels = () => this.getRequest('/v1/channels/closed');
    getChannelInfo = (chanId: string) =>
        this.getRequest(`/v1/graph/edge/${chanId}`);
    getBlockchainBalance = () => this.getRequest('/v1/balance/blockchain');
    getLightningBalance = () => this.getRequest('/v1/balance/channels');
    sendCoins = (data: any) =>
        this.postRequest('/v1/transactions', {
            addr: data.addr,
            sat_per_byte: data.sat_per_byte,
            amount: data.amount,
            spend_unconfirmed: data.spend_unconfirmed
        });
    getMyNodeInfo = () => this.getRequest('/v1/getinfo');
    getInvoices = (data: any) =>
        this.getRequest(
            `/v1/invoices?reversed=true&num_max_invoices=${
                (data && data.limit) || 500
            }`
        );
    createInvoice = (data: any) =>
        this.postRequest('/v1/invoices', {
            memo: data.memo,
            value_msat: Number(data.value) * 1000,
            expiry: data.expiry,
            is_amp: data.is_amp,
            private: data.private
        });
    getPayments = () => this.getRequest('/v1/payments');
    getNewAddress = (data: any) => this.getRequest('/v1/newaddress', data);
    openChannel = (data: OpenChannelRequest) =>
        this.postRequest('/v1/channels', {
            private: data.privateChannel,
            scid_alias: data.scidAlias,
            local_funding_amount: data.local_funding_amount,
            min_confs: data.min_confs,
            node_pubkey_string: data.node_pubkey_string,
            sat_per_byte: data.sat_per_byte,
            spend_unconfirmed: data.spend_unconfirmed
        });
    openChannelStream = (data: OpenChannelRequest) =>
        this.wsReq('/v1/channels/stream', 'POST', data);
    connectPeer = (data: any) => this.postRequest('/v1/peers', data);
    decodePaymentRequest = (urlParams?: Array<string>) =>
        this.getRequest(`/v1/payreq/${urlParams && urlParams[0]}`);
    payLightningInvoice = (data: any) => {
        if (data.pubkey) delete data.pubkey;
        return this.postRequest('/v2/router/send', {
            ...data,
            // Tor timeout is 60 seconds so make sure LND times out first
            timeout_seconds: 57,
            allow_self_payment: true
        });
    };
    closeChannel = (urlParams?: Array<string>) => {
        if (urlParams && urlParams.length === 4) {
            return this.deleteRequest(
                `/v1/channels/${urlParams && urlParams[0]}/${
                    urlParams && urlParams[1]
                }?force=${urlParams && urlParams[2]}&sat_per_byte=${
                    urlParams && urlParams[3]
                }`
            );
        }
        return this.deleteRequest(
            `/v1/channels/${urlParams && urlParams[0]}/${
                urlParams && urlParams[1]
            }?force=${urlParams && urlParams[2]}`
        );
    };
    getNodeInfo = (urlParams?: Array<string>) =>
        this.getRequest(`/v1/graph/node/${urlParams && urlParams[0]}`);
    getFees = () => this.getRequest('/v1/fees');
    setFees = (data: any) => {
        const {
            chan_point,
            base_fee_msat,
            fee_rate,
            time_lock_delta,
            min_htlc,
            max_htlc
        } = data;

        if (data.global) {
            return this.postRequest('/v1/chanpolicy', {
                base_fee_msat,
                fee_rate: `${Number(fee_rate) / 100}`,
                global: true,
                time_lock_delta: Number(time_lock_delta),
                min_htlc_msat: min_htlc ? `${Number(min_htlc) * 1000}` : null,
                max_htlc_msat: max_htlc ? `${Number(max_htlc) * 1000}` : null,
                min_htlc_msat_specified: min_htlc ? true : false
            });
        }
        return this.postRequest('/v1/chanpolicy', {
            base_fee_msat,
            fee_rate: `${Number(fee_rate) / 100}`,
            chan_point: {
                funding_txid_str: chan_point.funding_txid_str,
                output_index: chan_point.output_index
            },
            time_lock_delta: Number(time_lock_delta),
            min_htlc_msat: min_htlc ? `${Number(min_htlc) * 1000}` : null,
            max_htlc_msat: max_htlc ? `${Number(max_htlc) * 1000}` : null,
            min_htlc_msat_specified: min_htlc ? true : false
        });
    };
    getRoutes = (urlParams?: Array<string>) =>
        this.getRequest(
            `/v1/graph/routes/${urlParams && urlParams[0]}/${
                urlParams && urlParams[1]
            }`
        );
    getForwardingHistory = (hours = 24) => {
        const req = {
            num_max_events: 10000000,
            start_time: Math.round(
                new Date(Date.now() - hours * 60 * 60 * 1000).getTime() / 1000
            ).toString(),
            end_time: Math.round(new Date().getTime() / 1000).toString()
        };
        return this.postRequest('/v1/switch', req);
    };
    // Coin Control
    fundPsbt = (data: any) => this.postRequest('/v2/wallet/psbt/fund', data);
    finalizePsbt = (data: any) =>
        this.postRequest('/v2/wallet/psbt/finalize', data);
    publishTransaction = (data: any) => this.postRequest('/v2/wallet/tx', data);
    getUTXOs = () => this.getRequest('/v1/utxos?min_confs=0&max_confs=200000');
    bumpFee = (data: any) => this.postRequest('/v2/wallet/bumpfee', data);
    listAccounts = () => this.getRequest('/v2/wallet/accounts');
    importAccount = (data: any) =>
        this.postRequest('/v2/wallet/accounts/import', data);
    signMessage = (message: string) =>
        this.postRequest('/v1/signmessage', {
            msg: Base64Utils.btoa(message)
        });
    verifyMessage = (data: any) =>
        this.postRequest('/v1/verifymessage', {
            msg: Base64Utils.btoa(data.msg),
            signature: data.signature
        });
    lnurlAuth = async (r_hash: string) => {
        const signed = await this.signMessage(r_hash);
        return {
            signature: new sha256Hash()
                .update(Base64Utils.stringToUint8Array(signed.signature))
                .digest()
        };
    };
    subscribeInvoice = (r_hash: string) =>
        this.getRequest(`/v2/invoices/subscribe/${r_hash}`);
    subscribeTransactions = () => this.getRequest('/v1/transactions/subscribe');

    supportsMessageSigning = () => true;
    supportsLnurlAuth = () => true;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsPendingChannels = () => true;
    supportsMPP = () => this.supports('v0.10.0');
    supportsAMP = () => this.supports('v0.13.0');
    supportsCoinControl = () => this.supports('v0.12.0');
    supportsHopPicking = () => this.supports('v0.11.0');
    supportsAccounts = () => this.supports('v0.13.0');
    supportsRouting = () => true;
    supportsNodeInfo = () => true;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => true;
    supportsTaproot = () => this.supports('v0.15.0');
    supportsBumpFee = () => true;
    isLNDBased = () => true;
}
