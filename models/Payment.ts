import BaseModel from './BaseModel.ts';
import DateTimeUtils from './../../utils/DateTimeUtils';

export default class Payment extends BaseModel {
    payment_hash: string;
    creation_date?: string;
    value: string;
    fee?: string;
    value_sat: string;
    payment_preimage: string;
    value_msat: string;
    path: Array<string>;
    bolt: string;
    status: string;
    payment_preimage: string;
    amount_sent_msat: string;
    // c-lightning
    id?: string;
    // payment_hash: string;
    destination?: string;
    amount_msat?: string;
    msatoshi_sent?: string;
    amount_sent_msat?: string;
    created_at?: string;
    // status: string;
    // payment_preimage: string;
    bolt11?: string;

    @computed public get getCreationTime(): string {
        return DateTimeUtils.listFormattedDate(
            this.creation_date || this.creation_at
        );
    }

    @computed public get getAmount(): number | string {
        return this.value || Number(this.amount_msat) / 1000;
    }
}
