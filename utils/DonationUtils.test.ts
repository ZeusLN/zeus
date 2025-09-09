// DonationUtils.test.ts
import {
    calculateDonationAmount,
    findDonationPercentageIndex
} from './DonationUtils';

describe('DonationUtils', () => {
    describe('calculateDonationAmount', () => {
        it('should return correct donation amount with rounding down', () => {
            expect(calculateDonationAmount(1000, 25)).toBe(250);
            expect(calculateDonationAmount(999, 25)).toBe(249);
            expect(calculateDonationAmount(1, 33)).toBe(0);
        });

        it('should handle string inputs', () => {
            expect(calculateDonationAmount('5000', 10)).toBe(500);
        });

        it('should default to zero on falsy requestAmount', () => {
            expect(calculateDonationAmount(0, 10)).toBe(0);
            expect(calculateDonationAmount(undefined as any, 10)).toBe(0);
        });
    });

    describe('findDonationPercentageIndex', () => {
        const options = [5, 10, 20];

        it('should return correct index for exact match', () => {
            expect(findDonationPercentageIndex(5, options)).toBe(0);
            expect(findDonationPercentageIndex(10, options)).toBe(1);
            expect(findDonationPercentageIndex(20, options)).toBe(2);
        });

        it('should return null for non-matching percentage', () => {
            expect(findDonationPercentageIndex(23, options)).toBe(null);
        });
    });
});
