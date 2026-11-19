/**
 * Sanity bounds for on-chain fee rates, in sat/vB.
 *
 * The ceiling is not a prediction of what fees can legitimately reach.
 * It is the point past which a value is better explained by a broken or
 * hostile fee source than by mempool conditions. It sits well above the
 * highest rates seen in real congestion so that a genuine fee spike is
 * never rejected, while still bounding what an unvalidated API response
 * can hand to a transaction the user does not individually approve.
 */
export const MIN_SAT_PER_VBYTE = 1;
export const MAX_SAT_PER_VBYTE = 2000;

/**
 * Keys of the mempool `/v1/fees/recommended` response. Every consumer
 * falls back to `fastestFee`, so a response without it is unusable.
 */
export const RECOMMENDED_FEE_KEYS = [
    'fastestFee',
    'halfHourFee',
    'hourFee',
    'economyFee',
    'minimumFee'
] as const;

export const isPlausibleSatPerVbyte = (value: unknown): boolean => {
    const rate = Number(value);
    return (
        Number.isFinite(rate) &&
        rate >= MIN_SAT_PER_VBYTE &&
        rate <= MAX_SAT_PER_VBYTE
    );
};

/**
 * Validates a mempool recommended-fees response before any of it can
 * become a fee rate.
 *
 * Returns null, meaning "treat this like a failed fetch", if the
 * payload is malformed, is missing `fastestFee`, or carries any
 * implausible rate. A rate between 0 and 1 sat/vB is raised to 1 rather
 * than rejected: mempool's precise estimates already go below 1, and
 * on-chain sends and swap claims here take whole sat/vB, so 1 is the
 * lowest rate that can be paid. Rejecting the whole response rather than dropping
 * the offending key is deliberate: a source that reports one absurd rate
 * has not shown itself trustworthy for the others, and partial
 * acceptance would still let the bad key through to whichever rate the
 * user has set as their preferred one.
 */
export const sanitizeRecommendedFees = (
    raw: any
): { [key: string]: number } | null => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    const sanitized: { [key: string]: number } = {};

    for (const key of RECOMMENDED_FEE_KEYS) {
        const value = raw[key];
        if (value === undefined || value === null) continue;
        const rate = Number(value);
        const raised =
            rate > 0 && rate < MIN_SAT_PER_VBYTE ? MIN_SAT_PER_VBYTE : rate;
        if (!isPlausibleSatPerVbyte(raised)) return null;
        sanitized[key] = raised;
    }

    if (sanitized.fastestFee === undefined) return null;

    return sanitized;
};

/**
 * Size in vB of the largest reverse swap claim: a script-path spend of the
 * taproot lockup (signature, preimage, claim leaf, control block) to a
 * taproot address. To a P2WPKH address it is 140 vB.
 */
export const REVERSE_CLAIM_MAX_VSIZE = 152;

/**
 * The most a reverse swap claim may pay: the fee rate ceiling above, on
 * the largest claim. A larger quote is not a plausible fee.
 */
export const MAX_REVERSE_CLAIM_FEE =
    MAX_SAT_PER_VBYTE * REVERSE_CLAIM_MAX_VSIZE;

/**
 * The fee, in sats, a reverse swap's claim pays.
 *
 * The native claim pays a fixed fee exactly and ignores the rate, so this
 * number alone decides whether the claim relays and confirms before the
 * swap times out. The host's quote is kept when it pays at least the rate
 * for the largest claim, and raised to that otherwise, since a lower fee
 * may not relay or confirm in time. It is decided when the swap is
 * created and stored with it, so the amount shown before paying is the
 * amount the claim pays out.
 *
 * Returns undefined, and the swap must not be started or claimed, when the
 * rate is not a plausible sat/vB or the quote is not a number between 0
 * and MAX_REVERSE_CLAIM_FEE. A missing quote counts as 0, so the claim
 * pays the floor.
 */
export const reverseClaimMinerFee = (
    quote: unknown,
    feeRate: unknown
): number | undefined => {
    if (!isPlausibleSatPerVbyte(feeRate)) return undefined;
    const quoted = quote == null ? 0 : Number(quote);
    if (
        typeof quote === 'boolean' ||
        !Number.isFinite(quoted) ||
        quoted < 0 ||
        quoted > MAX_REVERSE_CLAIM_FEE
    ) {
        return undefined;
    }
    // the native claim takes whole sat/vB
    const floor = Math.ceil(Number(feeRate)) * REVERSE_CLAIM_MAX_VSIZE;
    return Math.max(Math.ceil(quoted), floor);
};

class FeeUtils {
    static DEFAULT_ROUTING_FEE_PERCENT = 0.05;

    calculateDefaultRoutingFee = (amount: number) => {
        if (amount > 1000) {
            return (amount * FeeUtils.DEFAULT_ROUTING_FEE_PERCENT).toFixed(0);
        }

        // LND takes a whole sat fee limit; round a msat amount up
        return Math.ceil(amount).toString();
    };
    roundFee = (text: string) => {
        const split = text.split('.');

        if (Number(split[1]) >= 5) {
            const value = Number(split[0]) + 1;
            return value.toString();
        }

        return split[0];
    };
    toFixed = (x: any, showAllDecimalPlaces?: boolean) => {
        if (showAllDecimalPlaces) return x.toFixed(8);
        return x.toFixed(8).replace(/\.?0+$/, '');
    };
}

const feeUtils = new FeeUtils();
export default feeUtils;
