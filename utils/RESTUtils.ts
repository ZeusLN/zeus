import RNFetchBlob from 'rn-fetch-blob';
import stores from '../stores/Stores';
import TransactionRequest from './../models/TransactionRequest';
import Channel from './../models/Channel';
import OpenChannelRequest from './../models/OpenChannelRequest';
import CloseChannelRequest from './../models/CloseChannelRequest';
import LoginRequest from './../models/LoginRequest';
import ErrorUtils from './../utils/ErrorUtils';
import VersionUtils from './../utils/VersionUtils';

interface Headers {
    macaroon?: string;
    encodingtype?: string;
    'Grpc-Metadata-macaroon'?: string;
}

export const DEFAULT_LNDHUB = 'https://lndhub.herokuapp.com';

// keep track of all active calls so we can cancel when appropriate
const calls: any = {};

class LND {
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

    supports = (supportedVersion: string) => {
        const { nodeInfo } = stores.nodeInfoStore;
        const { version } = nodeInfo;
        return VersionUtils.isSupportedVersion(version, supportedVersion);
    };

    wsReq = (route: string, method: string, data?: any) => {
        const {
            host,
            lndhubUrl,
            port,
            macaroonHex,
            accessToken,
            certVerification
        } = stores.settingsStore;

        const auth = macaroonHex || accessToken;
        const headers = this.getHeaders(auth, true);
        const methodRoute = `${route}?method=${method}`;
        const url = this.getURL(host || lndhubUrl, port, methodRoute, true);

        return new Promise(function(resolve, reject) {
            const ws = new WebSocket(url, null, {
                headers
                // rejectUnauthorized: certVerification
            });

            // keep pulling in responses until the socket closes
            let resp;

            ws.addEventListener('open', () => {
                // connection opened
                ws.send(JSON.stringify(data)); // send a message
            });

            ws.addEventListener('message', e => {
                // a message was received
                const data = JSON.parse(e.data);
                if (data.error) {
                    reject(data.error);
                } else {
                    resp = e.data;
                }
            });

            ws.addEventListener('error', e => {
                // an error occurred
                reject(e.message);
            });

            ws.addEventListener('close', e => {
                // connection closed
                resolve(JSON.parse(resp));
            });
        });
    };

    getHeaders = (macaroonHex: string, ws?: boolean) => {
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

    request = (route: string, method: string, data?: any, ws?: boolean) => {
        const {
            host,
            lndhubUrl,
            port,
            macaroonHex,
            accessToken,
            certVerification
        } = stores.settingsStore;

        const auth = macaroonHex || accessToken;
        const headers = this.getHeaders(auth);
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
    payLightningInvoiceV2 = (data: any) =>
        this.wsReq('/v2/router/send', 'POST', data);
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
    supportsMPP = () => this.supports('v0.11.0');
}

class CLightningREST extends LND {
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

    supportsMPP = () => false;
}

class LndHub extends LND {
    getHeaders = (accessToken: string) => {
        if (accessToken) {
            return {
                Authorization: `Bearer ${accessToken}`,
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            };
        }
        return {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        };
    };

    login = (data: LoginRequest) =>
        this.postRequest('/auth?type=auth', {
            login: data.login,
            password: data.password
        });

    getPayments = () => this.getRequest('/gettxs');
    getLightningBalance = () =>
        this.getRequest('/balance').then(({ BTC }) => ({
            balance: BTC.AvailableBalance
        }));
    getInvoices = () => this.getRequest('/getuserinvoices?limit=200');

    createInvoice = (data: any) =>
        this.postRequest('/addinvoice', {
            amt: data.value,
            memo: data.memo
        });
    getNewAddress = () => this.getRequest('/getbtc');
    payLightningInvoice = (data: any) =>
        this.postRequest('/payinvoice', {
            invoice: data.payment_request,
            amount: Number(data.amt && data.amt * 1000)
        });

    supportsOnchainSends = () => false;
    supportsKeysend = () => false;
    supportsChannelManagement = () => false;
    supportsCustomHostProtocol = () => true;
    supportsMPP = () => false;
}

class Spark {
    rpc = (rpcmethod, params = {}, range = null) => {
        let { url, accessKey, certVerification } = stores.settingsStore;

        const id = rpcmethod + JSON.stringify(params) + JSON.stringify(range);
        if (calls[id]) {
            return calls[id];
        }

        url = url.slice(-4) === '/rpc' ? url : url + '/rpc';

        const headers = { 'X-Access': accessKey };
        if (range) {
            headers['Range'] = `${range.unit}=${range.slice}`;
        }

        calls[id] = RNFetchBlob.config({
            trusty: !certVerification
        })
            .fetch(
                'POST',
                url,
                headers,
                JSON.stringify({ method: rpcmethod, params: params })
            )
            .then(response => {
                delete calls[id];
                const status = response.info().status;
                if (status < 300) {
                    return response.json();
                } else {
                    var errorInfo;
                    try {
                        errorInfo = response.json();
                    } catch (err) {
                        throw new Error(
                            'response was (' + status + ')' + response.text()
                        );
                    }
                    throw new Error(errorInfo.message);
                }
            });

        return calls[id];
    };

    getTransactions = () =>
        this.rpc('listfunds').then(({ outputs }) => ({
            transactions: outputs
        }));
    getChannels = () =>
        this.rpc('listpeers').then(({ peers }) => ({
            channels: peers
                .filter(peer => peer.channels.length)
                .map(peer => {
                    let channel =
                        peer.channels.find(
                            c => c.state !== 'ONCHAIN' && c.state !== 'CLOSED'
                        ) || peer.channels[0];

                    return {
                        active: peer.connected,
                        remote_pubkey: peer.id,
                        channel_point: channel.funding_txid,
                        chan_id: channel.channel_id,
                        capacity: Number(
                            channel.msatoshi_total / 1000
                        ).toString(),
                        local_balance: Number(
                            channel.msatoshi_to_us / 1000
                        ).toString(),
                        remote_balance: Number(
                            (channel.msatoshi_total - channel.msatoshi_to_us) /
                                1000
                        ).toString(),
                        total_satoshis_sent: Number(
                            channel.out_msatoshi_fulfilled / 1000
                        ).toString(),
                        total_satoshis_received: Number(
                            channel.in_msatoshi_fulfilled / 1000
                        ).toString(),
                        num_updates: (
                            channel.in_payments_offered +
                            channel.out_payments_offered
                        ).toString(),
                        csv_delay: channel.our_to_self_delay,
                        private: channel.private,
                        local_chan_reserve_sat: channel.our_channel_reserve_satoshis.toString(),
                        remote_chan_reserve_sat: channel.their_channel_reserve_satoshis.toString(),
                        close_address: channel.close_to_addr
                    };
                })
        }));
    getBlockchainBalance = () =>
        this.rpc('listfunds').then(({ outputs }) => {
            const unconf = outputs
                .filter(o => o.status !== 'confirmed')
                .reduce((acc, o) => acc + o.value, 0);
            const conf = outputs
                .filter(o => o.status === 'confirmed')
                .reduce((acc, o) => acc + o.value, 0);

            return {
                total_balance: conf + unconf,
                confirmed_balance: conf,
                unconfirmed_balance: unconf
            };
        });
    getLightningBalance = () =>
        this.rpc('listfunds').then(({ channels }) => ({
            balance: channels
                .filter(o => o.state === 'CHANNELD_NORMAL')
                .reduce((acc, o) => acc + o.channel_sat, 0),
            pending_open_balance: channels
                .filter(o => o.state === 'CHANNELD_AWAITING_LOCKIN')
                .reduce((acc, o) => acc + o.channel_sat, 0)
        }));
    sendCoins = (data: TransactionRequest) =>
        this.rpc('withdraw', {
            desination: data.addr,
            feerate: `${Number(data.sat_per_byte) * 1000}perkb`,
            satoshi: data.amount
        });
    getMyNodeInfo = () => this.rpc('getinfo');
    getInvoices = () =>
        this.rpc('listinvoices', {}, { unit: 'invoices', slice: '-100' }).then(
            ({ invoices }) => ({
                invoices: invoices.map(inv => ({
                    memo: inv.description,
                    r_preimage: inv.payment_preimage,
                    r_hash: inv.payment_hash,
                    value: parseInt(inv.msatoshi / 1000),
                    value_msat: inv.msatoshi,
                    settled: inv.status === 'paid',
                    creation_date: inv.expires_at,
                    settle_date: inv.paid_at,
                    payment_request: inv.bolt11,
                    expiry: inv.expires_at,
                    amt_paid: parseInt(inv.msatoshi_received / 1000),
                    amt_paid_sat: parseInt(inv.msatoshi_received / 1000),
                    amt_paid_msat: inv.msatoshi_received
                }))
            })
        );
    createInvoice = (data: any) =>
        this.rpc('invoice', {
            description: data.memo,
            label: 'zeus.' + parseInt(Math.random() * 1000000),
            msatoshi: Number(data.value) * 1000,
            expiry: data.expiry,
            exposeprivatechannels: true
        });
    getPayments = () =>
        this.rpc('listsendpays', {}, { unit: 'payments', slice: '-100' });
    getNewAddress = () => this.rpc('newaddr');
    openChannel = (data: OpenChannelRequest) =>
        this.rpc('fundchannel', {
            id: data.node_pubkey_string,
            amount: data.satoshis,
            feerate: `${Number(data.sat_per_byte) * 1000}perkb`,
            announce: !data.private
        });
    connectPeer = (data: any) =>
        this.rpc('connect', [data.addr.pubkey, data.addr.host]);
    listNode = () => {};
    decodePaymentRequest = (urlParams?: Array<string>) =>
        this.rpc('decodepay', [urlParams[0]]);
    payLightningInvoice = (data: any) =>
        this.rpc('pay', {
            bolt11: data.payment_request,
            msatoshi: data.amt ? Number(data.amt * 1000) : undefined
        });
    closeChannel = (urlParams?: Array<string>) =>
        this.rpc('close', [urlParams[0]]);
    getNodeInfo = (urlParams?: Array<string>) =>
        this.rpc('listnodes', [urlParams[0]]).then(({ nodes }) => {
            const node = nodes[0];
            return {
                node: node && {
                    last_update: node.last_timestamp,
                    pub_key: node.nodeid,
                    alias: node.alias,
                    color: node.color,
                    addresses: node.addresses.map(addr => ({
                        network: 'tcp',
                        addr:
                            addr.type === 'ipv6'
                                ? `[${addr.address}]:${addr.port}`
                                : `${addr.address}:${addr.port}`
                    }))
                }
            };
        });
    getFees = async () => {
        const info = await this.rpc('getinfo');

        const [listforwards, listpeers, listchannels] = await Promise.all([
            this.rpc('listforwards'),
            this.rpc('listpeers'),
            this.rpc('listchannels', { source: info.id })
        ]);

        let lastDay, lastWeek, lastMonth;
        const now = parseInt(new Date().getTime() / 1000);
        const oneDayAgo = now - 60 * 60 * 24;
        const oneWeekAgo = now - 60 * 60 * 24 * 7;
        const oneMonthAgo = now - 60 * 60 * 24 * 30;
        for (let i = listforwards.forwards.length - 1; i >= 0; i--) {
            const forward = listforwards.forwards[i];
            if (forward.status !== 'settled') continue;
            if (forward.resolved_time > oneDayAgo) {
                lastDay += forward.fee;
                lastWeek += forward.fee;
                lastMonth += forward.fee;
            } else if (forward.resolved_time > oneWeekAgo) {
                lastWeek += forward.fee;
                lastMonth += forward.fee;
            } else if (forward.resolved_time > oneWeekAgo) {
                lastMonth += forward.fee;
            } else break;
        }

        const channels = {};
        for (let i = 0; i < listchannels.channels.length; i++) {
            const channel = listchannels.channels[i];
            channels[channel.short_channel_id] = {
                base_fee_msat: channel.base_fee_millisatoshi,
                fee_rate: channel.fee_per_millionth / 1000000
            };
        }

        return {
            channel_fees: listpeers
                .filter()
                .map(
                    ({
                        channels: [
                            { short_channel_id, channel_id, funding_txid }
                        ]
                    }) => ({
                        chan_id: channel_id,
                        channel_point: funding_txid,
                        base_fee_msat:
                            channels[short_channel_id].base_fee_milli,
                        fee_rate: channels[short_channel_id].fee_rate
                    })
                ),
            total_fee_sum: parseInt(info.msatoshi_fees_collected / 1000),
            day_fee_sum: parseInt(lastDay / 1000),
            week_fee_sum: parseInt(lastWeek / 1000),
            month_fee_sum: parseInt(lastMonth / 1000)
        };
    };
    setFees = (data: any) =>
        this.rpc('setchannelfee', {
            id: data.global ? 'all' : data.channelId,
            base: data.base_fee_msat,
            ppm: newFeeRateMiliMsat
        });
    getRoutes = async (urlParams?: Array<string>) => {
        const msatoshi = Number(urlParams[1]) * 1000;

        const res = await this.rpc('getroute', {
            id: urlParams[0],
            msatoshi,
            riskfactor: 2
        });

        const route = res.route[0];

        return {
            routes: [
                {
                    total_fees: parseInt((route[0].msatoshi - msatoshi) / 1000)
                }
            ]
        };
    };

    supportsMPP = () => false;
}

class RESTUtils {
    constructor() {
        this.spark = new Spark();
        this.clightningREST = new CLightningREST();
        this.lndHub = new LndHub();
        this.lnd = new LND();
    }

    getClass = () => {
        const { implementation } = stores.settingsStore;
        switch (implementation) {
            case 'c-lightning-REST':
                return this.clightningREST;
            case 'spark':
                return this.spark;
            case 'lndhub':
                return this.lndHub;
            default:
                return this.lnd;
        }
    };

    call = (funcName, args) => {
        const cls = this.getClass();
        return cls[funcName].apply(cls, args);
    };

    getTransactions = (...args) => this.call('getTransactions', args);
    getChannels = (...args) => this.call('getChannels', args);
    getBlockchainBalance = (...args) => this.call('getBlockchainBalance', args);
    getLightningBalance = (...args) => this.call('getLightningBalance', args);
    sendCoins = (...args) => this.call('sendCoins', args);
    getMyNodeInfo = (...args) => this.call('getMyNodeInfo', args);
    getInvoices = (...args) => this.call('getInvoices', args);
    createInvoice = (...args) => this.call('createInvoice', args);
    getPayments = (...args) => this.call('getPayments', args);
    getNewAddress = (...args) => this.call('getNewAddress', args);
    openChannel = (...args) => this.call('openChannel', args);
    connectPeer = (...args) => this.call('connectPeer', args);
    listNode = (...args) => this.call('listNode', args);
    decodePaymentRequest = (...args) => this.call('decodePaymentRequest', args);
    payLightningInvoice = (...args) => this.call('payLightningInvoice', args);
    payLightningInvoiceV2 = (...args) =>
        this.call('payLightningInvoiceV2', args);
    closeChannel = (...args) => this.call('closeChannel', args);
    getNodeInfo = (...args) => this.call('getNodeInfo', args);
    getFees = (...args) => this.call('getFees', args);
    setFees = (...args) => this.call('setFees', args);
    getRoutes = (...args) => this.call('getRoutes', args);
    // lndhub
    createAccount = (...args) => this.call('createAccount', args);
    login = (...args) => this.call('login', args);

    supportsOnchainSends = () => this.call('supportsOnchainSends');
    supportsKeysend = () => this.call('supportsKeysend');
    supportsChannelManagement = () => this.call('supportsChannelManagement');
    // let users specify http/https
    supportsCustomHostProtocol = () => this.call('supportsCustomHostProtocol');
    supportsMPP = () => this.call('supportsMPP');
}

const restUtils = new RESTUtils();
export default restUtils;
