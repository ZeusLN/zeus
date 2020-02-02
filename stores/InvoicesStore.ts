import { action, observable, reaction } from 'mobx';
import axios from 'axios';
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
                    this.settingsStore.implementation === 'lnd'
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

    @action
    public getInvoices = () => {
        this.loading = true;
        RESTUtils.getInvoices(this.settingsStore)
            .then((response: any) => {
                // handle success
                const data = response.data;
                this.invoices = data.payments || data.invoices;
                this.invoices = this.invoices.map(
                    invoice => new Invoice(invoice)
                );
                this.invoices = this.invoices.slice().reverse();
                this.invoicesCount =
                    data.last_index_offset || this.invoices.length;
                this.loading = false;
            })
            .catch(() => {
                // handle error
                this.invoices = [];
                this.invoicesCount = 0;
                this.loading = false;
            });
    };

    @action
    public createInvoice = (
        memo: string,
        value: string,
        expiry: string = '3600',
        lnurl?: LNURLWithdrawParams
    ) => {
        const { implementation } = this.settingsStore;
        this.payment_request = null;
        this.creatingInvoice = true;
        this.creatingInvoiceError = false;
        this.error_msg = null;

        let data;
        if (implementation === 'c-lightning-REST') {
            // amount(msats), label, description
            data = {
                description: memo,
                label: memo,
                amount: Number(value) * 1000,
                expiry,
                private: true
            };
        } else {
            data = {
                memo,
                value,
                expiry
            };
        }

        RESTUtils.createInvoice(this.settingsStore, data)
            .then((response: any) => {
                // handle success
                const data = new Invoice(response.data);
                this.payment_request = data.getPaymentRequest;
                this.creatingInvoice = false;

                if (lnurl) {
                    axios
                        .get(lnurl.callback, {
                            params: {
                                k1: lnurl.k1,
                                pr: this.payment_request
                            }
                        })
                        .catch((err: any) => ({
                            status: 'ERROR',
                            reason: err.response.data
                        }))
                        .then((response: any) => {
                            if (response.data.status === 'ERROR') {
                                Alert.alert(response.data.reason);
                            }
                        });
                }
            })
            .catch((error: any) => {
                // handle error
                const errorInfo = error.response.data;
                this.creatingInvoiceError = true;
                this.creatingInvoice = false;
                this.error_msg = errorInfo.error.message || errorInfo.error;
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

        return RESTUtils.decodePaymentRequest(this.settingsStore, [
            paymentRequest
        ])
            .then((response: any) => {
                // handle success
                this.pay_req = new Invoice(response.data);

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
                this.getPayReqError =
                    (error.response &&
                        error.response.data &&
                        error.response.data.error) ||
                    error.message;
                this.pay_req = null;
            });
    };

    @action
    public getRoutes = (destination: string, amount: string) => {
        this.loadingFeeEstimate = true;
        this.feeEstimate = null;
        this.successProbability = null;

        return RESTUtils.getRoutes(this.settingsStore, [destination, amount])
            .then((response: any) => {
                // handle success
                const data = response.data;
                this.loadingFeeEstimate = false;
                this.successProbability = data.success_prob
                    ? data.success_prob * 100
                    : 0;

                const routes = data.routes;
                if (routes) {
                    routes.forEach(route => {
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
            .catch((error: any) => {
                // handle error
                this.loadingFeeEstimate = false;
                this.feeEstimate = null;
                this.successProbability = null;
            });
    };
}
