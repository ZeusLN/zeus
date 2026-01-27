import { computed } from 'mobx';

import Payment from './Payment';
import DateTimeUtils from '../utils/DateTimeUtils';
import { localeString } from '../utils/LocaleUtils';
import { Proof } from './CashuToken';

// Quote structure used in meltResponse
export interface MeltQuote {
    quote: string;
    amount: number;
    fee_reserve: number;
    state: string;
    expiry: number;
    payment_preimage?: string | null;
}

// MeltResponse compatible with CDK's structure
export interface MeltResponse {
    quote?: MeltQuote;
    change?: Proof[];
    // CDK style fields
    state?: string;
    amount?: number;
    fee_paid?: number;
    preimage?: string;
}

export default class CashuPayment extends Payment {
    public meltResponse: MeltResponse;
    public fee: number;
    public mintUrl: string;
    public proofs: Proof[];

    // CDK transaction fields (for completed transactions from history)
    public fromCDK?: boolean;
    public cdkTimestamp?: number;
    public cdkAmount?: number;
    public cdkMemo?: string;
    public cdkState?: string;

    constructor(data?: any) {
        super(data);
    }

    /**
     * Create CashuPayment from CDK transaction (outgoing)
     */
    static fromCDKTransaction(tx: {
        id: string;
        amount: number;
        fee?: number;
        mint_url: string;
        timestamp: number;
        memo?: string;
        state: string;
    }): CashuPayment {
        const payment = new CashuPayment({
            payment_hash: tx.id,
            creation_date: tx.timestamp.toString(),
            value_sat: tx.amount,
            fee_sat: (tx.fee || 0).toString(),
            status:
                tx.state === 'Pending'
                    ? 'IN_FLIGHT'
                    : tx.state === 'Failed'
                    ? 'FAILED'
                    : 'SUCCEEDED',
            fromCDK: true,
            cdkTimestamp: tx.timestamp,
            cdkAmount: tx.amount,
            cdkMemo: tx.memo,
            cdkState: tx.state,
            mintUrl: tx.mint_url,
            fee: tx.fee || 0
        });
        return payment;
    }

    @computed public get model(): string {
        return localeString('views.Cashu.CashuPayment.title');
    }

    // Override for CDK transactions
    @computed public get getTimestamp(): number {
        if (this.fromCDK) return this.cdkTimestamp || 0;
        return Number(this.creation_date) || Number(this.timestamp) || 0;
    }

    @computed public get getAmount(): number {
        if (this.fromCDK) return this.cdkAmount || 0;
        return Number(this.value_sat) || Number(this.value) || 0;
    }

    @computed public get getFee(): string {
        if (this.fromCDK) {
            if (this.fee === 0) return '';
            return this.fee.toString();
        }
        return super.getFee;
    }

    @computed public get getMemo(): string | undefined {
        if (this.fromCDK) return this.cdkMemo;
        return super.getMemo;
    }

    @computed public get getMintUrl(): string {
        return this.mintUrl;
    }

    @computed public get isFailed(): boolean {
        if (this.fromCDK) return this.cdkState === 'Failed';
        return this.status === 'FAILED';
    }

    @computed public get isInTransit(): boolean {
        if (this.fromCDK) return this.cdkState === 'Pending';
        return this.status === 'IN_FLIGHT';
    }

    @computed public get getDisplayTime(): string {
        if (this.fromCDK) {
            return DateTimeUtils.listFormattedDate(this.cdkTimestamp || 0);
        }
        return super.getDisplayTime;
    }

    @computed public get getDisplayTimeShort(): string {
        if (this.fromCDK) {
            return DateTimeUtils.listFormattedDateShort(this.cdkTimestamp || 0);
        }
        return super.getDisplayTimeShort;
    }
}
