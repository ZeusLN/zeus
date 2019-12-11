import BaseModel from './BaseModel.ts';
import { observable, computed } from 'mobx';

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
    public value: number|string;
    public blockheight: number;
    public status: string;
    public txid: string;
    public outputs: number;
    public address: string;

    @computed public get getAmount(): number|string {
        return this.value || this.amount;
    }

    @computed public get getBlockHeight(): number|string {
        const block_height = this.blockheight || this.block_height;
        return block_height.toString();
    }

    @computed public get tx(): string {
        return this.txid || this.tx_hash;
    }

    @computed public get destAddresses(): Array<string> {
        return this.dest_addresses || [this.address];
    }
}
