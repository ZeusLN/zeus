export default interface NodeInfo {
    chains?: Array<string>;
    uris?: Array<string>;
    alias?: string;
    num_active_channels?: number;
    num_inactive_channels?: number;
    version?: string;
    identity_pubkey?: string;
    num_peers?: number;
    synced_to_chain?: boolean;
    testnet?: boolean;
    block_hash?: string;
    block_height?: number;
    best_header_timestamp?: string;
}