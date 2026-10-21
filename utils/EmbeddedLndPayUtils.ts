// The native LND bridges (LndMobile.java, Lndmobile.swift) emit stream events
// keyed by method name alone, so every in-flight RouterSendPaymentV2 call
// receives every other call's events. Terminal lnrpc.Payment updates carry
// payment_hash, which lets each caller filter for its own payment. Stream
// error events carry only error_code/error_desc and cannot be correlated.
// The expected hash comes from LncPayUtils.deriveExpectedPaymentHash, the
// same helper TransactionsStore uses for the hash it tracks.

export const matchesExpectedPayment = (
    expectedPaymentHash: string | null | undefined,
    payment?: { payment_hash?: string | null } | null
): boolean => {
    // no correlation possible: fall back to first-event behavior
    if (!expectedPaymentHash) return true;
    // terminal updates always carry a hash; treat a missing one as a match
    // rather than risk a payment that never resolves
    if (!payment || !payment.payment_hash) return true;
    return payment.payment_hash.toLowerCase() === expectedPaymentHash;
};

export default { matchesExpectedPayment };
