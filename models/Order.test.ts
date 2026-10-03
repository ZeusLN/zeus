jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../stores/Stores', () => ({
    fiatStore: {
        formatAmountForDisplay: (amount: string) => `$${amount}`
    }
}));

import Order from './Order';

// PosStore stamps orders with new Date().toISOString(), so build fixtures the
// same way from a local time. The expected strings then hold in any time zone.
const isoFromLocal = (...args: [number, number, number, number, number]) =>
    new Date(...args).toISOString();

const makeOrder = (data: any = {}) =>
    new Order({
        id: 'order-1',
        created_at: isoFromLocal(2026, 8, 14, 9, 5),
        updated_at: isoFromLocal(2026, 8, 14, 9, 5),
        total_money: { amount: 1234, currency: 'USD' },
        total_tax_money: { amount: 99, currency: 'USD' },
        line_items: [],
        ...data
    });

describe('Order', () => {
    describe('getDisplayTime', () => {
        it('formats the updated time and created day', () => {
            expect(makeOrder().getDisplayTime).toBe('09:05 am | Mon, Sep 14');
        });

        it('uses a 12-hour clock for afternoon times', () => {
            const order = makeOrder({
                updated_at: isoFromLocal(2026, 8, 14, 17, 30)
            });
            expect(order.getDisplayTime).toBe('05:30 pm | Mon, Sep 14');
        });

        it('shows midnight as 12 am', () => {
            const order = makeOrder({
                updated_at: isoFromLocal(2026, 8, 14, 0, 0)
            });
            expect(order.getDisplayTime).toBe('12:00 am | Mon, Sep 14');
        });

        it('takes the time from updated_at and the day from created_at', () => {
            const order = makeOrder({
                created_at: isoFromLocal(2026, 11, 31, 23, 59),
                updated_at: isoFromLocal(2027, 0, 1, 8, 1)
            });
            expect(order.getDisplayTime).toBe('08:01 am | Thu, Dec 31');
        });

        it('zero-pads single-digit days', () => {
            const order = makeOrder({
                created_at: isoFromLocal(2026, 1, 3, 12, 0)
            });
            expect(order.getDisplayTime).toBe('09:05 am | Tue, Feb 03');
        });
    });

    describe('getItemCount', () => {
        it('counts line items', () => {
            const order = makeOrder({
                line_items: [
                    { name: 'Coffee', quantity: 1 },
                    { name: 'Bagel', quantity: 2 }
                ]
            });
            expect(order.getItemCount).toBe(2);
        });

        it('returns 0 when line_items is missing', () => {
            expect(makeOrder({ line_items: undefined }).getItemCount).toBe(0);
        });
    });

    describe('getItemsList', () => {
        it('joins item names and shows quantities above 1', () => {
            const order = makeOrder({
                line_items: [
                    { name: 'Coffee', quantity: 1 },
                    { name: 'Bagel', quantity: 3 }
                ]
            });
            expect(order.getItemsList).toBe('Coffee, Bagel (x3)');
        });

        it('returns an empty string for an order with no items', () => {
            expect(makeOrder().getItemsList).toBe('');
        });
    });

    describe('autoGratuity', () => {
        it('returns the gratuity line item amount in dollars', () => {
            const order = makeOrder({
                line_items: [
                    {
                        name: 'Coffee',
                        quantity: 1,
                        base_price_money: { amount: 500 }
                    },
                    {
                        name: 'Auto Gratuity (18%)',
                        quantity: 1,
                        base_price_money: { amount: 90 }
                    }
                ]
            });
            expect(order.autoGratuity).toBe('0.90');
        });

        it('returns an empty string when there is no gratuity item', () => {
            const order = makeOrder({
                line_items: [
                    {
                        name: 'Coffee',
                        quantity: 1,
                        base_price_money: { amount: 500 }
                    }
                ]
            });
            expect(order.autoGratuity).toBe('');
        });
    });

    describe('money getters', () => {
        it('converts total and tax from cents to dollars', () => {
            const order = makeOrder();
            expect(order.getTotalMoney).toBe('12.34');
            expect(order.getTaxMoney).toBe('0.99');
        });

        it('treats a missing tax amount as zero', () => {
            expect(makeOrder({ total_tax_money: undefined }).getTaxMoney).toBe(
                '0.00'
            );
        });

        it('formats totals through the fiat store', () => {
            const order = makeOrder();
            expect(order.getTotalMoneyDisplay).toBe('$12.34');
            expect(order.getTaxMoneyDisplay).toBe('$0.99');
        });
    });
});
