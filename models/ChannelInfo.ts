import { computed } from 'mobx';
import BaseModel from './BaseModel';

export interface RoutingPolicy {
    time_lock_delta: number;
    min_htlc: string;
    fee_base_msat: string;
    fee_rate_milli_msat: string;
    inbound_fee_base_msat?: string;
    inbound_fee_rate_milli_msat?: string;
    disabled: boolean;
    max_htlc_msat: string;
    last_update: number;
}

export default class ChannelInfo extends BaseModel {
    channel_id?: string;
    chan_point?: string;
    last_update?: number;
    node1_pub?: string;
    node2_pub?: string;
    node_1_pub?: string;
    node_2_pub?: string;
    capacity?: string;
    node1_policy?: RoutingPolicy;
    node2_policy?: RoutingPolicy;
    node_1_policy?: RoutingPolicy;
    node_2_policy?: RoutingPolicy;

    // CLNRest
    channel_flags?: number;
    message_flags?: number;
    features?: string;
    direction?: number;
    source?: string;
    destination?: string;
    public?: boolean;
    active?: boolean;
    amount_msat?: number;
    short_channel_id?: string;
    delay: number;
    htlc_minimum_msat: number;
    htlc_maximum_msat: number;
    base_fee_millisatoshi: number;
    fee_per_millionth: number;

    @computed
    public get node1Policy(): RoutingPolicy | undefined {
        return this.node_1_policy || this.node1_policy;
    }

    @computed
    public get node2Policy(): RoutingPolicy | undefined {
        return this.node_2_policy || this.node2_policy;
    }

    @computed
    public get node1Pub(): string {
        return this.node_1_pub || this.node1_pub || this.source || '';
    }

    @computed
    public get node2Pub(): string {
        return this.node_2_pub || this.node2_pub || this.destination || '';
    }
}
