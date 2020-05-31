import { action, observable, reaction } from 'mobx';
import RNFetchBlob from 'rn-fetch-blob';
import { Alert } from 'react-native';
import { LNURLWithdrawParams } from 'js-lnurl';
import hashjs from 'hash.js';
import Invoice from './../models/Invoice';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';

export default class InvoicesStore {
    @observable paymentRequest: string;
    @observable loading: boolean = false;
    @observable error: boolean = false;
    @observable error_msg: string | null;
    @observable getPayReqError: string | null = null;
    @observable invoices: Array<Invoice> = [];
    @observable invoice: Invoice;
    @observable pay_req: Invoice | null;
    @observable payment_request: string | null;
    @observable creatingInvoice: boolean = false;
    @observable creatingInvoiceError: boolean = false;
    @observable invoicesCount: number;
    settingsStore: SettingsStore;

    // lnd
    @observable loadingFeeEstimate: boolean = false;
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
    public getInvoices = () => {
        this.loading = true;
        RESTUtils.getInvoices()
            .then((data: any) => {
                this.invoices = data.payments || data.invoices || data;
                this.invoices = this.invoices.map(
                    invoice => new Invoice(invoice)
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
        expiry: string = '3600',
        lnurl?: LNURLWithdrawParams
    ) => {
        const { sslVerification } = this.settingsStore;
        this.payment_request = null;
        this.creatingInvoice = true;
        this.creatingInvoiceError = false;
        this.error_msg = null;

        RESTUtils.createInvoice({
            memo,
            value,
            expiry
        })
            .then((data: any) => {
                const invoice = new Invoice(data);
                this.payment_request = invoice.getPaymentRequest;
                this.creatingInvoice = false;

                if (lnurl) {
                    RNFetchBlob.fetch(
                        'get',
                        `${lnurl.callback}?k1=${lnurl.k1}&pr=${this.payment_request}`
                    )
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
            })
            .catch((error: any) => {
                // handle error
                this.creatingInvoiceError = true;
                this.creatingInvoice = false;
                this.error_msg = error.toString() || 'Error creating invoice';
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
                if (
                    descriptionPreimage &&
                    this.pay_req.description_hash !==
                        hashjs
                            .sha256()
                            .update(descriptionPreimage)
                            .digest('hex')
                ) {
                    throw new Error('wrong description_hash!');
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
    public getRoutes = (destination: string, amount: string) => {
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
