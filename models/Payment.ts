import { computed } from 'mobx';
import bolt11 from 'bolt11';
import BigNumber from 'bignumber.js';
import humanizeDuration from 'humanize-duration';

import BaseModel from './BaseModel';
import DateTimeUtils from '../utils/DateTimeUtils';
import { localeString } from '../utils/LocaleUtils';
import Bolt11Utils from '../utils/Bolt11Utils';
import Base64Utils from '../utils/Base64Utils';
import { lnrpc } from '../proto/lightning';
import { notesStore } from '../stores/storeInstances';

const keySendMessageType = '34349334';

interface preimageBuffer {
    data: Array<number>;
    type: string;
}

export default class Payment extends BaseModel {
    private payment_hash: string | { data: number[]; type: string }; // object if lndhub
    creation_date?: string;
    value?: string | number; // lnd deprecated
    value_sat?: string | number;
    fee_sat?: string;
    fee_msat?: string;
    payment_preimage: string;
    path: Array<string>;
    bolt: string;
    status: string;
    payment_request: string;
    failure_reason?: string | number;
    // c-lightning
    id?: string;
    destination?: string;
    amount_msat?: string;
    amount_sent_msat?: string;
    msatoshi_sent?: string;
    msatoshi?: string;
    created_at?: string;
    timestamp?: string;
    preimage: any | preimageBuffer;
    bolt11?: string;
    htlcs?: Array<any>;
    nodes?: any;

    constructor(data?: any, nodes?: any) {
        super(data);
        this.nodes = nodes;
    }

    @computed public get paymentHash(): string | undefined {
        if (typeof this.payment_hash === 'string') {
            return this.payment_hash;
        }
        if (this.payment_hash?.type === 'Buffer') {
            this.payment_hash = Base64Utils.bytesToHex(this.payment_hash.data);
            return this.payment_hash;
        }
        return undefined;
    }

    @computed public get getPaymentRequest(): string | undefined {
        return this.payment_request || this.bolt11;
    }

    @computed public get getDestination(): string | undefined {
        if (this.destination) return this.destination;
        const pay_req = this.getPaymentRequest;
        if (pay_req) {
            try {
                const decoded = bolt11.decode(pay_req);
                return decoded.payeeNodeKey;
            } catch {
                return undefined;
            }
        } else {
            return undefined;
        }
    }

    @computed public get getKeysendMessage(): string | undefined {
        if (
            this.htlcs?.[0]?.route?.hops?.[0]?.custom_records?.[
                keySendMessageType
            ]
        ) {
            return Base64Utils.base64ToUtf8(
                this.htlcs[0].route.hops[0].custom_records[keySendMessageType]
            );
        }
        return undefined;
    }

    @computed public get getMemo(): string | undefined {
        if (this.getPaymentRequest) {
            try {
                const decoded: any = bolt11.decode(this.getPaymentRequest);
                for (let i = 0; i < decoded.tags.length; i++) {
                    const tag = decoded.tags[i];
                    if (tag.tagName === 'description') return tag.data;
                }
            } catch (e) {
                console.log('Error decoding payment request:', e);
            }
        }
        return undefined;
    }

    @computed public get getKeysendMessageOrMemo(): string | undefined {
        return this.getKeysendMessage || this.getMemo;
    }

    @computed public get model(): string {
        return localeString('views.Payment.title');
    }

    @computed public get getPreimage(): string {
        const preimage = this.preimage || this.payment_preimage;
        if (preimage) {
            if (typeof preimage !== 'string' && preimage.data) {
                return Base64Utils.bytesToHex(preimage.data);
            } else if (typeof preimage === 'string') {
                return preimage;
            }
        }
        return '';
    }

    @computed public get isIncomplete(): boolean {
        return (
            !this.getPreimage ||
            this.getPreimage ===
                '0000000000000000000000000000000000000000000000000000000000000000'
        );
    }

    @computed public get isInTransit(): boolean {
        if (!this.isIncomplete) return false;
        if (!this.htlcs) return false;
        let inTransit = false;
        for (const htlc of this.htlcs) {
            if (
                htlc.status === 'IN_FLIGHT' ||
                htlc.status === lnrpc.HTLCAttempt.HTLCStatus.IN_FLIGHT
            ) {
                inTransit = true;
                break;
            }
        }
        return inTransit;
    }

    @computed public get isFailed(): boolean {
        if (!this.isIncomplete) return false;
        let isFailed = false;
        if (this.htlcs) {
            for (const htlc of this.htlcs) {
                if (
                    htlc.status === 'FAILED' ||
                    htlc.status === lnrpc.HTLCAttempt.HTLCStatus.FAILED
                ) {
                    isFailed = true;
                    break;
                }
            }
        }
        if (
            this.failure_reason &&
            this.failure_reason !== 'FAILURE_REASON_NONE' &&
            this.failure_reason !==
                lnrpc.PaymentFailureReason.FAILURE_REASON_NONE
        )
            isFailed = true;
        return isFailed;
    }

    @computed public get getTimestamp(): string | number {
        return this.creation_date || this.created_at || this.timestamp || 0;
    }

    @computed public get getDate(): Date {
        return DateTimeUtils.listDate(this.getTimestamp);
    }

    @computed public get getDisplayTime(): string {
        return DateTimeUtils.listFormattedDate(this.getTimestamp);
    }

    @computed public get getDisplayTimeShort(): string {
        return DateTimeUtils.listFormattedDateShort(this.getTimestamp);
    }

    @computed public get getAmount(): number | string {
        return this.amount_msat
            ? Number(this.amount_msat.toString().replace('msat', '')) / 1000
            : this.value_sat ||
                  this.value ||
                  Number(this.msatoshi_sent) / 1000 ||
                  Number(this.amount_sent_msat) / 1000 ||
                  0;
    }

    @computed public get getFee(): string {
        // lnd
        if (this.fee_sat || this.fee_msat) {
            return this.fee_sat || (Number(this.fee_msat) / 1000).toString();
        }

        // c-lightning-REST
        if (this.amount_msat && this.amount_sent_msat) {
            const msatoshi_sent: any = Number(
                this.amount_sent_msat.toString().replace('msat', '')
            );
            const msatoshi: any = Number(
                this.amount_msat.toString().replace('msat', '')
            );
            const fee = Number(msatoshi_sent - msatoshi) / 1000;
            return fee.toString();
        }

        return '0';
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

    @computed public get enhancedPath(): any[] {
        const enhancedPath: any[] = [];
        !this.htlcs &&
            this.path &&
            this.path.forEach((hop: string) => {
                const pubKey = hop;
                const alias = this.nodes[pubKey];
                const enhancedHop = alias ? alias : pubKey;
                enhancedPath.push(enhancedHop);
            });

        this.htlcs &&
            this.htlcs.forEach((htlc: any) => {
                const route: any[] = [];
                if (
                    htlc.status === 'SUCCEEDED' ||
                    htlc.status === lnrpc.HTLCAttempt.HTLCStatus.SUCCEEDED
                ) {
                    htlc.route.hops &&
                        htlc.route.hops.forEach((hop: any) => {
                            const pubKey = hop.pub_key;
                            const alias =
                                this.nodes[pubKey] && this.nodes[pubKey].alias;
                            const nodeLabel = alias ? alias : pubKey;
                            const enhancedHop = {
                                alias,
                                pubKey,
                                node: nodeLabel,
                                forwarded: hop.amt_to_forward,
                                fee: hop.fee_msat
                                    ? Number(hop.fee_msat) / 1000
                                    : 0
                            };
                            route.push(enhancedHop);
                        });
                }
                enhancedPath.push(route);
            });

        return enhancedPath;
    }

    @computed public get originalTimeUntilExpiryInSeconds():
        | number
        | undefined {
        try {
            const decodedPaymentRequest =
                this.payment_request != null
                    ? Bolt11Utils.decode(this.payment_request)
                    : this.bolt
                    ? Bolt11Utils.decode(this.bolt)
                    : this.bolt11
                    ? Bolt11Utils.decode(this.bolt11)
                    : null;
            return decodedPaymentRequest?.expiry;
        } catch (e) {
            return undefined;
        }
    }

    public getFormattedOriginalTimeUntilExpiry(
        locale: string | undefined
    ): string {
        const originalTimeUntilExpiryInSeconds =
            this.originalTimeUntilExpiryInSeconds;

        if (originalTimeUntilExpiryInSeconds == null) {
            return localeString('models.Invoice.never');
        }

        const originalTimeUntilExpiryInMs =
            originalTimeUntilExpiryInSeconds * 1000;

        return this.formatHumanReadableDuration(
            originalTimeUntilExpiryInMs,
            locale
        );
    }

    private formatHumanReadableDuration(
        durationInMs: number,
        locale: string | undefined
    ) {
        return humanizeDuration(durationInMs, {
            language: locale === 'zh' ? 'zh_CN' : locale,
            fallbacks: ['en'],
            round: true,
            largest: 2
        })
            .replace(/(\d+) /g, '$1 ')
            .replace(/ (\d+)/g, ' $1');
    }

    @computed public get getNoteKey(): string {
        return `note-${this.paymentHash || this.getPreimage}`;
    }

    @computed public get getNote(): string {
        return notesStore.notes[this.getNoteKey] || '';
    }
}
