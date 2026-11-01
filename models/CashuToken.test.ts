jest.mock('../stores/Stores');

import CashuToken from './CashuToken';

describe('CashuToken timestamps', () => {
    it('uses created_at for a sent token', () => {
        const token = new CashuToken({
            sent: true,
            created_at: 1700000000,
            received_at: 1800000000
        });

        expect(token.getTimestamp).toBe(1700000000);
        expect(token.getDate.getTime()).toBe(1700000000 * 1000);
    });

    // Chosen by the received flag, not by which field is set
    it('uses received_at for a received token even when created_at is set', () => {
        const token = new CashuToken({
            received: true,
            pendingClaim: true,
            created_at: 1700000000,
            received_at: 1800000000
        });

        expect(token.getTimestamp).toBe(1800000000);
        expect(token.getDate.getTime()).toBe(1800000000 * 1000);
    });

    it('keeps fractional seconds in getDate', () => {
        const token = new CashuToken({
            sent: true,
            created_at: 1700000000.25
        });

        expect(token.getDate.getTime()).toBe(1700000000250);
    });

    // Falls back to 0 like the other Activity models, so the date filters
    // see the epoch
    it('falls back to the epoch when the timestamp is missing', () => {
        const token = new CashuToken({
            received: true,
            created_at: 1700000000
        });

        expect(token.getTimestamp).toBe(0);
        expect(token.getDate.getTime()).toBe(0);
        expect(token.getDisplayTime).toBe('');
    });

    it('shows a display time when the timestamp is set', () => {
        const token = new CashuToken({
            sent: true,
            created_at: 1700000000
        });

        expect(token.getDisplayTime).not.toBe('');
    });
});
