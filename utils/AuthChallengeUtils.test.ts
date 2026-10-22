import { isValidAuthChallenge } from './AuthChallengeUtils';

const HEX_128 = 'a1'.repeat(64);

describe('AuthChallengeUtils', () => {
    describe('isValidAuthChallenge', () => {
        it('accepts 128 lowercase hex characters', () => {
            expect(isValidAuthChallenge(HEX_128)).toBe(true);
            expect(isValidAuthChallenge('0123456789abcdef'.repeat(8))).toBe(
                true
            );
        });

        it('rejects the LNURL-auth canonical phrase', () => {
            expect(
                isValidAuthChallenge(
                    'DO NOT EVER SIGN THIS TEXT WITH YOUR PRIVATE KEYS! IT IS ONLY USED FOR DERIVATION OF LNURL-AUTH HASHING-KEY, DISCLOSING ITS SIGNATURE WILL COMPROMISE YOUR LNURL-AUTH IDENTITY AND MAY LEAD TO LOSS OF FUNDS!'
                )
            ).toBe(false);
        });

        it('rejects hex of the wrong length', () => {
            expect(isValidAuthChallenge(HEX_128.slice(1))).toBe(false);
            expect(isValidAuthChallenge(`${HEX_128}a`)).toBe(false);
            expect(isValidAuthChallenge('a1'.repeat(32))).toBe(false);
            expect(isValidAuthChallenge('')).toBe(false);
        });

        it('rejects uppercase hex', () => {
            expect(isValidAuthChallenge(HEX_128.toUpperCase())).toBe(false);
        });

        it('rejects non-hex characters and surrounding text', () => {
            expect(isValidAuthChallenge(`${'a1'.repeat(63)}zz`)).toBe(false);
            expect(isValidAuthChallenge(` ${HEX_128.slice(1)}`)).toBe(false);
            expect(isValidAuthChallenge(`${HEX_128}\n`)).toBe(false);
            expect(isValidAuthChallenge(`${HEX_128}\nmore text`)).toBe(false);
        });

        it('rejects non-string values', () => {
            expect(isValidAuthChallenge(undefined)).toBe(false);
            expect(isValidAuthChallenge(null)).toBe(false);
            expect(isValidAuthChallenge(123)).toBe(false);
            expect(isValidAuthChallenge([HEX_128])).toBe(false);
            expect(isValidAuthChallenge({ toString: () => HEX_128 })).toBe(
                false
            );
        });
    });
});
