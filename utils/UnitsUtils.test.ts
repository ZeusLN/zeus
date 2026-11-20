import {
    getDecimalPlaceholder,
    numberWithCommas,
    numberWithDecimals,
    roundUpToWholeSats,
    satsToBip21Amount
} from './UnitsUtils';

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        settings: {
            fiat: 'USD',
            display: {
                removeDecimalSpaces: false
            }
        }
    },
    fiatStore: {
        symbolLookup: () => ({
            decimalPlaces: 2
        })
    }
}));

describe('UnitsUtils', () => {
    describe('getDecimalPlaceholder', () => {
        it('Returns string and count properly', () => {
            expect(getDecimalPlaceholder('1231.2', 'BTC')).toEqual({
                string: '0 000 000',
                count: 7
            });
            expect(getDecimalPlaceholder('1231.', 'BTC')).toEqual({
                string: '00 000 000',
                count: 8
            });

            expect(getDecimalPlaceholder('1231.2', 'fiat')).toEqual({
                string: '0',
                count: 1
            });
            expect(getDecimalPlaceholder('1231.', 'fiat')).toEqual({
                string: '00',
                count: 2
            });

            expect(getDecimalPlaceholder('1231.2', 'sats')).toEqual({
                string: '00',
                count: 2
            });
            expect(getDecimalPlaceholder('1231.', 'sats')).toEqual({
                string: '000',
                count: 3
            });
        });
    });

    describe('numberWithCommas', () => {
        it('groups the whole part in thousands', () => {
            expect(numberWithCommas(1234567)).toEqual('1,234,567');
            expect(numberWithCommas('1234567')).toEqual('1,234,567');
            expect(numberWithCommas(999)).toEqual('999');
            expect(numberWithCommas('-1234567')).toEqual('-1,234,567');
        });

        it('keeps up to three decimals as they are', () => {
            expect(numberWithCommas('4539039877.452')).toEqual(
                '4,539,039,877.452'
            );
            expect(numberWithCommas(1234.5)).toEqual('1,234.5');
        });

        it('does not group the digits after the decimal point', () => {
            expect(numberWithCommas('1234.5678')).toEqual('1,234.5678');
            expect(numberWithCommas(0.00001234)).toEqual('0.00001234');
            expect(numberWithCommas('-1234567.8912')).toEqual(
                '-1,234,567.8912'
            );
            // 24778.456 + 3.478 in floating point
            expect(numberWithCommas(24778.456 + 3.478)).toEqual(
                '24,781.933999999997'
            );
        });

        it('keeps a decimal point with nothing before or after it', () => {
            expect(numberWithCommas('1234.')).toEqual('1,234.');
            expect(numberWithCommas('.5')).toEqual('.5');
        });

        it('leaves an already grouped amount alone', () => {
            expect(numberWithCommas('1,234,567.8912')).toEqual(
                '1,234,567.8912'
            );
        });

        it('returns 0 for an empty or missing value', () => {
            expect(numberWithCommas('')).toEqual('0');
            expect(numberWithCommas(undefined as any)).toEqual('0');
            expect(numberWithCommas(0)).toEqual('0');
        });
    });

    describe('numberWithDecimals', () => {
        it('swaps the separators', () => {
            expect(numberWithDecimals('1234567.89')).toEqual('1.234.567,89');
        });

        it('does not group the digits after the decimal separator', () => {
            expect(numberWithDecimals('1234567.8912')).toEqual(
                '1.234.567,8912'
            );
        });
    });

    describe('roundUpToWholeSats', () => {
        it('keeps whole sats', () => {
            expect(roundUpToWholeSats('1000')).toBe('1000');
            expect(roundUpToWholeSats(1)).toBe('1');
        });

        it('rounds millisats up', () => {
            expect(roundUpToWholeSats('1000.5')).toBe('1001');
            expect(roundUpToWholeSats('1000.001')).toBe('1001');
            expect(roundUpToWholeSats('0.001')).toBe('1');
        });
    });

    describe('satsToBip21Amount', () => {
        it('converts whole sats to BTC', () => {
            expect(satsToBip21Amount(100000)).toBe('0.001');
            expect(satsToBip21Amount('1000')).toBe('0.00001');
            expect(satsToBip21Amount('1')).toBe('0.00000001');
            expect(satsToBip21Amount('2100000000000000')).toBe('21000000');
        });

        it('rounds millisats up to the next whole sat', () => {
            expect(satsToBip21Amount('1000.5')).toBe('0.00001001');
            expect(satsToBip21Amount('1000.001')).toBe('0.00001001');
            expect(satsToBip21Amount('0.001')).toBe('0.00000001');
            expect(satsToBip21Amount(1000.999)).toBe('0.00001001');
        });

        it('never gives more than 8 decimals', () => {
            for (const sats of ['1.5', '123456.789', '99999999.001']) {
                const [, decimals = ''] = satsToBip21Amount(sats).split('.');
                expect(decimals.length).toBeLessThanOrEqual(8);
            }
        });
    });
});
