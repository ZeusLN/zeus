import url from 'url';
import { action, observable, reaction } from 'mobx';
import RNFetchBlob from 'rn-fetch-blob';
import { Alert } from 'react-native';
import { LNURLWithdrawParams } from 'js-lnurl';
import querystring from 'querystring-es3';
import hashjs from 'hash.js';
import Invoice from './../models/Invoice';
import SettingsStore from './SettingsStore';
import Base64Utils from './../utils/Base64Utils';
import RESTUtils from './../utils/RESTUtils';

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
    settingsStore: SettingsStore;

    // lnd
    @observable loadingFeeEstimate = false;
    @observable feeEstimate: number | null;
    @observable successProbability: number | null;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;

        reaction(
            () => this.pay_req,
            () => {
                if (
                    this.pay_req &&
                    this.pay_req.destination &&
                    (this.settingsStore.implementation === 'lnd' ||
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
    };

    @action
    public resetPaymentReq = () => {
        this.payment_request = '';
    };

    resetInvoices = () => {
        this.invoices = [];
        this.invoicesCount = 0;
        this.loading = false;
    };

    @action
    public getInvoices = async () => {
        this.loading = true;
        await RESTUtils.getInvoices()
            .then((data: any) => {
                this.invoices = data.payments || data.invoices || data;
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
    public createInvoice = (
        memo: string,
        value: string,
        expiry = '3600',
        lnurl?: LNURLWithdrawParams,
        ampInvoice?: boolean,
        routeHints?: boolean
    ) => {
        this.payment_request = null;
        this.payment_request_amt = null;
        this.creatingInvoice = true;
        this.creatingInvoiceError = false;
        this.error_msg = null;

        const req: any = {
            memo,
            value,
            expiry
        };

        if (ampInvoice) req.is_amp = true;
        if (routeHints) req.private = true;

        RESTUtils.createInvoice(req)
            .then((data: any) => {
                const invoice = new Invoice(data);
                this.payment_request = invoice.getPaymentRequest;
                this.payment_request_amt = value;
                this.creatingInvoice = false;

                if (lnurl) {
                    const u = url.parse(lnurl.callback);
                    const qs = querystring.parse(u.query);
                    qs.k1 = lnurl.k1;
                    qs.pr = this.payment_request;
                    u.search = querystring.stringify(qs);
                    u.query = querystring.stringify(qs);

                    RNFetchBlob.fetch('get', url.format(u))
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
                                    [{ text: 'OK', onPress: () => void 0 }],
                                    { cancelable: false }
                                );
                            }
                        });
                }

                if (this.settingsStore.implementation === 'lnd') {
                    const formattedRhash = invoice.r_hash
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_');
                    RESTUtils.subscribeInvoice(formattedRhash)
                        // TODO: get this to catch the response properly
                        .finally((data: any) => {
                            this.watchedInvoicePaid = true;
                        });
                }
            })
            .catch((error: any) => {
                // handle error
                this.creatingInvoiceError = true;
                this.creatingInvoice = false;
                this.error_msg = error.toString() || 'Error creating invoice';
            });
    };

    @action
    public getNewAddress = () => {
        return RESTUtils.getNewAddress().then((data: any) => {
            this.onChainAddress = data.address || data[0].address;
        });
    };

    @action
    public getPayReq = (
        paymentRequest: string,
        descriptionPreimage?: string
    ) => {
        this.pay_req = null;
        this.paymentRequest = paymentRequest;
        this.loading = true;
        this.feeEstimate = null;

        return RESTUtils.decodePaymentRequest([paymentRequest])
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

                this.loading = false;
                this.getPayReqError = null;
            })
            .catch((error: any) => {
                // handle error
                this.loading = false;
                this.pay_req = null;
                this.getPayReqError = error.toString();
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

        return RESTUtils.getRoutes([destination, amount])
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
