type FeeLimit = { percent: string } | { fixed: string };

export interface AdditionalOutput {
    address: string;
    amount: string;
    satAmount: string | number;
}

export interface OutPoint {
    txid_bytes?: string;
    txid_str?: string;
    output_index: number;
}

export default interface TransactionRequest {
    addr?: string;
    sat_per_byte?: string | null; // optional
    sat_per_vbyte?: string | null; // optional
    amount?: string;
    utxos?: string[];
    conf_target?: number;
    spend_unconfirmed?: boolean;
    send_all?: boolean;
    account?: string;
    additional_outputs?: Array<AdditionalOutput>;
    outpoints?: Array<OutPoint>;
}

export type SendPaymentRequest =
    | {
          payment_request: string;
          amt?: string;
          fee_limit?: FeeLimit;
      }
    | {
          dest_string: string;
          amt: string;
          final_cltv_delta: string;
          payment_hash_string: string;
          fee_limit?: FeeLimit;
      };
