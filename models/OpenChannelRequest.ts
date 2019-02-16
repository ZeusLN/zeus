export default interface OpenChannelRequest {
    min_confs?: string;
    spend_unconfirmed?: boolean;
    remote_csv_delay?: number;
    node_pubkey_string: string;
    node_pubkey?: any;
    push_sat?: string;
    target_conf?: number;
    sat_per_byte?: string;
    private?: boolean;
    min_htlc_msat?: string;
    local_funding_amount: string;
    host: string;
};