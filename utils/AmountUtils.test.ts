import { isBelowDustLimit } from './AmountUtils';

describe('AmountUtils', () => {
    describe('isBelowDustLimit', () => {
        it('handle zero amount invoice', async () => {
            expect(isBelowDustLimit(0)).toEqual(false);
        });

        it('handles amounts below dust limit', async () => {
            expect(isBelowDustLimit(5)).toEqual(true);
            expect(isBelowDustLimit(500)).toEqual(true);
            expect(isBelowDustLimit(545)).toEqual(true);
        });

        it('handles amounts above dust limit', async () => {
            expect(isBelowDustLimit(546)).toEqual(false);
            expect(isBelowDustLimit(3546)).toEqual(false);
        });
    });
});
