import BaseModel from './BaseModel';
import DateTimeUtils from './../utils/DateTimeUtils';
import { computed } from 'mobx';

export default class Payment extends BaseModel {
    payment_hash: string;
    creation_date?: string;
    value: string;
    // fee?: string; DEPRECATED
    fee_sat?: string;
    fee_msat?: string;
    value_sat: string;
    payment_preimage: string;
    value_msat: string;
    path: Array<string>;
    bolt: string;
    status: string;
    amount_sent_msat: string;
    // c-lightning
    id?: string;
    // payment_hash: string;
    destination?: string;
    amount_msat?: string;
    msatoshi_sent?: string;
    msatoshi?: string;
    // amount_sent_msat?: string;
    created_at?: string;
    // status: string;
    // payment_preimage: string;
    bolt11?: string;

    @computed public get getCreationTime(): string {
        return DateTimeUtils.listFormattedDate(
            this.creation_date || this.created_at || 0
        );
    }

    @computed public get getAmount(): number | string {
        return this.value || Number(this.msatoshi_sent) / 1000;
    }

    @computed public get getFee(): string {
        // lnd
        if (this.fee_sat || this.fee_msat) {
            return this.fee_sat || (Number(this.fee_msat) / 1000).toString();
        }

        // c-lightning
        const msatoshi_sent: any = this.msatoshi_sent;
        const msatoshi: any = this.msatoshi;
        const fee = Number(msatoshi_sent - msatoshi) / 1000;
        return fee.toString();
    }
}
