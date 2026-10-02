jest.mock('../stores/Stores', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

import Order from './Order';

describe('Order.getDisplayTime', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-09-25T12:00:00'));
    });

    afterEach(() => {
        jest.useRealTimers();
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
});
