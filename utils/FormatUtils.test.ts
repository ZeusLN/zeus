import { formatProgressPercentage } from './FormatUtils';

describe('FormatUtils', () => {
    describe('formatProgressPercentage', () => {
        it('formats whole numbers without decimal places', () => {
            expect(formatProgressPercentage(0)).toEqual('0');
            expect(formatProgressPercentage(50)).toEqual('50');
            expect(formatProgressPercentage(100)).toEqual('100');
        });

        it('formats decimal numbers with 1 decimal place', () => {
            expect(formatProgressPercentage(0.1)).toEqual('0.1');
            expect(formatProgressPercentage(50.5)).toEqual('50.5');
            expect(formatProgressPercentage(99.9)).toEqual('99.9');
        });

        it('rounds to 1 decimal place', () => {
            expect(formatProgressPercentage(33.33)).toEqual('33.3');
            expect(formatProgressPercentage(66.67)).toEqual('66.7');
            expect(formatProgressPercentage(99.99)).toEqual('100.0');
        });

        it('parses valid numeric strings', () => {
            expect(formatProgressPercentage('50' as any)).toEqual('50');
            expect(formatProgressPercentage('33.33' as any)).toEqual('33.3');
        });

        it('returns 0 for invalid values', () => {
            expect(formatProgressPercentage(null as any)).toEqual('0');
            expect(formatProgressPercentage(undefined as any)).toEqual('0');
            expect(formatProgressPercentage('invalid' as any)).toEqual('0');
        });
    });
});
