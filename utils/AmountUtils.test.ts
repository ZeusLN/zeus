import {
    processSatsAmount,
    shouldHideMillisatoshiAmounts,
    getUnformattedAmount,
    getAmountFromSats,
    getFormattedAmount,
    getFeePercentage,
    getSatAmount,
    normalizeNumberString
} from './AmountUtils';
import { settingsStore, fiatStore, unitsStore } from '../stores/Stores';
import { SATS_PER_BTC } from './UnitsUtils';

jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => {
        const translations: { [key: string]: string } = {
            'general.disabled': 'Disabled',
            'general.fiatRateNotAvailable':
                'Rate for selected currency not available',
            'general.errorFetchingFiatRates': 'Error fetching fiat rates',
            'general.notAvailable': 'N/A'
        };
        return translations[key] || key;
    }
}));

jest.mock('../stores/Stores', () => {
    const mockUnitsStore = { units: 'sats' };
    const mockSettingsStore = {
        settings: {
            display: {
                showMillisatoshiAmounts: true,
                removeDecimalSpaces: false,
                showAllDecimalPlaces: false
            },
            fiat: 'USD'
        }
    };
    const mockFiatStore = {
        symbolLookup: () => ({
            decimalPlaces: 2
        }),
        fiatRates: [
            {
                code: 'USD',
                rate: 50000,
                cryptoCode: 'BTC',
                currencyPair: 'USD/BTC'
            },
            {
                code: 'EUR',
                rate: 45000,
                cryptoCode: 'BTC',
                currencyPair: 'EUR/BTC'
            }
        ],
        getSymbol: () => ({
            symbol: '$',
            space: false,
            rtl: false,
            separatorSwap: false,
            decimalPlaces: 2
        })
    };
    return {
        settingsStore: mockSettingsStore,
        fiatStore: mockFiatStore,
        unitsStore: mockUnitsStore
    };
});

describe('AmountUtils', () => {
    beforeEach(() => {
        // Reset to default state before each test
        (settingsStore as any).settings = {
            display: {
                showMillisatoshiAmounts: true
            }
        };
    });

    describe('processSatsAmount', () => {
        describe('when showMillisatoshiAmounts is true', () => {
            beforeEach(() => {
                (
                    settingsStore as any
                ).settings.display.showMillisatoshiAmounts = true;
            });

            it('should not round amounts with decimals when roundAmount is false', () => {
                const result = processSatsAmount('1234.567', false);
                expect(result.displayAmount).toBe('1,234.567');
                expect(result.shouldShowRounding).toBe(false);
            });

            it('should not round amounts with decimals when roundAmount is true', () => {
                const result = processSatsAmount('1234.567', true);
                expect(result.displayAmount).toBe('1,234.567');
                expect(result.shouldShowRounding).toBe(false);
            });

            it('should handle whole numbers correctly', () => {
                const result = processSatsAmount('1234', false);
                expect(result.displayAmount).toBe('1,234');
                expect(result.shouldShowRounding).toBe(false);
            });
        });

        describe('when showMillisatoshiAmounts is false', () => {
            beforeEach(() => {
                (
                    settingsStore as any
                ).settings.display.showMillisatoshiAmounts = false;
            });

            it('should round amounts with decimals when roundAmount is false', () => {
                const result = processSatsAmount('1234.567', false);
                expect(result.displayAmount).toBe('1,235');
                expect(result.shouldShowRounding).toBe(false);
            });

            it('should round amounts with decimals when roundAmount is true and show rounding indicator', () => {
                const result = processSatsAmount('1234.567', true);
                expect(result.displayAmount).toBe('1,235');
                expect(result.shouldShowRounding).toBe(true);
            });

            it('should handle whole numbers correctly', () => {
                const result = processSatsAmount('1234', false);
                expect(result.displayAmount).toBe('1,234');
                expect(result.shouldShowRounding).toBe(false);
            });

            it('should round 0.5 up correctly', () => {
                const result = processSatsAmount('1234.5', false);
                expect(result.displayAmount).toBe('1,235');
                expect(result.shouldShowRounding).toBe(false);
            });

            it('should round 0.4 down correctly', () => {
                const result = processSatsAmount('1234.4', false);
                expect(result.displayAmount).toBe('1,234');
                expect(result.shouldShowRounding).toBe(false);
            });
        });

        describe('edge cases', () => {
            it('should handle undefined settings gracefully', () => {
                (settingsStore as any).settings = undefined;
                const result = processSatsAmount('1234.567', false);
                expect(result.displayAmount).toBe('1,235'); // Should round when settings are undefined
                expect(result.shouldShowRounding).toBe(false);
            });

            it('should handle null settings gracefully', () => {
                (settingsStore as any).settings = null;
                const result = processSatsAmount('1234.567', false);
                expect(result.displayAmount).toBe('1,235'); // Should round when settings are null
                expect(result.shouldShowRounding).toBe(false);
            });

            it('should handle missing display settings gracefully', () => {
                (settingsStore as any).settings = {};
                const result = processSatsAmount('1234.567', false);
                expect(result.displayAmount).toBe('1,235'); // Should round when display settings are missing
                expect(result.shouldShowRounding).toBe(false);
            });

            it('should handle string numbers correctly', () => {
                (
                    settingsStore as any
                ).settings.display.showMillisatoshiAmounts = false;
                const result = processSatsAmount(1234.567, false);
                expect(result.displayAmount).toBe('1,235');
                expect(result.shouldShowRounding).toBe(false);
            });

            it('should handle comma-separated numbers correctly when hideMsats is enabled', () => {
                (
                    settingsStore as any
                ).settings.display.showMillisatoshiAmounts = false;
                const result = processSatsAmount('4,539,039,877.452', false);
                expect(result.displayAmount).toBe('4,539,039,877');
                expect(result.shouldShowRounding).toBe(false);
            });

            it('should preserve decimals and format with commas when hideMsats is disabled', () => {
                (
                    settingsStore as any
                ).settings.display.showMillisatoshiAmounts = true;
                const result = processSatsAmount('4,539,039,877.452', false);
                expect(result.displayAmount).toBe('4,539,039,877.452');
                expect(result.shouldShowRounding).toBe(false);
            });

            it('should round and format with commas when hideMsats is enabled and roundAmount is true', () => {
                (
                    settingsStore as any
                ).settings.display.showMillisatoshiAmounts = false;
                const result = processSatsAmount('4,539,039,877.452', true);
                expect(result.displayAmount).toBe('4,539,039,877');
                expect(result.shouldShowRounding).toBe(true);
            });
        });
    });

    describe('shouldHideMillisatoshiAmounts', () => {
        it('should return false when showMillisatoshiAmounts is true', () => {
            (settingsStore as any).settings.display.showMillisatoshiAmounts =
                true;
            expect(shouldHideMillisatoshiAmounts()).toBe(false);
        });

        it('should return true when showMillisatoshiAmounts is false', () => {
            (settingsStore as any).settings.display.showMillisatoshiAmounts =
                false;
            expect(shouldHideMillisatoshiAmounts()).toBe(true);
        });

        it('should return true when settings are undefined', () => {
            (settingsStore as any).settings = undefined;
            expect(shouldHideMillisatoshiAmounts()).toBe(true);
        });

        it('should return true when display settings are missing', () => {
            (settingsStore as any).settings = {};
            expect(shouldHideMillisatoshiAmounts()).toBe(true);
        });
    });

    describe('getUnformattedAmount', () => {
        beforeEach(() => {
            // Reset mocks before each test
            (unitsStore as any).units = 'sats';
            (settingsStore as any).settings = {
                fiat: 'USD',
                display: {
                    removeDecimalSpaces: false,
                    showAllDecimalPlaces: false
                }
            };
            (fiatStore as any).fiatRates = [
                {
                    code: 'USD',
                    rate: 50000,
                    cryptoCode: 'BTC',
                    currencyPair: 'USD/BTC'
                },
                {
                    code: 'EUR',
                    rate: 45000,
                    cryptoCode: 'BTC',
                    currencyPair: 'EUR/BTC'
                }
            ];
            (fiatStore as any).getSymbol = () => ({
                symbol: '$',
                space: false,
                rtl: false,
                separatorSwap: false,
                decimalPlaces: 2
            });
        });

        describe('BTC unit', () => {
            it('converts sats to BTC correctly', () => {
                (unitsStore as any).units = 'BTC';
                const result = getUnformattedAmount({
                    sats: SATS_PER_BTC
                });
                expect(result.amount).toBe('1');
                expect(result.unit).toBe('BTC');
                expect(result.negative).toBe(false);
                expect(result.space).toBe(false);
            });

            it('converts partial BTC correctly', () => {
                (unitsStore as any).units = 'BTC';
                const result = getUnformattedAmount({
                    sats: 100000000 / 2 // 0.5 BTC
                });
                expect(result.amount).toBe('0.5');
                expect(result.unit).toBe('BTC');
            });

            it('handles small amounts correctly', () => {
                (unitsStore as any).units = 'BTC';
                const result = getUnformattedAmount({
                    sats: 1000
                });
                expect(result.amount).toBe('0.00001');
                expect(result.unit).toBe('BTC');
            });

            it('handles negative values', () => {
                (unitsStore as any).units = 'BTC';
                const result = getUnformattedAmount({
                    sats: -SATS_PER_BTC
                });
                expect(result.amount).toBe('1');
                expect(result.unit).toBe('BTC');
                expect(result.negative).toBe(true);
            });

            it('respects showAllDecimalPlaces flag', () => {
                (unitsStore as any).units = 'BTC';
                (settingsStore as any).settings.display = {
                    showAllDecimalPlaces: true
                };
                const result = getUnformattedAmount({
                    sats: 100000000
                });
                expect(result.amount).toBe('1.00000000');
            });
        });

        describe('sats unit', () => {
            it('returns sats as string', () => {
                (unitsStore as any).units = 'sats';
                const result = getUnformattedAmount({
                    sats: 1000
                });
                expect(result.amount).toBe('1000');
                expect(result.unit).toBe('sats');
                expect(result.negative).toBe(false);
            });

            it('handles singular sat correctly', () => {
                (unitsStore as any).units = 'sats';
                const result = getUnformattedAmount({
                    sats: 1
                });
                expect(result.amount).toBe('1');
                expect(result.unit).toBe('sats');
                expect(result.plural).toBe(false);
            });

            it('handles plural sats correctly', () => {
                (unitsStore as any).units = 'sats';
                const result = getUnformattedAmount({
                    sats: 2
                });
                expect(result.amount).toBe('2');
                expect(result.unit).toBe('sats');
                expect(result.plural).toBe(true);
            });

            it('handles negative sats', () => {
                (unitsStore as any).units = 'sats';
                const result = getUnformattedAmount({
                    sats: -1000
                });
                expect(result.amount).toBe('1000');
                expect(result.unit).toBe('sats');
                expect(result.negative).toBe(true);
            });

            it('handles string input', () => {
                (unitsStore as any).units = 'sats';
                const result = getUnformattedAmount({
                    sats: '5000'
                });
                expect(result.amount).toBe('5000');
                expect(result.unit).toBe('sats');
            });
        });

        describe('fiat unit', () => {
            it('converts to fiat correctly', () => {
                (unitsStore as any).units = 'fiat';
                const result = getUnformattedAmount({
                    sats: SATS_PER_BTC
                });
                expect(result.amount).toBe('50000.00');
                expect(result.unit).toBe('fiat');
                expect(result.symbol).toBe('$');
                expect(result.negative).toBe(false);
                expect(result.space).toBe(false);
            });

            it('handles partial amounts correctly', () => {
                (unitsStore as any).units = 'fiat';
                const result = getUnformattedAmount({
                    sats: SATS_PER_BTC / 2 // 0.5 BTC
                });
                expect(result.amount).toBe('25000.00');
                expect(result.unit).toBe('fiat');
            });

            it('handles negative fiat values', () => {
                (unitsStore as any).units = 'fiat';
                const result = getUnformattedAmount({
                    sats: -SATS_PER_BTC
                });
                expect(result.amount).toBe('50000.00');
                expect(result.unit).toBe('fiat');
                expect(result.negative).toBe(true);
            });

            it('handles different fiat currencies', () => {
                (unitsStore as any).units = 'fiat';
                (settingsStore as any).settings.fiat = 'EUR';
                (fiatStore as any).getSymbol = () => ({
                    symbol: '€',
                    space: true,
                    rtl: false,
                    separatorSwap: false,
                    decimalPlaces: 2
                });
                const result = getUnformattedAmount({
                    sats: SATS_PER_BTC
                });
                expect(result.amount).toBe('45000.00');
                expect(result.symbol).toBe('€');
                expect(result.space).toBe(true);
            });

            it('handles custom decimal places', () => {
                (unitsStore as any).units = 'fiat';
                (fiatStore as any).getSymbol = () => ({
                    symbol: '¥',
                    space: false,
                    rtl: false,
                    separatorSwap: false,
                    decimalPlaces: 0
                });
                const result = getUnformattedAmount({
                    sats: SATS_PER_BTC
                });
                expect(result.amount).toBe('50000');
            });

            it('returns error when fiat is not set', () => {
                (unitsStore as any).units = 'fiat';
                (settingsStore as any).settings.fiat = undefined;
                const result = getUnformattedAmount({
                    sats: 1000
                });
                expect(result.amount).toBe('Disabled');
                expect(result.unit).toBe('fiat');
                expect(result.symbol).toBe('$');
            });

            it('returns error when fiat rates are not available', () => {
                (unitsStore as any).units = 'fiat';
                (fiatStore as any).fiatRates = undefined;
                const result = getUnformattedAmount({
                    sats: 1000
                });
                expect(result.amount).toBe('Disabled');
                expect(result.unit).toBe('fiat');
                expect(result.error).toBe('Error fetching fiat rates');
            });

            it('returns error when rate for currency is not available', () => {
                (unitsStore as any).units = 'fiat';
                (fiatStore as any).fiatRates = [
                    {
                        code: 'EUR',
                        rate: 45000,
                        cryptoCode: 'BTC',
                        currencyPair: 'EUR/BTC'
                    }
                ];
                const result = getUnformattedAmount({
                    sats: 1000
                });
                expect(result.amount).toBe('Disabled');
                expect(result.unit).toBe('fiat');
                expect(result.error).toBe(
                    'Rate for selected currency not available'
                );
            });

            it('returns error when rate entry has no rate', () => {
                (unitsStore as any).units = 'fiat';
                (fiatStore as any).fiatRates = [
                    {
                        code: 'USD',
                        rate: 0,
                        cryptoCode: 'BTC',
                        currencyPair: 'USD/BTC'
                    }
                ];
                const result = getUnformattedAmount({
                    sats: 1000
                });
                expect(result.amount).toBe('Disabled');
                expect(result.unit).toBe('fiat');
                expect(result.error).toBe(
                    'Rate for selected currency not available'
                );
            });
        });

        describe('fixedUnits parameter', () => {
            it('overrides units parameter when fixedUnits is provided', () => {
                (unitsStore as any).units = 'sats';
                const result = getUnformattedAmount({
                    sats: SATS_PER_BTC,
                    fixedUnits: 'BTC'
                });
                expect(result.amount).toBe('1');
                expect(result.unit).toBe('BTC');
            });
        });

        describe('edge cases', () => {
            it('handles zero sats', () => {
                (unitsStore as any).units = 'sats';
                const result = getUnformattedAmount({
                    sats: 0
                });
                expect(result.amount).toBe('0');
                expect(result.unit).toBe('sats');
                expect(result.plural).toBe(true);
            });

            it('handles default sats parameter', () => {
                (unitsStore as any).units = 'sats';
                const result = getUnformattedAmount({});
                expect(result.amount).toBe('0');
                expect(result.unit).toBe('sats');
            });
        });
    });

    describe('getAmountFromSats', () => {
        beforeEach(() => {
            // Reset mocks before each test
            (unitsStore as any).units = 'sats';
            (settingsStore as any).settings = {
                fiat: 'USD',
                display: {
                    removeDecimalSpaces: false,
                    showAllDecimalPlaces: false
                }
            };
            (fiatStore as any).fiatRates = [
                {
                    code: 'USD',
                    rate: 50000,
                    cryptoCode: 'BTC',
                    currencyPair: 'USD/BTC'
                },
                {
                    code: 'EUR',
                    rate: 45000,
                    cryptoCode: 'BTC',
                    currencyPair: 'EUR/BTC'
                }
            ];
            (fiatStore as any).symbolLookup = (code: string) => ({
                symbol: code === 'EUR' ? '€' : '$',
                space: code === 'EUR',
                rtl: false,
                separatorSwap: false,
                decimalPlaces: 2
            });
        });

        describe('BTC unit', () => {
            it('converts sats to BTC correctly', () => {
                (unitsStore as any).units = 'BTC';
                const result = getAmountFromSats(SATS_PER_BTC);
                expect(result).toBe('₿1');
            });

            it('converts partial BTC correctly', () => {
                (unitsStore as any).units = 'BTC';
                const result = getAmountFromSats(SATS_PER_BTC / 2);
                expect(result).toBe('₿0.5');
            });

            it('handles small amounts correctly', () => {
                (unitsStore as any).units = 'BTC';
                const result = getAmountFromSats(1000);
                expect(result).toBe('₿0.00001');
            });

            it('handles negative values', () => {
                (unitsStore as any).units = 'BTC';
                const result = getAmountFromSats(-SATS_PER_BTC);
                expect(result).toBe('-₿1');
            });

            it('handles zero', () => {
                (unitsStore as any).units = 'BTC';
                const result = getAmountFromSats(0);
                expect(result).toBe('₿0');
            });
        });

        describe('sats unit', () => {
            it('formats sats correctly', () => {
                (unitsStore as any).units = 'sats';
                const result = getAmountFromSats(1000);
                expect(result).toBe('1,000 sats');
            });

            it('handles singular sat correctly', () => {
                (unitsStore as any).units = 'sats';
                const result = getAmountFromSats(1);
                expect(result).toBe('1 sat');
            });

            it('handles plural sats correctly', () => {
                (unitsStore as any).units = 'sats';
                const result = getAmountFromSats(2);
                expect(result).toBe('2 sats');
            });

            it('handles negative sats', () => {
                (unitsStore as any).units = 'sats';
                const result = getAmountFromSats(-1000);
                expect(result).toBe('-1,000 sats');
            });

            it('handles large numbers with commas', () => {
                (unitsStore as any).units = 'sats';
                const result = getAmountFromSats(1000000);
                expect(result).toBe('1,000,000 sats');
            });
        });

        describe('fiat unit', () => {
            it('converts to fiat correctly', () => {
                (unitsStore as any).units = 'fiat';
                const result = getAmountFromSats(SATS_PER_BTC);
                expect(result).toBe('$50,000.00');
            });

            it('handles partial amounts correctly', () => {
                (unitsStore as any).units = 'fiat';
                const result = getAmountFromSats(SATS_PER_BTC / 2);
                expect(result).toBe('$25,000.00');
            });

            it('returns N/A when fiat rates are not available', () => {
                (unitsStore as any).units = 'fiat';
                (fiatStore as any).fiatRates = undefined;
                const result = getAmountFromSats(1000);
                expect(result).toBe('N/A');
            });

            it('returns undefined when fiat is not set', () => {
                (unitsStore as any).units = 'fiat';
                (settingsStore as any).settings.fiat = undefined;
                const result = getAmountFromSats(1000);
                expect(result).toBeUndefined();
            });
        });

        describe('fixedUnits parameter', () => {
            it('overrides units parameter when fixedUnits is provided', () => {
                (unitsStore as any).units = 'sats';
                const result = getAmountFromSats(SATS_PER_BTC, 'BTC');
                expect(result).toBe('₿1');
            });
        });
    });

    describe('getFormattedAmount', () => {
        beforeEach(() => {
            // Reset mocks before each test
            (unitsStore as any).units = 'sats';
            (settingsStore as any).settings = {
                fiat: 'USD',
                display: {
                    removeDecimalSpaces: false,
                    showAllDecimalPlaces: false
                }
            };
            (fiatStore as any).fiatRates = [
                {
                    code: 'USD',
                    rate: 50000,
                    cryptoCode: 'BTC',
                    currencyPair: 'USD/BTC'
                },
                {
                    code: 'EUR',
                    rate: 45000,
                    cryptoCode: 'BTC',
                    currencyPair: 'EUR/BTC'
                }
            ];
            (fiatStore as any).symbolLookup = (code: string) => ({
                symbol: code === 'EUR' ? '€' : '$',
                space: code === 'EUR',
                rtl: false,
                separatorSwap: false,
                decimalPlaces: 2
            });
        });

        describe('BTC unit', () => {
            it('formats BTC value correctly (expects BTC, not sats)', () => {
                (unitsStore as any).units = 'BTC';
                const result = getFormattedAmount(1);
                expect(result).toBe('₿1');
            });

            it('formats decimal BTC correctly', () => {
                (unitsStore as any).units = 'BTC';
                const result = getFormattedAmount(0.5);
                expect(result).toBe('₿0.5');
            });

            it('handles negative BTC values', () => {
                (unitsStore as any).units = 'BTC';
                const result = getFormattedAmount(-1);
                expect(result).toBe('-₿1');
            });

            it('handles zero', () => {
                (unitsStore as any).units = 'BTC';
                const result = getFormattedAmount(0);
                expect(result).toBe('₿0');
            });
        });

        describe('sats unit', () => {
            it('formats sats correctly', () => {
                (unitsStore as any).units = 'sats';
                const result = getFormattedAmount(1000);
                expect(result).toBe('1,000 sats');
            });

            it('handles singular sat correctly', () => {
                (unitsStore as any).units = 'sats';
                const result = getFormattedAmount(1);
                expect(result).toBe('1 sat');
            });

            it('handles plural sats correctly', () => {
                (unitsStore as any).units = 'sats';
                const result = getFormattedAmount(2);
                expect(result).toBe('2 sats');
            });

            it('handles negative sats', () => {
                (unitsStore as any).units = 'sats';
                const result = getFormattedAmount(-1000);
                expect(result).toBe('-1,000 sats');
            });
        });

        describe('fiat unit', () => {
            it('formats fiat amount correctly', () => {
                (unitsStore as any).units = 'fiat';
                const result = getFormattedAmount(50000);
                expect(result).toBe('$50,000.00');
            });

            it('handles amounts with commas (treats commas as decimal separators)', () => {
                (unitsStore as any).units = 'fiat';
                const result = getFormattedAmount('50,000');
                // The code replaces commas with dots, so "50,000" becomes "50.000" = 50.00
                expect(result).toBe('$50.00');
            });

            it('handles amounts with decimals and commas', () => {
                (unitsStore as any).units = 'fiat';
                const result = getFormattedAmount('1234.56');
                expect(result).toBe('$1,234.56');
            });

            it('handles different fiat currencies', () => {
                (unitsStore as any).units = 'fiat';
                (settingsStore as any).settings.fiat = 'EUR';
                const result = getFormattedAmount(45000);
                expect(result).toBe('€ 45,000.00');
            });

            it('handles separatorSwap currencies correctly', () => {
                (unitsStore as any).units = 'fiat';
                (settingsStore as any).settings.fiat = 'ARS';
                (fiatStore as any).fiatRates = [
                    {
                        code: 'ARS',
                        rate: 50000,
                        cryptoCode: 'BTC',
                        currencyPair: 'ARS/BTC'
                    }
                ];
                (fiatStore as any).symbolLookup = (code: string) => ({
                    symbol: code === 'ARS' ? '$' : '$',
                    space: code === 'ARS',
                    rtl: false,
                    separatorSwap: true,
                    decimalPlaces: 2
                });
                const result = getFormattedAmount(50000);
                // separatorSwap swaps commas and dots: 50000.00 becomes 50.000,00
                expect(result).toBe('$ 50.000,00');
            });

            it('handles amounts with both commas and decimals (results in NaN)', () => {
                (unitsStore as any).units = 'fiat';
                const result = getFormattedAmount('1,234.56');
                // Commas are replaced with dots, so "1,234.56" becomes "1.234.56" which has two dots
                // Number("1.234.56") = NaN, so toFixed(2) = "NaN"
                expect(result).toBe('$NaN');
            });

            it('returns N/A when fiat rates are not available', () => {
                (unitsStore as any).units = 'fiat';
                (fiatStore as any).fiatRates = undefined;
                const result = getFormattedAmount(1000);
                expect(result).toBe('N/A');
            });

            it('returns undefined when fiat is not set', () => {
                (unitsStore as any).units = 'fiat';
                (settingsStore as any).settings.fiat = undefined;
                const result = getFormattedAmount(1000);
                expect(result).toBeUndefined();
            });
        });

        describe('fixedUnits parameter', () => {
            it('overrides units parameter when fixedUnits is provided', () => {
                (unitsStore as any).units = 'sats';
                const result = getFormattedAmount(1, 'BTC');
                expect(result).toBe('₿1');
            });
        });
    });

    describe('getSatAmount', () => {
        beforeEach(() => {
            // Reset mocks before each test
            (unitsStore as any).units = 'sats';
            (settingsStore as any).settings = {
                fiat: 'USD',
                display: {
                    removeDecimalSpaces: false,
                    showAllDecimalPlaces: false
                }
            };
            (fiatStore as any).fiatRates = [
                {
                    code: 'USD',
                    rate: 50000,
                    cryptoCode: 'BTC',
                    currencyPair: 'USD/BTC'
                },
                {
                    code: 'EUR',
                    rate: 45000,
                    cryptoCode: 'BTC',
                    currencyPair: 'EUR/BTC'
                }
            ];
        });

        describe('sats unit', () => {
            it('returns the same value for sats', () => {
                (unitsStore as any).units = 'sats';
                const result = getSatAmount('1000');
                expect(result).toBe(1000);
            });

            it('handles numeric input', () => {
                (unitsStore as any).units = 'sats';
                const result = getSatAmount(1000);
                expect(result).toBe(1000);
            });

            it('treats 3 digits after comma as thousand separator', () => {
                (unitsStore as any).units = 'sats';
                const result = getSatAmount('1,001');
                expect(result).toBe(1001);
            });

            it('treats comma with 1-2 digits after as decimal separator', () => {
                (unitsStore as any).units = 'sats';
                const result = getSatAmount('1,5');
                expect(result).toBe(1.5);
            });
        });

        describe('BTC unit', () => {
            it('converts BTC to sats correctly', () => {
                (unitsStore as any).units = 'BTC';
                const result = getSatAmount('1');
                expect(result).toBe(SATS_PER_BTC);
            });

            it('converts partial BTC to sats correctly', () => {
                (unitsStore as any).units = 'BTC';
                const result = getSatAmount('0.5');
                expect(result).toBe(SATS_PER_BTC / 2);
            });

            it('converts small BTC amounts correctly', () => {
                (unitsStore as any).units = 'BTC';
                const result = getSatAmount('0.00001');
                expect(result).toBe(1000);
            });

            it('handles zero', () => {
                (unitsStore as any).units = 'BTC';
                const result = getSatAmount('0');
                expect(result).toBe(0);
            });

            it('handles empty string', () => {
                (unitsStore as any).units = 'BTC';
                const result = getSatAmount('');
                expect(result).toBe(0);
            });
        });

        describe('fiat unit', () => {
            it('converts fiat to sats correctly', () => {
                (unitsStore as any).units = 'fiat';
                // $50,000 = 1 BTC = 100,000,000 sats at rate of 50000
                const result = getSatAmount('50000');
                expect(result).toBe(100000000);
            });

            it('converts partial fiat amounts correctly', () => {
                (unitsStore as any).units = 'fiat';
                // $25,000 = 0.5 BTC = 50,000,000 sats at rate of 50000
                const result = getSatAmount('25000');
                expect(result).toBe(50000000);
            });

            it('converts small fiat amounts correctly', () => {
                (unitsStore as any).units = 'fiat';
                // $0.50 = 0.00001 BTC = 1000 sats at rate of 50000
                const result = getSatAmount('0.5');
                expect(result).toBe(1000);
            });

            it('handles comma as decimal separator', () => {
                (unitsStore as any).units = 'fiat';
                // $0,50 (European notation) = $0.50 = 1000 sats
                const result = getSatAmount('0,5');
                expect(result).toBe(1000);
            });

            it('returns 0 when rate is not available', () => {
                (unitsStore as any).units = 'fiat';
                (fiatStore as any).fiatRates = [];
                const result = getSatAmount('1000');
                expect(result).toBe(0);
            });

            it('returns 0 when fiat is not set', () => {
                (unitsStore as any).units = 'fiat';
                (settingsStore as any).settings.fiat = undefined;
                const result = getSatAmount('1000');
                expect(result).toBe(0);
            });

            it('returns 0 for empty string', () => {
                (unitsStore as any).units = 'fiat';
                const result = getSatAmount('');
                expect(result).toBe(0);
            });
        });

        describe('forceUnit parameter', () => {
            it('overrides store units when forceUnit is provided', () => {
                (unitsStore as any).units = 'sats';
                const result = getSatAmount('1', 'BTC');
                expect(result).toBe(SATS_PER_BTC);
            });

            it('forces sats interpretation', () => {
                (unitsStore as any).units = 'BTC';
                const result = getSatAmount('1000', 'sats');
                expect(result).toBe(1000);
            });

            it('forces fiat interpretation', () => {
                (unitsStore as any).units = 'sats';
                const result = getSatAmount('50000', 'fiat');
                expect(result).toBe(100000000);
            });
        });

        describe('edge cases', () => {
            it('returns 0 for unknown unit', () => {
                (unitsStore as any).units = 'unknown';
                const result = getSatAmount('1000');
                expect(result).toBe(0);
            });

            it('handles numeric zero', () => {
                (unitsStore as any).units = 'sats';
                const result = getSatAmount(0);
                expect(result).toBe(0);
            });

            it('handles string zero', () => {
                (unitsStore as any).units = 'sats';
                const result = getSatAmount('0');
                expect(result).toBe(0);
            });
        });
    });

    describe('getFeePercentage', () => {
        it('calculates a simple percentage', () => {
            expect(getFeePercentage(10, 1000)).toBe('1%');
        });

        it('calculates a fractional percentage', () => {
            expect(getFeePercentage(15, 1000)).toBe('1.5%');
        });

        it('caps at 3 decimal places and removes trailing zeros', () => {
            expect(getFeePercentage(1, 3000)).toBe('0.033%');
        });

        it('handles string inputs', () => {
            expect(getFeePercentage('50', '1000')).toBe('5%');
        });

        it('returns empty string when fee is 0', () => {
            expect(getFeePercentage(0, 1000)).toBe('');
            expect(getFeePercentage('0', 1000)).toBe('');
        });

        it('returns empty string when amount is 0', () => {
            expect(getFeePercentage(10, 0)).toBe('');
            expect(getFeePercentage(10, '0')).toBe('');
        });

        it('returns empty string when fee is undefined', () => {
            expect(getFeePercentage(undefined, 1000)).toBe('');
        });

        it('returns empty string when amount is undefined', () => {
            expect(getFeePercentage(10, undefined)).toBe('');
        });

        it('handles negative fee by stripping the minus sign', () => {
            expect(getFeePercentage(-10, 1000)).toBe('1%');
        });

        it('handles 100% fee', () => {
            expect(getFeePercentage(1000, 1000)).toBe('100%');
        });

        it('handles fee larger than amount', () => {
            expect(getFeePercentage(1500, 1000)).toBe('150%');
        });

        it('handles very small percentages', () => {
            expect(getFeePercentage(1, 1000000)).toBe('0%');
        });
    });

    describe('amount normalization', () => {
        it('treats 3 digits after separator as thousand separator', () => {
            expect(normalizeNumberString('1,234')).toBe('1234');
            expect(normalizeNumberString('100,000')).toBe('100000');
            expect(normalizeNumberString('1.234.567')).toBe('1234567');
        });

        it('handles mixed separators with decimals', () => {
            expect(normalizeNumberString('1,234.56')).toBe('1234.56');
            expect(normalizeNumberString('1.234,56')).toBe('1234.56');
            expect(normalizeNumberString('1,000,000.50')).toBe('1000000.50');
        });

        it('handles negative values and edge cases', () => {
            expect(normalizeNumberString('-1,234')).toBe('-1234');
            expect(normalizeNumberString('-1.234,56')).toBe('-1234.56');
            expect(normalizeNumberString('  1,234.56  ')).toBe('1234.56');
        });

        it('handles null, undefined, empty, and zero values', () => {
            expect(normalizeNumberString('')).toBe('0');
            expect(normalizeNumberString(null as any)).toBe('0');
            expect(normalizeNumberString(undefined as any)).toBe('0');
            expect(normalizeNumberString('0')).toBe('0');
            expect(normalizeNumberString('0,0')).toBe('0.0');
        });
    });
});
