import { observable, computed } from 'mobx';

export default class Transaction {
    @observable amount: number;
    block_hash: string;
    block_height: number;
    dest_addresses: Array<string>;
    num_confirmations: number;
    time_stamp: string;
    tx_hash: string;
    total_fees: string;
    // c-lightning
    @observable value: number|string;

    @computed
    public getAmount(): any {
        return this.value || this.amount;
    }
}
