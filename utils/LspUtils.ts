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

export interface OrderTerms {
    lsp_balance_sat?: number | string;
    client_balance_sat?: number | string;
    channel_expiry_blocks?: number | string;
    required_channel_confirmations?: number | string;
    funding_confirms_within_blocks?: number | string;
    announce_channel?: boolean;
}

export interface OrderTermsCheck {
    valid: boolean;
    mismatches: Array<keyof OrderTerms>;
}

// How each requested term may differ in the LSP's answer. Balances and
// announce_channel must match exactly. The others are guarantees, so the
// LSP may only improve on them: keep the channel open at least as long,
// wait for at least as many confirmations, fund at least as fast.
const ORDER_TERM_RULES: Record<
    Exclude<keyof OrderTerms, 'announce_channel'>,
    'equal' | 'atLeast' | 'atMost'
> = {
    lsp_balance_sat: 'equal',
    client_balance_sat: 'equal',
    channel_expiry_blocks: 'atLeast',
    required_channel_confirmations: 'atLeast',
    funding_confirms_within_blocks: 'atMost'
};

const toNumber = (value: any): BigNumber | null => {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const n = new BigNumber(value);
    return n.isFinite() ? n : null;
};

/**
 * Compares an LSPS1 create_order response with the terms the wallet
 * requested. Only terms that were actually sent are checked: pass
 * undefined (or a value that is not a number) for a term the request
 * left to the LSP. A requested term missing from the response is a
 * mismatch. Accepts the order itself or a JSON-RPC reply wrapping it.
 */
export function verifyOrderTerms(
    requested: OrderTerms,
    response: any
): OrderTermsCheck {
    const order = response?.result ?? response;
    const mismatches: Array<keyof OrderTerms> = [];

    (
        Object.keys(ORDER_TERM_RULES) as Array<keyof typeof ORDER_TERM_RULES>
    ).forEach((key) => {
        const want = toNumber(requested[key]);
        if (want === null) return;
        const got = toNumber(order?.[key]);
        const rule = ORDER_TERM_RULES[key];
        if (
            got === null ||
            (rule === 'equal' && !got.eq(want)) ||
            (rule === 'atLeast' && got.lt(want)) ||
            (rule === 'atMost' && got.gt(want))
        ) {
            mismatches.push(key);
        }
    });

    if (
        typeof requested.announce_channel === 'boolean' &&
        order?.announce_channel !== requested.announce_channel
    ) {
        mismatches.push('announce_channel');
    }

    return { valid: mismatches.length === 0, mismatches };
}
