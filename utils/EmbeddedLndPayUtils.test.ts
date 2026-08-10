import {
    getExpectedPaymentHash,
    matchesExpectedPayment
} from './EmbeddedLndPayUtils';

// BOLT11 spec reference vector (lnbc2500u, hashed description); its
// payment_hash is pinned by the spec
const SPEC_PAYMENT_REQUEST =
    'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr';
const SPEC_PAYMENT_HASH =
    '0001020304050607080900010203040506070809000102030405060708090102';

const KEYSEND_HASH_HEX =
    '66497159952cabecfee7fd8ac0f3aa1a557a77b21313c5a94559d1e78c90ed8b';
const KEYSEND_HASH_BASE64 = Buffer.from(KEYSEND_HASH_HEX, 'hex').toString(
    'base64'
);

describe('EmbeddedLndPayUtils', () => {
    describe('getExpectedPaymentHash', () => {
        it('decodes the payment hash out of a bolt11 payment request', () => {
            expect(
                getExpectedPaymentHash({
                    payment_request: SPEC_PAYMENT_REQUEST
                })
            ).toEqual(SPEC_PAYMENT_HASH);
        });

        it('converts a base64 keysend payment hash to hex', () => {
            expect(
                getExpectedPaymentHash({ payment_hash: KEYSEND_HASH_BASE64 })
            ).toEqual(KEYSEND_HASH_HEX);
        });

        it('passes a hex payment hash through, lowercased', () => {
            expect(
                getExpectedPaymentHash({
                    payment_hash: KEYSEND_HASH_HEX.toUpperCase()
                })
            ).toEqual(KEYSEND_HASH_HEX);
        });

        it('converts a byte-array payment hash to hex', () => {
            expect(
                getExpectedPaymentHash({
                    payment_hash: Uint8Array.from(
                        Buffer.from(KEYSEND_HASH_HEX, 'hex')
                    )
                })
            ).toEqual(KEYSEND_HASH_HEX);
        });

        it('prefers the request payment_hash over the payment_request', () => {
            expect(
                getExpectedPaymentHash({
                    payment_hash: KEYSEND_HASH_HEX,
                    payment_request: SPEC_PAYMENT_REQUEST
                })
            ).toEqual(KEYSEND_HASH_HEX);
        });

        it('returns null for AMP payments even when a hash is present', () => {
            expect(
                getExpectedPaymentHash({
                    amp: true,
                    payment_hash: KEYSEND_HASH_HEX,
                    payment_request: SPEC_PAYMENT_REQUEST
                })
            ).toBeNull();
        });

        it('returns null for an undecodable payment request', () => {
            expect(
                getExpectedPaymentHash({ payment_request: 'lnbc1notarealpr' })
            ).toBeNull();
        });

        it('returns null when there is nothing to correlate on', () => {
            expect(getExpectedPaymentHash({})).toBeNull();
        });
    });

    describe('matchesExpectedPayment', () => {
        it('matches when no expected hash is available (legacy first-event behavior)', () => {
            expect(
                matchesExpectedPayment(null, {
                    payment_hash: KEYSEND_HASH_HEX
                })
            ).toEqual(true);
        });

        it('matches its own payment, case-insensitively', () => {
            expect(
                matchesExpectedPayment(KEYSEND_HASH_HEX, {
                    payment_hash: KEYSEND_HASH_HEX.toUpperCase()
                })
            ).toEqual(true);
        });

        it("rejects another payment's event", () => {
            expect(
                matchesExpectedPayment(KEYSEND_HASH_HEX, {
                    payment_hash: SPEC_PAYMENT_HASH
                })
            ).toEqual(false);
        });

        it('matches defensively when the event carries no hash', () => {
            expect(matchesExpectedPayment(KEYSEND_HASH_HEX, {})).toEqual(true);
            expect(matchesExpectedPayment(KEYSEND_HASH_HEX, null)).toEqual(
                true
            );
        });
    });
});
