import { verifyWrappedInvoice } from './LspUtils';

// Deterministic fixtures signed with throwaway test keys. The scenario:
// the user requests 100 000 sats with a quoted zero-conf fee of
// 1000 sats, so the inner invoice is for 99 000 sats and the wrapped
// invoice asks the payer for the full 100 000. All fixtures share the
// inner invoice's payment hash except WRAPPED_BAD_HASH.
const INNER =
    'lnbc990u1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqgd9hxuetjxqyz5vqcqpj9qypqsqdf53ayr0meh6f8uxhzpz4wzlt3kss4uzw49w968dcsaudvndkk8zk076rgp0ygfxvwqzdf4d4agpwxrrsm2cahg6rj0j5lfct8spz2gqtdet4r';

const WRAPPED_EXACT =
    'lnbc1m1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqpj9qypqsq2vynt4pr072a6kxqxke74s3lhg83939xvm2u8wmsnqg34j7l6y5q92yy9ey8vyve6jupggy22y3dz00uy70q3dryra2dmwg0693lp9gpj93x0l';

const WRAPPED_PARTIAL_FEE =
    'lnbc995u1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqpj9qypqsqjc6688zhw0m0hxzaxyyzy7m54mtakntfrfme59adm33car0dv24pxuq09sgcg30tutgwf7nz4x7g53ct49udpkyvelryp0t4vlxtwusqskhjv3';

const WRAPPED_OVERCHARGE =
    'lnbc1000010n1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqpj9qypqsqedn5pc5y62pd3ah9c3fjplxjf8flkln2tms4neee9sc4na8w88g3mtnd563rmz84g7s6vzta87c368zrrunedy8m8exu5g02m7zv6sgpx4qvg9';

const WRAPPED_UNDER_INNER =
    'lnbc989990n1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqpj9qypqsqe40ncep33dvjhap5gamh2ar89fn09rcxyul7reex8yf7tqx5grk8akeksu64ww9dpz49839yclzjz05kr6e57mfaad4tuaqs54gx6lcqyl8d47';

const WRAPPED_BAD_HASH =
    'lnbc1m1pj48ugqpp5lllllllllllllllllllllllllllllllllllllllllllllllllllssp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqpj9qypqsqvp4xlq0j7vgk4jv6m4xx49a3zqffvx60lyv5nrgst2ll4g9pepa56hxm6sfmvdunvrhnu0gw6wytn8hp8r3yf7y6zkw2rzkw7ugedqcqr0jraj';

const WRAPPED_TESTNET =
    'lntb1m1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqpj9qypqsqcnr4xnjgqh9lq2shjstc78mv3cw3tu7upkmj37ly6cu4um4s7f0kzzmnnedk5au2wgt5c7pydjy6pr2eqhpj284j8lryjdrtentxnhgpgelv6l';

const QUOTED_FEE_SATS = 1000;

describe('verifyWrappedInvoice', () => {
    it('accepts a wrapped invoice for inner amount plus the quoted fee', () => {
        expect(
            verifyWrappedInvoice(INNER, WRAPPED_EXACT, QUOTED_FEE_SATS)
        ).toEqual({ valid: true });
    });

    it('accepts a wrapped invoice charging less than the quoted fee', () => {
        expect(
            verifyWrappedInvoice(INNER, WRAPPED_PARTIAL_FEE, QUOTED_FEE_SATS)
        ).toEqual({ valid: true });
    });

    it('accepts an identical invoice when no fee was quoted', () => {
        expect(verifyWrappedInvoice(INNER, INNER, 0)).toEqual({
            valid: true
        });
    });

    it('rejects a wrapped invoice charging more than the quoted fee', () => {
        expect(
            verifyWrappedInvoice(INNER, WRAPPED_OVERCHARGE, QUOTED_FEE_SATS)
        ).toEqual({ valid: false, error: 'amount_mismatch' });
    });

    it('rejects a wrapped invoice for less than the inner amount', () => {
        expect(
            verifyWrappedInvoice(INNER, WRAPPED_UNDER_INNER, QUOTED_FEE_SATS)
        ).toEqual({ valid: false, error: 'amount_mismatch' });
    });

    it('rejects a wrapped invoice with the fee on top when no fee was quoted', () => {
        expect(verifyWrappedInvoice(INNER, WRAPPED_EXACT, 0)).toEqual({
            valid: false,
            error: 'amount_mismatch'
        });
    });

    it('rejects a wrapped invoice with a different payment hash', () => {
        expect(
            verifyWrappedInvoice(INNER, WRAPPED_BAD_HASH, QUOTED_FEE_SATS)
        ).toEqual({ valid: false, error: 'payment_hash_mismatch' });
    });

    it('rejects a wrapped invoice on a different network', () => {
        expect(
            verifyWrappedInvoice(INNER, WRAPPED_TESTNET, QUOTED_FEE_SATS)
        ).toEqual({ valid: false, error: 'network_mismatch' });
    });

    it('rejects an undecodable wrapped invoice', () => {
        expect(
            verifyWrappedInvoice(INNER, 'lnbc1notaninvoice', QUOTED_FEE_SATS)
        ).toEqual({ valid: false, error: 'decode_failure' });
    });

    it('rejects an empty wrapped invoice', () => {
        expect(verifyWrappedInvoice(INNER, '', QUOTED_FEE_SATS)).toEqual({
            valid: false,
            error: 'decode_failure'
        });
    });
});
