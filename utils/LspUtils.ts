import BigNumber from 'bignumber.js';

import Bolt11Utils from './Bolt11Utils';

export type WrappedInvoiceError =
    | 'decode_failure'
    | 'network_mismatch'
    | 'payment_hash_mismatch'
    | 'amount_missing'
    | 'amount_mismatch'
    | 'expiry_mismatch'
    | 'cltv_mismatch';

export interface WrappedInvoiceCheck {
    valid: boolean;
    error?: WrappedInvoiceError;
}

const fail = (error: WrappedInvoiceError): WrappedInvoiceCheck => ({
    valid: false,
    error
});

// Olympus sets the wrapped invoice to expire one hour after the inner
// invoice (olympus-flow hodlExpiry). Payments that arrive after the inner
// invoice expires fail anyway; this only bounds how far past it the LSP
// can go.
const MAX_WRAPPED_EXTRA_EXPIRY_SECONDS = 3600;

// The wrap's final CLTV must cover the inner one plus the LSP's own
// delta (Olympus adds 40). Anything far above that only lengthens how
// long the payer's HTLC can be held.
const MAX_WRAPPED_EXTRA_CLTV_BLOCKS = 144;

// BOLT 11: min_final_cltv_expiry defaults to 18 when the c field is absent
const DEFAULT_MIN_FINAL_CLTV_EXPIRY = 18;

/**
 * Verifies a Flow 2.0 wrapped invoice (jit_bolt11) against the inner
 * invoice it is supposed to wrap. The wrap is only trust-minimized when
 * it commits to the same payment hash: the LSP cannot settle the payer's
 * HTLC without forwarding to us, because only our node holds the
 * preimage. The amount bound stops the LSP from charging the payer more
 * than the fee it quoted. The expiry bound limits how long after our
 * invoice expires the wrap still takes payments, and the final CLTV bound
 * stops the LSP from asking the payer to lock funds for much longer than
 * the forward needs.
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

    // decode() fills in the BOLT 11 default expiry, so both are set
    if (
        inner.timeExpireDate == null ||
        wrapped.timeExpireDate == null ||
        wrapped.timeExpireDate >
            inner.timeExpireDate + MAX_WRAPPED_EXTRA_EXPIRY_SECONDS
    ) {
        return fail('expiry_mismatch');
    }

    const innerCltv = inner.cltv_expiry ?? DEFAULT_MIN_FINAL_CLTV_EXPIRY;
    const wrappedCltv = wrapped.cltv_expiry ?? DEFAULT_MIN_FINAL_CLTV_EXPIRY;
    if (
        wrappedCltv < innerCltv ||
        wrappedCltv > innerCltv + MAX_WRAPPED_EXTRA_CLTV_BLOCKS
    ) {
        return fail('cltv_mismatch');
    }

    return { valid: true };
}
