export enum LSPOrderState {
    CREATED = 'CREATED',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

export enum LSPService {
    LSPS1 = 'LSPS1',
    LSPS7 = 'LSPS7'
}

export enum PaymentAwaitState {
    POLLING = 'polling',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export interface LSPActivity {
    model: 'LSPS1Order' | 'LSPS7Order';
    state: LSPOrderState;
    getAmount: number;
    getTimestamp: number;
    getDate: Date;
    getDisplayTimeShort: string;
}

/**
 * Returns true if the order's payment object indicates no payment is required,
 * i.e. the LSP omitted every payment option (per BLIP-51 §3, "The LSP MAY omit
 * payment options"). Used when a discount token grants a free channel or
 * channel extension and the server returns `payment: {}`.
 *
 * A missing `payment` object is treated as not-free — the response is
 * malformed per spec, so we don't claim "free" without evidence.
 */
export const isOrderFree = (payment: any): boolean => {
    if (!payment) return false;
    return (
        !payment.bolt11 &&
        !payment.bolt12 &&
        !payment.onchain &&
        !payment.lightning_invoice &&
        !payment.bolt11_invoice
    );
};

const isScalar = (value: any): boolean =>
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean';

const isPlainObject = (value: any): boolean =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

// true if each of the named fields is missing or a scalar
const hasScalarFields = (value: any, keys: string[]): boolean =>
    keys.every((key) => isScalar(value[key]));

// The fields the order screens, the orders list and the Activity list read.
// No reader iterates over the keys of an order, so a field that is not
// named here is never read and is not checked.
const ORDER_FIELDS = [
    'lsp_balance_sat',
    'client_balance_sat',
    'announce_channel',
    'channel_expiry_blocks',
    'funding_confirms_within_blocks',
    'created_at',
    'expires_at',
    'channel_extension_expiry_blocks',
    'new_channel_expiry_block'
];
const PAYMENT_FIELDS = [
    'state',
    'order_total_sat',
    'fee_total_sat',
    'lightning_invoice',
    'bolt11_invoice',
    'min_fee_for_0conf',
    'min_onchain_payment_confirmations',
    'onchain_address'
];
// payment options that are objects, with the fields read from each
const PAYMENT_OPTION_FIELDS: { [option: string]: string[] } = {
    bolt11: [
        'state',
        'order_total_sat',
        'fee_total_sat',
        'expires_at',
        'invoice'
    ],
    bolt12: [],
    onchain: [
        'order_total_sat',
        'fee_total_sat',
        'expires_at',
        'address',
        'min_fee_for_0conf',
        'min_onchain_payment_confirmations'
    ],
    onchain_payment: []
};
const CHANNEL_FIELDS = [
    'funding_outpoint',
    'funded_at',
    'expires_at',
    'short_channel_id',
    'max_channel_extension_expiry_blocks',
    'expiration_block'
];
const ORIGINAL_ORDER_FIELDS = ['id', 'service'];

/**
 * Returns true if an LSPS1/LSPS7 order response (with or without the
 * JSON-RPC `result` wrapper) has the shape the order screens and the
 * Activity list read: a non-empty order_id string, a string order_state
 * if there is one, and scalars in the other fields they read from the
 * order, from `payment` and its payment options (which are objects) and
 * from `channel` (plus `original_order` as an object and
 * `extension_order_ids` as a list of scalars). Fields they do not read are
 * ignored, so an LSP can add fields of any type.
 */
export const isValidOrderResponse = (order: any): boolean => {
    const result = order?.result || order;
    if (!isPlainObject(result)) return false;
    if (typeof result.order_id !== 'string' || !result.order_id) return false;
    // the Activity list calls string methods on the order state
    if (result.order_state != null && typeof result.order_state !== 'string') {
        return false;
    }
    if (!hasScalarFields(result, ORDER_FIELDS)) return false;

    const { payment, channel } = result;

    if (payment != null) {
        if (!isPlainObject(payment)) return false;
        if (!hasScalarFields(payment, PAYMENT_FIELDS)) return false;
        const optionsValid = Object.entries(PAYMENT_OPTION_FIELDS).every(
            ([option, fields]) =>
                payment[option] == null ||
                (isPlainObject(payment[option]) &&
                    hasScalarFields(payment[option], fields))
        );
        if (!optionsValid) return false;
    }

    if (channel != null) {
        if (!isPlainObject(channel)) return false;
        if (!hasScalarFields(channel, CHANNEL_FIELDS)) return false;
        const { original_order, extension_order_ids } = channel;
        if (
            original_order != null &&
            !(
                isPlainObject(original_order) &&
                hasScalarFields(original_order, ORIGINAL_ORDER_FIELDS)
            )
        ) {
            return false;
        }
        if (
            extension_order_ids != null &&
            !(
                Array.isArray(extension_order_ids) &&
                extension_order_ids.every(isScalar)
            )
        ) {
            return false;
        }
    }

    return true;
};

/**
 * Builds the navigation params for the LSPS payment-await screen from an order's
 * payment object. Shared by every LSPS1/LSPS7 "make payment" call site.
 */
export const buildPaymentAwaitParams = (
    payment: any,
    orderId: string,
    service: LSPService
) => ({
    orderId,
    invoice:
        payment?.bolt11?.invoice ||
        payment?.lightning_invoice ||
        payment?.bolt11_invoice,
    satAmount:
        payment?.bolt11?.order_total_sat ||
        payment?.order_total_sat ||
        payment?.bolt11?.fee_total_sat ||
        payment?.fee_total_sat,
    service
});

/**
 * Returns the amount to send for an order's on-chain payment option. The
 * client must pay order_total_sat, which for LSPS1 includes the requested
 * client balance on top of fee_total_sat. fee_total_sat is only used when
 * the LSP omits order_total_sat.
 */
export const getOnchainPaymentAmount = (payment: any) =>
    payment?.onchain?.order_total_sat || payment?.onchain?.fee_total_sat;
