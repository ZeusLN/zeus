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
 * Sentinel meaning "no fee rate supplied - let the node pick its own".
 * Matches the -1 convention used for optional numerics in LdkNodeInjection.
 */
export const NO_SAT_PER_VBYTE = -1;

/**
 * Normalizes a user-supplied on-chain fee rate (sat/vB) for the ldk-node
 * bridge.
 *
 * ldk-node builds its FeeRate with fromSatPerVbUnchecked, which performs no
 * validation, so a missing, zero, negative, fractional-to-zero, or NaN rate
 * must never reach it. Any of those yield NO_SAT_PER_VBYTE so the node falls
 * back to its own fee estimation instead of building a transaction around a
 * nonsense rate.
 *
 * Note this deliberately does NOT impose an upper bound: silently lowering a
 * rate the user explicitly typed would misreport what was broadcast. Bounding
 * absurd fee rates is a separate concern that needs its own confirmation UX.
 *
 * @param satPerVbyte - Fee rate as collected by the UI
 * @returns A whole sat/vB rate, or NO_SAT_PER_VBYTE if none applies
 */
export function sanitizeSatPerVbyte(
    satPerVbyte?: string | number | null
): number {
    if (satPerVbyte == null || satPerVbyte === '') return NO_SAT_PER_VBYTE;
    const rate = Math.floor(Number(satPerVbyte));
    if (!Number.isFinite(rate) || rate < 1) return NO_SAT_PER_VBYTE;
    return rate;
}
