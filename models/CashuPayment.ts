import { computed } from 'mobx';

import Payment from './Payment';
import DateTimeUtils from '../utils/DateTimeUtils';
import { localeString } from '../utils/LocaleUtils';
import { Proof } from './CashuToken';
import Bolt11Utils from '../utils/Bolt11Utils';
import type { CDKTransaction } from '../cashu-cdk';

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

    // CDK transaction fields (for melts recovered from CDK history)
    public fromCDK?: boolean;
    public cdkTransactionId?: string;
    public cdkQuoteId?: string;

    constructor(data?: any) {
        super(data);
    }

    /**
     * Create CashuPayment from CDK transaction (outgoing melt)
     */
    static fromCDKTransaction(tx: CDKTransaction): CashuPayment {
        return new CashuPayment({
            payment_request: tx.payment_request,
            payment_preimage: tx.payment_proof,
            amount: tx.amount,
            fee: tx.fee || 0,
            mintUrl: tx.mint_url,
            timestamp: tx.timestamp,
            fromCDK: true,
            cdkTransactionId: tx.id,
            cdkQuoteId: tx.quote_id
        });
    }

    @computed public get model(): string {
        return localeString('views.Cashu.CashuPayment.title');
    }

    @computed public get getTimestamp(): number {
        return Number(this.creation_date) || Number(this.timestamp) || 0;
    }

    @computed public get getAmount(): number {
        return (
            Number(this.value_sat) ||
            Number(this.value) ||
            Number(this.amount) ||
            0
        );
    }

    @computed public get getFee(): string {
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
        const payReq = this.payment_request || this.bolt11;
        if (payReq) {
            try {
                return Bolt11Utils.decode(payReq).description;
            } catch {}
        }
        return undefined;
    }

    @computed public get getMintUrl(): string {
        return this.mintUrl;
    }

    @computed public get isFailed(): boolean {
        return this.status === 'FAILED';
    }

    @computed public get isInTransit(): boolean {
        return this.status === 'IN_FLIGHT';
    }

    @computed public get getDisplayTime(): string {
        return DateTimeUtils.listFormattedDate(this.getTimestamp);
    }

    @computed public get getDisplayTimeShort(): string {
        return DateTimeUtils.listFormattedDateShort(this.getTimestamp);
    }

    @computed public get getNoteKey(): string {
        return `note-${this.paymentHash || this.getPreimage || ''}`;
    }
}
