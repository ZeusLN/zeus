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

const WRAPPED_AMOUNTLESS =
    'lnbc1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqpj9qypqsqsvrmr2u4zak97jvzueml36t58qrsu36q4y6csslzt58sqndtghmhmwa9njvkynxas8ssqj9svk2wcmhewkexdyhtrdmrt0up9tmflfgqxjmhxa';

// inner amount plus 999 msat (99 000 999 msat)
const WRAPPED_SUBSAT_OVER =
    'lnbc990009990p1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqpj9qypqsqys2xwnhsftksuaatsjc03fpdfy0tychgpyec4yq96kkpllt6zgnpctjj45fkypt4cpt0zegnlezd8k8clgc9qyatzgnqa4nnly8va7sq4udhp9';

const WRAPPED_TESTNET =
    'lntb1m1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqpj9qypqsqcnr4xnjgqh9lq2shjstc78mv3cw3tu7upkmj37ly6cu4um4s7f0kzzmnnedk5au2wgt5c7pydjy6pr2eqhpj284j8lryjdrtentxnhgpgelv6l';

// Expiry and final CLTV variants, signed with another throwaway key.
// INNER and WRAPPED_EXACT both expire 86 400 s after the same timestamp
// and carry a min_final_cltv_expiry of 18.

// WRAPPED_EXACT expiring 3600 s after INNER (what Olympus sends)
const WRAPPED_EXPIRY_PLUS_HOUR =
    'lnbc1m1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyzhuscqpj9qypqsqvnuxannkaxcm5y73tcmvc3rtdwjdtvqph8pzaze6lvu8kqhrty6zzpzdru9nx8y4ce7da2feut8m0vwj8zudenm2au8rze634xwlhrqp7dwd9t';

// WRAPPED_EXACT expiring 3601 s after INNER
const WRAPPED_EXPIRY_OVER =
    'lnbc1m1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyzhu3cqpj9qypqsqma0lz3ug0mnnt05vw4lhfn3p4ls45mepyrh5dtp9d67ar8fu06sj8es8mp64zkl87qqejgqag00cc8e5e39x6uqaavdt9e46d83837gp7pj4mp';

// WRAPPED_EXACT with no x field (BOLT 11 default 3600 s)
const WRAPPED_NO_EXPIRY =
    'lnbc1m1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqcqpj9qypqsqf344lpqtuql3ur9xy7464umue5kdun3zmvyqsvu0r0qra6k3hachtwtga29wv7ktja3qugx5jsxnm8f04qygxqsxhplmkkxzkmr9ttcpzkt75k';

// WRAPPED_EXACT with final CLTV 58 (Olympus: inner + 40)
const WRAPPED_CLTV_58 =
    'lnbc1m1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqzp69qypqsqfdukfjdcwmr9wx87cehlv9wzvzz2f0770qshvajfylru2dqlvkgxufx2gez2wjk9l8nxu6dstehaycw3j920zc0hahwyqd8pdektlfsqhhzxe9';

// WRAPPED_EXACT with final CLTV 162 (inner + 144)
const WRAPPED_CLTV_162 =
    'lnbc1m1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqz9z9qypqsqkdwvmu6defej7qzdwe5a36fugkse3vq8r2zudhx5p9fgu6lem82j9jehymajmaxhgzsafaeq22qyzm300yzlpq0zgcwygakhkgcg78sppyheqt';

// WRAPPED_EXACT with final CLTV 163 (inner + 145)
const WRAPPED_CLTV_163 =
    'lnbc1m1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vqcqz9r9qypqsqu43r94hhjk8858uecs34g7x96yy5uyzx8fs67k20xu3lj00f4w2n7ay02ezkt80q353mhzfuaq5srkq4d0puj2czcxpjanlfhvacyagpfpexes';

// WRAPPED_EXACT with no c field (BOLT 11 default 18)
const WRAPPED_NO_CLTV =
    'lnbc1m1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqvwaexzursv4jqxqyz5vq9qypqsq2yslkkrv4t6h0mwdcc6wfu9kyk9z8d0qsv6dtv5eapga7jkpc5ap0csv40kckudlffer4ywyen6d0whu4qne9ugxxkg5cxt9lzwu82cqfz3mt9';

// INNER with no x field (BOLT 11 default 3600 s)
const INNER_NO_EXPIRY =
    'lnbc990u1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqgd9hxuetjcqpj9qypqsqy8gc29jeakfdt7t6x33pnnjk00zk0a6awkdg4udusapyxdsx0hh9vs4dclnu4urtcq7jeehnjx9vtgadv6d02nfyrwwn0mphjqaevdcqr8shv6';

// INNER with final CLTV 40
const INNER_CLTV_40 =
    'lnbc990u1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqgd9hxuetjxqyz5vqcqzpg9qypqsq87ed3euqfyx65ayn7gr588ecpc0rxx4jkzvx7d429kj22ezyhla82dljk9nvmy97rlctuhzgdgzxsy4m962gmuq0h6ns7tt0wm58vjsp7gjl67';

// INNER with no c field (BOLT 11 default 18)
const INNER_NO_CLTV =
    'lnbc990u1pj48ugqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsdqgd9hxuetjxqyz5vq9qypqsqkggyh08ate4q5ktjvyeq0vdsfr6tz6md5uj8yz0kyl3fe8z9ymu9s3z4ngvjfxflufx9mpretmmd6qfvadjn4phra5hrhpjx8eq5vqcpqg8saw';

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

    it('allows sub-sat rounding on top of a quoted fee', () => {
        expect(verifyWrappedInvoice(INNER, WRAPPED_SUBSAT_OVER, 1)).toEqual({
            valid: true
        });
    });

    it('rejects any overage when no fee was quoted', () => {
        expect(verifyWrappedInvoice(INNER, WRAPPED_SUBSAT_OVER, 0)).toEqual({
            valid: false,
            error: 'amount_mismatch'
        });
    });

    it('rejects an amountless wrapped invoice', () => {
        expect(
            verifyWrappedInvoice(INNER, WRAPPED_AMOUNTLESS, QUOTED_FEE_SATS)
        ).toEqual({ valid: false, error: 'amount_missing' });
    });

    it('rejects an amountless inner invoice', () => {
        expect(
            verifyWrappedInvoice(
                WRAPPED_AMOUNTLESS,
                WRAPPED_EXACT,
                QUOTED_FEE_SATS
            )
        ).toEqual({ valid: false, error: 'amount_missing' });
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

    describe('expiry', () => {
        it('accepts a wrap expiring one hour after the inner invoice', () => {
            expect(
                verifyWrappedInvoice(
                    INNER,
                    WRAPPED_EXPIRY_PLUS_HOUR,
                    QUOTED_FEE_SATS
                )
            ).toEqual({ valid: true });
        });

        it('rejects a wrap expiring more than one hour after the inner invoice', () => {
            expect(
                verifyWrappedInvoice(
                    INNER,
                    WRAPPED_EXPIRY_OVER,
                    QUOTED_FEE_SATS
                )
            ).toEqual({ valid: false, error: 'expiry_mismatch' });
        });

        it('accepts a wrap with no expiry field that expires first', () => {
            expect(
                verifyWrappedInvoice(INNER, WRAPPED_NO_EXPIRY, QUOTED_FEE_SATS)
            ).toEqual({ valid: true });
        });

        it('applies the default expiry to an inner invoice without one', () => {
            expect(
                verifyWrappedInvoice(
                    INNER_NO_EXPIRY,
                    WRAPPED_EXACT,
                    QUOTED_FEE_SATS
                )
            ).toEqual({ valid: false, error: 'expiry_mismatch' });
        });
    });

    describe('final CLTV', () => {
        it('accepts the inner CLTV plus 40 blocks', () => {
            expect(
                verifyWrappedInvoice(INNER, WRAPPED_CLTV_58, QUOTED_FEE_SATS)
            ).toEqual({ valid: true });
        });

        it('accepts the inner CLTV plus 144 blocks', () => {
            expect(
                verifyWrappedInvoice(INNER, WRAPPED_CLTV_162, QUOTED_FEE_SATS)
            ).toEqual({ valid: true });
        });

        it('rejects more than 144 blocks above the inner CLTV', () => {
            expect(
                verifyWrappedInvoice(INNER, WRAPPED_CLTV_163, QUOTED_FEE_SATS)
            ).toEqual({ valid: false, error: 'cltv_mismatch' });
        });

        it('rejects a CLTV below the inner CLTV', () => {
            expect(
                verifyWrappedInvoice(
                    INNER_CLTV_40,
                    WRAPPED_EXACT,
                    QUOTED_FEE_SATS
                )
            ).toEqual({ valid: false, error: 'cltv_mismatch' });
        });

        it('accepts a wrap above an inner CLTV of 40', () => {
            expect(
                verifyWrappedInvoice(
                    INNER_CLTV_40,
                    WRAPPED_CLTV_58,
                    QUOTED_FEE_SATS
                )
            ).toEqual({ valid: true });
        });

        it('applies the default CLTV to a wrap without a c field', () => {
            expect(
                verifyWrappedInvoice(INNER, WRAPPED_NO_CLTV, QUOTED_FEE_SATS)
            ).toEqual({ valid: true });
            expect(
                verifyWrappedInvoice(
                    INNER_CLTV_40,
                    WRAPPED_NO_CLTV,
                    QUOTED_FEE_SATS
                )
            ).toEqual({ valid: false, error: 'cltv_mismatch' });
        });

        it('applies the default CLTV to an inner invoice without a c field', () => {
            expect(
                verifyWrappedInvoice(
                    INNER_NO_CLTV,
                    WRAPPED_CLTV_162,
                    QUOTED_FEE_SATS
                )
            ).toEqual({ valid: true });
            expect(
                verifyWrappedInvoice(
                    INNER_NO_CLTV,
                    WRAPPED_CLTV_163,
                    QUOTED_FEE_SATS
                )
            ).toEqual({ valid: false, error: 'cltv_mismatch' });
        });
    });
});
