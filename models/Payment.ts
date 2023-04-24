import { computed } from 'mobx';
import bolt11 from 'bolt11';

import BaseModel from './BaseModel';
import DateTimeUtils from './../utils/DateTimeUtils';
import { localeString } from './../utils/LocaleUtils';

export default class Payment extends BaseModel {
    payment_hash: string;
    creation_date?: string;
    value: string | number;
    fee_sat?: string;
    fee_msat?: string;
    payment_preimage: string;
    path: Array<string>;
    bolt: string;
    status: string;
    payment_request: string;
    // c-lightning
    id?: string;
    destination?: string;
    amount_msat?: string;
    amount_sent_msat?: string;
    msatoshi_sent?: string;
    msatoshi?: string;
    created_at?: string;
    timestamp?: string;
    preimage: string;
    bolt11?: string;
    htlcs?: Array<any>;
    nodes?: any;

    constructor(data?: any, nodes?: any) {
        super(data);
        this.nodes = nodes;
    }

    @computed public get getPaymentRequest(): string | undefined {
        return this.payment_request || this.bolt11;
    }

    @computed public get getMemo(): string | undefined {
        if (this.getPaymentRequest) {
            const decoded: any = bolt11.decode(this.getPaymentRequest);
            for (let i = 0; i < decoded.tags.length; i++) {
                const tag = decoded.tags[i];
                switch (tag.tagName) {
                    case 'description':
                        return tag.data;
                }
            }
        }
        return undefined;
    }

    @computed public get model(): string {
        return localeString('views.Payment.title');
    }

    @computed public get getPreimage(): string {
        return this.preimage || this.payment_preimage;
    }

    @computed public get getTimestamp(): string | number {
        return this.creation_date || this.created_at || this.timestamp || 0;
    }

    @computed public get getDate(): string | Date {
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
            ? Number(this.amount_msat.replace('msat', '')) / 1000
            : this.value || Number(this.msatoshi_sent) / 1000 || 0;
    }

    @computed public get getFee(): string {
        // lnd
        if (this.fee_sat || this.fee_msat) {
            return this.fee_sat || (Number(this.fee_msat) / 1000).toString();
        }

        // c-lightning-REST
        if (this.amount_msat && this.amount_sent_msat) {
            const msatoshi_sent: any = Number(
                this.amount_sent_msat.replace('msat', '')
            );
            const msatoshi: any = Number(this.amount_msat.replace('msat', ''));
            const fee = Number(msatoshi_sent - msatoshi) / 1000;
            return fee.toString();
        }

        return '0';
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
                if (htlc.status === 'SUCCEEDED') {
                    htlc.route.hops &&
                        htlc.route.hops.forEach((hop: any) => {
                            const pubKey = hop.pub_key;
                            const alias =
                                this.nodes[pubKey] && this.nodes[pubKey].alias;
                            const nodeLabel = alias ? alias : pubKey;
                            const enhancedHop = {
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
}
