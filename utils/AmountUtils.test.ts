import {
    processSatsAmount,
    shouldHideMillisatoshiAmounts
} from './AmountUtils';
import { settingsStore } from '../stores/Stores';

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        settings: {
            display: {
                showMillisatoshiAmounts: true
            }
        }
    }
}));

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
});
