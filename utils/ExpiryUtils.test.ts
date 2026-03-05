import { expirySecondsFromInput } from './ExpiryUtils';

describe('ExpiryUtils', () => {
    describe('expirySecondsFromInput', () => {
        it('returns the value unchanged for Seconds', () => {
            expect(expirySecondsFromInput('90', 'Seconds')).toBe('90');
            expect(expirySecondsFromInput('1', 'Seconds')).toBe('1');
        });

        it('converts Minutes to seconds', () => {
            expect(expirySecondsFromInput('1', 'Minutes')).toBe('60');
            expect(expirySecondsFromInput('10', 'Minutes')).toBe('600');
        });

        it('converts Hours to seconds', () => {
            expect(expirySecondsFromInput('1', 'Hours')).toBe('3600');
            expect(expirySecondsFromInput('2', 'Hours')).toBe('7200');
        });

        it('converts Days to seconds', () => {
            expect(expirySecondsFromInput('1', 'Days')).toBe('86400');
            expect(expirySecondsFromInput('7', 'Days')).toBe('604800');
        });

        it('converts Weeks to seconds', () => {
            expect(expirySecondsFromInput('1', 'Weeks')).toBe('604800');
            expect(expirySecondsFromInput('2', 'Weeks')).toBe('1209600');
        });
    });
});
