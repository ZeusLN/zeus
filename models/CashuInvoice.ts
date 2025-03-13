import { observable, computed } from 'mobx';
import humanizeDuration from 'humanize-duration';
import bolt11 from 'bolt11';

import BaseModel from './BaseModel';
import DateTimeUtils from '../utils/DateTimeUtils';
import Bolt11Utils from '../utils/Bolt11Utils';
import { localeString } from '../utils/LocaleUtils';
import { notesStore } from '../stores/storeInstances';

export default class CashuInvoice extends BaseModel {
    // MintQuote
    public expiry: number;
    public paid?: boolean;
    public pubkey?: string;
    public quote: string;
    public request: string;
    public state: string;
    // additions
    public mintUrl: string;

    // calculated
    @observable public bolt11: any;
    public expires_at: number;

    public formattedOriginalTimeUntilExpiry: string;
    public formattedTimeUntilExpiry: string;

    constructor(data?: any) {
        super(data);
        try {
            this.bolt11 = bolt11.decode(data.request);
        } catch (e) {
            console.log('error decoding Cashu bolt11');
        }
    }

    @computed public get model(): string {
        return localeString('views.CashuInvoice.title');
    }

    @computed public get getTimestamp(): string | number {
        return this.bolt11?.timestamp || this.expires_at || 0;
    }

    @computed public get getMemo(): string | undefined {
        let memo;
        for (let i = 0; i < this.bolt11?.tags.length; i++) {
            const tag = this.bolt11?.tags[i];
            switch (tag.tagName) {
                case 'description':
                    memo = tag.data;
                    break;
            }
        }
        if (typeof memo === 'string') return memo;
        if (Array.isArray(memo)) return memo[0];
        return undefined;
    }

    @computed public get isPaid(): boolean {
        return this.paid || this.state === 'PAID' || false;
    }

    @computed public get key(): string {
        return this.quote;
    }

    @computed public get getPaymentRequest(): string {
        return this.request || '';
    }

    // return amount in satoshis
    @computed public get getAmount(): number {
        return this.bolt11?.satoshis ? this.bolt11.satoshis : 0;
    }

    // return amount in satoshis
    @computed public get getRequestAmount(): number {
        return this.getAmount;
    }

    @computed public get getDisplayTime(): string {
        return this.isPaid
            ? this.formattedSettleDate
            : DateTimeUtils.listFormattedDate(this.expires_at || 0);
    }

    @computed public get getDisplayTimeOrder(): string {
        return DateTimeUtils.listFormattedDateOrder(
            new Date(
                Number(this.bolt11?.timestamp || this.expires_at || 0) * 1000
            )
        );
    }

    @computed public get getDisplayTimeShort(): string {
        return DateTimeUtils.listFormattedDateShort(
            this.bolt11?.timestamp || this.expires_at || 0
        );
    }

    @computed public get getDate(): Date {
        return this.isPaid
            ? this.settleDate
            : DateTimeUtils.listDate(
                  this.bolt11?.timestamp || this.expires_at || 0
              );
    }

    @computed public get settleDate(): Date {
        return DateTimeUtils.listDate(
            this.bolt11?.timestamp || this.expires_at || 0
        );
    }

    @computed public get formattedSettleDate(): string {
        return DateTimeUtils.listFormattedDate(
            this.bolt11?.timestamp || this.expires_at || 0
        );
    }

    @computed public get getCreationDate(): Date {
        return DateTimeUtils.listDate(
            this.bolt11?.timestamp || this.expires_at
        );
    }

    @computed public get formattedCreationDate(): string {
        return !!this.bolt11?.timestamp || !!this.expires_at
            ? DateTimeUtils.listFormattedDate(
                  this.bolt11?.timestamp || this.expires_at
              )
            : '';
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
        return `note-${this.quote}`;
    }

    @computed public get getNote(): string {
        return notesStore.notes[this.getNoteKey] || '';
    }
}
