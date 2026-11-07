import { isLoopbackHost, isPrivateHost, urlHost } from './HostUtils';

describe('HostUtils', () => {
    describe('urlHost', () => {
        it('lowercases and strips IPv6 brackets and a trailing dot', () => {
            expect(urlHost('http://UMBREL.Local:3006/api')).toBe(
                'umbrel.local'
            );
            expect(urlHost('http://umbrel.local./api')).toBe('umbrel.local');
            expect(urlHost('http://[FD00::1]:3006/api')).toBe('fd00::1');
        });

        it('reads the host, not userinfo or the fragment', () => {
            expect(urlHost('https://192.168.1.1@evil.com/x')).toBe('evil.com');
            expect(urlHost('https://evil.com/#umbrel.local')).toBe('evil.com');
        });

        it("returns '' for a URL that won't parse", () => {
            expect(urlHost('not a url')).toBe('');
            expect(isPrivateHost(urlHost('not a url'))).toBe(false);
        });
    });

    describe('isPrivateHost', () => {
        it.each([
            'localhost',
            '127.0.0.1',
            '::1',
            '0.0.0.0',
            '10.1.2.3',
            '172.16.0.1',
            '172.31.255.255',
            '192.168.1.10',
            '169.254.1.1',
            'fd00::1',
            'fc12::1',
            'fe80::1',
            'umbrel.local'
        ])('%s is private', (host) => {
            expect(isPrivateHost(host)).toBe(true);
        });

        it.each([
            'mempool.space',
            '172.15.0.1',
            '172.32.0.1',
            '8.8.8.8',
            '192.168.evil.com',
            '127.evil.com',
            '2001:db8::1',
            'local.example.com'
        ])('%s is not private', (host) => {
            expect(isPrivateHost(host)).toBe(false);
        });
    });

    it('isLoopbackHost covers localhost, ::1 and 127/8 only', () => {
        expect(isLoopbackHost('localhost')).toBe(true);
        expect(isLoopbackHost('::1')).toBe(true);
        expect(isLoopbackHost('127.4.5.6')).toBe(true);
        expect(isLoopbackHost('127.evil.com')).toBe(false);
        expect(isLoopbackHost('192.168.1.1')).toBe(false);
    });
});
