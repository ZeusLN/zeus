import { computed } from 'mobx';

import BaseModel from './BaseModel';
import { localeString } from '../utils/LocaleUtils';
import { notesStore } from '../stores/Stores';

export default class WithdrawalRequest extends BaseModel {
    public invreq_id: string;
    public active: boolean;
    public single_use: boolean;
    public bolt12: string;
    public used: boolean;
    public offer_description: string;
    public invreq_amount_msat: string;
    public signature: string;
    public valid: boolean;
    public invreq_chain: string;
    public invreq_payer_id: string;
    public invreq_metadata: string;
    public type: string;

    @computed public get model(): string {
        return localeString('general.withdrawalRequest');
    }

    @computed public get getAmount(): number {
        return Number(this.invreq_amount_msat) / 1000;
    }

    @computed public get getNoteKey(): string {
        return `note-${this.invreq_id || ''}`;
    }

    @computed public get getNote(): string {
        return notesStore.notes[this.getNoteKey] || '';
    }
}
