import { getDecimalPlaceholder } from './UnitsUtils';

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        settings: {
            fiat: 'PYG',
            display: {
                removeDecimalSpaces: false
            }
        }
    },
    fiatStore: {
        symbolLookup: () => ({
            decimalPlaces: 0
        })
    }
}));

describe('UnitsUtils - alt', () => {
    describe('getDecimalPlaceholder - alt', () => {
        it('Returns string and count properly w/ 0 decimal places', () => {
            expect(getDecimalPlaceholder('1231', 'fiat')).toEqual({
                string: null,
                count: 0
            });
        });
    });
});
