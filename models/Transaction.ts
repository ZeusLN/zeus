export default interface Transaction {
    amount: number;
    block_hash: string;
    block_height: number;
    dest_addresses: Array<string>;
    num_confirmations: number;
    time_stamp: string;
    tx_hash: string;
    total_fees: string;
}
