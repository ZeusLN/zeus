export enum LSPOrderState {
    CREATED = 'CREATED',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
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
