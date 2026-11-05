import { computed } from 'mobx';

import BaseModel from './BaseModel';
import DateTimeUtils from '../utils/DateTimeUtils';
import { SpliceDirection } from '../utils/SpliceUtils';
import { notesStore } from '../stores/Stores';

// A splice as Activity lists it, built from a SpliceStore record
export default class Splice extends BaseModel {
    public userChannelId: string;
    public channelId: string;
    public txid: string;
    public vout?: number;
    public initiator: 'local' | 'remote';
    public direction?: SpliceDirection;
    public amountSats?: number;
    public address?: string;
    public startedAt: number;
    public status: 'pending' | 'locked';
    public lockedAt?: number;
    public capacityBefore?: number;
    public capacityAfter?: number;
    public confirmationHeight?: number;

    @computed public get model(): string {
        return 'Splice';
    }

    @computed public get isPending(): boolean {
        return this.status !== 'locked';
    }

    // known once the splice transaction has been read from the chain
    @computed public get capacityChange(): number | undefined {
        if (this.capacityBefore == null || this.capacityAfter == null) {
            return undefined;
        }
        return this.capacityAfter - this.capacityBefore;
    }

    @computed public get getDirection(): SpliceDirection | undefined {
        if (this.direction) return this.direction;
        const change = this.capacityChange;
        if (change === undefined || change === 0) return undefined;
        return change > 0 ? 'in' : 'out';
    }

    // What we asked to move for our own splices; for the peer's, how much
    // the capacity changed. 0 while unknown
    @computed public get getAmount(): number {
        if (this.initiator === 'local' && this.amountSats) {
            return this.amountSats;
        }
        const change = this.capacityChange;
        return change !== undefined ? Math.abs(change) : 0;
    }

    @computed public get getTimestamp(): number {
        return Math.floor(this.startedAt / 1000);
    }

    @computed public get getDate(): Date {
        return new Date(this.startedAt);
    }

    @computed public get getDisplayTimeShort(): string {
        return DateTimeUtils.listFormattedDateShort(this.getTimestamp);
    }

    @computed public get getDisplayTimeOrder(): string {
        return DateTimeUtils.listFormattedDateOrder(this.getDate);
    }

    // shared with the on-chain transaction it replaces in Activity
    @computed public get getNote(): string {
        return notesStore.notes[`note-${this.txid}`] || '';
    }
}
