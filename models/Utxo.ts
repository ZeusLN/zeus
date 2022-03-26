import { observable, computed } from 'mobx';
import BaseModel from './BaseModel';

interface Outpoint {
    output_index: number;
    txid_bytes: string;
    txid_str: string;
}

export default class Utxo extends BaseModel {
    @observable address: string;
    @observable account: string;
    confirmations: string;
    outpoint: Outpoint;
    txid: string;
    output: string | number;
    pk_script: string;
    amount_sat: number | string;
    value: number | string;
    // CLR
    status: string;
    reserved: boolean;
    blockheight: number;

    @computed public get isUnconfirmed(): boolean {
        return this.getConfs <= 0;
    }

    @computed public get getAmount(): number | string {
        return this.amount_sat || this.value;
    }

    @computed public get getConfs(): number {
        return Number(this.confirmations);
    }

    @computed public get getOutpoint(): string {
        return this.outpoint && this.outpoint.txid_str
            ? `${this.outpoint.txid_str}:${this.outpoint.output_index}`
            : `${this.txid}:${this.output}`;
    }
}
