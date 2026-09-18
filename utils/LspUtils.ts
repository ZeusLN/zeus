import BigNumber from 'bignumber.js';

import Bolt11Utils from './Bolt11Utils';

export type WrappedInvoiceError =
    | 'decode_failure'
    | 'network_mismatch'
    | 'payment_hash_mismatch'
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

    const innerMsat = new BigNumber(inner.num_msat || 0);
    const wrappedMsat = new BigNumber(wrapped.num_msat || 0);
    // zeroConfFee is truncated to whole sats from the LSP's msat quote,
    // so allow up to 999 msat of rounding on top of the quoted fee
    const maxWrappedMsat = innerMsat
        .plus(new BigNumber(maxFeeSats || 0).times(1000))
        .plus(999);
    if (wrappedMsat.lt(innerMsat) || wrappedMsat.gt(maxWrappedMsat)) {
        return fail('amount_mismatch');
    }

    return { valid: true };
}
