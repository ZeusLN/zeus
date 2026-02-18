import { getAvatarInitials } from './DisplayUtils';

describe('DisplayUtils', () => {
    describe('getAvatarInitials', () => {
        it('returns empty string for undefined', () => {
            expect(getAvatarInitials(undefined)).toBe('');
        });

        it('returns empty string for empty string', () => {
            expect(getAvatarInitials('')).toBe('');
        });

        it('returns empty string for whitespace-only string', () => {
            expect(getAvatarInitials('   ')).toBe('');
        });

        it('returns single initial for one word', () => {
            expect(getAvatarInitials('John')).toBe('J');
            expect(getAvatarInitials('Kaloudis')).toBe('K');
        });

        it('returns two initials for two words', () => {
            expect(getAvatarInitials('Evan Kaloudis')).toBe('EK');
            expect(getAvatarInitials('John Doe')).toBe('JD');
        });

        it('returns first and last initial for three or more words', () => {
            expect(getAvatarInitials('John Quincy Adams')).toBe('JA');
            expect(getAvatarInitials('Mary Jane Watson Parker')).toBe('MP');
        });

        it('trims leading and trailing whitespace', () => {
            expect(getAvatarInitials('  Evan Kaloudis  ')).toBe('EK');
        });

        it('handles multiple spaces between words', () => {
            expect(getAvatarInitials('John   Doe')).toBe('JD');
        });

        it('returns uppercase initials', () => {
            expect(getAvatarInitials('john doe')).toBe('JD');
        });
    });
});
