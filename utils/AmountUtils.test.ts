import {
    processSatsAmount,
    shouldHideMillisatoshiAmounts,
    getUnformattedAmount
} from './AmountUtils';
import { settingsStore, fiatStore, unitsStore } from '../stores/Stores';
import { SATS_PER_BTC } from './UnitsUtils';

jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => {
        const translations: { [key: string]: string } = {
            'general.disabled': 'Disabled',
            'general.fiatRateNotAvailable':
                'Rate for selected currency not available',
            'general.errorFetchingFiatRates': 'Error fetching fiat rates'
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
});
