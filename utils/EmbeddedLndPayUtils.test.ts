import { matchesExpectedPayment } from './EmbeddedLndPayUtils';

const SPEC_PAYMENT_HASH =
    '0001020304050607080900010203040506070809000102030405060708090102';

const KEYSEND_HASH_HEX =
    '66497159952cabecfee7fd8ac0f3aa1a557a77b21313c5a94559d1e78c90ed8b';
describe('EmbeddedLndPayUtils', () => {
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
