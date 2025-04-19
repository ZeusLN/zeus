import ReactNativeBlobUtil from 'react-native-blob-util';
import { settingsStore, nodeInfoStore } from '../stores/storeInstances';
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
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), 30000);
            });

            const fetchPromise = ReactNativeBlobUtil.config({
                trusty: !certVerification
            })
                .fetch(method, url, headers, data ? JSON.stringify(data) : data)
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
                        try {
                            const errorInfo = response.json();
                            throw new Error(
                                (errorInfo.error && errorInfo.error.message) ||
                                    errorInfo.message ||
                                    errorInfo.error
                            );
                        } catch (e) {
                            if (
                                response.data &&
                                typeof response.data === 'string'
                            ) {
                                throw new Error(response.data);
                            } else {
                                throw new Error(
                                    localeString(
                                        'backends.LND.restReq.connectionError'
                                    )
                                );
                            }
                        }
                    }
                });

            const racePromise = Promise.race([
                fetchPromise,
                timeoutPromise
            ]).catch((error) => {
                calls.delete(id);
                console.log('Request timed out for:', url);
                throw error;
            });

            calls.set(id, racePromise);
        }

        return await calls.get(id);
    };

    supports = (minVersion: string, eosVersion?: string) => {
        const { nodeInfo } = nodeInfoStore;
        const { version } = nodeInfo;
        const { isSupportedVersion } = VersionUtils;
        return isSupportedVersion(version, minVersion, eosVersion);
    };

    wsReq = (route: string, method: string, data?: any) => {
        const { host, lndhubUrl, port, macaroonHex, accessToken } =
            settingsStore;

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
        } = settingsStore;

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
    getBlockchainBalance = (data: any) =>
        this.getRequest('/v1/balance/blockchain', data);
    getLightningBalance = () => this.getRequest('/v1/balance/channels');
    sendCoins = (data: any) =>
        this.postRequest('/v1/transactions', {
            addr: data.addr,
            sat_per_vbyte: data.sat_per_vbyte,
            amount: data.amount,
            spend_unconfirmed: data.spend_unconfirmed,
            send_all: data.send_all,
            outpoints: data.outpoints
        });
    sendCustomMessage = (data: any) =>
        this.postRequest('/v1/custommessage', {
            peer: Base64Utils.hexToBase64(data.peer),
            type: data.type,
            data: Base64Utils.hexToBase64(data.data)
        });
    subscribeCustomMessages = (onResponse: any, onError: any) => {
        const route = '/v1/custommessage/subscribe';
        const method = 'GET';

        const { host, lndhubUrl, port, macaroonHex, accessToken } =
            settingsStore;

        const auth = macaroonHex || accessToken;
        const headers: any = this.getHeaders(auth, true);
        const methodRoute = `${route}?method=${method}`;
        const url = this.getURL(host || lndhubUrl, port, methodRoute, true);

        const ws: any = new WebSocket(url, null, {
            headers
        });

        ws.addEventListener('open', () => {
            // connection opened
            console.log('subscribeCustomMessages ws open');
            ws.send(JSON.stringify({}));
        });

        ws.addEventListener('message', (e: any) => {
            // a message was received
            const data = JSON.parse(e.data);
            console.log('subscribeCustomMessagews message', data);
            if (data.error) {
                onError(data.error);
            } else {
                onResponse(data);
            }
        });

        ws.addEventListener('error', (e: any) => {
            // an error occurred
            console.log('subscribeCustomMessages ws err', e);
            const certWarning = localeString('backends.LND.wsReq.warning');
            onError(e.message ? `${certWarning} (${e.message})` : certWarning);
        });

        ws.addEventListener('close', () => {
            // ws closed
            console.log('subscribeCustomMessages ws close');
        });
    };
    getNetworkInfo = () => this.getRequest('/v1/graph/info');
    getMyNodeInfo = () => this.getRequest('/v1/getinfo');
    getInvoices = (
        params: { limit?: number; reversed?: boolean } = {
            limit: 500,
            reversed: true
        }
    ) =>
        this.getRequest(
            `/v1/invoices?reversed=${
                params?.reversed !== undefined ? params.reversed : true
            }${params?.limit ? `&num_max_invoices=${params.limit}` : ''}`
        );
    createInvoice = (data: any) =>
        this.postRequest('/v1/invoices', {
            memo: data.memo,
            value_msat: data.value_msat || Number(data.value) * 1000,
            expiry: data.expiry,
            is_amp: data.is_amp,
            is_blinded: data.is_blinded,
            private: data.private,
            r_preimage: data.preimage
                ? Base64Utils.hexToBase64(data.preimage)
                : undefined,
            route_hints: data.route_hints
        });
    getPayments = (
        params: { maxPayments?: number; reversed?: boolean } = {
            maxPayments: 500,
            reversed: true
        }
    ) =>
        this.getRequest(
            `/v1/payments?include_incomplete=true${
                params?.maxPayments ? `&max_payments=${params.maxPayments}` : ''
            }&reversed=${
                params?.reversed !== undefined ? params.reversed : true
            }`
        );

    getNewAddress = (data: any) => this.getRequest('/v1/newaddress', data);
    getNewChangeAddress = (data: any) =>
        this.postRequest('/v2/wallet/address/next', data);
    openChannelSync = (data: OpenChannelRequest) => {
        let request: any = {
            private: data.privateChannel,
            scid_alias: data.scidAlias,
            local_funding_amount: data.local_funding_amount || 0,
            min_confs: data.min_confs,
            node_pubkey_string: data.node_pubkey_string,
            sat_per_vbyte: data.sat_per_vbyte,
            spend_unconfirmed: data.spend_unconfirmed
        };

        if (data.fundMax) {
            request.fund_max = true;
            delete request.local_funding_amount;
        }

        if (data.simpleTaprootChannel) {
            request.commitment_type = 'SIMPLE_TAPROOT';
        }

        if (data.utxos && data.utxos.length > 0) {
            request.outpoints = data.utxos.map((utxo: string) => {
                const [txid_str, output_index] = utxo.split(':');
                return {
                    txid_str,
                    output_index: Number(output_index)
                };
            });
        }

        return this.postRequest('/v1/channels', request);
    };
    openChannelStream = (data: OpenChannelRequest) => {
        // prepare request
        let request: any = {
            private: data.privateChannel,
            scid_alias: data.scidAlias,
            local_funding_amount: data.local_funding_amount,
            min_confs: data.min_confs,
            node_pubkey_string: data.node_pubkey_string,
            sat_per_vbyte: data.sat_per_vbyte,
            spend_unconfirmed: data.spend_unconfirmed
        };

        if (data.fundMax) {
            request.fund_max = true;
        }

        if (data.simpleTaprootChannel) {
            request.commitment_type = 'SIMPLE_TAPROOT';
        }

        if (data.utxos && data.utxos.length > 0) {
            request.outpoints = data.utxos.map((utxo: string) => {
                const [txid_str, output_index] = utxo.split(':');
                return {
                    txid_str,
                    output_index: Number(output_index)
                };
            });
        }

        if (data.node_pubkey_string) {
            request.node_pubkey = Base64Utils.hexToBase64(
                data.node_pubkey_string
            );
        }

        if (data.funding_shim) {
            request.funding_shim = data.funding_shim;
            delete request.sat_per_vbyte;
        }

        // make call
        const { host, lndhubUrl, port, macaroonHex, accessToken } =
            settingsStore;

        const auth = macaroonHex || accessToken;
        const headers: any = this.getHeaders(auth, true);
        const methodRoute = '/v1/channels/stream?method=POST';
        const url = this.getURL(host || lndhubUrl, port, methodRoute, true);

        return new Promise(function (resolve, reject) {
            const ws: any = new WebSocket(url, null, {
                headers
            });

            // keep pulling in responses until the socket closes
            let resp: any;

            ws.addEventListener('open', () => {
                // connection opened
                ws.send(JSON.stringify(request)); // send a message
            });

            ws.addEventListener('message', (e: any) => {
                // a message was received
                const data = JSON.parse(e.data);
                if (data?.result?.psbt_fund) {
                    resolve(data);
                } else if (data.error) {
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
    connectPeer = (data: any) => this.postRequest('/v1/peers', data);
    decodePaymentRequest = (urlParams?: Array<string>) =>
        this.getRequest(`/v1/payreq/${urlParams && urlParams[0]}`);
    payLightningInvoice = async (data: any) => {
        if (data.pubkey) delete data.pubkey;

        const forcedTimeout = async (time_ms: number, response: any) => {
            await new Promise((res) => setTimeout(res, time_ms));
            return response;
        };

        const call = () =>
            this.postRequest('/v2/router/send', {
                ...data,
                allow_self_payment: true
            });

        const result: any = await Promise.race([
            forcedTimeout((data.timeout_seconds + 1) * 1000, {
                payment_error: localeString(
                    'views.SendingLightning.paymentTimedOut'
                )
            }),
            call()
        ]);

        return result;
    };
    closeChannel = (urlParams?: Array<string>) => {
        let requestString = `/v1/channels/${urlParams && urlParams[0]}/${
            urlParams && urlParams[1]
        }?force=${urlParams && urlParams[2]}`;

        if (urlParams && !urlParams[2] && urlParams[3]) {
            requestString += `&sat_per_vbyte=${urlParams && urlParams[3]}`;
        }

        if (urlParams && urlParams[4]) {
            requestString += `&delivery_address=${urlParams && urlParams[4]}`;
        }

        return this.deleteRequest(requestString);
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
            max_htlc,
            base_fee_msat_inbound,
            fee_rate_inbound
        } = data;

        if (data.global) {
            return this.postRequest('/v1/chanpolicy', {
                base_fee_msat,
                fee_rate: `${Number(fee_rate) / 100}`,
                ...(this.supportInboundFees() && {
                    inboundFee: {
                        base_fee_msat: base_fee_msat_inbound,
                        fee_rate_ppm: `${Number(fee_rate_inbound) * 10000}`
                    }
                }),
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
            ...(this.supportInboundFees() && {
                inboundFee: {
                    base_fee_msat: base_fee_msat_inbound,
                    fee_rate_ppm: `${Number(fee_rate_inbound) * 10000}`
                }
            }),
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
    signPsbt = (data: any) => this.postRequest('/v2/wallet/psbt/sign', data);
    finalizePsbt = (data: any) =>
        this.postRequest('/v2/wallet/psbt/finalize', data);
    publishTransaction = (data: any) => {
        if (data.tx_hex) data.tx_hex = Base64Utils.hexToBase64(data.tx_hex);
        return this.postRequest('/v2/wallet/tx', data);
    };
    fundingStateStep = (data: any) =>
        this.postRequest('/v1/funding/step', data);
    getUTXOs = (data: any) => this.postRequest('/v2/wallet/utxos', data);
    bumpFee = (data: any) => this.postRequest('/v2/wallet/bumpfee', data);
    bumpForceCloseFee = (data: any) =>
        this.postRequest('/v2/wallet/BumpForceCloseFee', data);
    listAccounts = () => this.getRequest('/v2/wallet/accounts');
    listAddresses = () => this.getRequest('/v2/wallet/addresses');
    importAccount = (data: any) =>
        this.postRequest('/v2/wallet/accounts/import', data);
    signMessage = (message: string) =>
        this.postRequest('/v1/signmessage', {
            msg: Base64Utils.utf8ToBase64(message)
        });
    verifyMessage = (data: any) =>
        this.postRequest('/v1/verifymessage', {
            msg: Base64Utils.utf8ToBase64(data.msg),
            signature: data.signature
        });
    supportsAddressMessageSigning = () => true;
    signMessageWithAddr = async (message: string, address: string) =>
        this.postRequest('/v2/wallet/address/signmessage', {
            msg: Base64Utils.utf8ToBase64(message),
            addr: address
        });
    verifyMessageWithAddr = async (
        message: string,
        signature: string,
        address: string
    ) =>
        this.postRequest('/v2/wallet/address/verifymessage', {
            msg: Base64Utils.utf8ToBase64(message),
            signature,
            addr: address
        });
    lnurlAuth = async (r_hash: string) => {
        const signed = await this.signMessage(r_hash);
        return {
            signature: new sha256Hash()
                .update(Base64Utils.stringToUint8Array(signed.signature))
                .digest()
        };
    };
    lookupInvoice = (data: any) =>
        this.getRequest(`/v1/invoice/${data.r_hash}`);
    subscribeInvoice = (r_hash: string) =>
        this.getRequest(`/v2/invoices/subscribe/${r_hash}`);
    subscribeTransactions = () => this.getRequest('/v1/transactions/subscribe');
    initChanAcceptor = (data?: any) => {
        const { host, lndhubUrl, port, macaroonHex, accessToken } =
            settingsStore;

        const auth = macaroonHex || accessToken;
        const headers: any = this.getHeaders(auth, true);
        const url = this.getURL(
            host || lndhubUrl,
            port,
            '/v1/channels/acceptor?method=POST',
            true
        );

        const ws: any = new WebSocket(url, null, {
            headers
        });

        // keep pulling in responses until the socket closes
        let resp: any;

        const { zeroConfPeers, lspPubkey } = data;

        ws.addEventListener('open', (e: any) => {
            console.log('channel acceptor opened', e);
            ws.send(JSON.stringify({ accept: true }));
        });

        ws.addEventListener('message', (e: any) => {
            // a message was received
            const res = JSON.parse(e.data);
            if (res.error) {
                console.log('chanAcceptor err', res.error);
            } else {
                resp = JSON.parse(e.data).result;
                const requestPubkey = Base64Utils.base64ToHex(resp.node_pubkey);
                const pending_chan_id = resp.pending_chan_id;

                const isZeroConfAllowed =
                    lspPubkey === requestPubkey ||
                    (zeroConfPeers && zeroConfPeers.includes(requestPubkey));

                const acceptData = {
                    accept: !resp.wants_zero_conf || isZeroConfAllowed,
                    zero_conf: isZeroConfAllowed,
                    pending_chan_id
                };
                ws.send(JSON.stringify(acceptData)); // send a message
            }
        });

        ws.addEventListener('error', (e: any) => {
            const certWarning = localeString('backends.LND.wsReq.warning');
            // an error occurred
            console.log(
                e.message ? `${certWarning} (${e.message})` : certWarning
            );
        });

        ws.addEventListener('close', () => {
            console.log('channel acceptor close');
        });
    };

    supportsMessageSigning = () => true;
    supportsLnurlAuth = () => true;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsLightningSends = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsPendingChannels = () => true;
    supportsMPP = () => this.supports('v0.10.0');
    supportsAMP = () => this.supports('v0.13.0');
    supportsCoinControl = () => this.supports('v0.12.0');
    supportsChannelCoinControl = () => this.supports('v0.17.0');
    supportsHopPicking = () => this.supports('v0.11.0');
    supportsAccounts = () => this.supports('v0.13.0');
    supportsRouting = () => true;
    supportsNodeInfo = () => true;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => true;
    supportsTaproot = () => this.supports('v0.15.0');
    supportsBumpFee = () => true;
    supportsFlowLSP = () => true;
    supportsNetworkInfo = () => true;
    supportsSimpleTaprootChannels = () => this.supports('v0.17.0');
    supportsCustomPreimages = () => true;
    supportsSweep = () => true;
    supportsOnchainSendMax = () => this.supports('v0.18.3');
    supportsOnchainBatching = () => true;
    supportsChannelBatching = () => true;
    supportsChannelFundMax = () => true;
    supportsLSPScustomMessage = () => true;
    supportsLSPS1rest = () => true;
    supportsOffers = (): Promise<boolean> | boolean => false;
    supportsBolt11BlindedRoutes = () => this.supports('v0.18.3');
    supportsAddressesWithDerivationPaths = () => this.supports('v0.18.0');
    isLNDBased = () => true;
    supportInboundFees = () => this.supports('v0.18.0');
    supportsCashuWallet = () => false;
}
