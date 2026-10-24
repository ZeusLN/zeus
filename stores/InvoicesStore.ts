import url from 'url';
import { action, observable, reaction, runInAction } from 'mobx';
import BigNumber from 'bignumber.js';
import { Alert } from 'react-native';
import { LNURLWithdrawParams } from 'js-lnurl';
import querystring from 'querystring-es3';

import Invoice from '../models/Invoice';
import Channel from '../models/Channel';
import ChannelInfo from '../models/ChannelInfo';
import SettingsStore from './SettingsStore';
import LSPStore, { PricedZeroConfFeeQuote, ZeroConfFeeQuote } from './LSPStore';
import BackendUtils from '../utils/BackendUtils';
import { toWalletrpcAddressTypeName } from '../utils/LndUtils';
import { localeString } from '../utils/LocaleUtils';
import { errorToUserFriendly } from '../utils/ErrorUtils';
import { isLnurlCallbackAllowed } from '../utils/LnurlPayUtils';
import { fetchLnurlUrl } from '../utils/LnurlFetchUtils';
import LdkNodeInjection from '../ldknode/LdkNodeInjection';
import ChannelsStore from './ChannelsStore';
import NodeInfoStore from './NodeInfoStore';
import WithdrawalRequest from '../models/WithdrawalRequest';

// Olympus forgets a fee_id 5 to 6 minutes after quoting it. A quote older
// than this when an LNURL-withdraw fee is accepted is fetched again. The
// node invoice and the proposal still follow the acceptance, so this leaves
// them at least 2 minutes, enough for a slow Tor connection.
const LSP_FEE_QUOTE_MAX_AGE_MS = 3 * 60 * 1000;

export default class InvoicesStore {
    @observable paymentRequest: string;
    @observable loading = false;
    @observable error = false;
    @observable error_msg: string | null;
    @observable getPayReqError: string | null = null;
    @observable invoices: Array<Invoice> = [];
    @observable invoice: Invoice | null;
    @observable onChainAddress: string | null;
    @observable pay_req: Invoice | null;
    @observable withdrawal_req: WithdrawalRequest | null;
    @observable payment_request: string | null;
    @observable payment_request_amt: string | null;
    @observable creatingInvoice = false;
    @observable creatingInvoiceError = false;
    @observable invoicesCount: number;
    @observable watchedInvoicePaid = false;
    @observable watchedInvoicePaidAmt: number | string | null = null;
    settingsStore: SettingsStore;
    lspStore: LSPStore;
    channelsStore: ChannelsStore;
    nodeInfoStore: NodeInfoStore;

    // lnd
    @observable loadingFeeEstimate = false;
    @observable feeEstimate: number | null;
    @observable successProbability: number | null;

    constructor(
        settingsStore: SettingsStore,
        lspStore: LSPStore,
        channelsStore: ChannelsStore,
        nodeInfoStore: NodeInfoStore
    ) {
        this.settingsStore = settingsStore;
        this.lspStore = lspStore;
        this.channelsStore = channelsStore;
        this.nodeInfoStore = nodeInfoStore;

        reaction(
            () => this.pay_req,
            () => {
                if (
                    this.pay_req &&
                    this.pay_req.destination &&
                    BackendUtils.isLNDBased()
                ) {
                    this.getRoutes(
                        this.pay_req.destination,
                        this.pay_req.getRequestAmount
                    );
                }
                // Send probes for LDK Node to warm up the scorer
                // while the user reviews the payment request
                if (
                    this.pay_req &&
                    this.settingsStore.implementation === 'ldk-node'
                ) {
                    this.sendLdkProbes();
                }
            }
        );
    }

    @action
    public reset = () => {
        this.paymentRequest = '';
        this.onChainAddress = '';
        this.loading = false;
        this.error = false;
        this.error_msg = null;
        this.getPayReqError = null;
        this.invoices = [];
        this.invoice = null;
        this.pay_req = null;
        this.payment_request = null;
        this.creatingInvoice = false;
        this.creatingInvoiceError = false;
        this.invoicesCount = 0;
        this.loadingFeeEstimate = false;
        this.feeEstimate = null;
        this.successProbability = null;
        this.watchedInvoicePaid = false;
        this.watchedInvoicePaidAmt = null;
    };

    @action
    private resetInvoices = () => {
        this.invoices = [];
        this.invoicesCount = 0;
        this.loading = false;
    };

    @action
    public getInvoices = async () => {
        this.loading = true;
        await BackendUtils.getInvoices()
            .then((data: any) => {
                runInAction(() => {
                    this.invoices = data.invoices
                        .map((invoice: any) => new Invoice(invoice))
                        .slice()
                        .reverse();
                    this.invoicesCount =
                        data.last_index_offset || this.invoices.length;
                    this.loading = false;
                });
            })
            .catch(() => this.resetInvoices());
    };

    @action
    public redeemWithdrawalRequest = async ({
        invreq,
        label
    }: {
        invreq: string;
        label: string;
    }): Promise<WithdrawalRequest | null> => {
        this.loading = true;
        this.error = false;
        this.error_msg = null;
        try {
            let response = await BackendUtils.redeemWithdrawalRequest({
                invreq,
                label
            });
            runInAction(() => {
                this.loading = false;
                this.error = false;
                this.error_msg = null;
            });
            response = new WithdrawalRequest(response);
            return response;
        } catch (error: any) {
            let parsedError;
            try {
                parsedError = JSON.parse(error.message).message;
            } catch (parseErr) {
                parsedError = error.message;
            }
            runInAction(() => {
                this.loading = false;
                this.error = true;
                this.error_msg =
                    parsedError ||
                    localeString(
                        'stores.InvoicesStore.errorRedeemingWithdrawalRequest'
                    );
            });
            throw new Error(parsedError);
        }
    };

    @action
    public createUnifiedInvoice = ({
        memo,
        value,
        expirySeconds = '3600',
        lnurl,
        ampInvoice,
        blindedPaths,
        routeHints,
        routeHintChannels,
        addressType,
        account,
        customPreimage,
        noLsp,
        forceLsp,
        useLsp,
        skipOnchain,
        confirmLspFee
    }: {
        memo: string;
        value: string;
        expirySeconds: string;
        lnurl?: LNURLWithdrawParams;
        ampInvoice?: boolean;
        blindedPaths?: boolean;
        routeHints?: boolean;
        routeHintChannels?: Channel[];
        addressType?: string;
        account?: string;
        customPreimage?: string;
        noLsp?: boolean;
        forceLsp?: boolean;
        useLsp?: boolean;
        skipOnchain?: boolean;
        confirmLspFee?: (
            feeSats: number,
            amountSats: string
        ) => Promise<boolean>;
    }) => {
        this.creatingInvoice = true;
        return this.createInvoice({
            memo,
            value,
            expirySeconds,
            lnurl,
            ampInvoice,
            blindedPaths,
            routeHints,
            routeHintChannels,
            unified: true,
            customPreimage,
            noLsp,
            forceLsp,
            useLsp,
            confirmLspFee
        })
            .then((result) => {
                if (!result?.rHash || !result?.paymentRequest) {
                    runInAction(() => {
                        this.loading = false;
                        this.creatingInvoice = false;
                    });
                    return Promise.reject(
                        new Error(
                            localeString(
                                'stores.InvoicesStore.errorCreatingInvoice'
                            )
                        )
                    );
                }
                const { rHash, paymentRequest } = result;
                if (BackendUtils.supportsOnchainReceiving() && !skipOnchain) {
                    // ZEUS-2223: the on-chain leg must come from the
                    // requested account; falling back to the default
                    // account would silently receive into the node's own
                    // wallet instead of e.g. an imported watch-only account
                    const addressRequest: any = { unified: true };
                    if (addressType) addressRequest.type = addressType;
                    if (account && account !== 'default')
                        addressRequest.account = account;
                    return this.getNewAddress(addressRequest)
                        .then((onChainAddress: string) => {
                            runInAction(() => {
                                this.onChainAddress = onChainAddress;
                                this.payment_request = paymentRequest;
                                this.loading = false;
                                this.creatingInvoice = false;
                            });
                            return { rHash, onChainAddress };
                        })
                        .catch(() => {
                            runInAction(() => {
                                this.loading = false;
                                this.creatingInvoice = false;
                            });
                        });
                } else {
                    runInAction(() => {
                        this.payment_request = paymentRequest;
                        this.creatingInvoice = false;
                    });
                    return { rHash };
                }
            })
            .catch((error: any) => {
                runInAction(() => {
                    this.loading = false;
                });
                throw error;
            });
    };

    @action
    public createInvoice = async ({
        memo,
        value,
        expirySeconds = '3600',
        lnurl,
        ampInvoice,
        blindedPaths,
        routeHints,
        routeHintChannels,
        unified,
        customPreimage,
        noLsp,
        forceLsp,
        useLsp,
        confirmLspFee
    }: {
        memo: string;
        value: string;
        expirySeconds: string;
        lnurl?: LNURLWithdrawParams;
        ampInvoice?: boolean;
        blindedPaths?: boolean;
        routeHints?: boolean;
        routeHintChannels?: Channel[];
        unified?: boolean;
        customPreimage?: string;
        noLsp?: boolean;
        forceLsp?: boolean;
        useLsp?: boolean;
        // Asked before an LNURL-withdraw invoice priced with an LSP fee is
        // created and submitted; without it such an invoice is not created.
        confirmLspFee?: (
            feeSats: number,
            amountSats: string
        ) => Promise<boolean>;
    }) => {
        // useLsp is the caller's own decision. Receive passes it because
        // its LSP switch writes enableLSP through the settings queue, so
        // settings.enableLSP can still hold the old value when the user
        // taps Create invoice right after flipping the switch. A caller
        // that does not decide only gets the LSP where the screens show
        // the LSP switch and fee.
        const lspRequested =
            useLsp ??
            ((!!this.settingsStore.settings?.enableLSP || !!forceLsp) &&
                !this.nodeInfoStore.flowLspNotConfigured()
                    .flowLspNotConfigured);
        const lspFeeRequested =
            BackendUtils.supportsFlowLSP() &&
            lspRequested &&
            !!value &&
            value !== '0' &&
            !noLsp;

        // Only an invoice that asks for its own quote drops the answer to
        // another fee request still in flight.
        if (lspFeeRequested) {
            this.lspStore?.resetFee();
        } else {
            this.lspStore?.clearFee();
        }
        this.payment_request = null;
        this.payment_request_amt = null;
        if (!unified) this.creatingInvoice = true;
        this.creatingInvoiceError = false;
        this.error_msg = null;

        // Never fetch a withdraw callback that would reach internal
        // infrastructure or leak in cleartext (SSRF-by-callback). Refuse
        // before creating anything, so the user is not left holding an
        // invoice the service will never pay. getLnurlParams already refuses
        // these at resolve time; this covers params that arrive another way.
        if (lnurl && !isLnurlCallbackAllowed(lnurl.callback).ok) {
            this.creatingInvoice = false;
            this.creatingInvoiceError = true;
            this.error_msg = localeString('utils.lnurl.unsafeCallback');
            return;
        }

        const req: any = {
            memo,
            value,
            expiry_seconds: expirySeconds
        };

        if (ampInvoice) req.is_amp = true;
        if (blindedPaths) req.is_blinded = true;
        if (routeHints) {
            if (routeHintChannels?.length) {
                const routeHints = [];
                for (const routeHintChannel of routeHintChannels) {
                    let channelInfo =
                        this.channelsStore.chanInfo[
                            routeHintChannel.channelId!
                        ];
                    if (!channelInfo) {
                        try {
                            channelInfo = new ChannelInfo(
                                await BackendUtils.getChannelInfo(
                                    routeHintChannel.channelId
                                )
                            );
                        } catch (error: any) {
                            const error_msg = error?.toString();
                            runInAction(() => {
                                this.creatingInvoiceError = true;
                                this.creatingInvoice = false;
                                this.error_msg =
                                    error_msg ||
                                    localeString(
                                        'stores.InvoicesStore.errorCreatingInvoice'
                                    );
                            });
                            return;
                        }
                    }
                    const remotePolicy =
                        channelInfo.node1Pub ===
                        this.nodeInfoStore.nodeInfo.nodeId
                            ? channelInfo.node2Policy
                            : channelInfo.node1Policy;
                    routeHints.push({
                        hop_hints: [
                            {
                                node_id: routeHintChannel.remotePubkey,
                                chan_id:
                                    routeHintChannel.peer_scid_alias &&
                                    routeHintChannel.peer_scid_alias !== '0'
                                        ? routeHintChannel.peer_scid_alias
                                        : routeHintChannel.channelId, // must not be converted to Number as this might lead to a loss of precision
                                fee_base_msat: Number(
                                    remotePolicy?.fee_base_msat
                                ),
                                fee_proportional_millionths: Number(
                                    remotePolicy?.fee_rate_milli_msat
                                ),
                                cltv_expiry_delta: remotePolicy?.time_lock_delta
                            }
                        ]
                    });
                }
                req.route_hints = routeHints;
            } else {
                req.private = true;
            }
        }

        if (customPreimage) req.preimage = customPreimage;

        // The quote this invoice is priced with: its fee and the fee_id the
        // proposal sends. lspStore.zeroConfFee/feeId are shared with the
        // screens and can hold another request's quote by the time they
        // would be read again.
        let lspQuote: PricedZeroConfFeeQuote = {
            feeSats: 0,
            feeId: undefined
        };

        if (lspFeeRequested) {
            const info: any = this.lspStore?.info;
            const method =
                info.connection_methods && info.connection_methods[0];

            // an incomplete connection method would produce a
            // non-empty but undialable host like 'undefined:9735'
            if (method?.address && method?.port) {
                try {
                    await this.channelsStore.connectPeer(
                        {
                            host: `${method.address}:${method.port}`,
                            node_pubkey_string: info.pubkey,
                            local_funding_amount: ''
                        },
                        false,
                        true
                    );
                } catch (e) {}
            }

            // undefined when there is no usable quote: the request failed
            // (flow_error is set, also for a negative fee) or was replaced.
            // A replaced request stops without an error of its own: it was
            // replaced by a newer LSP invoice or fee preview, which reports
            // its own result, or by LSPStore.reset() on a wallet switch, and
            // the shared error fields now belong to those.
            const fetchQuote = async () => {
                let quote: ZeroConfFeeQuote;
                try {
                    quote = await this.lspStore.getZeroConfFee(
                        Number(new BigNumber(value).times(1000))
                    );
                } catch (e) {
                    return;
                }
                return {
                    feeSats: quote.feeSats || 0,
                    feeId: quote.feeId,
                    quotedAt: Date.now()
                };
            };

            let quote = await fetchQuote();

            if (quote && lnurl && quote.feeSats > 0) {
                // An LNURL-withdraw invoice is submitted to the service as
                // soon as it is wrapped, before any screen can show the fee
                // next to it, so the caller has to show the fee and get it
                // accepted first. A fee at or above the amount is added on
                // top, as for any other receive.
                while (quote) {
                    // On top, the service is asked for the amount plus the
                    // fee, which it refuses above its maxWithdrawable.
                    const total = new BigNumber(value).plus(quote.feeSats);
                    if (
                        new BigNumber(value).lte(quote.feeSats) &&
                        lnurl.maxWithdrawable != null &&
                        total.times(1000).gt(lnurl.maxWithdrawable)
                    ) {
                        const max = new BigNumber(lnurl.maxWithdrawable)
                            .div(1000)
                            .integerValue(BigNumber.ROUND_FLOOR);
                        const feeSats = quote.feeSats;
                        runInAction(() => {
                            this.lspStore.flow_error = true;
                            this.lspStore.flow_error_msg = localeString(
                                'stores.InvoicesStore.lspFeeAboveMaxWithdrawable'
                            )
                                .replace(
                                    '{fee}',
                                    new BigNumber(feeSats).toFormat()
                                )
                                .replace('{total}', total.toFormat())
                                .replace('{max}', max.toFormat());
                        });
                        quote = undefined;
                        break;
                    }
                    const accepted = confirmLspFee
                        ? await confirmLspFee(quote.feeSats, value)
                        : false;
                    if (!accepted) {
                        quote = undefined;
                        this.lspStore.resetFee();
                        break;
                    }
                    if (
                        Date.now() - quote.quotedAt <
                        LSP_FEE_QUOTE_MAX_AGE_MS
                    ) {
                        break;
                    }
                    // The user took long enough for the LSP to forget the
                    // quote. Ask again unless the new fee is the same or
                    // zero: any other lower fee can change the amount
                    // received, when it is deducted where the accepted one
                    // was added on top.
                    const acceptedFeeSats: number = quote.feeSats;
                    quote = await fetchQuote();
                    if (
                        quote?.feeSats === acceptedFeeSats ||
                        quote?.feeSats === 0
                    ) {
                        break;
                    }
                }
            }

            if (!quote) {
                runInAction(() => {
                    this.creatingInvoice = false;
                });
                return;
            }
            lspQuote = quote;

            if (new BigNumber(value).gt(lspQuote.feeSats)) {
                req.value = new BigNumber(value).minus(lspQuote.feeSats);
            }
        }

        return BackendUtils.createInvoice(req)
            .then(async (data: any) => {
                if (data.error) {
                    const data_message = data.message?.toString();
                    const data_error = data.error.toString();
                    runInAction(() => {
                        this.creatingInvoiceError = true;
                        if (!unified) this.creatingInvoice = false;
                        const errString = data_message || data_error;
                        this.error_msg =
                            errString === 'Bad arguments' &&
                            this.settingsStore.implementation === 'lndhub' &&
                            req.value === '0'
                                ? localeString(
                                      'stores.InvoicesStore.zeroAmountLndhub'
                                  )
                                : errString ||
                                  localeString(
                                      'stores.InvoicesStore.errorCreatingInvoice'
                                  );
                    });
                    return;
                }
                const invoice = new Invoice(data);

                runInAction(() => {
                    if (!unified)
                        this.payment_request = invoice.getPaymentRequest;
                    this.payment_request_amt = value;

                    if (!unified) this.creatingInvoice = false;
                });

                let jit_bolt11: string = '';
                if (lspFeeRequested) {
                    try {
                        const response = await this.lspStore.getZeroConfInvoice(
                            invoice.getPaymentRequest,
                            lspQuote
                        );
                        jit_bolt11 = response as string;
                    } catch (e: any) {
                        // The LSP rejected the proposal: hard-fail rather
                        // than falling back to the unwrapped invoice, which
                        // could dead-end without the channel it needs. Clear
                        // the fee quote so it isn't shown alongside the
                        // error the LSP flow already surfaced.
                        runInAction(() => {
                            this.lspStore.zeroConfFee = undefined;
                            this.lspStore.feeId = undefined;
                            this.payment_request = null;
                            this.payment_request_amt = null;
                            this.creatingInvoice = false;
                        });
                        return;
                    }
                }

                if (lnurl) {
                    const u = url.parse(lnurl.callback);
                    const qs = querystring.parse(u.query);
                    qs.k1 = lnurl.k1;
                    qs.pr = jit_bolt11 || invoice.getPaymentRequest;
                    u.search = querystring.stringify(qs);
                    u.query = querystring.stringify(qs);

                    fetchLnurlUrl(url.format(u))
                        .then((response: any) => {
                            try {
                                const data = response.json();
                                return data;
                            } catch (err) {
                                return {
                                    status: 'ERROR',
                                    reason: response.text()
                                };
                            }
                        })
                        .catch((err: any) => ({
                            status: 'ERROR',
                            reason: err.message
                        }))
                        .then((data: any) => {
                            if (data.status === 'ERROR') {
                                Alert.alert(
                                    `[error] ${lnurl.domain} says:`,
                                    data.reason,
                                    [
                                        {
                                            text: localeString('general.error'),
                                            onPress: () => void 0
                                        }
                                    ],
                                    { cancelable: false }
                                );
                            }
                        });
                }

                return {
                    rHash: invoice.getFormattedRhash,
                    paymentRequest: jit_bolt11
                        ? jit_bolt11
                        : invoice.getPaymentRequest
                };
            })
            .catch((error: any) => {
                const error_msg = error?.toString();
                runInAction(() => {
                    this.creatingInvoiceError = true;
                    this.creatingInvoice = false;
                    this.error_msg =
                        error_msg ||
                        localeString(
                            'stores.InvoicesStore.errorCreatingInvoice'
                        );
                });
                throw error;
            });
    };

    public isInvoicePaid = async (hash: string): Promise<boolean> => {
        try {
            const response = await BackendUtils.lookupInvoice({ r_hash: hash });
            return !!response && new Invoice(response).isPaid;
        } catch {
            // lookupInvoice throws when the hash is unknown on this backend
            return false;
        }
    };

    @action
    public fetchIncomingChannel = async (hash: string) => {
        try {
            const response = await BackendUtils.lookupInvoice({ r_hash: hash });
            const enhancedPath: any[] = [];

            if (response?.htlcs?.length) {
                response.htlcs.forEach((htlc: any) => {
                    if (htlc.state === 'SETTLED') {
                        const amount = htlc.amt_msat
                            ? Math.round(Number(htlc.amt_msat) / 1000)
                            : 0;

                        const route: any[] = [];

                        if (htlc.chan_id) {
                            const chanId = String(htlc.chan_id);

                            const channel = this.channelsStore?.channels.find(
                                (c) =>
                                    String(c.chan_id) === chanId ||
                                    String(c.channelId) === chanId ||
                                    (c.channel_point &&
                                        c.channel_point.split(':')[0] ===
                                            chanId)
                            );

                            const pubKey =
                                channel?.remotePubkey ||
                                htlc.custom_records?.['34349334']?.toString(
                                    'hex'
                                ) ||
                                localeString('general.unknown');

                            const alias =
                                (pubKey !== localeString('general.unknown') &&
                                    this.channelsStore?.nodes?.[pubKey]
                                        ?.alias) ||
                                this.channelsStore?.aliasesByChannelId?.[
                                    chanId
                                ] ||
                                (pubKey !== localeString('general.unknown') &&
                                    this.channelsStore?.aliasMap?.get(pubKey));

                            route.push({
                                pubKey,
                                chan_id: chanId,
                                node: alias || pubKey,
                                alias,
                                forwarded: amount,
                                fee: 0
                            });
                        }

                        enhancedPath.push(route);
                    }
                });
            }

            return enhancedPath;
        } catch (error) {
            console.error(error);
            return [];
        }
    };

    @action
    public setWatchedInvoicePaid = (amount?: string | number) => {
        this.watchedInvoicePaid = true;
        if (amount) this.watchedInvoicePaidAmt = amount;
    };

    @action
    public getNewAddress = (params: any) => {
        if (!params.unified) {
            this.creatingInvoice = true;
            this.error_msg = null;
        }
        // ZEUS-2223 / ZEUS-2932: imported accounts exist under a single key
        // scope, and lnd requires the request's address type to match it;
        // it never infers the scope from the account name. Honor an
        // account-derived (walletrpc) address type; omit anything else (like
        // the user's preferred type from settings, see ZEUS-2396) so lnd's
        // default applies instead of a mismatched scope.
        const { type, ...rest } = params;
        const resolvedType =
            rest.account && rest.account !== 'default'
                ? toWalletrpcAddressTypeName(type)
                : type;
        const request =
            resolvedType === undefined ? rest : { ...rest, type: resolvedType };
        this.onChainAddress = null;
        return BackendUtils.getNewAddress(request)
            .then((data: any) => {
                const address =
                    data.address ||
                    data.bech32 ||
                    data.p2tr ||
                    (data[0] && data[0].address);
                runInAction(() => {
                    if (!request.unified) this.onChainAddress = address;
                    if (!request.unified) this.creatingInvoice = false;
                });
                return address;
            })
            .catch((error: any) => {
                const error_msg = error.toString();
                runInAction(() => {
                    this.error_msg =
                        error_msg ||
                        localeString(
                            'stores.InvoicesStore.errorGeneratingAddress'
                        );
                    this.creatingInvoice = false;
                });
            });
    };

    @action
    public getNewChangeAddress = (params: any) => {
        if (!params.unified) {
            this.creatingInvoice = true;
            this.error_msg = null;
        }

        const request = { ...params, change: true };

        this.onChainAddress = null;
        return BackendUtils.getNewChangeAddress(request)
            .then((data: any) => {
                const address = data.addr;
                runInAction(() => {
                    if (!request.unified) this.onChainAddress = address;
                    if (!request.unified) this.creatingInvoice = false;
                });
                return address;
            })
            .catch((error: any) => {
                const error_msg = error?.toString();
                runInAction(() => {
                    this.error_msg =
                        error_msg ||
                        localeString(
                            'stores.InvoicesStore.errorGeneratingAddress'
                        );
                    this.creatingInvoice = false;
                });
            });
    };

    public clearAddress = () => (this.onChainAddress = null);

    private clearPaymentRequest = () => (this.payment_request = null);

    @action
    public clearPayReq = () => {
        this.pay_req = null;
        this.getPayReqError = null;
    };

    @action
    public clearUnified = () => {
        this.clearAddress();
        this.clearPaymentRequest();
        this.error_msg = null;
        this.creatingInvoiceError = false;
    };

    @action
    public getPayReq = (paymentRequest: string) => {
        this.loading = true;
        this.pay_req = null;
        this.paymentRequest = paymentRequest;
        this.feeEstimate = null;

        return BackendUtils.decodePaymentRequest([paymentRequest])
            .then((data: any) => {
                runInAction(() => {
                    // thread the original bolt11 string through: several
                    // backends' decode responses omit it, leaving the
                    // Invoice unable to compute its expiry
                    this.pay_req = new Invoice({ ...data, paymentRequest });
                    this.getPayReqError = null;
                    this.loading = false;
                });
                return;
            })
            .catch((error: Error) => {
                const error_friendly = errorToUserFriendly(error);
                runInAction(() => {
                    this.pay_req = null;
                    this.getPayReqError = error_friendly;
                    this.loading = false;
                });
            });
    };

    @action
    public getWithdrawalReq = (withdrawalReq: string) => {
        this.loading = true;
        this.withdrawal_req = null;
        this.paymentRequest = withdrawalReq;
        this.feeEstimate = null;

        return BackendUtils.decodePaymentRequest([withdrawalReq])
            .then((data: any) => {
                runInAction(() => {
                    this.withdrawal_req = new WithdrawalRequest(data);
                    this.getPayReqError = null;
                    this.loading = false;
                });
                return;
            })
            .catch((error: Error) => {
                const error_friendly = errorToUserFriendly(error);
                runInAction(() => {
                    this.withdrawal_req = null;
                    this.getPayReqError = error_friendly;
                    this.loading = false;
                });
            });
    };

    @action
    private getRoutesError = () => {
        this.loadingFeeEstimate = false;
        this.feeEstimate = null;
        this.successProbability = null;
    };

    @action
    private getRoutes = (destination: string, amount: string | number) => {
        this.loadingFeeEstimate = true;
        this.feeEstimate = null;
        this.successProbability = null;

        return BackendUtils.getRoutes([destination, amount])
            .then((data: any) => {
                runInAction(() => {
                    this.loadingFeeEstimate = false;
                    this.successProbability = data.success_prob
                        ? data.success_prob * 100
                        : 0;

                    const routes = data.routes;
                    if (routes) {
                        routes.forEach((route: any) => {
                            // expect lnd to pick the cheapest route
                            if (this.feeEstimate) {
                                if (route.total_fees < this.feeEstimate) {
                                    this.feeEstimate = route.total_fees;
                                }
                            } else {
                                this.feeEstimate = route.total_fees || 0;
                            }
                        });
                    }
                });
            })
            .catch(() => this.getRoutesError());
    };

    /**
     * Send probes along the payment path for LDK Node.
     * This warms up the probabilistic scorer so the actual
     * payment has better routing information. Fire-and-forget.
     * Only probes fixed-amount invoices — variable-amount
     * invoices can't be probed without knowing the amount.
     */
    private sendLdkProbes = async () => {
        try {
            const amount = this.pay_req?.getRequestAmount;
            if (!amount || Number(amount) <= 0) return;

            await LdkNodeInjection.bolt11.sendBolt11Probes({
                invoice: this.paymentRequest
            });
        } catch {
            // Probe failures are expected and non-fatal
        }
    };
}
