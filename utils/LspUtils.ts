import BigNumber from 'bignumber.js';

import Bolt11Utils from './Bolt11Utils';

export type WrappedInvoiceError =
    | 'decode_failure'
    | 'network_mismatch'
    | 'payment_hash_mismatch'
    | 'amount_missing'
    | 'amount_mismatch';

export interface WrappedInvoiceCheck {
    valid: boolean;
    error?: WrappedInvoiceError;
}

const fail = (error: WrappedInvoiceError): WrappedInvoiceCheck => ({
    valid: false,
    error
});

/**
 * Verifies a Flow 2.0 wrapped invoice (jit_bolt11) against the inner
 * invoice it is supposed to wrap. The wrap is only trust-minimized when
 * it commits to the same payment hash: the LSP cannot settle the payer's
 * HTLC without forwarding to us, because only our node holds the
 * preimage. The amount bound stops the LSP from charging the payer more
 * than the fee it quoted.
 */
export function verifyWrappedInvoice(
    innerBolt11: string,
    wrappedBolt11: string,
    maxFeeSats: number
): WrappedInvoiceCheck {
    let inner, wrapped;
    try {
        inner = Bolt11Utils.decode(innerBolt11);
        wrapped = Bolt11Utils.decode(wrappedBolt11);
    } catch (e) {
        return fail('decode_failure');
    }

    if (
        !inner.network?.bech32 ||
        wrapped.network?.bech32 !== inner.network.bech32
    ) {
        return fail('network_mismatch');
    }

    if (
        !inner.payment_hash ||
        !wrapped.payment_hash ||
        wrapped.payment_hash.toLowerCase() !== inner.payment_hash.toLowerCase()
    ) {
        return fail('payment_hash_mismatch');
    }

    // millisatoshis is null exactly when the invoice carries no amount;
    // fail closed rather than treating a missing amount as zero
    if (inner.millisatoshis == null || wrapped.millisatoshis == null) {
        return fail('amount_missing');
    }

    const innerMsat = new BigNumber(inner.millisatoshis);
    const wrappedMsat = new BigNumber(wrapped.millisatoshis);
    // zeroConfFee is truncated to whole sats from the LSP's msat quote,
    // so when a fee was quoted allow up to 999 msat of rounding on top;
    // with no quote the wrapped amount must match the inner exactly
    const fee = new BigNumber(maxFeeSats || 0);
    const maxWrappedMsat = innerMsat
        .plus(fee.times(1000))
        .plus(fee.gt(0) ? 999 : 0);
    if (wrappedMsat.lt(innerMsat) || wrappedMsat.gt(maxWrappedMsat)) {
        return fail('amount_mismatch');
    }

    return { valid: true };
}

export type OrderInvoiceError =
    | 'decode_failure'
    | 'order_total_invalid'
    | 'amount_missing'
    | 'amount_mismatch';

export interface OrderInvoiceCheck {
    valid: boolean;
    error?: OrderInvoiceError;
}

/**
 * Verifies an LSPS1/LSPS7 order invoice against the order total the LSP
 * returned alongside it. Both come from the LSP, so this cannot catch an
 * LSP that quotes a high total; it stops the screen from showing one
 * amount while the invoice asks for another. LSPS1/LSPS7 orders carry no
 * separate payment hash, so there is nothing else to bind the invoice to.
 */
export function verifyOrderInvoice(
    bolt11: string,
    orderTotalSat: string | number | undefined
): OrderInvoiceCheck {
    // LSPS1 encodes sat amounts as decimal strings; accept plain numbers too
    if (!/^[1-9]\d*$/.test(String(orderTotalSat ?? ''))) {
        return { valid: false, error: 'order_total_invalid' };
    }
    const totalSat = new BigNumber(String(orderTotalSat));

    let decoded;
    try {
        decoded = Bolt11Utils.decode(bolt11);
    } catch (e) {
        return { valid: false, error: 'decode_failure' };
    }

    // an amountless invoice lets the payer's wallet pick any amount
    if (decoded.millisatoshis == null) {
        return { valid: false, error: 'amount_missing' };
    }

    if (!new BigNumber(decoded.millisatoshis).eq(totalSat.times(1000))) {
        return { valid: false, error: 'amount_mismatch' };
    }

    return { valid: true };
}
