import ValidationUtils from './ValidationUtils';

describe('isValidServerAddress', () => {
    it('accepts valid server addresses without port', () => {
        expect(ValidationUtils.isValidServerAddress('example.com')).toBe(true);
        expect(
            ValidationUtils.isValidServerAddress('subdomain.example.com')
        ).toBe(true);
        expect(
            ValidationUtils.isValidServerAddress('sub-domain.example.space')
        ).toBe(true);
        expect(
            ValidationUtils.isValidServerAddress(
                'some.more.subs.example-domain.de'
            )
        ).toBe(true);
        expect(ValidationUtils.isValidServerAddress('10.0.2.2')).toBe(true);
        expect(ValidationUtils.isValidServerAddress('[2001:db8::1]')).toBe(
            true
        );
        expect(ValidationUtils.isValidServerAddress('localhost')).toBe(true);
    });

    it('accepts valid server addresses with port when allowed', () => {
        expect(
            ValidationUtils.isValidServerAddress('example.com:443', {
                allowPort: true
            })
        ).toBe(true);
        expect(
            ValidationUtils.isValidServerAddress('10.0.2.2:4001', {
                allowPort: true
            })
        ).toBe(true);
        expect(
            ValidationUtils.isValidServerAddress('[2001:db8::1]:8080', {
                allowPort: true
            })
        ).toBe(true);
        expect(
            ValidationUtils.isValidServerAddress('localhost:21021', {
                allowPort: true
            })
        ).toBe(true);
    });

    it('accepts valid server addresses with protocol', () => {
        expect(
            ValidationUtils.isValidServerAddress('https://example.com')
        ).toBe(true);
        expect(
            ValidationUtils.isValidServerAddress('HTTPS://example.com')
        ).toBe(true);
        expect(
            ValidationUtils.isValidServerAddress('http://subdomain.example.com')
        ).toBe(true);
        expect(ValidationUtils.isValidServerAddress('https://10.0.2.2')).toBe(
            true
        );
        expect(ValidationUtils.isValidServerAddress('http://10.0.2.2')).toBe(
            true
        );
        expect(
            ValidationUtils.isValidServerAddress('https://[2001:db8::1]')
        ).toBe(true);
        expect(
            ValidationUtils.isValidServerAddress('http://[2001:db8::1]')
        ).toBe(true);
        expect(ValidationUtils.isValidServerAddress('https://localhost')).toBe(
            true
        );
        expect(ValidationUtils.isValidServerAddress('http://localhost')).toBe(
            true
        );
    });

    it('accepts valid paths', () => {
        expect(ValidationUtils.isValidServerAddress('example.com/')).toBe(true);
        expect(ValidationUtils.isValidServerAddress('example.com/path')).toBe(
            true
        );
        expect(ValidationUtils.isValidServerAddress('example.com/path/')).toBe(
            true
        );
        expect(
            ValidationUtils.isValidServerAddress('10.0.2.2/way/more/paths')
        ).toBe(true);
        expect(
            ValidationUtils.isValidServerAddress('10.0.2.2/way/more/paths/')
        ).toBe(true);
        expect(
            ValidationUtils.isValidServerAddress(
                '[2001:db8::1]/path-with_crazy!chars'
            )
        ).toBe(true);
        expect(
            ValidationUtils.isValidServerAddress(
                '[2001:db8::1]/path-with-numbers2'
            )
        ).toBe(true);
    });

    it('rejects invalid port numbers', () => {
        expect(
            ValidationUtils.isValidServerAddress('example.com:0', {
                allowPort: true
            })
        ).toBe(false);
        expect(
            ValidationUtils.isValidServerAddress('example.com:65536', {
                allowPort: true
            })
        ).toBe(false);
        expect(
            ValidationUtils.isValidServerAddress('example.com:-80', {
                allowPort: true
            })
        ).toBe(false);
        expect(
            ValidationUtils.isValidServerAddress('example.com: 80', {
                allowPort: true
            })
        ).toBe(false);
        expect(
            ValidationUtils.isValidServerAddress('example.com:80.80', {
                allowPort: true
            })
        ).toBe(false);
        expect(
            ValidationUtils.isValidServerAddress('example.com:abc', {
                allowPort: true
            })
        ).toBe(false);
    });

    it('rejects invalid server addresses', () => {
        expect(ValidationUtils.isValidServerAddress('http:/example.com')).toBe(
            false
        );
        expect(ValidationUtils.isValidServerAddress('http//example.com')).toBe(
            false
        );
        expect(
            ValidationUtils.isValidServerAddress('http:///example.com')
        ).toBe(false);
        expect(ValidationUtils.isValidServerAddress('ex!ample.com')).toBe(
            false
        );
        expect(ValidationUtils.isValidServerAddress('ex_ample.com')).toBe(
            false
        );
        expect(ValidationUtils.isValidServerAddress('example .com')).toBe(
            false
        );
        expect(ValidationUtils.isValidServerAddress('example. com')).toBe(
            false
        );
        expect(ValidationUtils.isValidServerAddress(' example.com')).toBe(
            false
        );
        expect(ValidationUtils.isValidServerAddress('example.com ')).toBe(
            false
        );
        expect(ValidationUtils.isValidServerAddress('exam ple.com')).toBe(
            false
        );
        expect(ValidationUtils.isValidServerAddress('example..com')).toBe(
            false
        );
        expect(ValidationUtils.isValidServerAddress('-example.com')).toBe(
            false
        );
        expect(ValidationUtils.isValidServerAddress('example.com2')).toBe(
            false
        );
        expect(ValidationUtils.isValidServerAddress('example.c')).toBe(false);
        expect(ValidationUtils.isValidServerAddress('example.123')).toBe(false);
        expect(ValidationUtils.isValidServerAddress('example.com//no')).toBe(
            false
        );
        expect(
            ValidationUtils.isValidServerAddress('example.com/not/ok//')
        ).toBe(false);
        expect(
            ValidationUtils.isValidServerAddress('example.com/nobody/does:this')
        ).toBe(false);
        expect(
            ValidationUtils.isValidServerAddress(
                'example.com/nobody/does/this/either:8080'
            )
        ).toBe(false);
        expect(ValidationUtils.isValidServerAddress('10.0.0.2.2')).toBe(false);
        expect(ValidationUtils.isValidServerAddress('10.0.2')).toBe(false);
        expect(ValidationUtils.isValidServerAddress('10.0.a.2')).toBe(false);
        expect(ValidationUtils.isValidServerAddress('10.0.2a.2')).toBe(false);
        expect(ValidationUtils.isValidServerAddress('10,0.0.2')).toBe(false);
        expect(ValidationUtils.isValidServerAddress('256.0.0.1')).toBe(false);
        expect(ValidationUtils.isValidServerAddress('10.256.0.1')).toBe(false);
        expect(ValidationUtils.isValidServerAddress('10.0.256.1')).toBe(false);
        expect(ValidationUtils.isValidServerAddress('10.0.0.256')).toBe(false);
        expect(ValidationUtils.isValidServerAddress('2001:db8::1')).toBe(false);
        expect(ValidationUtils.isValidServerAddress('[2001:db8::1')).toBe(
            false
        );
        expect(ValidationUtils.isValidServerAddress('2001:db8::1]')).toBe(
            false
        );
        expect(ValidationUtils.isValidServerAddress('[2001:db8:::1]')).toBe(
            false
        );
    });

    it('rejects HTTP when HTTPS is required', () => {
        expect(
            ValidationUtils.isValidServerAddress('http://example.com', {
                requireHttps: true
            })
        ).toBe(false);
        expect(
            ValidationUtils.isValidServerAddress('HTTP://example.com', {
                requireHttps: true
            })
        ).toBe(false);
        expect(
            ValidationUtils.isValidServerAddress('https://example.com', {
                requireHttps: true
            })
        ).toBe(true);
        expect(
            ValidationUtils.isValidServerAddress('example.com', {
                requireHttps: true
            })
        ).toBe(true);
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
        expect(ValidationUtils.isValidPort('a')).toBe(false);
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
        expect(ValidationUtils.hasValidRuneChars('abc def')).toBe(false);
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
        expect(
            ValidationUtils.hasValidPairingPhraseCharsAndWordcount(
                'cherry truth mask employ bo!x silver mass bunker fiscal'
            )
        ).toBe(false);
    });
});
