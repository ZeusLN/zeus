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

const isScalarRecord = (value: any): boolean =>
    isPlainObject(value) && Object.values(value).every(isScalar);

// payment options that are objects; every other payment field is a scalar
const PAYMENT_OPTION_KEYS = ['bolt11', 'bolt12', 'onchain', 'onchain_payment'];

/**
 * Returns true if an LSPS1/LSPS7 order response (with or without the
 * JSON-RPC `result` wrapper) has the shape the order screens and the
 * Activity list read: a non-empty order_id string and scalar fields,
 * except `payment` (scalars, plus the payment options as objects of
 * scalars) and `channel` (scalars, plus `original_order` as an object of
 * scalars and `extension_order_ids` as a list of scalars).
 */
export const isValidOrderResponse = (order: any): boolean => {
    const result = order?.result || order;
    if (!isPlainObject(result)) return false;
    if (typeof result.order_id !== 'string' || !result.order_id) return false;

    const { payment, channel, ...fields } = result;
    if (!Object.values(fields).every(isScalar)) return false;

    if (payment != null) {
        if (!isPlainObject(payment)) return false;
        const paymentValid = Object.entries(payment).every(([key, value]) =>
            PAYMENT_OPTION_KEYS.includes(key)
                ? value == null || isScalarRecord(value)
                : isScalar(value)
        );
        if (!paymentValid) return false;
    }

    if (channel != null) {
        if (!isPlainObject(channel)) return false;
        const { original_order, extension_order_ids, ...channelFields } =
            channel;
        if (!Object.values(channelFields).every(isScalar)) return false;
        if (original_order != null && !isScalarRecord(original_order)) {
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
