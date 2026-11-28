// Lockstep scan of CashuDevKitModule.kt (Kotlin is not exercised by Jest).
//
// checkExternalMintQuote checks the mint URL's scheme and host once, before
// the request (project-loupe/audit-zeus#21). HttpURLConnection follows
// same-protocol redirects by default, so a mint could answer 302 with a
// loopback or LAN HTTPS URL and the GET would go there unchecked. With
// redirects off, the 3xx takes the existing non-200 rejection.
//
// fetchMintInfo is called by Mint Discovery for mints from public Nostr
// recommendations, which are checked only as URLs, so it does not follow
// redirects either.

import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
    path.join(__dirname, 'CashuDevKitModule.kt'),
    'utf8'
);

// Body of `fun <name>(` up to the next annotated or private member
const member = (name: string): string => {
    const start = source.indexOf(`fun ${name}(`);
    expect(start).toBeGreaterThan(-1);
    const rest = source.slice(start);
    const end = rest.slice(1).search(/\n    (?:@ReactMethod|private |fun )/);
    return end === -1 ? rest : rest.slice(0, end + 1);
};

describe('Android checkExternalMintQuote redirects', () => {
    const body = member('checkExternalMintQuote');

    it('turns redirects off before the request is sent', () => {
        const open = body.indexOf('openConnection()');
        const off = body.indexOf('connection.instanceFollowRedirects = false');
        const send = body.indexOf('connection.responseCode');
        expect(open).toBeGreaterThan(-1);
        expect(off).toBeGreaterThan(open);
        expect(send).toBeGreaterThan(off);
    });

    it('never turns redirects back on', () => {
        expect(body).not.toMatch(/instanceFollowRedirects = true/);
        expect(source).not.toMatch(/setFollowRedirects\(true\)/);
        expect(source).not.toMatch(/HttpURLConnection\.followRedirects = /);
    });

    it('rejects any status other than 200, which covers a 3xx', () => {
        expect(body).toMatch(
            /if \(responseCode != HttpURLConnection\.HTTP_OK\) \{[\s\S]*?promise\.reject\("HTTP_ERROR"[\s\S]*?return@launch/
        );
    });
});

describe('Android fetchMintInfo redirects', () => {
    const body = member('fetchMintInfo');

    it('turns redirects off before the request is sent', () => {
        const open = body.indexOf('openConnection()');
        const off = body.indexOf('connection.instanceFollowRedirects = false');
        const send = body.indexOf('connection.responseCode');
        expect(open).toBeGreaterThan(-1);
        expect(off).toBeGreaterThan(open);
        expect(send).toBeGreaterThan(off);
    });

    it('never turns redirects back on', () => {
        expect(body).not.toMatch(/instanceFollowRedirects = true/);
    });

    it('rejects any status outside 2xx, which covers a 3xx', () => {
        expect(body).toMatch(
            /if \(responseCode !in 200\.\.299\) \{[\s\S]*?promise\.reject\("HTTP_ERROR"[\s\S]*?return@launch/
        );
    });
});
