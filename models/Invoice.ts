import BaseModel from './BaseModel';
import { observable, computed } from 'mobx';
import DateTimeUtils from './../utils/DateTimeUtils';

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
    // c-lightning
    public bolt11: string;
    public label: string;
    public description: string;
    public msatoshi: number;
    @observable public payment_hash: string;
    public paid_at: number;
    public expires_at: number;
    public status: string;
    // pay req
    public timestamp?: string | number;
    public destination?: string;
    public num_satoshis?: string | number;

    @computed public get getMemo(): string {
        return this.memo || this.description || 'No memo';
    }

    @computed public get isPaid(): boolean {
        return this.status === 'paid' || this.settled;
    }

    @computed public get key(): string {
        return this.bolt11 || this.r_hash;
    }

    @computed public get getPaymentRequest(): string {
        return this.bolt11 || this.payment_request;
    }

    // return amount in satoshis
    @computed public get getAmount(): number {
        if (this.msatoshi) {
            const msatoshi = this.msatoshi.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        return this.settled ? Number(this.amt_paid_sat) : Number(this.value);
    }

    // return amount in satoshis
    @computed public get getRequestAmount(): number {
        if (this.msatoshi) {
            const msatoshi = this.msatoshi.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        return Number(this.num_satoshis || 0);
    }

    // return amount in satoshis
    @computed public get listDate(): string {
        return this.isPaid
            ? this.settleDate
            : DateTimeUtils.listFormattedDate(
                  this.expires_at || this.creation_date
              );
    }

    @computed public get settleDate(): Date {
        return DateTimeUtils.listFormattedDate(
            this.settle_date || this.paid_at
        );
    }

    @computed public get creationDate(): Date {
        return DateTimeUtils.listFormattedDate(this.creation_date);
    }

    @computed public get expirationDate(): Date | string {
        if (this.expiry) {
            return `${this.expiry} seconds`;
        }

        return this.expires_at
            ? DateTimeUtils.listFormattedDate(this.expires_at)
            : 'Never';
    }
}
