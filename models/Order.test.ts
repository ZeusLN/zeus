const mockDisplay: { timeFormat?: string } = {};

jest.mock('../stores/Stores', () => ({
    fiatStore: {
        formatAmountForDisplay: (amount: string) => `$${amount}`
    },
    settingsStore: {
        get settings() {
            return { display: mockDisplay };
        }
    }
}));
jest.mock('../utils/LocaleUtils');

import Order from './Order';

describe('Order.getDisplayTime', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-09-25T12:00:00'));
        mockDisplay.timeFormat = '12h';
    });

    afterEach(() => {
        jest.useRealTimers();
        delete mockDisplay.timeFormat;
    });

    it('uses a 24-hour clock when no time format is set', () => {
        delete mockDisplay.timeFormat;
        const order = new Order({
            created_at: '2025-07-17T21:20:00',
            updated_at: '2025-07-17T21:22:00'
        });
        expect(order.getDisplayTime).toBe("21:22 | Thu, Jul 17, '25");
    });

    it('includes the day of the month for an order from this year', () => {
        const order = new Order({
            created_at: '2026-08-09T10:40:00',
            updated_at: '2026-08-09T10:44:00'
        });
        expect(order.getDisplayTime).toBe('10:44 am | Sun, Aug 09');
    });

    it('appends the year for an order from a previous year', () => {
        const order = new Order({
            created_at: '2025-07-17T21:20:00',
            updated_at: '2025-07-17T21:22:00'
        });
        expect(order.getDisplayTime).toBe("09:22 pm | Thu, Jul 17, '25");
    });

    it('takes the time and the day from the same timestamp', () => {
        // created before midnight, paid after it
        const order = new Order({
            created_at: '2026-08-08T23:55:00',
            updated_at: '2026-08-09T00:05:00'
        });
        expect(order.getDisplayTime).toBe('12:05 am | Sun, Aug 09');
    });

    it('falls back to created_at when updated_at is missing', () => {
        const order = new Order({ created_at: '2026-08-09T10:40:00' });
        expect(order.getDisplayTime).toBe('10:40 am | Sun, Aug 09');
    });

    it('shows N/A for an unparseable timestamp', () => {
        const order = new Order({ updated_at: 'not-a-date' });
        expect(order.getDisplayTime).toBe('general.notAvailable');
    });
});

const makeOrder = (data: any = {}) =>
    new Order({
        id: 'order-1',
        total_money: { amount: 1234, currency: 'USD' },
        total_tax_money: { amount: 99, currency: 'USD' },
        line_items: [],
        ...data
    });

describe('Order', () => {
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
