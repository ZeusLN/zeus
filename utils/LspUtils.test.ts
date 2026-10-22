import {
    getLeaseDisplay,
    getRenewalInfo,
    verifyWrappedInvoice
} from './LspUtils';

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
});

describe('getLeaseDisplay', () => {
    const base = { fetchError: false, isLspChannel: true };

    it('shows the expiry without a button at the max lifetime', () => {
        expect(
            getLeaseDisplay({
                ...base,
                scid: '800000x1x0',
                maxExtensionInBlocks: 0,
                expirationBlock: 852560
            })
        ).toEqual({
            showFetchError: false,
            showLease: true,
            showExtendButton: false,
            hasLease: true
        });
    });

    it('shows the button when the lease can be extended', () => {
        expect(
            getLeaseDisplay({
                ...base,
                scid: '800000x1x0',
                maxExtensionInBlocks: 26280,
                expirationBlock: 852560
            })
        ).toEqual({
            showFetchError: false,
            showLease: true,
            showExtendButton: true,
            hasLease: true
        });
    });

    it('offers a lease purchase for a channel with no expiry', () => {
        expect(
            getLeaseDisplay({
                ...base,
                scid: '800000x1x0',
                maxExtensionInBlocks: 26280,
                expirationBlock: 0
            })
        ).toEqual({
            showFetchError: false,
            showLease: true,
            showExtendButton: true,
            hasLease: false
        });
    });

    it('treats a negative max extension as none', () => {
        expect(
            getLeaseDisplay({
                ...base,
                scid: '800000x1x0',
                maxExtensionInBlocks: -500,
                expirationBlock: 852560
            })
        ).toEqual({
            showFetchError: false,
            showLease: true,
            showExtendButton: false,
            hasLease: true
        });
    });

    it('warns for an LSP channel with no lease data when the fetch failed', () => {
        expect(getLeaseDisplay({ ...base, fetchError: true })).toEqual({
            showFetchError: true,
            showLease: false,
            showExtendButton: false,
            hasLease: false
        });
    });

    it('does not warn when the fetch succeeded', () => {
        expect(getLeaseDisplay(base).showFetchError).toBe(false);
    });

    it('does not warn for a channel with another peer', () => {
        expect(
            getLeaseDisplay({ fetchError: true, isLspChannel: false })
                .showFetchError
        ).toBe(false);
    });

    it('does not warn for a channel the LSP listed with no lease', () => {
        expect(
            getLeaseDisplay({
                ...base,
                fetchError: true,
                scid: '800000x1x0',
                maxExtensionInBlocks: 0,
                expirationBlock: 0
            })
        ).toEqual({
            showFetchError: false,
            showLease: false,
            showExtendButton: false,
            hasLease: false
        });
    });
});

describe('getRenewalInfo', () => {
    const entry = {
        short_channel_id: '800000x1x0',
        max_channel_extension_expiry_blocks: 26280,
        expiration_block: 852560
    };

    it('matches the short channel id and counts blocks to expiry', () => {
        expect(
            getRenewalInfo([entry], { shortChannelId: '800000x1x0' }, 850000)
        ).toEqual({
            scid: '800000x1x0',
            expiresInBlocks: 2560,
            maxExtensionInBlocks: 26280,
            expirationBlock: 852560
        });
    });

    it('matches the peer scid alias', () => {
        expect(
            getRenewalInfo(
                [entry],
                { shortChannelId: '1x2x3', peerScidAlias: '800000x1x0' },
                850000
            ).scid
        ).toBe('800000x1x0');
    });

    it('matches the confirmed scid of a zero-conf channel', () => {
        expect(
            getRenewalInfo(
                [entry],
                { zeroConfConfirmedScid: '800000x1x0' },
                850000
            ).scid
        ).toBe('800000x1x0');
    });

    it('leaves expiresInBlocks unset until the block height loads', () => {
        expect(
            getRenewalInfo([entry], { shortChannelId: '800000x1x0' }, 0)
        ).toEqual({
            scid: '800000x1x0',
            expiresInBlocks: undefined,
            maxExtensionInBlocks: 26280,
            expirationBlock: 852560
        });
    });

    it('counts an expired lease as negative', () => {
        expect(
            getRenewalInfo([entry], { shortChannelId: '800000x1x0' }, 853000)
                .expiresInBlocks
        ).toBe(-440);
    });

    it('has no expiry for a channel kept open at the LSP discretion', () => {
        expect(
            getRenewalInfo(
                [{ ...entry, expiration_block: 0 }],
                { shortChannelId: '800000x1x0' },
                850000
            )
        ).toEqual({
            scid: '800000x1x0',
            expiresInBlocks: undefined,
            maxExtensionInBlocks: 26280,
            expirationBlock: 0
        });
    });

    it('returns nothing for a channel the LSP did not list', () => {
        expect(
            getRenewalInfo([entry], { shortChannelId: '1x2x3' }, 850000)
        ).toEqual({});
        expect(
            getRenewalInfo(undefined, { shortChannelId: '1x2x3' }, 850000)
        ).toEqual({});
    });

    it('does not match an entry without an scid to a channel without an alias', () => {
        expect(
            getRenewalInfo(
                [{ ...entry, short_channel_id: undefined }],
                { shortChannelId: '1x2x3' },
                850000
            )
        ).toEqual({});
    });
});
