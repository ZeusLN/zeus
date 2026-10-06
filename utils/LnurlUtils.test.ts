const mockGetParams = jest.fn();

jest.mock('./LocaleUtils', () => ({ localeString: (k: string) => k }));

// js-lnurl/lib/helpers is deliberately left unmocked, so the real bech32
// decoder runs and the test exercises the payload an attacker actually
// controls
jest.mock('js-lnurl', () => ({
    getParams: (...args: any[]) => mockGetParams(...args)
}));

import { bech32 } from 'bech32';

import { getLnurlParams, hasUndecodableEscapes } from './LnurlUtils';

// decodelnurl() accepts bech32 up to 20000 characters
const encodeLnurl = (payload: string) =>
    bech32.encode('lnurl', bech32.toWords(Buffer.from(payload)), 20000);

describe('LnurlUtils', () => {
    beforeEach(() => {
        mockGetParams.mockReset();
        mockGetParams.mockResolvedValue({ tag: 'payRequest' });
    });

    describe('hasUndecodableEscapes', () => {
        it('accepts a plain URL', () => {
            expect(
                hasUndecodableEscapes('https://example.com/lnurlp/satoshi')
            ).toBe(false);
        });

        it('accepts well-formed percent-encoding, however much of it', () => {
            const url =
                'https://example.com/?memo=' +
                encodeURIComponent('é'.repeat(500));
            expect(hasUndecodableEscapes(url)).toBe(false);
        });

        it('stays lenient about a stray escape or two', () => {
            expect(
                hasUndecodableEscapes('https://example.com/?memo=50%off')
            ).toBe(false);
            expect(
                hasUndecodableEscapes('https://example.com/?a=%FF&b=%FE')
            ).toBe(false);
        });

        it('ignores valid escapes outside the failing runs', () => {
            expect(
                hasUndecodableEscapes(
                    'https://example.com/?memo=50%off&meta=' +
                        '%E2%82%AC'.repeat(100)
                )
            ).toBe(false);
            expect(
                hasUndecodableEscapes(
                    'https://example.com/?memo=50%25off%FFx' +
                        '%E2%82%AC'.repeat(100)
                )
            ).toBe(false);
        });

        it('counts the valid escapes inside a failing run', () => {
            expect(
                hasUndecodableEscapes(
                    'https://example.com/?a=' + '%41'.repeat(31) + '%FF'
                )
            ).toBe(false);
            expect(
                hasUndecodableEscapes(
                    'https://example.com/?a=' + '%41'.repeat(32) + '%FF'
                )
            ).toBe(true);
        });

        it('rejects a URL packed with malformed escapes', () => {
            expect(
                hasUndecodableEscapes(
                    'https://example.com/?a=' + '%FF'.repeat(600)
                )
            ).toBe(true);
        });

        it('allows exactly 32 malformed escapes and rejects 33', () => {
            const url = (n: number) =>
                'https://example.com/?a=' + '%FF'.repeat(n);
            expect(hasUndecodableEscapes(url(32))).toBe(false);
            expect(hasUndecodableEscapes(url(33))).toBe(true);
        });

        it('rejects malformed escapes spread across many parameters', () => {
            const query = Array.from(
                { length: 100 },
                (_, i) => `k${i}=%FF`
            ).join('&');
            expect(hasUndecodableEscapes(`https://example.com/?${query}`)).toBe(
                true
            );
        });
    });

    describe('getLnurlParams', () => {
        it('passes a legitimate LNURL through to js-lnurl', async () => {
            const lnurl = encodeLnurl(
                'https://example.com/lnurlp/satoshi?tag=payRequest'
            );

            await expect(getLnurlParams(lnurl)).resolves.toEqual({
                tag: 'payRequest'
            });
            expect(mockGetParams).toHaveBeenCalledWith(lnurl);
        });

        it('passes a bare https LNURL through to js-lnurl', async () => {
            const url = 'https://example.com/lnurlp/satoshi';

            await expect(getLnurlParams(url)).resolves.toEqual({
                tag: 'payRequest'
            });
            expect(mockGetParams).toHaveBeenCalledWith(url);
        });

        it('lets js-lnurl report input it cannot decode at all', async () => {
            await expect(getLnurlParams('not-an-lnurl')).resolves.toEqual({
                tag: 'payRequest'
            });
            expect(mockGetParams).toHaveBeenCalledWith('not-an-lnurl');
        });

        // Regression: js-lnurl runs query-string over the decoded payload
        // before it makes any network request, and query-string@6 decodes
        // through decode-uri-component@0.2.2, whose fallback decoder is
        // superlinear in the number of malformed escapes (GHSA-vcc3-ghjq-m6fr).
        // A scanned QR code or deep link carrying this payload used to wedge
        // the JS thread for minutes.
        it('rejects a decode-uri-component DoS payload before parsing it', async () => {
            const lnurl = encodeLnurl(
                'https://example.com/?a=' + '%FF'.repeat(2000)
            );

            await expect(getLnurlParams(lnurl)).rejects.toThrow();
            expect(mockGetParams).not.toHaveBeenCalled();
        });

        it.each([
            ['lnurlp://', 'lnurlp://example.com/?a='],
            ['bare https', 'https://example.com/?a=']
        ])(
            'rejects a DoS payload in a %s LNURL before parsing it',
            async (_, prefix) => {
                await expect(
                    getLnurlParams(prefix + '%FF'.repeat(2000))
                ).rejects.toThrow('utils.handleAnything.invalidLnurlParams');
                expect(mockGetParams).not.toHaveBeenCalled();
            }
        );

        // ~4000 escapes is the most that fits in the 20000 character bech32
        // string decodelnurl() accepts, so this is the worst case an attacker
        // can actually deliver through a QR code, deep link or share intent.
        it('rejects the largest deliverable payload inside a frame budget', async () => {
            const lnurl = encodeLnurl(
                'https://example.com/?a=' + '%FF'.repeat(4000)
            );
            expect(lnurl.length).toBeLessThanOrEqual(20000);

            const start = Date.now();
            await expect(getLnurlParams(lnurl)).rejects.toThrow();
            // unguarded, this payload runs for minutes
            expect(Date.now() - start).toBeLessThan(1000);
        });
    });
});
