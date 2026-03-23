/* eslint-disable */
/** TransactionType is an enum representing the type of transaction. */
export enum TransactionType {
    /** PURCHASE - PURCHASE indicates a purchase transaction. */
    PURCHASE = 'PURCHASE',
    /** SALE - SALE indicates a sale transaction. */
    SALE = 'SALE',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

/**
 * Intent is an enum informing the price oracle about the intent of the price
 * rate query. This is used to provide context for the asset rates being
 * requested, allowing the price oracle to tailor the response based on the
 * specific use case, such as paying an invoice or receiving a payment and the
 * different stages involved in those.
 */
export enum Intent {
    /**
     * INTENT_UNSPECIFIED - INTENT_UNSPECIFIED is used to indicate that the intent of the price rate
     * query is not specified. This is the fallback default value and should not
     * be used in production code. It is primarily used for backward
     * compatibility with older versions of the protocol that did not include
     * intent information.
     */
    INTENT_UNSPECIFIED = 'INTENT_UNSPECIFIED',
    /**
     * INTENT_PAY_INVOICE_HINT - INTENT_PAY_INVOICE_HINT is used to indicate that the user is requesting
     * a price rate hint for paying an invoice. This is typically used by the
     * payer of an invoice to provide a suggestion of the expected asset rate to
     * the RFQ peer (edge node) that will determine the actual rate for the
     * payment.
     */
    INTENT_PAY_INVOICE_HINT = 'INTENT_PAY_INVOICE_HINT',
    /**
     * INTENT_PAY_INVOICE - INTENT_PAY_INVOICE is used to indicate that a peer wants to pay an
     * invoice with assets. This is typically used by the edge node that
     * facilitates the swap from assets to BTC for the payer of an invoice. This
     * intent is used to provide the actual asset rate for the payment, which
     * may differ from the hint provided by the payer.
     */
    INTENT_PAY_INVOICE = 'INTENT_PAY_INVOICE',
    /**
     * INTENT_PAY_INVOICE_QUALIFY - INTENT_PAY_INVOICE_QUALIFY is used to indicate that the payer of an
     * invoice has received an asset rate from their RFQ peer (edge node) and is
     * qualifying the rate for the payment. This is typically used by the payer
     * of an invoice to ensure that the asset rate provided by their peer (edge
     * node) is acceptable before proceeding with the payment.
     */
    INTENT_PAY_INVOICE_QUALIFY = 'INTENT_PAY_INVOICE_QUALIFY',
    /**
     * INTENT_RECV_PAYMENT_HINT - INTENT_RECV_PAYMENT_HINT is used to indicate that the user is requesting
     * a price rate hint for receiving a payment through an invoice. This is
     * typically used by the creator of an invoice to provide a suggestion of
     * the expected asset rate to the RFQ peer (edge node) that will determine
     * the actual rate used for creating an invoice.
     */
    INTENT_RECV_PAYMENT_HINT = 'INTENT_RECV_PAYMENT_HINT',
    /**
     * INTENT_RECV_PAYMENT - INTENT_RECV_PAYMENT is used to indicate that a peer wants to create an
     * invoice to receive a payment with assets. This is typically used by the
     * edge node that facilitates the swap from BTC to assets for the receiver
     * of a payment. This intent is used to provide the actual asset rate for
     * the invoice creation, which may differ from the hint provided by the
     * receiver.
     */
    INTENT_RECV_PAYMENT = 'INTENT_RECV_PAYMENT',
    /**
     * INTENT_RECV_PAYMENT_QUALIFY - INTENT_RECV_PAYMENT_QUALIFY is used to indicate that the creator of an
     * invoice received an asset rate from their RFQ peer (edge node) and is
     * qualifying the rate for the creation of the invoice. This is typically
     * used by the creator of an invoice to ensure that the asset rate provided
     * by their peer (edge node) is acceptable before proceeding with creating
     * the invoice.
     */
    INTENT_RECV_PAYMENT_QUALIFY = 'INTENT_RECV_PAYMENT_QUALIFY',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

/**
 * FixedPoint is a scaled integer representation of a fractional number.
 *
 * This type consists of two integer fields: a coefficient and a scale.
 * Using this format enables precise and consistent representation of fractional
 * numbers while avoiding floating-point data types, which are prone to
 * precision errors.
 *
 * The relationship between the fractional representation and its fixed-point
 * representation is expressed as:
 * ```
 * V = F_c / (10^F_s)
 * ```
 * where:
 *
 * * `V` is the fractional value.
 *
 * * `F_c` is the coefficient component of the fixed-point representation. It is
 *    the scaled-up fractional value represented as an integer.
 *
 * * `F_s` is the scale component. It is an integer specifying how
 *   many decimal places `F_c` should be divided by to obtain the fractional
 *   representation.
 */
export interface FixedPoint {
    /**
     * The coefficient is the fractional value scaled-up as an integer. This
     * integer is represented as a string as it may be too large to fit in a
     * uint64.
     */
    coefficient: string;
    /**
     * The scale is the component that determines how many decimal places
     * the coefficient should be divided by to obtain the fractional value.
     */
    scale: number;
}

/**
 * AssetRates represents the exchange rates for subject and payment assets
 * relative to BTC, expressed as fixed-point numbers. It includes the rates
 * for both assets and an expiration timestamp indicating when the rates
 * are no longer valid.
 */
export interface AssetRates {
    /**
     * subjectAssetRate is the number of subject asset units per BTC represented
     * as a fixed-point number. This field is also commonly referred to as the
     * subject asset to BTC (conversion) rate. When the subject asset is BTC,
     * this field should be set to 100 billion, as one BTC is equivalent to 100
     * billion msats.
     */
    subjectAssetRate: FixedPoint | undefined;
    /**
     * paymentAssetRate is the number of payment asset units per BTC represented
     * as a fixed-point number. This field is also commonly referred to as the
     * payment asset to BTC (conversion) rate. When the payment asset is BTC,
     * this field should be set to 100 billion, as one BTC is equivalent to 100
     * billion msats.
     */
    paymentAssetRate: FixedPoint | undefined;
    /**
     * expiry_timestamp is the Unix timestamp in seconds after which the asset
     * rates are no longer valid.
     */
    expiryTimestamp: string;
}

/**
 * AssetSpecifier is a union type for specifying an asset by either its asset ID
 * or group key.
 */
export interface AssetSpecifier {
    /** The 32-byte asset ID specified as raw bytes (gRPC only). */
    assetId: Uint8Array | string | undefined;
    /** The 32-byte asset ID encoded as a hex string (use this for REST). */
    assetIdStr: string | undefined;
    /** The 32-byte asset group key specified as raw bytes (gRPC only). */
    groupKey: Uint8Array | string | undefined;
    /**
     * The 32-byte asset group key encoded as hex string (use this for
     * REST).
     */
    groupKeyStr: string | undefined;
}

/**
 * QueryAssetRatesRequest specifies the parameters for querying asset exchange
 * rates in a transaction. It includes the transaction type, details about the
 * subject and payment assets, and an optional hint for expected asset rates.
 */
export interface QueryAssetRatesRequest {
    /**
     * transaction_type indicates whether the transaction is a purchase or a
     * sale.
     */
    transactionType: TransactionType;
    /** subject_asset is the asset to be priced for purchase or sale. */
    subjectAsset: AssetSpecifier | undefined;
    /**
     * subject_asset_max_amount is the maximum amount of the subject asset that
     * could be involved in the transaction.
     */
    subjectAssetMaxAmount: string;
    /**
     * payment_asset is the asset used for purchasing or receiving from a sale.
     *
     * NOTE: An asset ID of all zeros indicates that the payment asset is BTC.
     * In this case, the asset rate will be given as milli-satoshi per asset
     * unit
     */
    paymentAsset: AssetSpecifier | undefined;
    /**
     * payment_asset_max_amount is the maximum amount of the payment asset that
     * could be involved in the transaction. This field is optional. If set to
     * zero, it is considered unset.
     */
    paymentAssetMaxAmount: string;
    /**
     * asset_rates_hint is an optional suggestion of asset rates for the
     * transaction, intended to provide guidance on expected pricing.
     */
    assetRatesHint: AssetRates | undefined;
    /**
     * intent informs the price oracle about the stage of the payment flow that
     * lead to the price rate query. This is used to provide context for the
     * asset rates being requested, allowing the price oracle to tailor the
     * response based on the specific use case, such as paying an invoice or
     * receiving a payment and the different stages involved in those. This
     * field will only be set by tapd v0.7.0 and later.
     */
    intent: Intent;
    /**
     * counterparty_id is the 33-byte public key of the peer that is on the
     * opposite side of the transaction. This field will only be set by tapd
     * v0.7.0 and later and only if the user initiating the transaction (sending
     * a payment or creating an invoice) opted in to sharing their peer ID with
     * the price oracle.
     */
    counterpartyId: Uint8Array | string;
    /**
     * metadata is an optional text field that can be used to provide
     * additional metadata about the transaction to the price oracle. This can
     * include information about the wallet end user that initiated the
     * transaction, or any authentication information that the price oracle
     * can use to give out a more accurate (or discount) asset rate. Though not
     * verified or enforced by tapd, the suggested format for this field is a
     * JSON string. This field is optional and can be left empty if no metadata
     * is available. The maximum length of this field is 32'768 bytes. This
     * field will only be set by tapd v0.7.0 and later.
     */
    metadata: string;
}

/**
 * QueryAssetRatesOkResponse is the successful response to a
 * QueryAssetRates call.
 */
export interface QueryAssetRatesOkResponse {
    /** asset_rates is the asset exchange rates for the transaction. */
    assetRates: AssetRates | undefined;
}

/** QueryAssetRatesErrResponse is the error response to a QueryAssetRates call. */
export interface QueryAssetRatesErrResponse {
    /** error is the error message. */
    message: string;
    /** code is the error code. */
    code: number;
}

/** QueryAssetRatesResponse is the response from a QueryAssetRates RPC call. */
export interface QueryAssetRatesResponse {
    /** ok is the successful response to the query. */
    ok: QueryAssetRatesOkResponse | undefined;
    /** error is the error response to the query. */
    error: QueryAssetRatesErrResponse | undefined;
}

export interface PriceOracle {
    /**
     * QueryAssetRates retrieves the exchange rate between a tap asset and BTC for
     * a specified transaction type, subject asset, and payment asset. The asset
     * rate represents the number of tap asset units per BTC.
     */
    queryAssetRates(
        request?: DeepPartial<QueryAssetRatesRequest>
    ): Promise<QueryAssetRatesResponse>;
}

type Builtin =
    | Date
    | Function
    | Uint8Array
    | string
    | number
    | boolean
    | undefined;

type DeepPartial<T> = T extends Builtin
    ? T
    : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : T extends {}
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : Partial<T>;
