import BigNumber from 'bignumber.js';
import {
    calculateFiatAmountsWithoutRate,
    calculateSubTotalSats,
    calculateTaxSats,
    calculateTotalSats,
    isPayableSatsAmount
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

describe('calculateSubTotalSats', () => {
    const item = (amount: number, sats: number, quantity = 1) => ({
        name: 'item',
        quantity,
        base_price_money: { amount, sats }
    });

    it('adds sats-priced items at their sats price', () => {
        expect(calculateSubTotalSats([item(0, 1000, 2), item(0, 250)], 0)).toBe(
            '2250'
        );
    });

    it('converts fiat-priced items at the rate', () => {
        expect(calculateSubTotalSats([item(5, 0, 3)], 100000)).toBe('15000');
        expect(calculateSubTotalSats([item(5, 0)], '100000.00')).toBe('5000');
    });

    it('adds a sats item and a fiat item together', () => {
        expect(calculateSubTotalSats([item(0, 1000), item(5, 0)], 100000)).toBe(
            '6000'
        );
    });

    it('rounds the sum half up, not each item', () => {
        // each item is 0.5 sats at this rate
        expect(
            calculateSubTotalSats([item(0.01, 0), item(0.01, 0)], 2000000)
        ).toBe('1');
        expect(calculateSubTotalSats([item(0.01, 0)], 2000000)).toBe('1');
    });

    it.each([
        ['a zero rate', 0],
        ['a zero rate string', '0.00'],
        ['no rate', undefined as any]
    ])(
        "isn't payable with a fiat item and %s, even with a sats item",
        (_, rate) => {
            const sats = calculateSubTotalSats(
                [item(0, 1000), item(5, 0)],
                rate
            );
            expect(isPayableSatsAmount(sats)).toBe(false);
        }
    );

    it("doesn't need a rate for sats-priced items", () => {
        expect(calculateSubTotalSats([item(0, 1000)], 0)).toBe('1000');
    });

    it('counts an item with no price as 0', () => {
        const unpriced = {
            name: 'item',
            quantity: 1,
            base_price_money: { amount: 0 }
        };
        expect(calculateSubTotalSats([unpriced, item(0, 1000)], 0)).toBe(
            '1000'
        );
    });

    it('is 0 for no items', () => {
        expect(calculateSubTotalSats([], 100000)).toBe('0');
        expect(calculateSubTotalSats(undefined as any, 100000)).toBe('0');
    });
});

describe('isPayableSatsAmount', () => {
    it.each(['1', '10800', 21, '2100000000000000'])('accepts %s', (sats) => {
        expect(isPayableSatsAmount(sats)).toBe(true);
    });

    it.each([
        ['0', '0'],
        ['a negative amount', '-10800'],
        ['Infinity (rate 0)', 'Infinity'],
        ['-Infinity', '-Infinity'],
        ['NaN', 'NaN'],
        ['a fraction', '1.5'],
        ['an empty string', ''],
        ['undefined', undefined]
    ])('rejects %s', (_, sats) => {
        expect(isPayableSatsAmount(sats)).toBe(false);
    });

    it('rejects the total computed for a fiat order with a zero rate', () => {
        const sats = new BigNumber(1000).div(100).div('0.00').toFixed(0);
        expect(isPayableSatsAmount(sats)).toBe(false);
    });
});

describe('calculateFiatAmountsWithoutRate', () => {
    const fiatItem = (amount: number, quantity = 1) => ({
        name: 'item',
        quantity,
        base_price_money: { amount }
    });
    // $12.34 of items with 10% tax, as recalculateCurrentOrder stores it
    const standalone = {
        line_items: [fiatItem(5.17), fiatItem(3.585, 2)],
        total_money: { amount: 1234 },
        total_tax_money: { amount: 123.4 }
    };

    it('takes the subtotal and tax from the order', () => {
        expect(
            calculateFiatAmountsWithoutRate(standalone, false, {
                percentage: '0'
            })
        ).toEqual({
            subTotalFiat: '12.34',
            taxFiat: '1.23',
            tipFiat: '0.00',
            totalFiat: '13.57'
        });
    });

    it('applies a percentage tip to the fiat subtotal', () => {
        expect(
            calculateFiatAmountsWithoutRate(standalone, false, {
                percentage: '25'
            })
        ).toEqual({
            subTotalFiat: '12.34',
            taxFiat: '1.23',
            tipFiat: '3.09',
            totalFiat: '16.66'
        });
    });

    it('adds a tip entered in fiat', () => {
        expect(
            calculateFiatAmountsWithoutRate(standalone, false, { fiat: '2.5' })
        ).toEqual({
            subTotalFiat: '12.34',
            taxFiat: '1.23',
            tipFiat: '2.50',
            totalFiat: '16.07'
        });
    });

    it.each([
        ['no tip amount', {}],
        ['a tip that needed a rate', { fiat: 'Infinity' }]
    ])('leaves the tip and total unset for %s', (_, tip) => {
        expect(calculateFiatAmountsWithoutRate(standalone, false, tip)).toEqual(
            {
                subTotalFiat: '12.34',
                taxFiat: '1.23',
                tipFiat: undefined,
                totalFiat: undefined
            }
        );
    });

    it('subtracts the tax from a Square total that includes it', () => {
        const square = {
            line_items: [fiatItem(1100)],
            total_money: { amount: 1100 },
            total_tax_money: { amount: 100 }
        };
        expect(
            calculateFiatAmountsWithoutRate(square, true, { percentage: '20' })
        ).toEqual({
            subTotalFiat: '10.00',
            taxFiat: '1.00',
            tipFiat: '2.00',
            totalFiat: '13.00'
        });
    });

    it('leaves the fiat amounts unset when an item is priced in sats', () => {
        const mixed = {
            line_items: [
                fiatItem(5),
                {
                    name: 'sats item',
                    quantity: 1,
                    base_price_money: { amount: 0, sats: 1000 }
                }
            ],
            total_money: { amount: 500, sats: Infinity },
            total_tax_money: { amount: 50 }
        };
        expect(
            calculateFiatAmountsWithoutRate(mixed, false, { fiat: '1' })
        ).toEqual({
            subTotalFiat: undefined,
            taxFiat: undefined,
            tipFiat: '1.00',
            totalFiat: undefined
        });
    });

    it('leaves the subtotal unset when the order has no total', () => {
        const noTotal = {
            line_items: [fiatItem(5)],
            total_tax_money: { amount: 50 }
        };
        expect(
            calculateFiatAmountsWithoutRate(noTotal, false, { percentage: '0' })
        ).toEqual({
            subTotalFiat: undefined,
            taxFiat: '0.50',
            tipFiat: undefined,
            totalFiat: undefined
        });
    });

    it('leaves the tax unset when the order has no tax amount', () => {
        const noTax = {
            line_items: [fiatItem(5)],
            total_money: { amount: 500 }
        };
        expect(
            calculateFiatAmountsWithoutRate(noTax, false, { percentage: '0' })
        ).toEqual({
            subTotalFiat: '5.00',
            taxFiat: undefined,
            tipFiat: '0.00',
            totalFiat: undefined
        });
    });
});
