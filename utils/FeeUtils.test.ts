import FeeUtils from './FeeUtils';

const satoshisPerBTC = 100000000;

describe('FeeUtils', () => {
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
    });
});
