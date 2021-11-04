import { computed } from 'mobx';
import BaseModel from './BaseModel';
import DateTimeUtils from './../utils/DateTimeUtils';

export default class ForwardEvent extends BaseModel {
    amt_out: string;
    amt_in: string;
    chan_id_out: string;
    chan_id_in: string;
    fee: string;
    timestamp: string;

    @computed public get getTime(): string {
        return DateTimeUtils.listFormattedDate(this.timestamp || 0);
    }

    @computed public get getDateShort(): string | Date {
        return DateTimeUtils.listFormattedDateShort(this.timestamp || 0);
    }
}
