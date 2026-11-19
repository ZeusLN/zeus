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
// can go. The extra minute covers rounding: the LSP turns the expiry time
// into a relative expiry against its own clock, and its node stamps the
// invoice with a creation time taken later, possibly on another host.
const MAX_WRAPPED_EXTRA_EXPIRY_SECONDS = 3600 + 60;

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
