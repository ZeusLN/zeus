import type { RouteHint, Invoice } from '../lightning';
export declare enum LookupModifier {
    /** DEFAULT - The default look up modifier, no look up behavior is changed. */
    DEFAULT = "DEFAULT",
    /**
     * HTLC_SET_ONLY - Indicates that when a look up is done based on a set_id, then only that set
     * of HTLCs related to that set ID should be returned.
     */
    HTLC_SET_ONLY = "HTLC_SET_ONLY",
    /**
     * HTLC_SET_BLANK - Indicates that when a look up is done using a payment_addr, then no HTLCs
     * related to the payment_addr should be returned. This is useful when one
     * wants to be able to obtain the set of associated setIDs with a given
     * invoice, then look up the sub-invoices "projected" by that set ID.
     */
    HTLC_SET_BLANK = "HTLC_SET_BLANK",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export interface CancelInvoiceMsg {
    /**
     * Hash corresponding to the (hold) invoice to cancel. When using
     * REST, this field must be encoded as base64.
     */
    paymentHash: Uint8Array | string;
}
export interface CancelInvoiceResp {
}
export interface AddHoldInvoiceRequest {
    /**
     * An optional memo to attach along with the invoice. Used for record keeping
     * purposes for the invoice's creator, and will also be set in the description
     * field of the encoded payment request if the description_hash field is not
     * being used.
     */
    memo: string;
    /** The hash of the preimage */
    hash: Uint8Array | string;
    /**
     * The value of this invoice in satoshis
     *
     * The fields value and value_msat are mutually exclusive.
     */
    value: string;
    /**
     * The value of this invoice in millisatoshis
     *
     * The fields value and value_msat are mutually exclusive.
     */
    valueMsat: string;
    /**
     * Hash (SHA-256) of a description of the payment. Used if the description of
     * payment (memo) is too long to naturally fit within the description field
     * of an encoded payment request.
     */
    descriptionHash: Uint8Array | string;
    /** Payment request expiry time in seconds. Default is 86400 (24 hours). */
    expiry: string;
    /** Fallback on-chain address. */
    fallbackAddr: string;
    /** Delta to use for the time-lock of the CLTV extended to the final hop. */
    cltvExpiry: string;
    /**
     * Route hints that can each be individually used to assist in reaching the
     * invoice's destination.
     */
    routeHints: RouteHint[];
    /** Whether this invoice should include routing hints for private channels. */
    private: boolean;
}
export interface AddHoldInvoiceResp {
    /**
     * A bare-bones invoice for a payment within the Lightning Network. With the
     * details of the invoice, the sender has all the data necessary to send a
     * payment to the recipient.
     */
    paymentRequest: string;
    /**
     * The "add" index of this invoice. Each newly created invoice will increment
     * this index making it monotonically increasing. Callers to the
     * SubscribeInvoices call can use this to instantly get notified of all added
     * invoices with an add_index greater than this one.
     */
    addIndex: string;
    /**
     * The payment address of the generated invoice. This value should be used
     * in all payments for this invoice as we require it for end to end
     * security.
     */
    paymentAddr: Uint8Array | string;
}
export interface SettleInvoiceMsg {
    /**
     * Externally discovered pre-image that should be used to settle the hold
     * invoice.
     */
    preimage: Uint8Array | string;
}
export interface SettleInvoiceResp {
}
export interface SubscribeSingleInvoiceRequest {
    /**
     * Hash corresponding to the (hold) invoice to subscribe to. When using
     * REST, this field must be encoded as base64url.
     */
    rHash: Uint8Array | string;
}
export interface LookupInvoiceMsg {
    /** When using REST, this field must be encoded as base64. */
    paymentHash: Uint8Array | string | undefined;
    paymentAddr: Uint8Array | string | undefined;
    setId: Uint8Array | string | undefined;
    lookupModifier: LookupModifier;
}
/**
 * Invoices is a service that can be used to create, accept, settle and cancel
 * invoices.
 */
export interface Invoices {
    /**
     * SubscribeSingleInvoice returns a uni-directional stream (server -> client)
     * to notify the client of state transitions of the specified invoice.
     * Initially the current invoice state is always sent out.
     */
    subscribeSingleInvoice(request?: DeepPartial<SubscribeSingleInvoiceRequest>, onMessage?: (msg: Invoice) => void, onError?: (err: Error) => void): void;
    /**
     * CancelInvoice cancels a currently open invoice. If the invoice is already
     * canceled, this call will succeed. If the invoice is already settled, it will
     * fail.
     */
    cancelInvoice(request?: DeepPartial<CancelInvoiceMsg>): Promise<CancelInvoiceResp>;
    /**
     * AddHoldInvoice creates a hold invoice. It ties the invoice to the hash
     * supplied in the request.
     */
    addHoldInvoice(request?: DeepPartial<AddHoldInvoiceRequest>): Promise<AddHoldInvoiceResp>;
    /**
     * SettleInvoice settles an accepted invoice. If the invoice is already
     * settled, this call will succeed.
     */
    settleInvoice(request?: DeepPartial<SettleInvoiceMsg>): Promise<SettleInvoiceResp>;
    /**
     * LookupInvoiceV2 attempts to look up at invoice. An invoice can be refrenced
     * using either its payment hash, payment address, or set ID.
     */
    lookupInvoiceV2(request?: DeepPartial<LookupInvoiceMsg>): Promise<Invoice>;
}
declare type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
declare type DeepPartial<T> = T extends Builtin ? T : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
export {};
//# sourceMappingURL=invoices.d.ts.map