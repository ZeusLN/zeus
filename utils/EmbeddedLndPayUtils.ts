import Base64Utils from './Base64Utils';
import Bolt11Utils from './Bolt11Utils';

// The native LND bridges (LndMobile.java, Lndmobile.swift) emit stream events
// keyed by method name alone, so every in-flight RouterSendPaymentV2 call
// receives every other call's events. Terminal lnrpc.Payment updates carry
// payment_hash, which lets each caller filter for its own payment. Stream
// error events carry only error_code/error_desc and cannot be correlated.

const HEX_64 = /^[0-9a-fA-F]{64}$/;

// The hex payment hash a RouterSendPaymentV2 call should expect its terminal
// event to carry, or null when correlation isn't possible. AMP payments skip
// correlation: lnd derives a hash per attempt, so the request-side hash never
// matches the event's.
export const getExpectedPaymentHash = (options: {
    amp?: boolean | null;
    payment_hash?: string | Uint8Array | number[] | null;
    payment_request?: string | null;
}): string | null => {
    if (options.amp) return null;

    const { payment_hash, payment_request } = options;
    try {
        if (payment_hash) {
            if (typeof payment_hash === 'string') {
                // keysend callers pass base64; tolerate hex too
                return HEX_64.test(payment_hash)
                    ? payment_hash.toLowerCase()
                    : Base64Utils.base64ToHex(payment_hash).toLowerCase();
            }
            return Base64Utils.bytesToHex(
                Array.from(payment_hash)
            ).toLowerCase();
        }
        if (payment_request) {
            return (
                Bolt11Utils.decode(
                    payment_request
                ).payment_hash?.toLowerCase() || null
            );
        }
    } catch (e) {
        // fall through: an undecodable request means no correlation,
        // not a failed payment
    }
    return null;
};

export const matchesExpectedPayment = (
    expectedPaymentHash: string | null,
    payment?: { payment_hash?: string | null } | null
): boolean => {
    // no correlation possible: fall back to first-event behavior
    if (!expectedPaymentHash) return true;
    // terminal updates always carry a hash; treat a missing one as a match
    // rather than risk a payment that never resolves
    if (!payment || !payment.payment_hash) return true;
    return payment.payment_hash.toLowerCase() === expectedPaymentHash;
};

export default { getExpectedPaymentHash, matchesExpectedPayment };
