import {
    authChallengeRequestBody,
    isValidAuthChallenge,
    OLYMPUS_AUTH_TAG,
    ZEUS_PAY_AUTH_TAG
} from './AuthChallengeUtils';

const NONCE = 'a1'.repeat(64);
const ZEUS_PAY_CHALLENGE = `${ZEUS_PAY_AUTH_TAG}${NONCE}`;
const OLYMPUS_CHALLENGE = `${OLYMPUS_AUTH_TAG}${NONCE}`;
const CANONICAL_PHRASE =
    'DO NOT EVER SIGN THIS TEXT WITH YOUR PRIVATE KEYS! IT IS ONLY USED FOR DERIVATION OF LNURL-AUTH HASHING-KEY, DISCLOSING ITS SIGNATURE WILL COMPROMISE YOUR LNURL-AUTH IDENTITY AND MAY LEAD TO LOSS OF FUNDS!';

describe('AuthChallengeUtils', () => {
    describe('isValidAuthChallenge', () => {
        it.each([
            ['ZEUS Pay', ZEUS_PAY_AUTH_TAG],
            ['Olympus', OLYMPUS_AUTH_TAG]
        ] as const)(
            'accepts the %s tag followed by 128 lowercase hex characters',
            (_label, tag) => {
                expect(isValidAuthChallenge(`${tag}${NONCE}`, tag)).toBe(true);
                expect(
                    isValidAuthChallenge(
                        `${tag}${'0123456789abcdef'.repeat(8)}`,
                        tag
                    )
                ).toBe(true);
            }
        );

        it("rejects the other service's challenge", () => {
            expect(
                isValidAuthChallenge(OLYMPUS_CHALLENGE, ZEUS_PAY_AUTH_TAG)
            ).toBe(false);
            expect(
                isValidAuthChallenge(ZEUS_PAY_CHALLENGE, OLYMPUS_AUTH_TAG)
            ).toBe(false);
        });

        it('rejects a bare hex nonce', () => {
            expect(isValidAuthChallenge(NONCE, ZEUS_PAY_AUTH_TAG)).toBe(false);
            expect(isValidAuthChallenge(NONCE, OLYMPUS_AUTH_TAG)).toBe(false);
        });

        it('rejects the LNURL-auth canonical phrase, bare or after the tag', () => {
            expect(
                isValidAuthChallenge(CANONICAL_PHRASE, ZEUS_PAY_AUTH_TAG)
            ).toBe(false);
            expect(
                isValidAuthChallenge(
                    `${ZEUS_PAY_AUTH_TAG}${CANONICAL_PHRASE}`,
                    ZEUS_PAY_AUTH_TAG
                )
            ).toBe(false);
        });

        it('rejects the tag in a different form', () => {
            expect(
                isValidAuthChallenge(
                    `zeuspay.com auth${NONCE}`,
                    ZEUS_PAY_AUTH_TAG
                )
            ).toBe(false);
            expect(
                isValidAuthChallenge(
                    `ZEUSPAY.COM AUTH ${NONCE}`,
                    ZEUS_PAY_AUTH_TAG
                )
            ).toBe(false);
            expect(
                isValidAuthChallenge(
                    ` ${ZEUS_PAY_CHALLENGE}`,
                    ZEUS_PAY_AUTH_TAG
                )
            ).toBe(false);
            expect(
                isValidAuthChallenge(
                    `zeuspay.com  auth ${NONCE}`,
                    ZEUS_PAY_AUTH_TAG
                )
            ).toBe(false);
        });

        it('rejects hex of the wrong length', () => {
            const tag = ZEUS_PAY_AUTH_TAG;
            expect(isValidAuthChallenge(`${tag}${NONCE.slice(1)}`, tag)).toBe(
                false
            );
            expect(isValidAuthChallenge(`${tag}${NONCE}a`, tag)).toBe(false);
            expect(isValidAuthChallenge(`${tag}${'a1'.repeat(32)}`, tag)).toBe(
                false
            );
            expect(isValidAuthChallenge(tag, tag)).toBe(false);
            expect(isValidAuthChallenge('', tag)).toBe(false);
        });

        it('rejects uppercase hex', () => {
            expect(
                isValidAuthChallenge(
                    `${ZEUS_PAY_AUTH_TAG}${NONCE.toUpperCase()}`,
                    ZEUS_PAY_AUTH_TAG
                )
            ).toBe(false);
        });

        it('rejects non-hex characters and trailing text', () => {
            const tag = OLYMPUS_AUTH_TAG;
            expect(
                isValidAuthChallenge(`${tag}${'a1'.repeat(63)}zz`, tag)
            ).toBe(false);
            expect(isValidAuthChallenge(`${OLYMPUS_CHALLENGE}\n`, tag)).toBe(
                false
            );
            expect(
                isValidAuthChallenge(`${OLYMPUS_CHALLENGE}\nmore text`, tag)
            ).toBe(false);
            expect(
                isValidAuthChallenge(`${OLYMPUS_CHALLENGE} ${NONCE}`, tag)
            ).toBe(false);
        });

        it('rejects non-string values', () => {
            const tag = ZEUS_PAY_AUTH_TAG;
            expect(isValidAuthChallenge(undefined, tag)).toBe(false);
            expect(isValidAuthChallenge(null, tag)).toBe(false);
            expect(isValidAuthChallenge(123, tag)).toBe(false);
            expect(isValidAuthChallenge([ZEUS_PAY_CHALLENGE], tag)).toBe(false);
            expect(
                isValidAuthChallenge(
                    { toString: () => ZEUS_PAY_CHALLENGE },
                    tag
                )
            ).toBe(false);
        });
    });

    describe('authChallengeRequestBody', () => {
        it('asks for a version 2 challenge for the pubkey', () => {
            expect(JSON.parse(authChallengeRequestBody('03cd'))).toEqual({
                pubkey: '03cd',
                version: 2
            });
        });
    });
});
