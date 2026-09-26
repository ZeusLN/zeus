import { lnrpc } from '../proto/lightning';
import Bolt11Utils from './Bolt11Utils';
import { localeString } from './LocaleUtils';

// The pending time is measured by the sender's node, so it includes the
// round trip across the route. Below this, a rejection at the final hop is
// treated as prompt; a slow route or peer reconnect can take several seconds
// on its own. At or above it, the recipient's node held the HTLC before
// failing it back, which is what a canceled hold invoice looks like to the
// payer.
export const MIN_REPORTED_HOLD_SECONDS = 15;

// BOLT 11: min_final_cltv_expiry_delta when the invoice omits the c field
const DEFAULT_MIN_FINAL_CLTV_EXPIRY = 18;

// int64 fields arrive as strings over REST/LNC and as Long objects from the
// embedded LND protobuf decoder
const toNumber = (value: any): number => {
    if (value == null) return NaN;
    if (typeof value === 'object' && typeof value.toNumber === 'function') {
        return value.toNumber();
    }
    return Number(value);
};

// enums arrive as names over REST/LNC and as numbers from embedded LND
const isEnumValue = (value: any, name: string, enumValue: number) =>
    value === name || value === enumValue;

const getMinFinalCltvExpiry = (paymentRequest: any): number | null => {
    if (typeof paymentRequest !== 'string' || !paymentRequest) return null;
    try {
        const { cltv_expiry } = Bolt11Utils.decode(paymentRequest);
        return cltv_expiry ?? DEFAULT_MIN_FINAL_CLTV_EXPIRY;
    } catch {
        return null;
    }
};

/**
 * Looks through an lnrpc.Payment's HTLC attempts for one that the final hop
 * (the recipient's node) failed with INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS,
 * the code a node returns for a canceled hold invoice as well as for an
 * unknown, expired, or already paid invoice, and for an HTLC whose expiry
 * is too close to the recipient's block height.
 *
 * Returns null when no attempt was rejected by the recipient. Otherwise
 * returns how long the longest of those attempts was pending, from dispatch
 * by the sender's node until the failure came back, when that is at least
 * MIN_REPORTED_HOLD_SECONDS; heldSeconds is null for a prompt rejection or
 * when the timestamps are missing.
 *
 * senderBehindChain is set when a prompt rejection carried a block height
 * that makes the HTLC's expiry too soon for the invoice's
 * min_final_cltv_expiry. lnd picks the expiry from its own block height
 * plus a few blocks of padding, so this means the sender's node is behind
 * the chain, and paying again once it has synced can succeed. Held HTLCs
 * are not checked: the recipient accepted them on arrival, and its height
 * keeps advancing while it holds them.
 */
export const getRecipientRejection = (
    payment: any
): { heldSeconds: number | null; senderBehindChain: boolean } | null => {
    const htlcs: any[] = Array.isArray(payment?.htlcs) ? payment.htlcs : [];
    let rejected = false;
    let heldSeconds: number | null = null;
    let senderBehindChain = false;
    let minFinalCltvExpiry: number | null | undefined;

    for (const htlc of htlcs) {
        const failure = htlc?.failure;
        const hops = htlc?.route?.hops;
        if (
            !failure ||
            !Array.isArray(hops) ||
            hops.length === 0 ||
            !isEnumValue(
                htlc.status,
                'FAILED',
                lnrpc.HTLCAttempt.HTLCStatus.FAILED
            ) ||
            !isEnumValue(
                failure.code,
                'INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS',
                lnrpc.Failure.FailureCode.INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS
            ) ||
            // position 0 is the sender, so the final hop is hops.length
            toNumber(failure.failure_source_index) !== hops.length
        ) {
            continue;
        }

        rejected = true;
        const pendingSeconds =
            (toNumber(htlc.resolve_time_ns) - toNumber(htlc.attempt_time_ns)) /
            1e9;
        if (
            Number.isFinite(pendingSeconds) &&
            pendingSeconds >= MIN_REPORTED_HOLD_SECONDS
        ) {
            if (heldSeconds === null || pendingSeconds > heldSeconds) {
                heldSeconds = pendingSeconds;
            }
            continue;
        }

        const recipientHeight = toNumber(failure.height);
        const finalHopExpiry = toNumber(hops[hops.length - 1]?.expiry);
        if (
            !(recipientHeight > 0) ||
            !(finalHopExpiry > 0) ||
            senderBehindChain
        ) {
            continue;
        }
        if (minFinalCltvExpiry === undefined) {
            minFinalCltvExpiry = getMinFinalCltvExpiry(
                payment?.payment_request
            );
        }
        if (
            minFinalCltvExpiry !== null &&
            finalHopExpiry < recipientHeight + minFinalCltvExpiry
        ) {
            senderBehindChain = true;
        }
    }

    return rejected ? { heldSeconds, senderBehindChain } : null;
};

// Rounds a pending duration down to its largest whole unit, e.g. 134
// seconds becomes '2 minutes'. The unit boundaries keep every value at 2 or
// more (durations under MIN_REPORTED_HOLD_SECONDS are not reported), so only
// plural forms are needed.
export const formatHeldDuration = (seconds: number): string => {
    const format = (count: number, unit: string) =>
        localeString(`views.SendingLightning.heldDuration.${unit}`, {
            count: String(Math.floor(count))
        });
    if (seconds < 120) return format(seconds, 'seconds');
    if (seconds < 2 * 3600) return format(seconds / 60, 'minutes');
    if (seconds < 2 * 86400) return format(seconds / 3600, 'hours');
    return format(seconds / 86400, 'days');
};
