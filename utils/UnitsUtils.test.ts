import { getDecimalPlaceholder } from './UnitsUtils';

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
});
