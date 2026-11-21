import {
    calculateCustomTipSats,
    calculateTaxSats,
    calculateTotalSats
} from './PosUtils';

jest.mock('./UnitsUtils', () => ({
    SATS_PER_BTC: 100000000
}));

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

describe('calculateTaxSats', () => {
    const rate = 113440.2; // Example rate: 1 BTC = $113,440.2

    it('calculates tax with a global tax rate', () => {
        const lineItems = [
            {
                name: 'Coffee',
                quantity: 2,
                base_price_money: { amount: 0, sats: 5000 },
                taxPercentage: ''
            }
        ];
        const subTotalSats = '10000';
        const taxPercentage = '10'; // Global tax 10%
        const result = calculateTaxSats(
            lineItems,
            subTotalSats,
            rate,
            taxPercentage
        );
        expect(result).toBe('1000');
    });

    it('calculates tax with per-item tax rates', () => {
        const lineItems = [
            {
                name: 'Coffee',
                quantity: 1,
                taxPercentage: '8',
                base_price_money: { amount: 0, sats: 10000 }
            },
            {
                name: 'Cake',
                quantity: 1,
                taxPercentage: '5',
                base_price_money: { amount: 0, sats: 20000 }
            }
        ];
        const subTotalSats = '30000';
        const result = calculateTaxSats(lineItems, subTotalSats, rate);
        // Tax: (10000 * 0.08) + (20000 * 0.05) = 800 + 1000 = 1800
        expect(result).toBe('1800');
    });

    it('calculates tax with mixed global and per-item tax rates', () => {
        const lineItems = [
            {
                name: 'Coffee',
                quantity: 1,
                taxPercentage: '8',
                base_price_money: { amount: 0, sats: 10000 }
            },
            {
                name: 'Tea',
                quantity: 1,
                base_price_money: { amount: 0, sats: 10000 }
            } // No individual tax, should use global
        ];
        const subTotalSats = '20000';
        const taxPercentage = '10'; // Global tax 10%
        const result = calculateTaxSats(
            lineItems,
            subTotalSats,
            rate,
            taxPercentage
        );
        // Tax: (10000 * 0.08) + (10000 * 0.10) = 800 + 1000 = 1800
        expect(result).toBe('1800');
    });

    it('calculates tax for items priced in fiat', () => {
        const lineItems = [
            {
                name: 'Sandwich',
                quantity: 1,
                taxPercentage: '15',
                base_price_money: { amount: 5, sats: 0 }
            } // $5
        ];
        // Subtotal for $5 at $113440.2/BTC is 4,407 sats
        const subTotalSats = '4407';
        const taxPercentage = '10';
        const result = calculateTaxSats(
            lineItems,
            subTotalSats,
            rate,
            taxPercentage
        );
        // Tax: (4407 * 0.15) = 661.05 -> rounded to 661
        expect(result).toBe('661');
    });

    it('returns 0 tax when no tax rates are provided', () => {
        const lineItems = [
            {
                name: 'Water',
                quantity: 1,
                base_price_money: { amount: 0, sats: 2000 }
            }
        ];
        const subTotalSats = '2000';
        const result = calculateTaxSats(lineItems, subTotalSats, rate);
        expect(result).toBe('0');
    });
});

describe('calculateCustomTipSats', () => {
    const rate = 100000; // 1 BTC = $100,000

    it('defaults to 21% of the subtotal in sats when empty (sats)', () => {
        expect(calculateCustomTipSats('', '10000', 'sats', rate)).toBe('2100');
    });

    it('defaults to 21% of the subtotal in sats when empty (fiat)', () => {
        expect(calculateCustomTipSats('', '10000', 'fiat', rate)).toBe('2100');
    });

    it('defaults to 21% of the subtotal in sats when empty (BTC)', () => {
        expect(calculateCustomTipSats('', '10000', 'BTC', rate)).toBe('2100');
    });

    it('rounds the default tip half up', () => {
        expect(calculateCustomTipSats('', '50', 'fiat', rate)).toBe('11');
    });

    it('uses a sats amount as-is', () => {
        expect(calculateCustomTipSats('500', '10000', 'sats', rate)).toBe(
            '500'
        );
    });

    it('converts a BTC amount to sats', () => {
        expect(calculateCustomTipSats('0.0001', '10000', 'BTC', rate)).toBe(
            '10000'
        );
    });

    it('converts a fiat amount to sats', () => {
        expect(calculateCustomTipSats('1', '10000', 'fiat', rate)).toBe('1000');
    });
});
