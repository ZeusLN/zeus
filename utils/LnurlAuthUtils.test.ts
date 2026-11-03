import {
    LNURLAUTH_CANONICAL_PHRASE,
    isReservedSigningMessage
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
