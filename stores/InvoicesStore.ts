import { action, observable } from 'mobx';
import axios from 'axios';
import Invoice from './../models/Invoice';
import PaymentRequest from './../models/PaymentRequest';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';

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
        this.loading = true;
        RESTUtils.getInvoices(this.settingsStore)
            .then((response: any) => {
                // handle success
                const data = response.data;
                this.invoices = data.payments || data.invoices;
                this.invoices = this.invoices.map(invoice => new Invoice(invoice));
                this.invoices = this.invoices.reverse();
                this.invoicesCount = data.last_index_offset || this.invoices.length;
                this.loading = false;
            })
            .catch(() => {
                // handle error
                this.invoices = [];
                this.loading = false;
            });
    };

    @action
    public createInvoice = (
        memo: string,
        value: string,
        expiry: string = '3600'
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
        const { implementation } = this.settingsStore;

        this.pay_req = null;
        this.paymentRequest = paymentRequest;
        this.loading = true;

        RESTUtils.decodePaymentRequest(this.settingsStore, [paymentRequest])
            .then((response: any) => {
                // handle success
                const data = response.data;
                this.pay_req = new Invoice(data);
                this.loading = false;
                this.getPayReqError = false;
            })
            .catch((err: error) => {
                // handle error
                this.loading = false;
                this.getPayReqError = true;
                this.pay_req = null;
            });
    };
}
