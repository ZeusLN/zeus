/**
 * Sanity bounds for on-chain fee rates, in sat/vB.
 *
 * The ceiling is not a prediction of what fees can legitimately reach —
 * it is the point past which a value is better explained by a broken or
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
 * Returns null — meaning "treat this like a failed fetch" — if the
 * payload is malformed, is missing `fastestFee`, or carries any
 * implausible rate. Rejecting the whole response rather than dropping
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
        if (!isPlausibleSatPerVbyte(value)) return null;
        sanitized[key] = Number(value);
    }

    if (sanitized.fastestFee === undefined) return null;

    return sanitized;
};

class FeeUtils {
    static DEFAULT_ROUTING_FEE_PERCENT = 0.05;

    calculateDefaultRoutingFee = (amount: number) => {
        if (amount > 1000) {
            return (amount * FeeUtils.DEFAULT_ROUTING_FEE_PERCENT).toFixed(0);
        }

        return amount.toString();
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
