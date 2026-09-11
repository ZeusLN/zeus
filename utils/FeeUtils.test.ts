import FeeUtils, {
    isPlausibleSatPerVbyte,
    sanitizeRecommendedFees,
    MAX_SAT_PER_VBYTE
} from './FeeUtils';

const satoshisPerBTC = 100_000_000;

// shape of a real mempool /v1/fees/recommended response
const VALID_FEES = {
    fastestFee: 12,
    halfHourFee: 10,
    hourFee: 8,
    economyFee: 3,
    minimumFee: 1
};

describe('FeeUtils', () => {
    describe('calculateDefaultRoutingFee', () => {
        it('Calculates a fee based on the amount', () => {
            expect(FeeUtils.calculateDefaultRoutingFee(0)).toEqual('0');
            expect(FeeUtils.calculateDefaultRoutingFee(999)).toEqual('999');
            expect(FeeUtils.calculateDefaultRoutingFee(1000)).toEqual('1000');
            expect(FeeUtils.calculateDefaultRoutingFee(1001)).toEqual('50');
            expect(FeeUtils.calculateDefaultRoutingFee(1003)).toEqual('50');
            expect(FeeUtils.calculateDefaultRoutingFee(1010)).toEqual('51');
            expect(FeeUtils.calculateDefaultRoutingFee(1011)).toEqual('51');
            expect(FeeUtils.calculateDefaultRoutingFee(10000)).toEqual('500');
        });
    });

    describe('roundFee', () => {
        it('Rounds fees', () => {
            expect(FeeUtils.roundFee('11.5')).toEqual('12');
            expect(FeeUtils.roundFee('34.1')).toEqual('34');
        });
    });

    describe('toFixed', () => {
        it('Properly handles decimals in Bitcoin unit format', () => {
            expect(FeeUtils.toFixed(100 / satoshisPerBTC)).toEqual('0.000001');
            expect(FeeUtils.toFixed(1000 / satoshisPerBTC)).toEqual('0.00001');
            expect(FeeUtils.toFixed(10000 / satoshisPerBTC)).toEqual('0.0001');
            // was returning "0.00000009999999999999999" in original version
            expect(
                FeeUtils.toFixed(Number('10') / satoshisPerBTC).toString()
            ).toBe('0.0000001');
            expect(FeeUtils.toFixed(1 / satoshisPerBTC)).toEqual('0.00000001');
            expect(FeeUtils.toFixed(283190 / satoshisPerBTC)).toEqual(
                '0.0028319'
            );
            expect(FeeUtils.toFixed(500000 / satoshisPerBTC)).toEqual('0.005');
            expect(FeeUtils.toFixed(-500000 / satoshisPerBTC)).toEqual(
                '-0.005'
            );
        });

        it('Properly handles decimals in Bitcoin unit format - with showAllDecimalPlaces enabled', () => {
            expect(FeeUtils.toFixed(100 / satoshisPerBTC, true)).toEqual(
                '0.00000100'
            );
            expect(FeeUtils.toFixed(1000 / satoshisPerBTC, true)).toEqual(
                '0.00001000'
            );
            expect(FeeUtils.toFixed(10000 / satoshisPerBTC, true)).toEqual(
                '0.00010000'
            );
            // was returning "0.00000009999999999999999" in original version
            expect(
                FeeUtils.toFixed(Number('10') / satoshisPerBTC, true).toString()
            ).toBe('0.00000010');
            expect(FeeUtils.toFixed(1 / satoshisPerBTC, true)).toEqual(
                '0.00000001'
            );
            expect(FeeUtils.toFixed(283190 / satoshisPerBTC, true)).toEqual(
                '0.00283190'
            );
            expect(FeeUtils.toFixed(500000 / satoshisPerBTC, true)).toEqual(
                '0.00500000'
            );
            expect(FeeUtils.toFixed(-500000 / satoshisPerBTC, true)).toEqual(
                '-0.00500000'
            );
        });
    });

    describe('isPlausibleSatPerVbyte', () => {
        it('accepts ordinary and genuinely high rates', () => {
            expect(isPlausibleSatPerVbyte(1)).toBe(true);
            expect(isPlausibleSatPerVbyte(12)).toBe(true);
            expect(isPlausibleSatPerVbyte(700)).toBe(true);
            expect(isPlausibleSatPerVbyte(MAX_SAT_PER_VBYTE)).toBe(true);
            // strings, as typed into the fee inputs
            expect(isPlausibleSatPerVbyte('25')).toBe(true);
        });

        it('rejects rates above the sanity ceiling', () => {
            expect(isPlausibleSatPerVbyte(MAX_SAT_PER_VBYTE + 1)).toBe(false);
            expect(isPlausibleSatPerVbyte(50_000)).toBe(false);
            expect(isPlausibleSatPerVbyte(100_000)).toBe(false);
            expect(isPlausibleSatPerVbyte('99999')).toBe(false);
        });

        it('rejects zero, negative, and non-numeric input', () => {
            expect(isPlausibleSatPerVbyte(0)).toBe(false);
            expect(isPlausibleSatPerVbyte(0.5)).toBe(false);
            expect(isPlausibleSatPerVbyte(-10)).toBe(false);
            expect(isPlausibleSatPerVbyte(Infinity)).toBe(false);
            expect(isPlausibleSatPerVbyte(NaN)).toBe(false);
            expect(isPlausibleSatPerVbyte('')).toBe(false);
            expect(isPlausibleSatPerVbyte('abc')).toBe(false);
            expect(isPlausibleSatPerVbyte(null)).toBe(false);
            expect(isPlausibleSatPerVbyte(undefined)).toBe(false);
            expect(isPlausibleSatPerVbyte({})).toBe(false);
        });
    });

    describe('sanitizeRecommendedFees', () => {
        it('passes a well-formed response through as numbers', () => {
            expect(sanitizeRecommendedFees(VALID_FEES)).toEqual(VALID_FEES);
        });

        it('coerces numeric strings', () => {
            expect(
                sanitizeRecommendedFees({ ...VALID_FEES, fastestFee: '12' })
            ).toEqual(VALID_FEES);
        });

        it('rejects the whole response when any rate is implausible', () => {
            // the audit scenario: a compromised or broken fee source
            expect(
                sanitizeRecommendedFees({ ...VALID_FEES, fastestFee: 50_000 })
            ).toBeNull();
            // an absurd value on a key the user may have set as preferred
            // must not survive just because fastestFee looks sane
            expect(
                sanitizeRecommendedFees({ ...VALID_FEES, economyFee: 100_000 })
            ).toBeNull();
            expect(
                sanitizeRecommendedFees({ ...VALID_FEES, minimumFee: 0 })
            ).toBeNull();
            expect(
                sanitizeRecommendedFees({ ...VALID_FEES, hourFee: -1 })
            ).toBeNull();
        });

        it('rejects a response with no fastestFee to fall back to', () => {
            const { fastestFee, ...withoutFastest } = VALID_FEES;
            expect(fastestFee).toBe(12);
            expect(sanitizeRecommendedFees(withoutFastest)).toBeNull();
        });

        it('tolerates a response missing optional keys', () => {
            expect(sanitizeRecommendedFees({ fastestFee: 12 })).toEqual({
                fastestFee: 12
            });
            expect(
                sanitizeRecommendedFees({ fastestFee: 12, hourFee: null })
            ).toEqual({ fastestFee: 12 });
        });

        it('rejects malformed payloads', () => {
            expect(sanitizeRecommendedFees(null)).toBeNull();
            expect(sanitizeRecommendedFees(undefined)).toBeNull();
            expect(sanitizeRecommendedFees('nope')).toBeNull();
            expect(sanitizeRecommendedFees([])).toBeNull();
            expect(sanitizeRecommendedFees({})).toBeNull();
        });
    });
});
