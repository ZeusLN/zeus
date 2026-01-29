import { computed } from 'mobx';

import BaseModel from './BaseModel';

// Proof type compatible with both cashu-ts and CDK
// cashu-ts uses: { id, amount, secret, C }
// CDK uses: { keyset_id, amount, secret, c }
export interface Proof {
    amount: number;
    secret: string;
    // cashu-ts style
    id?: string;
    C?: string;
    // CDK style
    keyset_id?: string;
    c?: string;
}

import { contactStore } from '../stores/Stores';

import CashuUtils from '../utils/CashuUtils';
import DateTimeUtils from '../utils/DateTimeUtils';
import { localeString } from '../utils/LocaleUtils';

const supportedUnits = ['sat'];

export default class CashuToken extends BaseModel {
    public memo: string;
    public mint: string;
    public unit: string;
    public received?: boolean;
    public sent?: boolean;
    public spent?: boolean; // only for sent tokens
    public encodedToken?: string;
    public proofs: Proof[];
    public value?: number; // cached value from CDK
    public created_at?: number;
    public received_at?: number;

    @computed public get model(): string {
        return localeString('cashu.token');
    }

    @computed public get getAmount(): number {
        // Use cached value if proofs are not available
        if (!this.proofs || this.proofs.length === 0) {
            return this.value || 0;
        }
        return CashuUtils.sumProofsValue(this.proofs);
    }

    @computed public get isSupported(): boolean {
        return supportedUnits.includes(this.unit);
    }

    @computed public get getMemo(): string {
        return this.memo;
    }

    @computed public get getDisplayTime(): string {
        return this.getTimestamp
            ? DateTimeUtils.listFormattedDate(this.getTimestamp)
            : '';
    }

    @computed public get getDisplayTimeOrder(): string {
        return DateTimeUtils.listFormattedDateOrder(
            new Date(this.getTimestamp * 1000)
        );
    }

    @computed public get getDisplayTimeShort(): string {
        return DateTimeUtils.listFormattedDateShort(this.getTimestamp);
    }

    @computed public get getTimestamp(): number {
        return this.received ? this.received_at || 0 : this.created_at || 0;
    }

    @computed public get getLockPubkey(): string | undefined {
        if (!this.proofs || this.proofs.length === 0) return undefined;
        return CashuUtils.getP2PKPubkeySecret(this.proofs[0].secret);
    }

    @computed public get getLocktime(): number | undefined {
        if (!this.proofs || this.proofs.length === 0) return undefined;
        return CashuUtils.getP2PKLocktime(this.proofs[0].secret);
    }

    @computed public get getContactName(): string | undefined {
        const lockPubkey = this.getLockPubkey;
        if (!lockPubkey) return undefined;
        const contact = contactStore.contacts.find((contact: any) =>
            contact.cashuPubkey?.some((pubkey: string) => pubkey === lockPubkey)
        );
        return contact?.name;
    }
}
