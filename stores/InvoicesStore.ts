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

    resetInvoices = () => {
        this.invoices = [];
        this.invoicesCount = 0;
        this.loading = false;
    };

    @action
    public getInvoices = () => {
        this.loading = true;
        RESTUtils.getInvoices(this.settingsStore)
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    // handle success
                    const data = response.json();
                    this.invoices = data.payments || data.invoices;
                    this.invoices = this.invoices.map(
                        invoice => new Invoice(invoice)
                    );
                    this.invoices = this.invoices.slice().reverse();
                    this.invoicesCount =
                        data.last_index_offset || this.invoices.length;
                    this.loading = false;
                } else {
                    this.resetInvoices();
                }
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
        const { implementation, sslVerification } = this.settingsStore;
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
                const status = response.info().status;
                if (status == 200) {
                    // handle success
                    const data = new Invoice(response.json());
                    this.payment_request = data.getPaymentRequest;
                    this.creatingInvoice = false;

                    if (lnurl) {
                        const params = {
                            k1: lnurl.k1,
                            pr: this.payment_request
                        };
                        RNFetchBlob.config({
                            trusty: !sslVerification || true
                        })
                            .fetch(
                                'get',
                                lnurl.callback,
                                null,
                                JSON.stringify(params)
                            )
                            .then((response: any) => {
                                const status = response.info().status;
                                if (status == 200) {
                                    const data = response.json();
                                    if (data.status === 'ERROR') {
                                        Alert.alert(data.reason);
                                    }
                                } else {
                                    return {
                                        status: 'ERROR',
                                        reason: 'LNURL error'
                                    };
                                }
                            })
                            .catch((err: any) => ({
                                status: 'ERROR',
                                reason: err.toString()
                            }));
                    }
                } else {
                    const errorInfo = response.json().data;
                    this.creatingInvoiceError = true;
                    this.creatingInvoice = false;
                    this.error_msg = errorInfo.error.message || errorInfo.error;
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

        return RESTUtils.decodePaymentRequest(this.settingsStore, [
            paymentRequest
        ])
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    // handle success
                    this.pay_req = new Invoice(response.json());

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
                } else {
                    this.loading = false;
                    this.pay_req = null;
                    const error = response.json();
                    this.getPayReqError =
                        (error.data && error.data.error) || error.message;
                }
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

        return RESTUtils.getRoutes(this.settingsStore, [destination, amount])
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    // handle success
                    const data = response.json();
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
                } else {
                    this.getRoutesError();
                }
            })
            .catch(() => {
                this.getRoutesError();
            });
    };
}
