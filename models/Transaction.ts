import { computed } from 'mobx';
import BigNumber from 'bignumber.js';

import BaseModel from './BaseModel';
import DateTimeUtils from './../utils/DateTimeUtils';
import { localeString } from './../utils/LocaleUtils';

interface OutputDetail {
    address: string;
    amount: string;
    is_our_address: boolean;
    output_index: string;
    output_type: string;
    pk_script: string;
}

interface PreviousOutpoint {
    raw_tx_hex: string;
    is_our_output: boolean;
    outpoint: string;
    timestamp: string;
    total_fees: string;
    tx_hash: string;
}

export default class Transaction extends BaseModel {
    public amount: number;
    public block_hash: string;
    public block_height: number;
    public dest_addresses: Array<string>;
    public num_confirmations: number;
    public time_stamp: string;
    public tx_hash: string;
    public total_fees: string;
    public output_details: Array<OutputDetail>;
    public previous_outpoints: Array<PreviousOutpoint>;
    // c-lightning
    public value: number | string;
    public blockheight: number;
    public status: string;
    public txid: string;
    public outputs: number;
    public address: string;

    @computed public get model(): string {
        return localeString('general.transaction');
    }

    @computed public get getFee(): string | number {
        return this.total_fees || 0;
    }

    @computed public get getFeePercentage(): string {
        const amount = this.getAmount;
        const fee = this.getFee;
        if (!fee || !amount || fee == '0') return '';

        // use at most 3 decimal places and remove trailing 0s
        return (
            Number(new BigNumber(fee).div(amount).times(100).toFixed(3))
                .toString()
                .replace(/-/g, '') + '%'
        );
    }

    @computed public get getTimestamp(): string | number {
        return this.time_stamp || 0;
    }

    @computed public get getDisplayTime(): string {
        return DateTimeUtils.listFormattedDate(this.getTimestamp);
    }

    @computed public get getDisplayTimeShort(): string {
        return this.getTimestamp === 0
            ? this.getBlockHeight
            : DateTimeUtils.listFormattedDateShort(this.getTimestamp);
    }

    @computed public get getDisplayTimeOrder(): string {
        return DateTimeUtils.listFormattedDateOrder(
            new Date(Number(this.getTimestamp) * 1000)
        );
    }

    @computed public get getDate(): string | Date {
        return DateTimeUtils.listDate(this.time_stamp);
    }

    @computed public get isConfirmed(): boolean {
        return this.num_confirmations > 0 || this.status === 'confirmed';
    }

    @computed public get getAmount(): number | string {
        const amount = this.value || this.amount || 0;
        const fee = this.getFee;

        const amountIsNegative = Number(amount) < 0;
        const feeIsNegative = Number(fee) < 0;
        const sameFormat = amountIsNegative === feeIsNegative;

        return sameFormat
            ? new BigNumber(amount).minus(this.getFee).toString()
            : new BigNumber(amount).plus(this.getFee).toString();
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

    @computed public get getOutpoint(): string {
        let outpoint = '';
        this.output_details.map((output: OutputDetail) => {
            if (output.is_our_address)
                outpoint = `${this.tx}:${output.output_index}`;
        });
        return outpoint;
    }
}
