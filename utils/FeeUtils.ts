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
 * Whether a reverse swap has a fee its claim can be built with.
 *
 * The claim pays the host-quoted claim miner fee when there is one and
 * ignores the rate. Only without that quote does it fall back to the
 * rate from the Swaps screen, and an unusable rate there would become
 * 2 sat/vB at claim time, which can fail to confirm before the swap
 * times out.
 */
export const hasUsableClaimFee = (
    claimMinerFee: unknown,
    feeRate: unknown
): boolean => Number(claimMinerFee) > 0 || isPlausibleSatPerVbyte(feeRate);

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

/**
 * The recommended rates offered as presets wherever a fee rate is picked,
 * fastest first. These are also the choices for the preferred rate in
 * settings.
 */
export const FEE_PRESET_KEYS = [
    'fastestFee',
    'halfHourFee',
    'hourFee',
    'minimumFee'
] as const;

export type FeePreset = typeof FEE_PRESET_KEYS[number];

/**
 * Which preset a fee rate matches, or 'custom' when none does. Presets
 * often share a rate (hour and minimum are both 1 sat/vB in a quiet
 * mempool), so the preferred preset wins a tie, then the fastest one.
 */
export const presetForFee = (
    fee: string | undefined,
    recommendedFees: { [key: string]: number | undefined },
    preferred?: string
): FeePreset | 'custom' => {
    if (!fee) return 'custom';
    const rate = Number(fee);
    const matches = FEE_PRESET_KEYS.filter(
        (key) =>
            recommendedFees[key] !== undefined && recommendedFees[key] === rate
    );
    if (matches.length === 0) return 'custom';
    return matches.find((key) => key === preferred) || matches[0];
};
