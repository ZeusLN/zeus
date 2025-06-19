import { calculateTotalSats } from './TipUtils';

describe('calculateTotalSats', () => {
    it('calculates with 5% tip and no tax', () => {
        const result = calculateTotalSats('100', '5', '0');
        expect(result.toString()).toBe('105');
    });
    it('calculates with 50% tip and no tax', () => {
        const result = calculateTotalSats('100', '50', '0');
        expect(result.toString()).toBe('150');
    });

    it('calculates with 10% tip and 15 sats tax', () => {
        const result = calculateTotalSats('200', '10', '15');
        expect(result.toString()).toBe('235');
    });

    it('calculates with 0% tip and 0 tax', () => {
        const result = calculateTotalSats('500', '0', '0');
        expect(result.toString()).toBe('500');
    });

    it('calculates with 150% tip and 0 tax', () => {
        const result = calculateTotalSats('100', '150', '0');
        expect(result.toString()).toBe('250');
    });
});
