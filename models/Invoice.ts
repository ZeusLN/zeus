import { observable, computed } from 'mobx';
import humanizeDuration from 'humanize-duration';

import BaseModel from './BaseModel';
import Base64Utils from '../utils/Base64Utils';
import DateTimeUtils from '../utils/DateTimeUtils';
import Bolt11Utils from '../utils/Bolt11Utils';
import { localeString } from '../utils/LocaleUtils';
import { notesStore } from '../stores/storeInstances';

interface HopHint {
    fee_proportional_millionths: number;
    chan_id: string;
    fee_base_msat: number;
    cltv_expiry_delta: number;
    node_id: string;
}

interface RouteHint {
    hop_hints: Array<HopHint>;
}

interface HTLC {
    custom_records?: CustomRecords;
}

interface CustomRecords {
    [key: number]: string;
}

const keySendMessageType = '34349334';

export default class Invoice extends BaseModel {
    public route_hints: Array<RouteHint>;
    public fallback_addr: string;
    public r_hash: any;
    public settle_date: string;
    public expiry: string;
    public memo: string;
    public receipt: string;
    public settle_index: string;
    public add_index: string;
    public payment_request: string;
    public value: string;
    public settled: boolean;
    public amt_paid_msat: string;
    public amt_paid: string;
    public amt_paid_sat: string;
    public private: boolean;
    public creation_date: string;
    public description_hash: string;
    public r_preimage: any;
    public cltv_expiry: string;
    public htlcs: Array<HTLC>;
    public is_amp?: boolean;
    public is_blinded?: boolean;
    // c-lightning, eclair
    public bolt11: string;
    public label: string;
    public description: string;
    public msatoshi: number;
    public msatoshi_received: number;
    @observable public payment_hash: string;
    public paid_at: number;
    public expires_at: number;
    public status: string;
    public amount_msat: number;
    public invoice_amount_msat: string | number;
    // pay req
    public timestamp?: string | number;
    public destination?: string;
    public num_satoshis?: string | number;
    public features?: any;
    // lndhub
    public amt?: number;
    public ispaid?: boolean;
    public expire_time?: number;
    public millisatoshis?: string;
    public pay_req?: string;

    public amount_received_msat?: string | number;

    public formattedOriginalTimeUntilExpiry: string;
    public formattedTimeUntilExpiry: string;

    @computed public get model(): string {
        return localeString('views.Invoice.title');
    }

    @computed public get getRPreimage(): string {
        if (!this.r_preimage) return '';
        const preimage = this.r_preimage.data || this.r_preimage;
        return typeof preimage === 'object'
            ? Base64Utils.bytesToHex(preimage)
            : typeof preimage === 'string'
            ? preimage.includes('=')
                ? Base64Utils.base64ToHex(preimage)
                : preimage
            : '';
    }

    @computed public get getRHash(): string {
        if (!this.r_hash) return '';
        const hash = this.r_hash.data || this.r_hash;
        return typeof hash === 'object'
            ? Base64Utils.bytesToHex(hash)
            : typeof hash === 'string'
            ? hash.includes('=')
                ? Base64Utils.base64ToHex(hash)
                : hash
            : '';
    }

    @computed public get getDescriptionHash(): string {
        const hash = this.description_hash;
        return typeof hash === 'string'
            ? hash.includes('=')
                ? Base64Utils.base64ToHex(hash)
                : hash
            : '';
    }

    @computed public get getTimestamp(): string | number {
        return (
            this.paid_at ||
            this.creation_date ||
            this.timestamp ||
            this.settle_date ||
            0
        );
    }

    @computed public get getKeysendMessage(): string | undefined {
        if (
            this.htlcs?.length > 0 &&
            this.htlcs?.[0]?.custom_records?.[keySendMessageType]
        )
            return Base64Utils.base64ToUtf8(
                this.htlcs[0].custom_records[keySendMessageType]
            );
        return undefined;
    }

    @computed public get getMemo(): string | undefined {
        const memo = this.memo || this.description;
        if (typeof memo === 'string') return memo;
        if (Array.isArray(memo)) return memo[0];
        return undefined;
    }

    @computed public get getKeysendMessageOrMemo(): string | undefined {
        return this.getKeysendMessage || this.getMemo;
    }

    @computed public get isPaid(): boolean {
        return this.status === 'paid' || this.settled || this.ispaid || false;
    }

    @computed public get key(): string {
        return this.bolt11 || this.r_hash;
    }

    @computed public get getPaymentRequest(): string {
        return this.bolt11 || this.payment_request || this.pay_req || '';
    }

    // return amount in satoshis
    @computed public get getAmount(): number {
        if (this.msatoshi_received) {
            const msatoshi = this.msatoshi_received.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        if (this.msatoshi) {
            const msatoshi = this.msatoshi.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        if (this.amount_received_msat) {
            const msatoshi = this.amount_received_msat.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        return this.settled
            ? Number(this.amt_paid_sat)
            : Number(this.value) || Number(this.amt) || 0;
    }

    // return amount in satoshis
    @computed public get getRequestAmount(): number {
        if (this.msatoshi) {
            const msatoshi = this.msatoshi.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        if (this.amount_msat) {
            const msatoshi = this.amount_msat.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        if (this.millisatoshis || this.invoice_amount_msat) {
            const msatoshi = this.millisatoshis || this.invoice_amount_msat;
            return Number(msatoshi) / 1000;
        }
        return Number(this.num_satoshis || 0);
    }

    @computed public get getDisplayTime(): string {
        return this.isPaid
            ? this.formattedSettleDate
            : DateTimeUtils.listFormattedDate(
                  this.expires_at || this.creation_date || this.timestamp || 0
              );
    }

    @computed public get getDisplayTimeOrder(): string {
        return DateTimeUtils.listFormattedDateOrder(
            new Date(
                Number(
                    this.settle_date || this.paid_at || this.timestamp || 0
                ) * 1000
            )
        );
    }

    @computed public get getDisplayTimeShort(): string {
        return this.isPaid && !this.is_amp
            ? DateTimeUtils.listFormattedDateShort(
                  this.settle_date || this.paid_at || this.timestamp || 0
              )
            : DateTimeUtils.listFormattedDateShort(
                  this.expires_at || this.creation_date || this.timestamp || 0
              );
    }

    @computed public get getFormattedRhash(): string {
        const rHash = this.r_hash || this.payment_hash;
        return rHash
            ? typeof rHash === 'string'
                ? rHash.replace(/\+/g, '-').replace(/\//g, '_')
                : rHash.data
                ? Base64Utils.bytesToHex(rHash.data)
                : Base64Utils.bytesToHex(rHash)
            : '';
    }

    @computed public get getDate(): Date {
        return this.isPaid
            ? this.settleDate
            : DateTimeUtils.listDate(
                  this.expires_at || this.creation_date || this.timestamp || 0
              );
    }

    @computed public get settleDate(): Date {
        return DateTimeUtils.listDate(
            this.settle_date || this.paid_at || this.timestamp || 0
        );
    }

    @computed public get formattedSettleDate(): string {
        return DateTimeUtils.listFormattedDate(
            this.settle_date || this.paid_at || this.timestamp || 0
        );
    }

    @computed public get getCreationDate(): Date {
        return DateTimeUtils.listDate(this.creation_date);
    }

    @computed public get formattedCreationDate(): string {
        return DateTimeUtils.listFormattedDate(this.creation_date);
    }

    @computed public get isExpired(): boolean {
        const getExpiryTimestamp = this.getExpiryUnixTimestamp();

        if (getExpiryTimestamp == null) {
            return false;
        }

        return getExpiryTimestamp * 1000 <= Date.now();
    }

    @computed public get isZeusPay(): boolean {
        if (this.getMemo?.toLowerCase().startsWith('zeus pay')) return true;
        return false;
    }

    @computed public get originalTimeUntilExpiryInSeconds():
        | number
        | undefined {
        try {
            const decodedPaymentRequest = Bolt11Utils.decode(
                this.getPaymentRequest
            );
            if (this.expires_at != null) {
                // expiry is missing in payment request in Core Lightning
                return this.expires_at - decodedPaymentRequest.timestamp;
            }
            return decodedPaymentRequest.expiry;
        } catch (e) {
            return undefined;
        }
    }

    public determineFormattedOriginalTimeUntilExpiry(
        locale: string | undefined
    ): void {
        const originalTimeUntilExpiryInSeconds =
            this.originalTimeUntilExpiryInSeconds;

        if (originalTimeUntilExpiryInSeconds == null) {
            return localeString('models.Invoice.never');
        }

        const originalTimeUntilExpiryInMs =
            originalTimeUntilExpiryInSeconds * 1000;

        this.formattedOriginalTimeUntilExpiry =
            this.formatHumanReadableDuration(
                originalTimeUntilExpiryInMs,
                locale
            );
    }

    public determineFormattedRemainingTimeUntilExpiry(
        locale: string | undefined
    ): void {
        const millisecondsUntilExpiry =
            this.getRemainingMillisecondsUntilExpiry();

        if (millisecondsUntilExpiry == null) {
            this.formattedTimeUntilExpiry = localeString(
                'models.Invoice.never'
            );
            return;
        }

        this.formattedTimeUntilExpiry =
            millisecondsUntilExpiry <= 0
                ? localeString('views.Activity.expired')
                : this.formatHumanReadableDuration(
                      millisecondsUntilExpiry,
                      locale
                  );
    }

    private getRemainingMillisecondsUntilExpiry(): number | undefined {
        const expiryTimestamp = this.getExpiryUnixTimestamp();

        return expiryTimestamp != null
            ? expiryTimestamp * 1000 - Date.now()
            : undefined;
    }

    private getExpiryUnixTimestamp(): number | undefined {
        const originalTimeUntilExpiryInSeconds =
            this.originalTimeUntilExpiryInSeconds;

        if (originalTimeUntilExpiryInSeconds == null) {
            return undefined;
        }

        try {
            const paymentRequestTimestamp = Bolt11Utils.decode(
                this.getPaymentRequest
            ).timestamp;

            return paymentRequestTimestamp + originalTimeUntilExpiryInSeconds;
        } catch (e) {
            return undefined;
        }
    }

    private formatHumanReadableDuration(
        durationInMs: number,
        locale: string | undefined
    ) {
        return (
            humanizeDuration(durationInMs, {
                language: locale === 'zh' ? 'zh_CN' : locale,
                fallbacks: ['en'],
                round: true,
                largest: 2
            })
                // replace spaces between digits and units with non-breaking spaces
                .replace(/(\d) ([^,])/g, '$1 $2') // LTR
                .replace(/([^,]) (\d)/g, '$2 $1') // RTL
        );
    }

    @computed public get getNoteKey(): string {
        return `note-${this.payment_hash || this.getRPreimage || ''}`;
    }

    @computed public get getNote(): string {
        return notesStore.notes[this.getNoteKey] || '';
    }
}
