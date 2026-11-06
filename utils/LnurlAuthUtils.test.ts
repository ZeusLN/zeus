import {
    LNURLAUTH_CANONICAL_PHRASE,
    isReservedSigningMessage,
    signLnurlAuthChallenge
} from './LnurlAuthUtils';

describe('isReservedSigningMessage', () => {
    it('matches the canonical phrase', () => {
        expect(isReservedSigningMessage(LNURLAUTH_CANONICAL_PHRASE)).toBe(true);
    });

    it('matches with surrounding whitespace, different case and collapsed whitespace', () => {
        expect(
            isReservedSigningMessage(`  \n${LNURLAUTH_CANONICAL_PHRASE}\t `)
        ).toBe(true);
        expect(
            isReservedSigningMessage(LNURLAUTH_CANONICAL_PHRASE.toLowerCase())
        ).toBe(true);
        expect(
            isReservedSigningMessage(
                LNURLAUTH_CANONICAL_PHRASE.replace(/ /g, '  \n')
            )
        ).toBe(true);
    });

    it('does not match other messages', () => {
        expect(isReservedSigningMessage('')).toBe(false);
        expect(isReservedSigningMessage('hello')).toBe(false);
        expect(
            isReservedSigningMessage(LNURLAUTH_CANONICAL_PHRASE + ' extra')
        ).toBe(false);
    });

    // A look-alike whose chars share the phrase's low bytes is a different
    // string. Backends must sign UTF-8 so it cannot be signed as the phrase.
    it('does not match a look-alike that differs only above the low byte', () => {
        expect(
            isReservedSigningMessage(
                '\u0144' + LNURLAUTH_CANONICAL_PHRASE.slice(1)
            )
        ).toBe(false);
    });
});

// Expected values computed with Node's crypto (HMAC) and @noble/curves
// (public key, RFC 6979 DER signature), independent of the app's helpers.
describe('signLnurlAuthChallenge', () => {
    // sha256 of a node signature, as returned by the backends' lnurlAuth
    const hashingKey = Uint8Array.from(
        Buffer.from(
            '974844ab2f50a8fc85ca54a9fc686854e902ad46f1b72219d05e0f371f29bb8c',
            'hex'
        )
    );
    const k1 =
        'e2af6254a8df433264fa23f67eb8188635d15ce883e8fc020989d5f82ae6f11e';

    it('derives the linking key from hmacSha256(hashingKey, domain) and signs k1', () => {
        expect(
            signLnurlAuthChallenge(hashingKey, 'site.example.com', k1)
        ).toEqual({
            linkingKeyPub:
                '02377dcf8283b583856ddc81dda14d0f17f679c379d30ecb05ca4696a14df1db16',
            signedMessageDERHex:
                '3045022100a162fb10d66d4ebc92120b28ea4d1a1e2125f0f740b35d4b02ff549b7bffb7530220448802198a147c3637bc0ad75fb2a9a6022381f5f0edad4695f74799bcc61646'
        });
    });

    it('gives each domain its own linking key', () => {
        const a = signLnurlAuthChallenge(hashingKey, 'a.example.com', k1);
        const b = signLnurlAuthChallenge(hashingKey, 'b.example.com', k1);
        expect(a.linkingKeyPub).not.toBe(b.linkingKeyPub);
    });
});
