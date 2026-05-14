import {
    formatBitcoinWithSpaces,
    getDecimalPlaceholder,
    getDecimalSeparator,
    normalizeNumberString,
    numberWithCommas
} from './UnitsUtils';
import { settingsStore } from '../stores/Stores';

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        settings: {
            locale: 'en',
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
    beforeEach(() => {
        (settingsStore as any).settings.locale = 'en';
        (settingsStore as any).settings.display.removeDecimalSpaces = false;
    });

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

    describe('locale-aware formatting', () => {
        it('uses English-style separators by default', () => {
            expect(numberWithCommas('1234567.89')).toBe('1,234,567.89');
            expect(getDecimalSeparator()).toBe('.');
        });

        it('uses European-style separators for supported app locales', () => {
            (settingsStore as any).settings.locale = 'de';
            expect(numberWithCommas('1234567.89')).toBe('1.234.567,89');
            expect(getDecimalSeparator()).toBe(',');
        });

        it('formats BTC decimals with locale-aware separators', () => {
            (settingsStore as any).settings.locale = 'de';
            expect(formatBitcoinWithSpaces('12345.6789')).toBe('12.345,67 89');
        });
    });

    describe('locale-aware normalization', () => {
        it('keeps English formatted input canonical', () => {
            expect(normalizeNumberString('1,234.56')).toBe('1234.56');
        });

        it('normalizes European formatted input using the app locale', () => {
            (settingsStore as any).settings.locale = 'de';
            expect(normalizeNumberString('1.234,56')).toBe('1234.56');
        });

        it('treats fallback decimal input as a decimal when needed', () => {
            (settingsStore as any).settings.locale = 'de';
            expect(normalizeNumberString('0.5')).toBe('0.5');
        });
    });
});
