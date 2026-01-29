import ValidationUtils from './ValidationUtils';

describe('hasProtocolPrefix', () => {
    it('detects http protocol prefix', () => {
        expect(ValidationUtils.hasProtocolPrefix('http://example.com')).toBe(
            true
        );
        expect(ValidationUtils.hasProtocolPrefix('HTTP://example.com')).toBe(
            true
        );
    });

    it('detects https protocol prefix', () => {
        expect(ValidationUtils.hasProtocolPrefix('https://example.com')).toBe(
            true
        );
        expect(ValidationUtils.hasProtocolPrefix('HTTPS://example.com')).toBe(
            true
        );
    });

    it('returns false for addresses without protocol prefix', () => {
        expect(ValidationUtils.hasProtocolPrefix('example.com')).toBe(false);
        expect(ValidationUtils.hasProtocolPrefix('127.0.0.1')).toBe(false);
        expect(
            ValidationUtils.hasProtocolPrefix('v2onionaddress.onion')
        ).toBe(false);
    });
});

describe('isValidOnionAddress', () => {
    it('accepts valid V2 onion addresses', () => {
        expect(
            ValidationUtils.isValidOnionAddress('v2onionaddress12.onion')
        ).toBe(true);
        expect(
            ValidationUtils.isValidOnionAddress('V2ONIONADDRESS12.ONION')
        ).toBe(true);
    });

    it('accepts valid V3 onion addresses', () => {
        expect(
            ValidationUtils.isValidOnionAddress(
                'v3onionaddressv3onionaddressv3onionaddressv3onionadd.onion'
            )
        ).toBe(true);
    });

    it('rejects invalid onion addresses', () => {
        expect(ValidationUtils.isValidOnionAddress('too-short.onion')).toBe(
            false
        );
        expect(ValidationUtils.isValidOnionAddress('not-an-onion.com')).toBe(
            false
        );
        expect(
            ValidationUtils.isValidOnionAddress('v@lidcharacters.onion')
        ).toBe(false);
        expect(
            ValidationUtils.isValidOnionAddress('v2onionaddress123.onion')
        ).toBe(false);
    });
});

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

describe('validateNodePubkey', () => {
    it('accepts valid 66-character hex pubkeys', () => {
        expect(
            ValidationUtils.validateNodePubkey(
                '02eec7245d6b7d2ccb30380bfbe2a3648cd7a942653f5aa340edcea1f283686619'
            )
        ).toBe(true);
        expect(
            ValidationUtils.validateNodePubkey(
                '03a0434d9e47f3c86235477c7b1ae6ae5d3442d49b1943c2b752a68e2a47e247c7'
            )
        ).toBe(true);
        expect(
            ValidationUtils.validateNodePubkey(
                '02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9'
            )
        ).toBe(true);
    });

    it('rejects invalid pubkeys', () => {
        expect(
            ValidationUtils.validateNodePubkey(
                '02eec7245d6b7d2ccb30380bfbe2a3648cd7a942653f5aa340edcea1f28368661'
            )
        ).toBe(false);
        expect(
            ValidationUtils.validateNodePubkey(
                '02eec7245d6b7d2ccb30380bfbe2a3648cd7a942653f5aa340edcea1f2836866199'
            )
        ).toBe(false);
        expect(ValidationUtils.validateNodePubkey('not-a-pubkey')).toBe(false);
        expect(
            ValidationUtils.validateNodePubkey(
                '02eec7245d6b7d2ccb30380bfbe2a3648cd7a942653f5aa340edcea1f28368661 '
            )
        ).toBe(false);
    });

    it('accepts empty string', () => {
        expect(ValidationUtils.validateNodePubkey('')).toBe(false);
    });

    it('accepts case insensitive hex characters', () => {
        expect(
            ValidationUtils.validateNodePubkey(
                '02eec7245d6b7d2ccb30380bfbe2a3648cd7a942653f5aa340edcea1f283686619'
            )
        ).toBe(true);
        expect(
            ValidationUtils.validateNodePubkey(
                '02EEC7245D6B7D2CCB30380BFBE2A3648CD7A942653F5AA340EDCEA1F283686619'
            )
        ).toBe(true);
    });
});

describe('validateNodeHost', () => {
    it('accepts valid host addresses without port', () => {
        expect(ValidationUtils.validateNodeHost('example.com')).toBe(true);
        expect(ValidationUtils.validateNodeHost('subdomain.example.com')).toBe(
            true
        );
        expect(ValidationUtils.validateNodeHost('node.example.org')).toBe(true);
        expect(ValidationUtils.validateNodeHost('localhost')).toBe(true);
        expect(ValidationUtils.validateNodeHost('192.168.1.1')).toBe(true);
        expect(ValidationUtils.validateNodeHost('10.0.0.1')).toBe(true);
        expect(ValidationUtils.validateNodeHost('2001:db8::1')).toBe(true);
        expect(ValidationUtils.validateNodeHost('2001:db8:0:0:0:0:0:1')).toBe(
            true
        );
        expect(ValidationUtils.validateNodeHost('::1')).toBe(true);
        expect(ValidationUtils.validateNodeHost('fe80::1%eth0')).toBe(true);
    });

    it('accepts valid host addresses with port', () => {
        expect(ValidationUtils.validateNodeHost('example.com:8080')).toBe(true);
        expect(ValidationUtils.validateNodeHost('node.example.org:9735')).toBe(
            true
        );
        expect(ValidationUtils.validateNodeHost('localhost:10009')).toBe(true);
        expect(ValidationUtils.validateNodeHost('192.168.1.1:9735')).toBe(true);
        expect(ValidationUtils.validateNodeHost('2001:db8::1:9735')).toBe(true);
        expect(ValidationUtils.validateNodeHost('[2001:db8::1]:9735')).toBe(
            true
        );
        expect(ValidationUtils.validateNodeHost('[::1]:8080')).toBe(true);
        expect(ValidationUtils.validateNodeHost('[fe80::1%eth0]:10009')).toBe(
            true
        );
    });

    it('rejects invalid host addresses', () => {
        expect(ValidationUtils.validateNodeHost('example.com:99999')).toBe(
            false
        );
        expect(ValidationUtils.validateNodeHost('example.com:0')).toBe(false);
        expect(ValidationUtils.validateNodeHost('example.com:abc')).toBe(false);
        expect(ValidationUtils.validateNodeHost('example.com:')).toBe(false);
        expect(ValidationUtils.validateNodeHost(':8080')).toBe(false);
        expect(ValidationUtils.validateNodeHost('example com')).toBe(false);
        expect(ValidationUtils.validateNodeHost('example@com')).toBe(false);
        expect(ValidationUtils.validateNodeHost('2001:db8::1:99999')).toBe(
            false
        );
        expect(ValidationUtils.validateNodeHost('[2001:db8::1]:99999')).toBe(
            false
        );
        expect(ValidationUtils.validateNodeHost('[2001:db8::1]:0')).toBe(false);
        expect(ValidationUtils.validateNodeHost('[2001:db8::1]:abc')).toBe(
            false
        );
        expect(ValidationUtils.validateNodeHost('2001:db8::1]')).toBe(false);
        expect(ValidationUtils.validateNodeHost('[2001:db8::1')).toBe(false);
    });

    it('accepts empty string', () => {
        expect(ValidationUtils.validateNodeHost('')).toBe(false);
    });
});
