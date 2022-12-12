import Base64Utils from './Base64Utils';

describe('Base64Utils', () => {
    describe('utf8ToHexString', () => {
        it('Converts utf8 string to hexidecimal string', () => {
            expect(
                Base64Utils.utf8ToHexString('Test string with punctuation.')
            ).toEqual(
                '5465737420737472696e6720776974682070756e6374756174696f6e2e'
            );
            expect(Base64Utils.utf8ToHexString('1234567890')).toEqual(
                '31323334353637383930'
            );
            expect(Base64Utils.utf8ToHexString('!@#$%^&*')).toEqual(
                '21402324255e262a'
            );
            expect(Base64Utils.utf8ToHexString('áéíÓÚ àèìÒÙ âêîÔÛ')).toEqual(
                'c3a1c3a9c3adc393c39a20c3a0c3a8c3acc392c39920c3a2c3aac3aec394c39b'
            );
        });
    });

    describe('base64ToHex', () => {
        it('Converts base64 string to hexidecimal string', () => {
            expect(
                Base64Utils.base64ToHex('VGhpcyBpcyB0aGUgZmlyc3QgdGVzdA==')
            ).toEqual('54686973206973207468652066697273742074657374');
            expect(Base64Utils.base64ToHex('RW5kIHRoZSBGZWQ=')).toEqual(
                '456e642074686520466564'
            );
            expect(
                Base64Utils.base64ToHex(
                    'RGVjb2RpbmcgdGhpcyBCYXNlNjQ/IFF1aXRlIHNwb29reS4='
                )
            ).toEqual(
                '4465636f64696e672074686973204261736536343f2051756974652073706f6f6b792e'
            );
            expect(Base64Utils.base64ToHex('WkVVUw==')).toEqual('5a455553');
        });
    });
});
