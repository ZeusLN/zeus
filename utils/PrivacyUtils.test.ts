import privacyUtils from './PrivacyUtils';
import { settingsStore } from '../stores/Stores';

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        settings: {
            privacy: {
                lurkerMode: false
            }
        }
    }
}));

describe('PrivacyUtils', () => {
    beforeEach(() => {
        // Reset to default state before each test
        (settingsStore as any).settings = {
            privacy: {
                lurkerMode: false
            }
        };
        // Clear memoized values by creating a new instance
        // Since privacyUtils is a singleton, we need to clear its internal state
        (privacyUtils as any).memoizedValues.clear();
    });

    describe('sensitiveValue', () => {
        describe('when lurkerMode is false', () => {
            beforeEach(() => {
                (settingsStore as any).settings.privacy.lurkerMode = false;
            });

            it('should return the original string value', () => {
                const result = privacyUtils.sensitiveValue({
                    input: 'test123'
                });
                expect(result).toBe('test123');
            });

            it('should return the original number value', () => {
                const result = privacyUtils.sensitiveValue({ input: 12345 });
                expect(result).toBe(12345);
            });

            it('should return the original Date value', () => {
                const date = new Date('2024-01-01');
                const result = privacyUtils.sensitiveValue({ input: date });
                expect(result).toBe(date);
            });

            it('should return undefined for undefined input', () => {
                const result = privacyUtils.sensitiveValue({
                    input: undefined
                });
                expect(result).toBeUndefined();
            });

            it('should condense long strings when condenseAtLength is provided', () => {
                const longString = 'a'.repeat(20);
                const result = privacyUtils.sensitiveValue({
                    input: longString,
                    condenseAtLength: 10
                });
                expect(result).toBe('aaaaaaa...');
            });

            it('should not condense strings shorter than condenseAtLength', () => {
                const shortString = 'test';
                const result = privacyUtils.sensitiveValue({
                    input: shortString,
                    condenseAtLength: 10
                });
                expect(result).toBe('test');
            });
        });

        describe('when lurkerMode is true', () => {
            beforeEach(() => {
                (settingsStore as any).settings.privacy.lurkerMode = true;
            });

            it('should return a masked value for string input', () => {
                const result = privacyUtils.sensitiveValue({
                    input: 'test123'
                });
                expect(result).toBeDefined();
                expect(result).not.toBe('test123');
                expect(typeof result).toBe('string');
                expect((result as string).length).toBe(7); // Length of 'test123'
            });

            it('should return a masked value using alphabet by default', () => {
                const result = privacyUtils.sensitiveValue({ input: 'test' });
                const alphabet = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
                expect(result).toBeDefined();
                // Check that all characters are from the alphabet
                for (const char of result as string) {
                    expect(alphabet).toContain(char);
                }
            });

            it('should return a masked value using numbers when numberSet is true', () => {
                const result = privacyUtils.sensitiveValue({
                    input: 'test',
                    numberSet: true
                });
                const numbers = 'ΑΒΓΔΕϚΣΤΖΗΘϝϟϡ–◦¤☼ΙΠΧΜ';
                expect(result).toBeDefined();
                // Check that all characters are from the numbers set
                for (const char of result as string) {
                    expect(numbers).toContain(char);
                }
            });

            it('should use fixedLength when provided', () => {
                const result = privacyUtils.sensitiveValue({
                    input: 'test',
                    fixedLength: 10
                });
                expect(result).toBeDefined();
                expect((result as string).length).toBe(10);
            });

            it('should memoize values - same input returns same masked value', () => {
                const input = 'test123';
                const result1 = privacyUtils.sensitiveValue({ input });
                const result2 = privacyUtils.sensitiveValue({ input });
                expect(result1).toBe(result2);
            });

            it('should generate different masked values for different inputs', () => {
                const result1 = privacyUtils.sensitiveValue({ input: 'test1' });
                const result2 = privacyUtils.sensitiveValue({ input: 'test2' });
                expect(result1).not.toBe(result2);
            });

            it('should memoize based on all parameters', () => {
                const input = 'test';
                const result1 = privacyUtils.sensitiveValue({
                    input,
                    fixedLength: 5,
                    numberSet: false
                });
                const result2 = privacyUtils.sensitiveValue({
                    input,
                    fixedLength: 5,
                    numberSet: false
                });
                expect(result1).toBe(result2);
            });

            it('should generate different values for different fixedLength', () => {
                const input = 'test';
                const result1 = privacyUtils.sensitiveValue({
                    input,
                    fixedLength: 5
                });
                const result2 = privacyUtils.sensitiveValue({
                    input,
                    fixedLength: 10
                });
                expect(result1).not.toBe(result2);
                expect((result1 as string).length).toBe(5);
                expect((result2 as string).length).toBe(10);
            });

            it('should generate different values for different numberSet', () => {
                const input = 'test';
                const result1 = privacyUtils.sensitiveValue({
                    input,
                    numberSet: false
                });
                const result2 = privacyUtils.sensitiveValue({
                    input,
                    numberSet: true
                });
                expect(result1).not.toBe(result2);
            });

            it('should handle undefined input', () => {
                const result = privacyUtils.sensitiveValue({
                    input: undefined
                });
                expect(result).toBeDefined();
                expect((result as string).length).toBe(0); // Empty string length
            });

            it('should handle number input', () => {
                const result = privacyUtils.sensitiveValue({ input: 12345 });
                expect(result).toBeDefined();
                expect((result as string).length).toBe(5); // Length of '12345'
            });

            it('should handle Date input', () => {
                const date = new Date('2024-01-01T00:00:00.000Z');
                const result = privacyUtils.sensitiveValue({ input: date });
                expect(result).toBeDefined();
                expect(typeof result).toBe('string');
            });

            it('should condense long strings before masking when condenseAtLength is provided', () => {
                const longString = 'a'.repeat(20);
                const result1 = privacyUtils.sensitiveValue({
                    input: longString,
                    condenseAtLength: 10
                });
                const result2 = privacyUtils.sensitiveValue({
                    input: longString,
                    condenseAtLength: 10
                });
                // Should be memoized based on condensed string
                expect(result1).toBe(result2);
                // Length is based on original input length, not condensed length
                expect((result1 as string).length).toBe(20); // Original input length
            });

            it('should handle fixedLength with null value', () => {
                const result = privacyUtils.sensitiveValue({
                    input: 'test',
                    fixedLength: null
                });
                expect(result).toBeDefined();
                expect((result as string).length).toBe(4); // Should use input length
            });
        });

        describe('edge cases', () => {
            it('should handle missing privacy settings gracefully', () => {
                (settingsStore as any).settings = {};
                const result = privacyUtils.sensitiveValue({ input: 'test' });
                // Should default to false (no masking)
                expect(result).toBe('test');
            });

            it('should handle undefined privacy settings gracefully', () => {
                (settingsStore as any).settings.privacy = undefined;
                const result = privacyUtils.sensitiveValue({ input: 'test' });
                // Should default to false (no masking)
                expect(result).toBe('test');
            });

            it('should handle empty string input', () => {
                (settingsStore as any).settings.privacy.lurkerMode = true;
                const result = privacyUtils.sensitiveValue({ input: '' });
                expect(result).toBeDefined();
                expect((result as string).length).toBe(0);
            });

            it('should handle zero fixedLength', () => {
                (settingsStore as any).settings.privacy.lurkerMode = true;
                const result = privacyUtils.sensitiveValue({
                    input: 'test',
                    fixedLength: 0
                });
                expect(result).toBeDefined();
                // Zero is falsy, so it falls back to input length
                expect((result as string).length).toBe(4); // Input length
            });

            it('should handle very long fixedLength', () => {
                (settingsStore as any).settings.privacy.lurkerMode = true;
                const result = privacyUtils.sensitiveValue({
                    input: 'test',
                    fixedLength: 100
                });
                expect(result).toBeDefined();
                expect((result as string).length).toBe(100);
            });

            it('should handle condenseAtLength equal to input length', () => {
                (settingsStore as any).settings.privacy.lurkerMode = false;
                const input = 'test';
                const result = privacyUtils.sensitiveValue({
                    input,
                    condenseAtLength: 4
                });
                expect(result).toBe('test'); // Should not condense
            });

            it('should handle condenseAtLength less than 3', () => {
                (settingsStore as any).settings.privacy.lurkerMode = false;
                const input = 'test';
                const result = privacyUtils.sensitiveValue({
                    input,
                    condenseAtLength: 2
                });
                // Should handle gracefully, likely won't condense
                expect(result).toBeDefined();
            });
        });
    });
});
