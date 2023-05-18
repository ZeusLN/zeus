import { observable, computed } from 'mobx';

import BaseModel from './BaseModel';
import Base64Utils from './../utils/Base64Utils';
import DateTimeUtils from './../utils/DateTimeUtils';
import { localeString } from './../utils/LocaleUtils';

interface HopHint {
    fee_proportional_millionths: number;
    chan_id: string;
    fee_base_msat: number;
    cltv_expiry_delta: number;
    node_id: string;
}

interface RouteHint {
    hop_hints: Array<HopHint>;
}

export default class Invoice extends BaseModel {
    public route_hints: Array<RouteHint>;
    public fallback_addr: string;
    public r_hash: string;
    public settle_date: string;
    public expiry: string;
    public memo: string;
    public receipt: string;
    public settle_index: string;
    public add_index: string;
    public payment_request: string;
    public value: string;
    public settled: boolean;
    public amt_paid_msat: string;
    public amt_paid: string;
    public amt_paid_sat: string;
    public private: boolean;
    public creation_date: string;
    public description_hash: string;
    public r_preimage: string;
    public cltv_expiry: string;
    // c-lightning, eclair
    public bolt11: string;
    public label: string;
    public description: string;
    public msatoshi: number;
    public msatoshi_received: number;
    @observable public payment_hash: string;
    public paid_at: number;
    public expires_at: number;
    public status: string;
    // pay req
    public timestamp?: string | number;
    public destination?: string;
    public num_satoshis?: string | number;
    public features?: any;
    // lndhub
    public amt?: number;
    public ispaid?: boolean;
    public expire_time?: number;
    public millisatoshis?: string;
    public pay_req?: string;

    @computed public get model(): string {
        return 'Invoice';
    }

    @computed public get getRPreimage(): string {
        const preimage = this.r_preimage;
        return typeof preimage === 'string'
            ? preimage.includes('=')
                ? Base64Utils.base64ToHex(preimage)
                : preimage
            : '';
    }

    @computed public get getRHash(): string {
        const hash = this.r_hash;
        return typeof hash === 'string'
            ? hash.includes('=')
                ? Base64Utils.base64ToHex(hash)
                : hash
            : '';
    }

    @computed public get getDescriptionHash(): string {
        const hash = this.description_hash;
        return typeof hash === 'string'
            ? hash.includes('=')
                ? Base64Utils.base64ToHex(hash)
                : hash
            : '';
    }

    @computed public get getTimestamp(): string | number {
        return (
            this.paid_at ||
            this.creation_date ||
            this.timestamp ||
            this.settle_date ||
            0
        );
    }

    @computed public get getMemo(): string {
        return this.memo || this.description;
    }

    @computed public get isPaid(): boolean {
        return this.status === 'paid' || this.settled || this.ispaid || false;
    }

    @computed public get key(): string {
        return this.bolt11 || this.r_hash;
    }

    @computed public get getPaymentRequest(): string {
        return this.bolt11 || this.payment_request || this.pay_req;
    }

    // return amount in satoshis
    @computed public get getAmount(): number {
        if (this.msatoshi_received) {
            const msatoshi = this.msatoshi_received.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        if (this.msatoshi) {
            const msatoshi = this.msatoshi.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        if (this.amount_received_msat) {
            const msatoshi = this.amount_received_msat.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        return this.settled
            ? Number(this.amt_paid_sat)
            : Number(this.value) || Number(this.amt) || 0;
    }

    // return amount in satoshis
    @computed public get getRequestAmount(): number {
        if (this.msatoshi) {
            const msatoshi = this.msatoshi.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        if (this.amount_msat) {
            const msatoshi = this.amount_msat.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        if (this.millisatoshis) {
            const msatoshi = this.millisatoshis;
            return Number(msatoshi) / 1000;
        }
        return Number(this.num_satoshis || 0);
    }

    @computed public get getDisplayTime(): string {
        return this.isPaid
            ? this.settleDate
            : DateTimeUtils.listFormattedDate(
                  this.expires_at || this.creation_date || this.timestamp || 0
              );
    }

    @computed public get getDisplayTimeShort(): string {
        return this.isPaid
            ? DateTimeUtils.listFormattedDateShort(
                  this.settle_date || this.paid_at || this.timestamp || 0
              )
            : DateTimeUtils.listFormattedDateShort(
                  this.expires_at || this.creation_date || this.timestamp || 0
              );
    }

    @computed public get getDate(): string | number | Date {
        return this.isPaid
            ? this.settleDate
            : DateTimeUtils.listDate(
                  this.expires_at || this.creation_date || this.timestamp || 0
              );
    }

    @computed public get settleDate(): Date {
        return DateTimeUtils.listFormattedDate(
            this.settle_date || this.paid_at || this.timestamp || 0
        );
    }

    @computed public get creationDate(): Date {
        return DateTimeUtils.listFormattedDate(this.creation_date);
    }

    @computed public get expirationDate(): Date | string {
        if (this.expiry || this.expire_time) {
            const expiration = this.expiry || this.expire_time;
            if (expiration == '0') return localeString('models.Invoice.never');
            return `${expiration} ${localeString('models.Invoice.seconds')}`;
        }

        return this.expires_at
            ? DateTimeUtils.listFormattedDate(this.expires_at)
            : localeString('models.Invoice.never');
    }

    @computed public get isExpired(): boolean {
        if (this.expiry) {
            return (
                new Date().getTime() / 1000 >
                Number(this.creation_date) + Number(this.expiry)
            );
        }

        return false;
    }
}
