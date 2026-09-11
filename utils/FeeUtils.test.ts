import FeeUtils, { sanitizeSatPerVbyte, NO_SAT_PER_VBYTE } from './FeeUtils';

const satoshisPerBTC = 100_000_000;

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

    describe('sanitizeSatPerVbyte', () => {
        it('passes through a usable rate', () => {
            expect(sanitizeSatPerVbyte('5')).toEqual(5);
            expect(sanitizeSatPerVbyte(5)).toEqual(5);
            expect(sanitizeSatPerVbyte('1')).toEqual(1);
        });

        it('returns the sentinel when no rate is supplied', () => {
            expect(sanitizeSatPerVbyte(undefined)).toEqual(NO_SAT_PER_VBYTE);
            expect(sanitizeSatPerVbyte(null)).toEqual(NO_SAT_PER_VBYTE);
            expect(sanitizeSatPerVbyte('')).toEqual(NO_SAT_PER_VBYTE);
        });

        it('rejects rates below one sat/vB', () => {
            expect(sanitizeSatPerVbyte(0)).toEqual(NO_SAT_PER_VBYTE);
            expect(sanitizeSatPerVbyte('0')).toEqual(NO_SAT_PER_VBYTE);
            expect(sanitizeSatPerVbyte(-1)).toEqual(NO_SAT_PER_VBYTE);
            expect(sanitizeSatPerVbyte('0.5')).toEqual(NO_SAT_PER_VBYTE);
        });

        it('rejects values that are not finite numbers', () => {
            expect(sanitizeSatPerVbyte('abc')).toEqual(NO_SAT_PER_VBYTE);
            expect(sanitizeSatPerVbyte(NaN)).toEqual(NO_SAT_PER_VBYTE);
            expect(sanitizeSatPerVbyte(Infinity)).toEqual(NO_SAT_PER_VBYTE);
        });

        it('floors fractional rates to whole sat/vB', () => {
            expect(sanitizeSatPerVbyte('2.9')).toEqual(2);
            expect(sanitizeSatPerVbyte(10.01)).toEqual(10);
        });

        it('does not impose an upper bound on an explicit rate', () => {
            expect(sanitizeSatPerVbyte('5000')).toEqual(5000);
        });
    });
});
