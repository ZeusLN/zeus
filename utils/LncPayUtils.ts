import Base64Utils from './Base64Utils';
import Bolt11Utils from './Bolt11Utils';

export type LncPayEventDecision =
    | { kind: 'ignore' }
    | { kind: 'terminal'; result: any }
    | { kind: 'error'; error: Error };

const HEX_32_BYTES = /^[0-9a-fA-F]{64}$/;

// Normalizes a payment hash to lowercase hex. Accepts 64-char hex or
// base64-encoded 32 bytes: requests carry base64 (LND REST convention)
// while LNC stream events carry hex, and callers shouldn't care which.
export const normalizePaymentHash = (hash: unknown): string | undefined => {
    if (typeof hash !== 'string' || !hash) return undefined;
    if (HEX_32_BYTES.test(hash)) return hash.toLowerCase();
    try {
        const hex = Base64Utils.base64ToHex(hash);
        if (HEX_32_BYTES.test(hex)) return hex.toLowerCase();
    } catch {}
    return undefined;
};

// Derives the payment hash (lowercase hex) an outgoing SendPaymentV2
// request expects its result events to carry. Returns undefined when no
// hash can be pinned down, in which case the caller must fall back to
// accepting the first terminal event on the stream:
// - AMP payments: lnd derives per-attempt hashes, so the request-side
//   hash never matches the events; correlating would filter out the
//   payment's own result.
// - keysend: the store builds payment_hash (base64) from its preimage.
// - bolt11: the hash is inside the invoice.
export const deriveExpectedPaymentHash = (data: {
    payment_hash?: string;
    payment_request?: string;
    amp?: boolean;
}): string | undefined => {
    if (data.amp) return undefined;
    if (data.payment_hash) return normalizePaymentHash(data.payment_hash);
    if (data.payment_request) {
        try {
            return normalizePaymentHash(
                Bolt11Utils.decode(data.payment_request).payment_hash
            );
        } catch {
            return undefined;
        }
    }
    return undefined;
};

// Classifies one raw `event.result` string from the shared
// 'routerrpc.Router.SendPaymentV2' LNC event channel. Everything on that
// channel shares one shape: JSON text of an lnrpc.Payment, the 'EOF'
// stream-close sentinel, or a raw Go error string (the native module has
// no separate error channel). Events with a parseable payment_hash that
// differs from expectedHashHex belong to a concurrent payment on the
// same channel; events without one are tolerated as matches so a payment
// is never stranded by a sparse event.
export const decideLncPayEvent = (
    eventResult: unknown,
    expectedHashHex?: string
): LncPayEventDecision => {
    if (
        !eventResult ||
        typeof eventResult !== 'string' ||
        eventResult === 'EOF'
    ) {
        return { kind: 'ignore' };
    }

    let result: any;
    try {
        result = JSON.parse(eventResult);
    } catch {
        return { kind: 'error', error: new Error(eventResult) };
    }
    if (typeof result !== 'object' || result === null) {
        return { kind: 'error', error: new Error(eventResult) };
    }

    if (result.status === 'IN_FLIGHT') return { kind: 'ignore' };

    if (expectedHashHex) {
        const eventHash = normalizePaymentHash(result.payment_hash);
        if (eventHash && eventHash !== expectedHashHex) {
            return { kind: 'ignore' };
        }
    }

    return { kind: 'terminal', result };
};
