import url from 'url';
import { action, observable, reaction } from 'mobx';
import BigNumber from 'bignumber.js';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Alert } from 'react-native';
import { LNURLWithdrawParams } from 'js-lnurl';
import querystring from 'querystring-es3';
import hashjs from 'hash.js';

import Invoice from '../models/Invoice';
import SettingsStore from './SettingsStore';
import LSPStore from './LSPStore';
import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import { localeString } from '../utils/LocaleUtils';
import ChannelsStore from './ChannelsStore';

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

    // lnd
    @observable loadingFeeEstimate = false;
    @observable feeEstimate: number | null;
    @observable successProbability: number | null;

    constructor(
        settingsStore: SettingsStore,
        lspStore: LSPStore,
        channelsStore: ChannelsStore
    ) {
        this.settingsStore = settingsStore;
        this.lspStore = lspStore;
        this.channelsStore = channelsStore;

        reaction(
            () => this.pay_req,
            () => {
                if (
                    this.pay_req &&
                    this.pay_req.destination &&
                    (BackendUtils.isLNDBased() ||
                        this.settingsStore.implementation === 'spark')
                ) {
                    this.getRoutes(
                        this.pay_req.destination,
                        this.pay_req.getRequestAmount
                    );
                }
            }
        );
    }

    reset = () => {
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

    resetInvoices = () => {
        this.invoices = [];
        this.invoicesCount = 0;
        this.loading = false;
    };

    @action
    public getInvoices = async () => {
        this.loading = true;
        await BackendUtils.getInvoices()
            .then((data: any) => {
                this.invoices = data.invoices;
                this.invoices = this.invoices.map(
                    (invoice) => new Invoice(invoice)
                );
                this.invoices = this.invoices.slice().reverse();
                this.invoicesCount =
                    data.last_index_offset || this.invoices.length;
                this.loading = false;
            })
            .catch(() => {
                this.resetInvoices();
            });
    };

    @action
    public createUnifiedInvoice = (
        memo: string,
        value: string,
        expiry = '3600',
        lnurl?: LNURLWithdrawParams,
        ampInvoice?: boolean,
        routeHints?: boolean,
        addressType?: string
    ) => {
        this.creatingInvoice = true;
        return this.createInvoice(
            memo,
            value,
            expiry,
            lnurl,
            ampInvoice,
            routeHints,
            true
        ).then(
            ({
                rHash,
                paymentRequest
            }: {
                rHash: string;
                paymentRequest: string;
            }) => {
                if (BackendUtils.supportsOnchainReceiving()) {
                    return this.getNewAddress(
                        addressType
                            ? { type: addressType, unified: true }
                            : { unified: true }
                    )
                        .then((onChainAddress: string) => {
                            this.onChainAddress = onChainAddress;
                            this.payment_request = paymentRequest;
                            this.loading = false;
                            this.creatingInvoice = false;
                            return { rHash, onChainAddress };
                        })
                        .catch(() => {
                            this.loading = false;
                            this.creatingInvoice = false;
                        });
                } else {
                    this.payment_request = paymentRequest;
                    this.creatingInvoice = false;
                    return { rHash };
                }
            }
        );
    };

    @action
    public createInvoice = async (
        memo: string,
        value: string,
        expiry = '3600',
        lnurl?: LNURLWithdrawParams,
        ampInvoice?: boolean,
        routeHints?: boolean,
        unified?: boolean
    ) => {
        this.payment_request = null;
        this.payment_request_amt = null;
        if (!unified) this.creatingInvoice = true;
        this.creatingInvoiceError = false;
        this.error_msg = null;

        this.lspStore.reset();

        const req: any = {
            memo,
            value,
            expiry
        };

        if (ampInvoice) req.is_amp = true;
        if (routeHints) req.private = true;

        if (
            BackendUtils.supportsLSPs() &&
            this.settingsStore.settings?.enableLSP &&
            value !== '0'
        ) {
            await this.lspStore
                .getLSPInfo()
                .then(async (result) => {
                    const info: any = result;
                    const method = info.connection_methods[0];

                    await this.channelsStore.connectPeer({
                        host: `${method.address}:${method.port}`,
                        node_pubkey_string: info.pubkey,
                        local_funding_amount: ''
                    });

                    if (value) {
                        await this.lspStore.getZeroConfFee(
                            Number(new BigNumber(value).times(1000))
                        );
                    }
                })
                .catch(() => {});

            if (new BigNumber(value).gt(this.lspStore.zeroConfFee || 0)) {
                req.value = new BigNumber(value).minus(
                    this.lspStore.zeroConfFee || 0
                );
            } else if (
                this.lspStore.zeroConfFee &&
                new BigNumber(this.lspStore.zeroConfFee).gt(1000)
            ) {
                this.error_msg = localeString(
                    'stores.InvoicesStore.lspNewChannelNeeded'
                );
            }
        }

        if (this.lspStore.error) {
            this.creatingInvoice = false;
            return;
        }

        return BackendUtils.createInvoice(req)
            .then(async (data: any) => {
                if (data.error) {
                    this.creatingInvoiceError = true;
                    if (!unified) this.creatingInvoice = false;
                    const errString =
                        data.message.toString() || data.error.toString();
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
                }
                const invoice = new Invoice(data);
                if (!unified) this.payment_request = invoice.getPaymentRequest;
                this.payment_request_amt = value;

                if (!unified) this.creatingInvoice = false;

                if (lnurl) {
                    const u = url.parse(lnurl.callback);
                    const qs = querystring.parse(u.query);
                    qs.k1 = lnurl.k1;
                    qs.pr = invoice.getPaymentRequest;
                    u.search = querystring.stringify(qs);
                    u.query = querystring.stringify(qs);

                    ReactNativeBlobUtil.fetch('get', url.format(u))
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

                const formattedRhash =
                    typeof invoice.r_hash === 'string'
                        ? invoice.r_hash.replace(/\+/g, '-').replace(/\//g, '_')
                        : Base64Utils.bytesToHexString(invoice.r_hash);

                if (
                    BackendUtils.supportsLSPs() &&
                    this.settingsStore.settings?.enableLSP &&
                    value !== '0'
                ) {
                    return await this.lspStore
                        .getZeroConfInvoice(invoice.getPaymentRequest)
                        .then((response: any) => {
                            const jit_bolt11: string = response;
                            return {
                                rHash: formattedRhash,
                                paymentRequest: jit_bolt11
                            };
                        });
                }

                return {
                    rHash: formattedRhash,
                    paymentRequest: invoice.getPaymentRequest
                };
            })
            .catch((error: any) => {
                // handle error
                this.creatingInvoiceError = true;
                this.creatingInvoice = false;
                this.error_msg =
                    error.toString() ||
                    localeString('stores.InvoicesStore.errorCreatingInvoice');
            });
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
        this.onChainAddress = null;
        return BackendUtils.getNewAddress(params)
            .then((data: any) => {
                const address =
                    data.address || data.bech32 || (data[0] && data[0].address);
                if (!params.unified) this.onChainAddress = address;
                if (!params.unified) this.creatingInvoice = false;
                return address;
            })
            .catch((error: any) => {
                // handle error
                this.error_msg =
                    error.toString() ||
                    localeString('stores.InvoicesStore.errorGeneratingAddress');
                this.creatingInvoice = false;
            });
    };

    @action
    public clearAddress = () => (this.onChainAddress = null);

    @action
    public clearPaymentRequest = () => (this.payment_request = null);

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
    public getPayReq = (
        paymentRequest: string,
        descriptionPreimage?: string
    ) => {
        this.loading = true;
        this.pay_req = null;
        this.paymentRequest = paymentRequest;
        this.feeEstimate = null;

        return BackendUtils.decodePaymentRequest([paymentRequest])
            .then((data: any) => {
                this.pay_req = new Invoice(data);

                // check description_hash if asked for
                const needed = hashjs
                    .sha256()
                    .update(descriptionPreimage)
                    .digest('hex');
                if (
                    descriptionPreimage &&
                    this.pay_req.description_hash !== needed
                ) {
                    throw new Error(
                        `wrong description_hash! got ${this.pay_req.description_hash}, needed ${needed}.`
                    );
                }

                this.getPayReqError = null;
                this.loading = false;
            })
            .catch((error: any) => {
                // handle error
                this.pay_req = null;
                this.getPayReqError = error.toString();
                this.loading = false;
            });
    };

    getRoutesError = () => {
        this.loadingFeeEstimate = false;
        this.feeEstimate = null;
        this.successProbability = null;
    };

    @action
    public getRoutes = (destination: string, amount: string | number) => {
        this.loadingFeeEstimate = true;
        this.feeEstimate = null;
        this.successProbability = null;

        return BackendUtils.getRoutes([destination, amount])
            .then((data: any) => {
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
            })
            .catch(() => {
                this.getRoutesError();
            });
    };
}
