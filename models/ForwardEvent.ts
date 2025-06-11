import { computed } from 'mobx';
import BaseModel from './BaseModel';
import DateTimeUtils from './../utils/DateTimeUtils';

export default class ForwardEvent extends BaseModel {
    amt_out: string;
    amt_in: string;
    chan_id_out: string;
    chan_id_in: string;
    fee: string;
    fee_msat: string;
    timestamp: string;

    // CLNRest
    created_index: string;
    in_channel: string;
    in_msat: string;
    status: string;
    received_time: string;
    in_htlc_id: string;
    out_channel: string;
    out_htlc_id: string;
    updated_index: string;
    style: string;
    out_msat: string;
    resolved_time: string;
    failcode: string;
    failreason: string;

    @computed public get getTime(): string {
        return DateTimeUtils.listFormattedDate(
            this.timestamp || this.resolved_time || 0
        );
    }

    @computed public get getDateShort(): string | Date {
        return DateTimeUtils.listFormattedDateShort(
            this.timestamp || this.resolved_time || 0
        );
    }

    @computed public get amtOut(): string | number {
        return this.amt_out || Number(this.out_msat) / 1000;
    }

    @computed public get feeSat(): string | number {
        return Number(this.fee_msat) / 1000;
    }

    @computed public get inChannelId(): string {
        return this.in_channel || this.chan_id_in;
    }

    @computed public get outChannelId(): string {
        return this.out_channel || this.chan_id_out;
    }

    @computed public get inAmt(): number {
        return Number(this.amt_in) || Number(this.in_msat) / 1000;
    }

    @computed public get outAmt(): number {
        return Number(this.amt_out) || Number(this.out_msat) / 1000;
    }
}
