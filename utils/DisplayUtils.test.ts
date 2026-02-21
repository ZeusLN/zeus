import { getAvatarInitials, getHostnameInitial } from './DisplayUtils';

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

    describe('getHostnameInitial', () => {
        // Subdomains should be skipped — use main domain initial
        it('skips subdomain and returns main domain initial', () => {
            expect(getHostnameInitial('https://mint.minibits.cash')).toBe('M');
        });

        it('skips multiple subdomains', () => {
            expect(getHostnameInitial('https://a.b.example.com')).toBe('E');
        });

        it('skips www subdomain', () => {
            expect(getHostnameInitial('https://www.coinos.io')).toBe('C');
        });

        // Plain domains (no subdomain)
        it('returns initial from plain domain', () => {
            expect(getHostnameInitial('https://stablenut.org')).toBe('S');
        });

        it('returns initial from two-part domain', () => {
            expect(getHostnameInitial('https://gandlaf.com')).toBe('G');
        });

        // Real-world mint URLs
        it('handles testnut.cashu.space', () => {
            expect(getHostnameInitial('https://testnut.cashu.space')).toBe('C');
        });

        it('handles nofees.testnut.cashu.space', () => {
            expect(
                getHostnameInitial('https://nofees.testnut.cashu.space')
            ).toBe('C');
        });

        // Edge cases
        it('returns empty string for null', () => {
            expect(getHostnameInitial(null)).toBe('');
        });

        it('returns empty string for undefined', () => {
            expect(getHostnameInitial(undefined)).toBe('');
        });

        it('returns empty string for empty string', () => {
            expect(getHostnameInitial('')).toBe('');
        });

        it('returns empty string for invalid URL', () => {
            expect(getHostnameInitial('not-a-url')).toBe('');
        });

        it('handles URL with port', () => {
            expect(getHostnameInitial('https://mint.example.com:3338')).toBe(
                'E'
            );
        });

        it('handles URL with path', () => {
            expect(getHostnameInitial('https://mint.example.com/v1/info')).toBe(
                'E'
            );
        });

        it('handles http URL', () => {
            expect(getHostnameInitial('http://localhost.example.org')).toBe(
                'E'
            );
        });

        it('uppercases the initial', () => {
            expect(getHostnameInitial('https://mint.example.com')).toBe('E');
        });
    });
});
