import {
    decideLncPayEvent,
    deriveExpectedPaymentHash,
    normalizePaymentHash
} from './LncPayUtils';

// BOLT11 spec reference vector (lnbc2500u with hashed description)
// https://github.com/lightning/bolts/blob/master/11-payment-encoding.md#examples
const BOLT11_SPEC_FIXTURE =
    'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr';
const SPEC_HASH_HEX =
    '0001020304050607080900010203040506070809000102030405060708090102';
const SPEC_HASH_BASE64 = Buffer.from(SPEC_HASH_HEX, 'hex').toString('base64');

const OTHER_HASH_HEX =
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

describe('normalizePaymentHash', () => {
    it('passes through hex, lowercased', () => {
        expect(normalizePaymentHash(SPEC_HASH_HEX)).toBe(SPEC_HASH_HEX);
        expect(normalizePaymentHash(SPEC_HASH_HEX.toUpperCase())).toBe(
            SPEC_HASH_HEX
        );
    });

    it('converts base64-encoded 32 bytes to hex', () => {
        expect(normalizePaymentHash(SPEC_HASH_BASE64)).toBe(SPEC_HASH_HEX);
    });

    it('returns undefined for garbage', () => {
        expect(normalizePaymentHash(undefined)).toBeUndefined();
        expect(normalizePaymentHash('')).toBeUndefined();
        expect(normalizePaymentHash('not a hash')).toBeUndefined();
        expect(normalizePaymentHash('abcd')).toBeUndefined();
        expect(normalizePaymentHash(42)).toBeUndefined();
    });
});

describe('deriveExpectedPaymentHash', () => {
    it('uses the keysend payment_hash (base64) when present', () => {
        expect(
            deriveExpectedPaymentHash({ payment_hash: SPEC_HASH_BASE64 })
        ).toBe(SPEC_HASH_HEX);
    });

    it('decodes the bolt11 invoice hash', () => {
        expect(
            deriveExpectedPaymentHash({ payment_request: BOLT11_SPEC_FIXTURE })
        ).toBe(SPEC_HASH_HEX);
    });

    it('skips correlation for AMP payments', () => {
        expect(
            deriveExpectedPaymentHash({
                amp: true,
                payment_hash: SPEC_HASH_BASE64,
                payment_request: BOLT11_SPEC_FIXTURE
            })
        ).toBeUndefined();
    });

    it('returns undefined when nothing is derivable', () => {
        expect(deriveExpectedPaymentHash({})).toBeUndefined();
        expect(
            deriveExpectedPaymentHash({ payment_request: 'lnbc1garbage' })
        ).toBeUndefined();
    });
});

describe('decideLncPayEvent', () => {
    const terminalEvent = JSON.stringify({
        status: 'SUCCEEDED',
        payment_hash: SPEC_HASH_HEX,
        payment_preimage: 'aa'.repeat(32)
    });

    it('ignores EOF and empty events', () => {
        expect(decideLncPayEvent('EOF').kind).toBe('ignore');
        expect(decideLncPayEvent('').kind).toBe('ignore');
        expect(decideLncPayEvent(undefined).kind).toBe('ignore');
        expect(decideLncPayEvent(null).kind).toBe('ignore');
    });

    it('ignores IN_FLIGHT updates, even with a matching hash', () => {
        const event = JSON.stringify({
            status: 'IN_FLIGHT',
            payment_hash: SPEC_HASH_HEX
        });
        expect(decideLncPayEvent(event, SPEC_HASH_HEX).kind).toBe('ignore');
        expect(decideLncPayEvent(event).kind).toBe('ignore');
    });

    it('accepts a terminal event when no hash is expected', () => {
        const decision = decideLncPayEvent(terminalEvent);
        expect(decision.kind).toBe('terminal');
        if (decision.kind === 'terminal') {
            expect(decision.result.status).toBe('SUCCEEDED');
        }
    });

    it('accepts a terminal event with a matching hex hash', () => {
        expect(decideLncPayEvent(terminalEvent, SPEC_HASH_HEX).kind).toBe(
            'terminal'
        );
    });

    it('matches when the event hash is base64 of the same bytes', () => {
        const event = JSON.stringify({
            status: 'SUCCEEDED',
            payment_hash: SPEC_HASH_BASE64
        });
        expect(decideLncPayEvent(event, SPEC_HASH_HEX).kind).toBe('terminal');
    });

    it("ignores another payment's terminal event", () => {
        expect(decideLncPayEvent(terminalEvent, OTHER_HASH_HEX).kind).toBe(
            'ignore'
        );
    });

    it('tolerates a terminal event without a payment_hash', () => {
        const event = JSON.stringify({ status: 'SUCCEEDED' });
        expect(decideLncPayEvent(event, SPEC_HASH_HEX).kind).toBe('terminal');
    });

    it('passes FAILED events through as terminal', () => {
        const event = JSON.stringify({
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_NO_ROUTE',
            payment_hash: SPEC_HASH_HEX
        });
        const decision = decideLncPayEvent(event, SPEC_HASH_HEX);
        expect(decision.kind).toBe('terminal');
        if (decision.kind === 'terminal') {
            expect(decision.result.failure_reason).toBe(
                'FAILURE_REASON_NO_ROUTE'
            );
        }
    });

    it('turns a non-JSON native error string into a real Error', () => {
        const raw = 'rpc error: code = Unavailable desc = connection closed';
        const decision = decideLncPayEvent(raw, SPEC_HASH_HEX);
        expect(decision.kind).toBe('error');
        if (decision.kind === 'error') {
            expect(decision.error).toBeInstanceOf(Error);
            expect(decision.error.message).toBe(raw);
        }
    });

    it('treats JSON that is not an object as an error', () => {
        expect(decideLncPayEvent('"unavailable"').kind).toBe('error');
        expect(decideLncPayEvent('123').kind).toBe('error');
        expect(decideLncPayEvent('null').kind).toBe('error');
    });
});
