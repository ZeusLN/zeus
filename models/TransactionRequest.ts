type FeeLimit = { percent: string } | { fixed: string };

export default interface TransactionRequest {
    target_conf?: Number | null; // optional
    addr?: string;
    sat_per_byte?: string | null; // optional
    amount?: string;
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
