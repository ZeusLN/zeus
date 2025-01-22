import ValidationUtils from './ValidationUtils';

describe('isValidHostAndPort', () => {
    it('accepts valid hostname without port', () => {
        expect(ValidationUtils.isValidHostAndPort('example.com')).toBe(true);
    });

    it('accepts valid hostname with port', () => {
        expect(ValidationUtils.isValidHostAndPort('example.com:8080')).toBe(
            true
        );
    });

    it('accepts valid hostname with protocol', () => {
        expect(ValidationUtils.isValidHostAndPort('https://example.com')).toBe(
            true
        );
        expect(ValidationUtils.isValidHostAndPort('http://example.com')).toBe(
            true
        );
    });

    it('rejects invalid port numbers', () => {
        expect(ValidationUtils.isValidHostAndPort('example.com:0')).toBe(false);
        expect(ValidationUtils.isValidHostAndPort('example.com:65536')).toBe(
            false
        );
    });

    it('rejects invalid hostnames', () => {
        expect(ValidationUtils.isValidHostAndPort('example..com')).toBe(false);
        expect(ValidationUtils.isValidHostAndPort('-example.com')).toBe(false);
    });
});

describe('isValidHttpsHostAndPort', () => {
    it('accepts valid hostname without protocol', () => {
        expect(ValidationUtils.isValidHttpsHostAndPort('example.com')).toBe(
            true
        );
    });

    it('accepts valid hostname with https protocol', () => {
        expect(
            ValidationUtils.isValidHttpsHostAndPort('https://example.com')
        ).toBe(true);
    });

    it('accepts valid hostname with port', () => {
        expect(
            ValidationUtils.isValidHttpsHostAndPort('example.com:8080')
        ).toBe(true);
        expect(
            ValidationUtils.isValidHttpsHostAndPort('https://example.com:8080')
        ).toBe(true);
    });

    it('rejects hostname with http protocol', () => {
        expect(
            ValidationUtils.isValidHttpsHostAndPort('http://example.com')
        ).toBe(false);
        expect(
            ValidationUtils.isValidHttpsHostAndPort('http://example.com:8080')
        ).toBe(false);
    });

    it('rejects invalid port numbers', () => {
        expect(ValidationUtils.isValidHttpsHostAndPort('example.com:0')).toBe(
            false
        );
        expect(
            ValidationUtils.isValidHttpsHostAndPort('example.com:65536')
        ).toBe(false);
    });

    it('rejects invalid hostnames', () => {
        expect(ValidationUtils.isValidHttpsHostAndPort('example..com')).toBe(
            false
        );
        expect(ValidationUtils.isValidHttpsHostAndPort('-example.com')).toBe(
            false
        );
    });
});

describe('isValidHostname', () => {
    it('accepts valid hostnames', () => {
        expect(ValidationUtils.isValidHostname('example.com')).toBe(true);
        expect(ValidationUtils.isValidHostname('sub.example.com')).toBe(true);
        expect(ValidationUtils.isValidHostname('example-domain.com')).toBe(
            true
        );
        expect(ValidationUtils.isValidHostname('localhost')).toBe(true);
        expect(ValidationUtils.isValidHostname('10.0.2.2')).toBe(true);
    });

    it('accepts hostnames with protocol', () => {
        expect(ValidationUtils.isValidHostname('http://example.com')).toBe(
            true
        );
        expect(ValidationUtils.isValidHostname('https://example.com')).toBe(
            true
        );
    });

    it('rejects invalid hostnames', () => {
        expect(ValidationUtils.isValidHostname('example..com')).toBe(false);
        expect(ValidationUtils.isValidHostname('.example.com')).toBe(false);
        expect(ValidationUtils.isValidHostname('example.com:')).toBe(false);
    });
});

describe('isValidPort', () => {
    it('accepts valid port numbers', () => {
        expect(ValidationUtils.isValidPort('80')).toBe(true);
        expect(ValidationUtils.isValidPort('8080')).toBe(true);
        expect(ValidationUtils.isValidPort('65535')).toBe(true);
    });

    it('rejects invalid port numbers', () => {
        expect(ValidationUtils.isValidPort('0')).toBe(false);
        expect(ValidationUtils.isValidPort('65536')).toBe(false);
        expect(ValidationUtils.isValidPort('-1')).toBe(false);
    });
});

describe('hasValidRuneChars', () => {
    it('accepts valid rune characters', () => {
        expect(ValidationUtils.hasValidRuneChars('abcDEF123-_=')).toBe(true);
        expect(ValidationUtils.hasValidRuneChars('ABC123')).toBe(true);
    });

    it('rejects invalid rune characters', () => {
        expect(ValidationUtils.hasValidRuneChars('abc!')).toBe(false);
        expect(ValidationUtils.hasValidRuneChars('abc@')).toBe(false);
        expect(ValidationUtils.hasValidRuneChars('abc space')).toBe(false);
    });
});

describe('hasValidMacaroonChars', () => {
    it('accepts valid macaroon hex characters', () => {
        expect(ValidationUtils.hasValidMacaroonChars('0123456789abcdef')).toBe(
            true
        );
        expect(ValidationUtils.hasValidMacaroonChars('ABCDEF')).toBe(true);
    });

    it('rejects invalid macaroon hex characters', () => {
        expect(ValidationUtils.hasValidMacaroonChars('0123g')).toBe(false);
        expect(ValidationUtils.hasValidMacaroonChars('abcd!')).toBe(false);
        expect(ValidationUtils.hasValidMacaroonChars('0123 4567')).toBe(false);
    });
});

describe('hasValidPairingPhraseCharsAndWordcount', () => {
    it('accepts valid 10-word pairing phrase', () => {
        expect(
            ValidationUtils.hasValidPairingPhraseCharsAndWordcount(
                'cherry truth mask employ box silver mass bunker fiscal vote'
            )
        ).toBe(true);
    });

    it('accepts phrase with extra spaces and normalizes', () => {
        expect(
            ValidationUtils.hasValidPairingPhraseCharsAndWordcount(
                '  cherry   truth  mask employ box silver mass bunker fiscal vote  '
            )
        ).toBe(true);
    });

    it('rejects phrases with wrong word count', () => {
        expect(
            ValidationUtils.hasValidPairingPhraseCharsAndWordcount(
                'less than ten words'
            )
        ).toBe(false);
        expect(
            ValidationUtils.hasValidPairingPhraseCharsAndWordcount(
                'more than ten words truth mask employ box silver mass bunker'
            )
        ).toBe(false);
    });

    it('rejects phrases with invalid characters', () => {
        expect(
            ValidationUtils.hasValidPairingPhraseCharsAndWordcount(
                'cherry truth mask employ box silver mass bunker fiscal 123'
            )
        ).toBe(false);
        expect(
            ValidationUtils.hasValidPairingPhraseCharsAndWordcount(
                'cherry truth mask employ box silver mass bunker fiscal @'
            )
        ).toBe(false);
    });
});
