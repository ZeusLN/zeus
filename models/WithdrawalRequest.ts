import { computed } from 'mobx';

import BaseModel from './BaseModel';

import { localeString } from '../utils/LocaleUtils';
import dateTimeUtils from '../utils/DateTimeUtils';

import { notesStore } from '../stores/Stores';

export default class WithdrawalRequest extends BaseModel {
    public invreq_id: string;
    public active: boolean;
    public single_use: boolean;
    public bolt12: string;
    public used: boolean;
    public offer_description: string;
    public invreq_amount_msat: number;
    public signature: string;
    public valid: boolean;
    public invreq_chain: string;
    public invreq_payer_id: string;
    public invreq_metadata: string;
    public type: string;
    public amount_received_msat: number;
    public description: string;
    public payment_hash: string;
    public payment_preimage: string;
    public status: string;
    public redeem?: boolean;
    public paid_at: number;

    @computed public get model(): string {
        return localeString('general.withdrawalRequest');
    }

    @computed public get getAmount(): number {
        return (
            Number(this.invreq_amount_msat) / 1000 ||
            this.amount_received_msat / 1000
        );
    }

    @computed public get getNoteKey(): string {
        return `note-${this.payment_hash || ''}`;
    }

    @computed public get getNote(): string {
        return notesStore.notes[this.getNoteKey] || '';
    }

    @computed public get getTimestamp(): number {
        return this.paid_at;
    }

    @computed public get getDisplayTimeShort(): string {
        return dateTimeUtils.listFormattedDateShort(this.getTimestamp);
    }
}
