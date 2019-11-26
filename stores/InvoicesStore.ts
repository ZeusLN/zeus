import { action, observable } from 'mobx';
import axios from 'axios';
import Invoice from './../models/Invoice';
import PaymentRequest from './../models/PaymentRequest';
import SettingsStore from './SettingsStore';

export default class InvoicesStore {
    @observable paymentRequest: string;
    @observable loading: boolean = false;
    @observable error: boolean = false;
    @observable error_msg: string | null;
    @observable getPayReqError: boolean = false;
    @observable invoices: Array<Invoice|any> = [];
    @observable invoice: Invoice;
    @observable pay_req: PaymentRequest | null;
    @observable payment_request: string | null;
    @observable creatingInvoice: boolean = false;
    @observable creatingInvoiceError: boolean = false;
    @observable invoicesCount: number;
    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @action
    public resetPaymentReq = () => {
        this.payment_request = '';
    };

    @action
    public getInvoices = () => {
        const { host, port, macaroonHex } = this.settingsStore;

        this.loading = true;
        axios
            .request({
                method: 'get',
                url: `https://${host}${
                    port ? ':' + port : ''
                }/v1/pay/listPayments`,
                headers: {
                    'macaroon': macaroonHex,
                    'encodingtype': 'hex'
                }
            })
            .then((response: any) => {
                // handle success
                const data = response.data;
                console.log('!!');
                console.log(data);
                this.invoices = data.payments.reverse();
                this.invoicesCount = data.last_index_offset || data.payments.length;
                this.loading = false;
            })
            .catch(() => {
                // handle error
                this.invoices = [];
                this.loading = false;
            });
    };

    @action
    public getInvoice = (lightningInvoice: string) => {
        const { host, port, macaroonHex } = this.settingsStore;

        axios
            .request({
                method: 'get',
                url: `https://${host}${
                    port ? ':' + port : ''
                }/v1/invoice/${lightningInvoice}`,
                headers: {
                    'macaroon': macaroonHex,
                    'encodingtype': 'hex'
                }
            })
            .then((response: any) => {
                // handle success
                const data = response.data;
                this.invoice = data;
            });
    };

    @action
    public createInvoice = (
        memo: string,
        value: string,
        expiry: string = '3600'
    ) => {
        const { host, port, macaroonHex } = this.settingsStore;

        this.payment_request = null;
        this.creatingInvoice = true;
        this.creatingInvoiceError = false;
        this.error_msg = null;

        axios
            .request({
                method: 'post',
                url: `https://${host}${port ? ':' + port : ''}/v1/invoices`,
                headers: {
                    'macaroon': macaroonHex,
                    'encodingtype': 'hex'
                },
                data: {
                    memo,
                    value,
                    expiry
                }
            })
            .then((response: any) => {
                // handle success
                const data = response.data;
                this.payment_request = data.payment_request;
                this.creatingInvoice = false;
            })
            .catch((error: any) => {
                // handle error
                const errorInfo = error.response.data;
                this.creatingInvoiceError = true;
                this.creatingInvoice = false;
                this.error_msg = errorInfo.error;
            });
    };

    @action
    public getPayReq = (paymentRequest: string) => {
        const { host, port, macaroonHex } = this.settingsStore;

        this.pay_req = null;
        this.paymentRequest = paymentRequest;
        this.loading = true;

        axios
            .request({
                method: 'get',
                url: `https://${host}${
                    port ? ':' + port : ''
                }/v1/payreq/${paymentRequest}`,
                headers: {
                    'macaroon': macaroonHex,
                    'encodingtype': 'hex'
                }
            })
            .then((response: any) => {
                // handle success
                const data = response.data;
                this.pay_req = data;
                this.loading = false;
                this.getPayReqError = false;
            })
            .catch(() => {
                // handle error
                this.loading = false;
                this.getPayReqError = true;
                this.pay_req = null;
            });
    };
}
