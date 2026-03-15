import { computed } from 'mobx';
import bolt11 from 'bolt11';

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
        return (
            Number(this.value_sat) ||
            Number(this.value) ||
            Number(this.amount) ||
            0
        );
    }

    @computed public get getFee(): string {
        if (this.fromCDK) {
            if (this.fee === 0) return '';
            return this.fee.toString();
        }
        const feeMsat = Number(this.fee_msat);
        if (!Number.isNaN(feeMsat) && feeMsat !== 0) {
            return (feeMsat / 1000).toString();
        }

        const feeSat = Number(this.fee_sat);
        if (!Number.isNaN(feeSat) && feeSat !== 0) {
            return feeSat.toString();
        }

        const fee = Number(this.fee);
        if (!Number.isNaN(fee) && fee !== 0) {
            return fee.toString();
        }

        const feesPaid = Number(this.fees_paid);
        if (!Number.isNaN(feesPaid) && feesPaid !== 0) {
            return feesPaid.toString();
        }

        return '0';
    }

    @computed public get getMemo(): string | undefined {
        if (this.fromCDK) return this.cdkMemo;
        const payReq = this.payment_request || this.bolt11;
        if (payReq) {
            try {
                const decoded: any = bolt11.decode(payReq);
                for (let i = 0; i < decoded.tags.length; i++) {
                    const tag = decoded.tags[i];
                    if (tag.tagName === 'description') return tag.data;
                }
            } catch {}
        }
        return undefined;
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
        const ts = this.fromCDK ? this.cdkTimestamp || 0 : this.getTimestamp;
        return DateTimeUtils.listFormattedDate(ts);
    }

    @computed public get getDisplayTimeShort(): string {
        const ts = this.fromCDK ? this.cdkTimestamp || 0 : this.getTimestamp;
        return DateTimeUtils.listFormattedDateShort(ts);
    }
}
