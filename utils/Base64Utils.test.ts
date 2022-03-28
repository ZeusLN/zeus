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

    describe('reverseMfpBytes', () => {
        it('Reverses bytes in master key fingerprint', () => {
            expect(Base64Utils.reverseMfpBytes('E65423A4')).toEqual('A42354E6');
        });
    });
});
