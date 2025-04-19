import { settingsStore, nodeInfoStore } from '../stores/storeInstances';
import TransactionRequest from '../models/TransactionRequest';
import OpenChannelRequest from '../models/OpenChannelRequest';
import VersionUtils from '../utils/VersionUtils';
import Base64Utils from '../utils/Base64Utils';
import { Hash as sha256Hash } from 'fast-sha256';
import BigNumber from 'bignumber.js';
import {
    getBalance,
    getChainTransactions,
    getOffchainBalance,
    listPeers
} from './CoreLightningRequestHandler';
import { localeString } from '../utils/LocaleUtils';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { doTorRequest, RequestMethod } from '../utils/TorUtils';

const calls = new Map<string, Promise<any>>();

export default class CLNRest {
    getHeaders = (rune: string): any => {
        return {
            Rune: rune
        };
    };

    supports = (
        minVersion: string,
        eosVersion?: string,
        minApiVersion?: string
    ) => {
        const { nodeInfo } = nodeInfoStore;
        const { version, api_version } = nodeInfo;
        const { isSupportedVersion } = VersionUtils;
        if (minApiVersion) {
            return (
                isSupportedVersion(version, minVersion, eosVersion) &&
                isSupportedVersion(api_version, minApiVersion)
            );
        }
        return isSupportedVersion(version, minVersion, eosVersion);
    };

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

    request = (route: string, method: string, data?: any, params?: any) => {
        const { host, port, rune, certVerification, enableTor } = settingsStore;

        if (params) {
            route = `${route}?${Object.keys(params)
                .map((key: string) => key + '=' + params[key])
                .join('&')}`;
        }

        const headers: any = this.getHeaders(rune);
        headers['Content-Type'] = 'application/json';

        const url = this.getURL(host, port, route);

        return this.restReq(
            headers,
            url,
            method,
            data,
            certVerification,
            enableTor
        );
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

    postRequest = (route: string, data?: any) =>
        this.request(route, 'post', data);

    getNode = (data: any) =>
        this.postRequest('/v1/listnodes', { id: data.id }).then((res) => {
            return res;
        });
    getTransactions = async () => await getChainTransactions();
    getChannels = async () => {
        const channels = await this.postRequest('/v1/listpeerchannels');
        return await listPeers(channels);
    };
    getBlockchainBalance = () =>
        this.postRequest('/v1/listfunds').then((res) => {
            return getBalance(res);
        });
    getLightningBalance = () =>
        this.postRequest('/v1/listfunds').then((res) => {
            return getOffchainBalance(res);
        });
    sendCoins = (data: TransactionRequest) => {
        let request: any;
        if (data.utxos) {
            request = {
                destination: data.addr,
                feerate: `${Number(data.sat_per_vbyte) * 1000}perkb`,
                satoshi: data.amount,
                utxos: data.utxos
            };
        } else {
            request = {
                destination: data.addr,
                feerate: `${Number(data.sat_per_vbyte) * 1000}perkb`,
                satoshi: data.amount
            };
        }
        return this.postRequest('/v1/withdraw', request);
    };
    getMyNodeInfo = () => this.postRequest('/v1/getinfo');
    getInvoices = (data?: any) =>
        this.postRequest('/v1/sql', {
            query: `SELECT label, bolt11, bolt12, payment_hash, amount_msat, status, amount_received_msat, paid_at, payment_preimage, description, expires_at FROM invoices WHERE status = 'paid' ORDER BY created_index DESC LIMIT ${
                data?.limit ? data.limit : 150
            };`
        }).then((data: any) => {
            const invoiceList: any[] = [];
            data.rows.forEach((invoice: any) => {
                invoiceList.push({
                    label: invoice[0],
                    bolt11: invoice[1],
                    bolt12: invoice[2],
                    payment_hash: invoice[3],
                    amount_msat: invoice[4],
                    status: invoice[5],
                    amount_received_msat: invoice[6],
                    paid_at: invoice[7],
                    payment_preimage: invoice[8],
                    description: invoice[9],
                    expires_at: invoice[10]
                });
            });

            return {
                invoices: invoiceList
            };
        });
    createInvoice = (data: any) =>
        this.postRequest('/v1/invoice', {
            description: data.memo,
            label: 'zeus.' + Math.random() * 1000000,
            amount_msat: data.value != 0 ? Number(data.value) * 1000 : 'any',
            expiry: Number(data.expiry),
            exposeprivatechannels: true
        });

    getPayments = () =>
        this.postRequest('/v1/sql', {
            query: "select sp.payment_hash, sp.groupid, min(sp.status) as status, min(sp.destination) as destination, min(sp.created_at) as created_at, min(sp.description) as description, min(sp.bolt11) as bolt11, min(sp.bolt12) as bolt12, sum(case when sp.status = 'complete' then sp.amount_sent_msat else null end) as amount_sent_msat, sum(case when sp.status = 'complete' then sp.amount_msat else 0 end) as amount_msat, max(sp.payment_preimage) as preimage from sendpays sp group by sp.payment_hash, sp.groupid order by created_index desc limit 150"
        }).then((data: any) => {
            const paymentList: any[] = [];
            data.rows.forEach((pay: any) => {
                paymentList.push({
                    payment_hash: pay[0],
                    groupid: pay[1],
                    status: pay[2],
                    destination: pay[3],
                    created_at: pay[4],
                    description: pay[5],
                    bolt11: pay[6],
                    bolt12: pay[7],
                    amount_sent_msat: pay[8],
                    amount_msat: pay[9],
                    preimage: pay[10]
                });
            });

            return {
                payments: paymentList
            };
        });
    getNewAddress = () => this.postRequest('/v1/newaddr');
    openChannelSync = (data: OpenChannelRequest) => {
        let request: any;
        const feeRate = `${new BigNumber(data.sat_per_vbyte || 0)
            .times(1000)
            .toString()}perkb`;

        request = {
            id: data.id,
            amount: data.fundMax ? 'all' : data.satoshis,
            feerate: feeRate,
            announce: !data.privateChannel ? true : false,
            minconf: data.min_confs
        };

        if (data.utxos && data.utxos.length > 0) request.utxos = data.utxos;

        return this.postRequest('/v1/fundchannel', request);
    };
    connectPeer = (data: any) => {
        const [host, port] = data.addr.host.split(':');

        return this.postRequest('/v1/connect', {
            id: data.addr.pubkey,
            host,
            port
        });
    };
    decodePaymentRequest = (urlParams?: Array<string>) =>
        this.postRequest('/v1/decode', {
            string: urlParams && urlParams[0]
        });

    payLightningInvoice = (data: any) =>
        this.postRequest('/v1/pay', {
            bolt11: data.payment_request,
            amount_msat: Number(data.amt && data.amt * 1000),
            maxfeepercent: data.max_fee_percent,
            retry_for: data.timeout_seconds
        });
    sendKeysend = (data: any) => {
        return this.postRequest('/v1/keysend', {
            destination: data.pubkey,
            amount_msat: Number(data.amt && data.amt * 1000),
            maxfeepercent: data.max_fee_percent,
            retry_for: data.timeout_seconds
        });
    };
    closeChannel = (urlParams?: Array<string>) => {
        const request = {
            id: urlParams && urlParams[0],
            unilateraltimeout: urlParams && urlParams[1] ? 2 : 0
        };
        return this.postRequest('/v1/close', request);
    };
    getFees = () =>
        this.postRequest('/v1/getinfo').then((res: any) => ({
            total_fee_sum: res.fees_collected_msat / 1000
        }));
    setFees = (data: any) =>
        this.postRequest('/v1/setchannel', {
            id: data.global ? 'all' : data.channelId,
            feebase: data.base_fee_msat,
            feeppm: data.fee_rate
        });
    getUTXOs = () => this.postRequest('/v1/listfunds');
    signMessage = (message: string) =>
        this.postRequest('/v1/signmessage', {
            message
        });
    verifyMessage = (data: any) =>
        this.postRequest('/v1/checkmessage', {
            message: data.msg,
            zbase: data.signature
        });
    lnurlAuth = async (r_hash: string) => {
        const signed = await this.signMessage(r_hash);
        return {
            signature: new sha256Hash()
                .update(Base64Utils.stringToUint8Array(signed.signature))
                .digest()
        };
    };

    // BOLT 12 / Offers
    listOffers = () =>
        this.postRequest('/v1/listoffers', { active_only: true });
    createOffer = ({
        description,
        label,
        singleUse
    }: {
        description?: string;
        label?: string;
        singleUse?: boolean;
    }) =>
        this.postRequest('/v1/offer', {
            amount: 'any',
            description,
            label,
            single_use: singleUse || false
        });
    disableOffer = ({ offer_id }: { offer_id: string }) =>
        this.postRequest('/v1/disableoffer', { offer_id });
    fetchInvoiceFromOffer = async (bolt12: string, amountSatoshis: string) => {
        return await this.postRequest('/v1/fetchinvoice', {
            offer: bolt12,
            amount_msat: Number(amountSatoshis) * 1000,
            timeout: 60
        });
    };

    supportsAddressMessageSigning = () => false;
    supportsMessageSigning = () => true;
    supportsLnurlAuth = () => true;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsLightningSends = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsPendingChannels = () => false;
    supportsMPP = () => false;
    supportsAMP = () => false;
    supportsCoinControl = () => true;
    supportsChannelCoinControl = () => true;
    supportsHopPicking = () => false;
    supportsAccounts = () => false;
    supportsRouting = () => true;
    supportsNodeInfo = () => true;
    singleFeesEarnedTotal = () => true;
    supportsAddressTypeSelection = () => false;
    supportsTaproot = () => false;
    supportsBumpFee = () => false;
    supportsFlowLSP = () => false;
    supportsNetworkInfo = () => false;
    supportsSimpleTaprootChannels = () => false;
    supportsCustomPreimages = () => false;
    supportsSweep = () => true;
    supportsOnchainSendMax = () => true;
    supportsOnchainBatching = () => false;
    supportsChannelBatching = () => false;
    supportsChannelFundMax = () => true;
    supportsLSPScustomMessage = () => false;
    supportsLSPS1rest = () => true;
    supportsBolt11BlindedRoutes = () => false;
    supportsAddressesWithDerivationPaths = () => false;
    supportsOffers = async () => {
        const { configs } = await this.postRequest('/v1/listconfigs');

        const supportsOffers: boolean = configs['experimental-offers']
            ? true
            : false;

        return supportsOffers;
    };
    isLNDBased = () => false;
    supportInboundFees = () => false;
    supportsDevTools = () => true;
    supportsCashuWallet = () => false;
}
