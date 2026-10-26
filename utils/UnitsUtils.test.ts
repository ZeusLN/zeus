import {
    getDecimalPlaceholder,
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
