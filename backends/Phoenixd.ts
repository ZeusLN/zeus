import ReactNativeBlobUtil from 'react-native-blob-util';
import { settingsStore } from '../stores/Stores';
import {
    doTorRequest,
    isOnionHttpsUrl,
    RequestMethod
} from '../utils/TorUtils';
import Base64Utils from '../utils/Base64Utils';
import Bolt11Utils from '../utils/Bolt11Utils';
import { localeString } from '../utils/LocaleUtils';
import {
    getNodeInfo,
    getLightningBalance,
    getBlockchainBalance,
    getIncomingPayments,
    getOutgoingPayments,
    getOnchainTransactions,
    mapIncomingPayment,
    mapGeneratedInvoice,
    mapPaymentResult,
    getOffers
} from '../utils/PhoenixdRequestHandler';

// keep track of all active calls so we can cancel when appropriate
const calls = new Map<string, Promise<any>>();

const TXID_REGEX = /^[0-9a-f]{64}$/;
// phoenixd caps neither list; Zeus deliberately limits both incoming
// and outgoing history to the most recent 100 entries
const HISTORY_LIMIT = 100;

// phoenixd's 401 body; used to recognize limited-access credentials on
// transports that don't surface the HTTP status (Tor)
const UNAUTHORIZED_MSG = 'Invalid authentication';

export default class Phoenixd {
    private defaultTimeout: number = 30000;
    // null = not probed yet; resolved during getMyNodeInfo at connect
    // time, before any supports* flag that depends on it is read
    private limitedAccess: boolean | null = null;

    clearCachedCalls = () => calls.clear();

    // phoenixd POST bodies are application/x-www-form-urlencoded
    // (Ktor call.receiveParameters()), not JSON
    private formEncode = (data?: any): string =>
        data
            ? Object.keys(data)
                  .filter(
                      (key: string) =>
                          data[key] !== undefined && data[key] !== null
                  )
                  .map(
                      (key: string) =>
                          `${encodeURIComponent(key)}=${encodeURIComponent(
                              String(data[key])
                          )}`
                  )
                  .join('&')
            : '';

    restReq = async (
        headers: any,
        url: string,
        method: any,
        data?: any,
        certVerification: boolean = false,
        useTor?: boolean,
        timeout?: number
    ) => {
        const body = data !== undefined ? this.formEncode(data) : undefined;
        // use body data as an identifier too, we don't want to cancel
        // when we are making multiple distinct calls concurrently
        const id = body ? `${url}${body}` : url;
        if (calls.has(id)) {
            return calls.get(id);
        }
        // The wallet config hides the Tor toggle for phoenixd, so this
        // branch is normally unreachable. It is kept so that a node
        // config carrying enableTor from elsewhere still routes over
        // Tor rather than silently falling back to clearnet.
        if (useTor === true) {
            calls.set(
                id,
                doTorRequest(
                    url,
                    method as RequestMethod,
                    body,
                    headers,
                    // .onion-over-Tor: bypass TLS validation (the .onion
                    // address authenticates at the Tor layer). Clearnet-
                    // over-Tor: keep strict TLS because exit nodes can
                    // MITM.
                    isOnionHttpsUrl(url),
                    timeout
                )
                    .then((response: any) => {
                        calls.delete(id);
                        return response;
                    })
                    .catch((error: any) => {
                        // evict rejected requests too, otherwise every
                        // subsequent identical call gets the same cached
                        // rejection until the next reconnect clears the
                        // map
                        calls.delete(id);
                        throw error;
                    })
            );
        } else {
            let timeoutId: ReturnType<typeof setTimeout>;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(
                    () => reject(new Error('Request timeout')),
                    timeout || this.defaultTimeout
                );
            });

            const fetchPromise = ReactNativeBlobUtil.config({
                trusty: !certVerification,
                // RNBlobUtil's native default is 60s; without this a
                // payment request holding the connection open longer
                // than that dies natively no matter what the race below
                // allows
                timeout: timeout || this.defaultTimeout
            })
                .fetch(method, url, headers, body)
                .then((response: any) => {
                    calls.delete(id);
                    const status = response.info().status;
                    if (status < 300) {
                        // phoenixd answers JSON on most routes but bare
                        // text on others (getoffer, getlnaddress,
                        // sendtoaddress)
                        try {
                            return response.json();
                        } catch (e) {
                            return response.data;
                        }
                    } else {
                        // phoenixd error bodies are plain text; carry
                        // the status so callers (the limited-access
                        // probe) can distinguish auth failures
                        const error: any = new Error(
                            response.data && typeof response.data === 'string'
                                ? response.data
                                : localeString(
                                      'backends.LND.restReq.connectionError'
                                  )
                        );
                        error.status = status;
                        throw error;
                    }
                });

            const racePromise = Promise.race([fetchPromise, timeoutPromise])
                .then((result) => {
                    // don't leave the losing timer dangling
                    clearTimeout(timeoutId);
                    return result;
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    calls.delete(id);
                    throw error;
                });

            calls.set(id, racePromise);
        }

        return await calls.get(id);
    };

    // phoenixd auth is HTTP basic with an empty username; only the
    // password is checked
    getHeaders = (password: string): any => ({
        Authorization: `Basic ${Base64Utils.utf8ToBase64(`:${password}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded'
    });

    getURL = (host: string, port: string | number, route: string) => {
        // phoenixd binds plain http by default; only assume https when
        // no protocol is given and let explicit http:// through
        const hostPath = host.includes('://') ? host : `https://${host}`;
        let baseUrl = `${hostPath}${port ? ':' + port : ''}`;
        if (baseUrl[baseUrl.length - 1] === '/') {
            baseUrl = baseUrl.slice(0, -1);
        }
        return `${baseUrl}${route}`;
    };

    request = (
        route: string,
        method: string,
        data?: any,
        params?: any,
        timeout?: number
    ) => {
        const { host, port, phoenixdPassword, certVerification, enableTor } =
            settingsStore;
        if (params) {
            route = `${route}?${this.formEncode(params)}`;
        }
        const headers = this.getHeaders(phoenixdPassword || '');
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

    getRequest = (route: string, params?: any) =>
        this.request(route, 'get', undefined, params);
    postRequest = (route: string, data?: any, timeout?: number) =>
        this.request(route, 'post', data || {}, null, timeout);

    // Detect whether the configured password is phoenixd's
    // limited-access (read-only) password. An empty-bodied POST to
    // /payinvoice never reaches payment logic: authentication rejects
    // the limited password with 401 before the handler runs, while the
    // full password reaches the handler and fails with 400 for the
    // missing invoice parameter.
    private checkLimitedAccess = async (): Promise<boolean> => {
        try {
            await this.postRequest('/payinvoice');
            // an empty probe can never legitimately succeed
            return false;
        } catch (error: any) {
            return (
                error?.status === 401 ||
                (error?.message || '').includes(UNAUTHORIZED_MSG)
            );
        }
    };

    getMyNodeInfo = async () => {
        const info = await this.getRequest('/getinfo');
        // resolve access level before NodeInfoStore snapshots
        // capability flags right after this call
        this.limitedAccess = await this.checkLimitedAccess();
        return getNodeInfo(info);
    };

    getLightningBalance = () =>
        this.getRequest('/getbalance').then((data: any) =>
            getLightningBalance(data)
        );

    getBlockchainBalance = () =>
        this.getRequest('/getbalance').then((data: any) =>
            getBlockchainBalance(data)
        );

    // phoenixd manages its single channel to the ACINQ peer itself;
    // Zeus deliberately exposes no channel management. This stub exists
    // because the connect flow calls getChannels unguarded.
    getChannels = () => Promise.resolve({ channels: [] });

    getInvoices = (data?: any) =>
        this.getRequest('/payments/incoming', {
            all: true,
            limit: data?.limit || HISTORY_LIMIT
        }).then((payments: any) => getIncomingPayments(payments));

    getPayments = () =>
        this.getRequest('/payments/outgoing', {
            all: true,
            limit: HISTORY_LIMIT
        }).then((payments: any) => getOutgoingPayments(payments));

    // on-chain "transactions" are phoenixd's outgoing on-chain
    // payments: splice-outs, liquidity purchases, channel closes. They
    // carry the mining/liquidity fees paid to ACINQ.
    getTransactions = () =>
        this.getRequest('/payments/outgoing', {
            all: true,
            limit: HISTORY_LIMIT
        }).then((payments: any) => getOnchainTransactions(payments));

    createInvoice = (data: any) => {
        const params: any = {
            // phoenixd requires a description (may be empty)
            description: data.memo || ''
        };
        if (data.value && Number(data.value) !== 0) {
            params.amountSat = Number(data.value);
        }
        if (data.expiry_seconds) {
            params.expirySeconds = Number(data.expiry_seconds);
        }
        return this.postRequest('/createinvoice', params).then((res: any) =>
            mapGeneratedInvoice(res)
        );
    };

    lookupInvoice = (data: any) =>
        this.getRequest(`/payments/incoming/${data.r_hash}`).then(
            (payment: any) => mapIncomingPayment(payment)
        );

    // phoenixd has no decode endpoint; decode client-side like LndHub
    decodePaymentRequest = (urlParams?: Array<string>) =>
        Promise.resolve().then(() =>
            Bolt11Utils.decode((urlParams && urlParams[0]) || '')
        );

    // phoenixd blocks on /payinvoice until the payment resolves and has
    // no server-side payment deadline, so the window is purely
    // client-imposed: race against the payment-timed-out shape (rather
    // than a retryable-looking transport error) so a slow payment
    // surfaces as "may be in transit, check Activity". A retry after a
    // transport-looking error risks double-sending.
    payLightningInvoice = (data: any) => {
        const timeoutSeconds = 60;

        let timer: ReturnType<typeof setTimeout>;
        const forcedTimeout = new Promise<any>((res) => {
            timer = setTimeout(
                () =>
                    res({
                        payment_error: localeString(
                            'views.SendingLightning.paymentTimedOut'
                        )
                    }),
                (timeoutSeconds + 1) * 1000
            );
        });

        const params: any = {
            invoice: data.payment_request
        };
        if (data.amt && Number(data.amt) !== 0) {
            params.amountSat = Number(data.amt);
        }

        return Promise.race([
            forcedTimeout,
            this.postRequest(
                '/payinvoice',
                params,
                (timeoutSeconds + 5) * 1000
            ).then((res: any) => mapPaymentResult(res))
        ]).then(
            (result) => {
                clearTimeout(timer);
                return result;
            },
            (error) => {
                clearTimeout(timer);
                throw error;
            }
        );
    };

    // POST /sendtoaddress splices out from the channel. It responds
    // HTTP 200 in every case: a bare txid on success, a failure
    // description otherwise — so success is recognized by shape.
    sendCoins = (data: any) =>
        this.postRequest(
            '/sendtoaddress',
            {
                address: data.addr,
                amountSat: Number(data.amount),
                // phoenixd requires an integer sat/vB; an empty or
                // unparseable fee field would otherwise send NaN and
                // come back as an opaque 400
                feerateSatByte: Math.max(
                    1,
                    Math.round(Number(data.sat_per_vbyte)) || 1
                )
            },
            // splice negotiation can take a while
            120000
        ).then((res: any) => {
            const body = typeof res === 'string' ? res.trim() : res;
            if (typeof body === 'string' && TXID_REGEX.test(body)) {
                return { txid: body };
            }
            throw new Error(
                typeof body === 'string' ? body : JSON.stringify(body)
            );
        });

    // phoenixd derives swap-in addresses and advances to the next index
    // only once the current one has been used on-chain, so repeated
    // calls return the same address until it is paid (see
    // reusesOnchainAddress)
    getNewAddress = () =>
        this.getRequest('/getswapinaddress').then((data: any) => ({
            address: data.address
        }));

    // BOLT 12: phoenixd exposes a single static node offer; offers
    // created via /createoffer are not stored, so they cannot be listed
    // or disabled afterwards
    listOffers = () =>
        this.getRequest('/getoffer').then((offer: string) =>
            getOffers(
                typeof offer === 'string' ? offer.trim() : offer,
                localeString('views.PayCodes.nodeOffer')
            )
        );

    createOffer = ({
        description,
        label,
        singleUse
    }: {
        description?: string;
        label?: string;
        singleUse?: boolean;
    }) =>
        this.postRequest('/createoffer', {
            description
        }).then((offer: string) => ({
            bolt12: typeof offer === 'string' ? offer.trim() : offer,
            label,
            active: true,
            single_use: singleUse || false,
            used: false
        }));

    // No-op: phoenixd's node offer is derived from the seed and cannot
    // be revoked. Mirrors LdkNode by echoing the offer back inactive so
    // the PayCode view has something to render (it feeds the result
    // straight into setState).
    disableOffer = ({ offer_id }: { offer_id: string }) =>
        Promise.resolve({ offer_id, active: false });

    // POST /payoffer pays the offer atomically (fetches the invoice
    // and settles it in one call), so return the paid shape the Send
    // view recognizes rather than an invoice to route onwards
    fetchInvoiceFromOffer = async (bolt12: string, amountSatoshis: string) => {
        const timeoutSeconds = 60;
        const res = await this.postRequest(
            '/payoffer',
            {
                offer: bolt12,
                amountSat: Number(amountSatoshis)
            },
            (timeoutSeconds + 5) * 1000
        );
        const result = mapPaymentResult(res);
        if (result.payment_error) {
            throw new Error(result.payment_error);
        }
        return {
            payment_hash: result.payment_hash,
            payment_preimage: result.payment_preimage,
            status: 'SUCCEEDED'
        };
    };

    // Poll the per-hash lookup endpoint until the watched invoice is
    // paid. rHash comes from Invoice.getFormattedRhash, which passes
    // phoenixd's hex hashes through unchanged.
    watchInvoicePaid = (
        { rHash, value }: { rHash: string; value?: string | number },
        onPaid: (payload: {
            amountSat: number;
            tx?: string;
            preimage?: string;
        }) => void
    ): (() => void) => {
        const interval = setInterval(() => {
            this.lookupInvoice({ r_hash: rHash })
                .then((invoice: any) => {
                    const amountPaid = Number(invoice.amt_paid_sat || 0);
                    if (
                        invoice.settled &&
                        amountPaid >= Number(value || 0) &&
                        amountPaid !== 0
                    ) {
                        clearInterval(interval);
                        onPaid({
                            amountSat: amountPaid,
                            tx: invoice.bolt11,
                            preimage: invoice.r_preimage
                        });
                    }
                })
                .catch(() => {
                    // invoice not found or node unreachable;
                    // retry on the next tick
                });
        }, 5000);
        return () => clearInterval(interval);
    };

    // phoenixd has no per-address transaction lookup; funds sent to the
    // swap-in address show up in the swap-in balance, so watch for that
    // to grow
    watchOnchainReceived = (
        { value }: { value?: string | number },
        onReceived: (payload: { amountSat: number; txid?: string }) => void
    ): (() => void) => {
        let initialTotal: number | null = null;
        const swapInTotal = (data: any) => {
            const swapIn = data.swapIn || {};
            return (
                (swapIn.unconfirmedBalanceSat || 0) +
                (swapIn.weaklyConfirmedBalanceSat || 0) +
                (swapIn.deeplyConfirmedBalanceSat || 0)
            );
        };
        const interval = setInterval(() => {
            this.getRequest('/getbalance')
                .then((data: any) => {
                    const total = swapInTotal(data);
                    if (initialTotal === null) {
                        initialTotal = total;
                        return;
                    }
                    const received = total - initialTotal;
                    if (received > 0 && received >= Number(value || 0)) {
                        clearInterval(interval);
                        onReceived({ amountSat: received });
                    }
                })
                .catch(() => {
                    // node unreachable; retry on the next tick
                });
        }, 7000);
        return () => clearInterval(interval);
    };

    supportsPeers = () => false;
    supportsMessageSigning = () => false;
    supportsMessageVerification = () => false;
    requiresVerifyPubkey = () => false;
    supportsAddressMessageSigning = () => false;
    supportsLnurlAuth = () => false;
    supportsOnchainBalance = () => true;
    supportsOnchainSends = () => this.limitedAccess !== true;
    supportsOnchainReceiving = () => true;
    // getswapinaddress hands back the first unused derived address, so
    // it only rotates after the current one receives coins — unlike
    // backends that mint a fresh address per request
    reusesOnchainAddress = () => true;
    supportsLightningSends = () => this.limitedAccess !== true;
    supportsKeysend = () => false;
    supportsChannelManagement = () => false;
    supportsCircularRebalancing = () => false;
    supportsForceClose = () => false;
    supportsPendingChannels = () => false;
    supportsClosedChannels = () => false;
    supportsMPP = () => false;
    supportsAMP = () => false;
    supportsCoinControl = () => false;
    supportsChannelCoinControl = () => false;
    supportsHopPicking = () => false;
    supportsWithdrawalRequests = () => false;
    supportsAccounts = () => false;
    supportsRouting = () => false;
    // No Node Info screen for phoenixd. This only hides the view;
    // getMyNodeInfo itself stays, because the connect flow calls it
    // unconditionally and the wallet will not render without a version.
    supportsNodeInfo = () => false;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => false;
    supportsNestedSegWit = () => false;
    supportsTaproot = () => false;
    supportsBumpFee = () => false;
    supportsFlowLSP = () => false;
    // phoenixd is a trampoline client and keeps no channel graph, so
    // there are no network-wide stats to report
    supportsNetworkInfo = () => false;
    supportsSimpleTaprootChannels = () => false;
    supportsCustomPreimages = () => false;
    supportsSweep = () => false;
    supportsOnchainSendMax = () => false;
    supportsOnchainBatching = () => false;
    supportsChannelBatching = () => false;
    supportsChannelFundMax = () => false;
    supportsLSPScustomMessage = () => false;
    supportsLSPS1rest = () => false;
    supportsBolt11BlindedRoutes = () => false;
    supportsAddressesWithDerivationPaths = () => false;
    supportsOffers = () => true;
    supportsListingOffers = () => true;
    supportsBolt12Address = () => false;
    supportsCustomFeeLimit = () => false;
    isLNDBased = () => false;
    supportsForwardingHistory = () => false;
    supportInboundFees = () => false;
    supportsDevTools = () => false;
    supportsCashuWallet = () => false;
    supportsSettingInvoiceExpiration = () => true;
    supportsNostrWalletConnectService = () => true;
    // phoenixd's channel balance is both the lightning and the
    // on-chain-spendable balance; the wallet total must not sum them
    hasOverlappingBalances = () => true;
}
