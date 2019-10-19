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

export default interface Invoice {
    route_hints: Array<RouteHint>;
    fallback_addr: string;
    r_hash: string;
    settle_date: string;
    expiry: string;
    memo: string;
    receipt: string;
    settle_index: string;
    add_index: string;
    payment_request: string;
    value: string;
    settled: boolean;
    amt_paid_msat: string;
    amt_paid: string;
    amt_paid_sat: string;
    private: boolean;
    creation_date: string;
    description_hash: string;
    r_preimage: string;
    cltv_expiry: string;
}
