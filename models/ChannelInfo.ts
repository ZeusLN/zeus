import BaseModel from './BaseModel';

interface RoutingPolicy {
    time_lock_delta: number;
    min_htlc: string;
    fee_base_msat: string;
    fee_rate_milli_msat: string;
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
    capacity?: string;
    node1_policy: RoutingPolicy;
    node2_policy: RoutingPolicy;
}
