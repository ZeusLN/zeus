import { settingsStore, nodeInfoStore } from '../stores/Stores';
import TransactionRequest from '../models/TransactionRequest';
import OpenChannelRequest from '../models/OpenChannelRequest';
import VersionUtils from '../utils/VersionUtils';
import Base64Utils from '../utils/Base64Utils';
import { Hash as sha256Hash } from 'fast-sha256';
import { v4 as uuidv4 } from 'uuid';
import BigNumber from 'bignumber.js';
import {
    getBalance,
    getChainTransactions,
    getOffchainBalance,
    listPeers,
    listClosedChannels,
    listPeerChannels
} from './CoreLightningRequestHandler';
import { localeString } from '../utils/LocaleUtils';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { doTorRequest, RequestMethod } from '../utils/TorUtils';

const calls = new Map<string, Promise<any>>();

export default class CLNRest {
    private defaultTimeout: number = 30000;
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
        useTor?: boolean,
        timeout?: number
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
                setTimeout(
                    () => reject(new Error('Request timeout')),
                    timeout || this.defaultTimeout
                );
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
                throw error;
            });

            calls.set(id, racePromise);
        }

        return await calls.get(id);
    };

    request = (
        route: string,
        method: string,
        data?: any,
        params?: any,
        timeout?: number
    ) => {
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
            enableTor,
            timeout
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

    postRequest = (route: string, data?: any, timeout?: number) =>
        this.request(route, 'post', data, null, timeout);

    getClosedChannels = async () => {
        const channels = await this.postRequest('/v1/listclosedchannels');
        return listClosedChannels(channels);
    };

    getNode = (data: any) =>
        this.postRequest('/v1/listnodes', { id: data.id }).then((res) => {
            return res;
        });
    getTransactions = async () => await getChainTransactions();
    getChannels = async () => {
        const channels = await this.postRequest('/v1/listpeerchannels');
        return await listPeerChannels(channels);
    };
    listPeers = async () => {
        const data = await this.postRequest('/v1/listpeers');
        return (await listPeers(data)).peersWithAliases;
    };
    disconnectPeer = async (pubkey: string) => {
        try {
            await this.postRequest('/v1/disconnect', {
                id: pubkey,
                force: true
            });
            return true;
        } catch (error) {
            console.error(`Error disconnecting peer ${pubkey}:`, error);
            return null;
        }
    };
    getChannelInfo = (shortChanId: string) => {
        const data = this.postRequest('/v1/listchannels', {
            short_channel_id: shortChanId
        });
        return data;
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
                    payment_hash: invoice[3],
                    amount_msat: invoice[4],
                    status: invoice[5],
                    amount_received_msat: invoice[6],
                    paid_at: invoice[7],
                    payment_preimage: invoice[8],
                    description: invoice[9],
                    expires_at: invoice[10],
                    bolt12: invoice[2]
                });
            });

            return {
                invoices: invoiceList
            };
        });
    createInvoice = (data: any) => {
        // Prefer exact value_msat from NWC when it resolves to a positive
        // integer; otherwise fall back to the sat-denominated value, and use
        // 'any' for amountless invoices. CLN rejects amount_msat: 0, so we
        // must NOT forward a 0 value_msat literal.
        //
        // Spec/correctness: an explicitly-supplied invalid value_msat (NaN,
        // negative, 0) is treated as a hard validation error rather than
        // silently falling through to data.value, so a buggy upstream
        // doesn't end up creating an unrelated-amount invoice. A defined
        // data.value still requires Number.isFinite + > 0 to be honored —
        // otherwise undefined != 0 evaluates true and Number(undefined)*1000
        // produces NaN, which CLN would reject opaquely.
        let amountMsat: number | string;
        if (data.value_msat !== undefined && data.value_msat !== null) {
            const v = Number(data.value_msat);
            if (Number.isFinite(v) && v > 0) {
                amountMsat = Math.floor(v);
            } else if (Number.isFinite(v) && v === 0) {
                // 0 means "no amount specified" → fall through to value check.
                amountMsat = NaN;
            } else {
                // NaN / negative / non-finite — hard error so a buggy
                // upstream can't end up creating an unrelated-amount invoice.
                throw new Error('Invalid value_msat for createInvoice');
            }
        } else {
            amountMsat = NaN;
        }
        if (Number.isNaN(amountMsat as number)) {
            if (data.value !== undefined && data.value !== null) {
                const v = Number(data.value);
                if (Number.isFinite(v) && v > 0) {
                    amountMsat = Math.floor(v) * 1000;
                } else if (Number.isFinite(v) && v === 0) {
                    amountMsat = 'any';
                } else {
                    throw new Error('Invalid value for createInvoice');
                }
            } else {
                amountMsat = 'any';
            }
        }

        return this.postRequest('/v1/invoice', {
            description: data.memo,
            // Use UUID v4 for invoice labels: collision-free even under many
            // concurrent NWC create_invoice calls (CLN rejects duplicate labels).
            // Format: "zeus.{uuid}" where {uuid} is a v4 UUID string.
            // BREAKING CHANGE: Previously used numeric format "zeus.{random_number}".
            // Downstream code should NOT parse label format; treat as opaque identifier.
            label: 'zeus.' + uuidv4(),
            amount_msat: amountMsat,
            expiry: Number(data.expiry_seconds),
            exposeprivatechannels: true
        });
    };

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

    getNewAddress = (data: any) => {
        let addresstype: string | undefined;

        switch (data.type) {
            case '0':
                addresstype = 'bech32';
                break;
            case '4':
                addresstype = 'p2tr';
                break;
            default:
                addresstype = undefined;
        }

        const params = addresstype ? { addresstype } : {};
        const res = this.postRequest('/v1/newaddr', params);
        return res;
    };

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
        const body: any = { id: data.addr.pubkey };
        if (host) {
            body.host = host;
            body.port = parseInt(port);
        }
        return this.postRequest('/v1/connect', body);
    };
    decodePaymentRequest = (urlParams?: Array<string>) =>
        this.postRequest('/v1/decode', {
            string: urlParams && urlParams[0]
        });

    payLightningInvoice = (data: any) => {
        const timeoutSeconds = (() => {
            const value =
                data.timeout_seconds !== undefined &&
                data.timeout_seconds !== null
                    ? Number(data.timeout_seconds)
                    : 60;
            return Number.isFinite(value) && value >= 0 ? value : 60;
        })();
        const request: any = {
            bolt11: data.payment_request,
            retry_for: timeoutSeconds
        };

        // Set fee limit: prefer fee_limit_msat (NIP-47 authoritative) over fee_limit_sat,
        // then fall back to max_fee_percent if no absolute limit provided.
        // Per CLN /v1/pay schema (doc/schemas/pay.json) the absolute-fee
        // parameter is `maxfee` (type "msat", whole number is interpreted as
        // millisatoshis). The previous parameter name `maxfeesats` is NOT a
        // valid CLN field and is rejected by the schema's
        // `additionalProperties: false`. Convert sat -> msat here, using
        // Math.floor to ensure the result is an integer (CLN schema requires it).
        if (data.fee_limit_msat !== undefined && data.fee_limit_msat !== null) {
            const v = Number(data.fee_limit_msat);
            if (Number.isFinite(v) && v >= 0) {
                request.maxfee = Math.floor(v);
            } else {
                delete request.maxfee;
            }
        } else if (
            data.fee_limit_sat !== undefined &&
            data.fee_limit_sat !== null
        ) {
            const v = Number(data.fee_limit_sat);
            if (Number.isFinite(v) && v >= 0) {
                request.maxfee = Math.floor(v * 1000);
            } else {
                delete request.maxfee;
            }
        } else if (
            data.max_fee_percent !== undefined &&
            data.max_fee_percent !== null
        ) {
            // Fallback to percentage-based fee limit if absolute limit not provided
            request.maxfeepercent = data.max_fee_percent;
        }

        // Only set amount_msat if it resolves to a positive, finite integer.
        // - When amount_msat is provided, pass it through directly without
        //   the /1000*1000 round-trip (IEEE-754 float arithmetic loses the
        //   low msat bit for odd values >= 1001 and breaks NIP-47 msat
        //   precision).
        // - Otherwise convert sat → msat, multiplying BEFORE flooring so
        //   sub-satoshi precision (e.g. 1.5 sats → 1500 msat) is preserved.
        // - Floor (not ceil) ensures amount stays ≤ requested value; CLN's
        //   `msat` schema type requires an integer value.
        // - "Any amount" invoices work when amount/amt is 0/undefined/NaN
        //   (amount_msat omitted).
        let amountMsat: number | undefined;
        if (data.amount_msat !== undefined && data.amount_msat !== null) {
            const direct = Number(data.amount_msat);
            if (Number.isFinite(direct)) amountMsat = Math.floor(direct);
        } else if (data.amt !== undefined && data.amt !== null) {
            const sats = Number(data.amt);
            if (Number.isFinite(sats)) amountMsat = Math.floor(sats * 1000);
        }
        if (amountMsat !== undefined && amountMsat > 0) {
            request.amount_msat = amountMsat;
        }

        return this.postRequest('/v1/pay', request, timeoutSeconds * 1000);
    };
    sendKeysend = (data: any) => {
        const rawAmountMsat =
            data.amount_msat !== undefined && data.amount_msat !== null
                ? Number(data.amount_msat)
                : undefined;
        const rawAmountSat =
            data.amt !== undefined && data.amt !== null
                ? Number(data.amt)
                : undefined;
        const amountMsat =
            rawAmountMsat !== undefined && Number.isFinite(rawAmountMsat)
                ? Math.floor(rawAmountMsat)
                : rawAmountSat !== undefined && Number.isFinite(rawAmountSat)
                ? Math.floor(rawAmountSat * 1000)
                : 0;
        return this.postRequest(
            '/v1/keysend',
            {
                destination: data.pubkey,
                amount_msat: amountMsat,
                maxfeepercent: data.max_fee_percent,
                retry_for: data.timeout_seconds
            },
            data.timeout_seconds * 1000
        );
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

    getForwardingHistory = (
        _hours?: number,
        _chanIdIn?: string,
        _chanIdOut?: string
    ) => {
        const data = this.postRequest('/v1/listforwards', {
            status: 'settled',
            limit: 10000000,
            index: 'created'
        });
        return data;
    };

    // BOLT 12 / Offers
    listOffers = () =>
        this.postRequest('/v1/listoffers', { active_only: true });
    createWithdrawalRequest = ({
        amount,
        description
    }: {
        amount: string;
        description: string;
    }) => {
        return this.postRequest('/v1/invoicerequest', {
            amount: Number(amount),
            description
        });
    };
    redeemWithdrawalRequest = ({
        invreq,
        label
    }: {
        invreq: string;
        label: string;
    }) => {
        return this.postRequest('/v1/sendinvoice', {
            invreq,
            label
        });
    };
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
    getRoutes = ({
        source,
        destination,
        amount_msat,
        layers,
        maxfee_msat,
        final_cltv
    }: {
        source: string;
        destination: string;
        amount_msat: number;
        layers?: string[];
        maxfee_msat?: number;
        final_cltv?: number;
    }) => {
        return this.postRequest(
            '/v1/getroutes',
            {
                source,
                destination,
                amount_msat,
                layers,
                maxfee_msat,
                final_cltv
            },
            30000
        );
    };
    askReneCreateLayer = ({ layer }: { layer: string }) => {
        return this.postRequest('/v1/askrene-create-layer', { layer }, 30000);
    };
    askReneUpdateChannel = ({
        short_channel_id_dir,
        layer,
        enabled = false
    }: {
        short_channel_id_dir: string;
        layer: string;
        enabled?: boolean;
    }) => {
        return this.postRequest(
            '/v1/askrene-update-channel',
            {
                short_channel_id_dir,
                layer,
                enabled
            },
            30000
        );
    };
    askReneRemoveLayer = ({ layer }: { layer: string }) => {
        return this.postRequest('/v1/askrene-remove-layer', { layer }, 30000);
    };
    sendPay = ({
        route,
        payment_hash,
        payment_secret,
        bolt11
    }: {
        route: any[];
        payment_hash: string;
        payment_secret?: string;
        bolt11?: string;
    }) => {
        const params: any = {
            route,
            payment_hash
        };

        if (payment_secret) {
            params.payment_secret = payment_secret;
        }

        if (bolt11) {
            params.bolt11 = bolt11;
        }

        return this.postRequest('/v1/sendpay', params, 30000);
    };
    waitSendPay = ({
        payment_hash,
        timeout
    }: {
        payment_hash: string;
        timeout?: number;
    }) => {
        const params: any = {
            payment_hash
        };

        if (timeout) {
            params.timeout = timeout;
        }

        return this.postRequest('/v1/waitsendpay', params, 120000);
    };

    supportsPeers = () => true;
    supportsMessageSigning = () => true;
    supportsMessageVerification = () => true;
    requiresVerifyPubkey = () => false;
    supportsAddressMessageSigning = () => false;
    supportsLnurlAuth = () => true;
    supportsOnchainBalance = () => true;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsLightningSends = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsCircularRebalancing = () => true;
    supportsForceClose = () => false;
    supportsPendingChannels = () => false;
    supportsClosedChannels = () => true;
    supportsMPP = () => false;
    supportsAMP = () => false;
    supportsCoinControl = () => true;
    supportsChannelCoinControl = () => true;
    supportsHopPicking = () => false;
    supportsWithdrawalRequests = () => true;
    supportsAccounts = () => false;
    supportsRouting = () => true;
    supportsNodeInfo = () => true;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => true;
    supportsNestedSegWit = () => false;
    supportsTaproot = () => true;
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
    supportsOffers = () => true;
    supportsListingOffers = () => true;
    supportsBolt12Address = () => true;
    supportsCustomFeeLimit = () => false;
    isLNDBased = () => false;
    supportsForwardingHistory = () => true;
    supportInboundFees = () => false;
    supportsDevTools = () => true;
    supportsCashuWallet = () => false;
    supportsSettingInvoiceExpiration = () => true;
    supportsNostrWalletConnectService = () => true;
}
