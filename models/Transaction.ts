import BaseModel from './BaseModel';
import { computed } from 'mobx';
import DateTimeUtils from './../utils/DateTimeUtils';

export default class Transaction extends BaseModel {
    public amount: number;
    public block_hash: string;
    public block_height: number;
    public dest_addresses: Array<string>;
    public num_confirmations: number;
    public time_stamp: string;
    public tx_hash: string;
    public total_fees: string;
    // c-lightning
    public value: number | string;
    public blockheight: number;
    public status: string;
    public txid: string;
    public outputs: number;
    public address: string;

    @computed public get model(): string {
        return 'Transaction';
    }

    @computed public get getTimestamp(): string {
        return this.time_stamp || 0;
    }

    @computed public get getDisplayTime(): string {
        return DateTimeUtils.listFormattedDate(this.time_stamp || 0);
    }

    @computed public get getDate(): string {
        return DateTimeUtils.listDate(this.time_stamp || 0);
    }

    @computed public get isConfirmed(): boolean {
        return this.num_confirmations > 0 || this.status === 'confirmed';
    }

    @computed public get getAmount(): number | string {
        return this.value || this.amount;
    }

    @computed public get getBlockHeight(): string | boolean {
        const block_height = this.blockheight || this.block_height;
        return block_height ? block_height.toString() : false;
    }

    @computed public get tx(): string {
        return this.txid || this.tx_hash;
    }

    @computed public get destAddresses(): Array<string> {
        return this.dest_addresses || [this.address];
    }
}
