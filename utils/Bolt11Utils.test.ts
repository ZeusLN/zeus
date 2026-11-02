import * as secp from '@noble/secp256k1';
import { bech32 } from 'bech32';

import Bolt11Utils from './Bolt11Utils';

const REGTEST_FIXTURE =
    'lnbcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';

const SIGNET_FIXTURE =
    'lntbs567780n1pnqr26ypp5c0wcrpzwxwqnwu2nld5q36dfc9yjrfdp87nn9d5y093jjncvqresdq0w3jhxar8v3n8xeccqzpuxqrrsssp5r94e3nwnw63gjaxc8wex38ufv2m6442vnrw49m7dad9jdum3tdsq9qyyssqk4dvvuk7zhhju8ztf7nfc2hzqq9gqtzuyc0ljz8nl93laxwv4869lt9fsxkxacje6eh4ur5ymg83hvakn4tfpzdu6fq49705sar7fxspga8qjp';

// BOLT11 spec reference vector (lnbc2500u with hashed description)
// https://github.com/lightning/bolts/blob/master/11-payment-encoding.md#examples
const BOLT11_SPEC_FIXTURE =
    'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr';
const BOLT11_SPEC_PAYEE =
    '03e7156ae33b0a208d0744199163177e909e80176e55d97a2f221ede0f934dd9ad';

// BOLT11 spec reference vector with no amount
// https://github.com/lightning/bolts/blob/master/11-payment-encoding.md#examples
const NO_AMOUNT_FIXTURE =
    'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap2r09nt4ndd0unm3z9u5t48y6ucv4r5sg7lk98c77ctvjczkspk5qprc90gx';

describe('decode', () => {
    it('correctly decodes a valid payment request', () => {
        const decoded = Bolt11Utils.decode(REGTEST_FIXTURE);

        expect(decoded.expiry).toBe(3600);
        expect(decoded.timestamp).toBe(1700074718);
        expect(decoded.paymentRequest).toBe(REGTEST_FIXTURE);
    });

    it('correctly decodes a signet payment request', () => {
        const decoded = Bolt11Utils.decode(SIGNET_FIXTURE);

        expect(decoded.expiry).toBeDefined();
        expect(decoded.timestamp).toBeDefined();
        expect(decoded.paymentRequest).toBe(SIGNET_FIXTURE);
    });

    it('throws an error if an invalid payment request is given', () => {
        const paymentRequest =
            'bcrt1230n1pj429x7pp57t97q4awqj3f529snr0pa6senk83sq5pp760qf5a4jzvd7xgwcksdqqcqzzsxqrrsssp57eqtv7vxr46arupna3w4ct0lkf2mqmz9wt044cwkks0rwlnhfr5s9qyyssqragwpwav7nfwv2xyuuamxxj4pnnpzv2hlw7j473repd3sq7st698ta9kmzmygt0w7tmncl56a6mnma0w7e5dlpqd0wy6x3v35rssldspjhh8p0';

        const action = () => Bolt11Utils.decode(paymentRequest);

        expect(action).toThrowError('Not a proper lightning payment request');
    });

    it('rejects a payment request longer than 7089 characters up front', () => {
        // timestamp + empty tagged fields (3 words each) + 104-word signature;
        // every field forces another pass over the remaining words, so an
        // uncapped decode of this shape is quadratic in the invoice length.
        const build = (length: number) =>
            bech32.encode(
                'lnbc10u',
                new Array(length - 'lnbc10u1'.length - 6).fill(0),
                length
            );

        expect(build(7089)).toHaveLength(7089);
        expect(Bolt11Utils.decode(build(7089)).num_satoshis).toBe('1000');
        expect(() => Bolt11Utils.decode(build(7090))).toThrowError(
            'Exceeds length limit'
        );
    });

    it('parses the amount from a nano-BTC prefix (1230n = 123 sat)', () => {
        const decoded = Bolt11Utils.decode(REGTEST_FIXTURE);

        expect(decoded.satoshis).toBe(123);
        expect(decoded.millisatoshis).toBe('123000');
        expect(decoded.num_satoshis).toBe('123');
        expect(decoded.num_msat).toBe('123000');
    });

    it('parses the amount from a signet nano-BTC prefix (567780n = 56778 sat)', () => {
        const decoded = Bolt11Utils.decode(SIGNET_FIXTURE);

        expect(decoded.satoshis).toBe(56778);
        expect(decoded.millisatoshis).toBe('56778000');
        expect(decoded.num_satoshis).toBe('56778');
        expect(decoded.num_msat).toBe('56778000');
    });

    it('exposes the matched network object with a bech32 prefix', () => {
        expect(Bolt11Utils.decode(REGTEST_FIXTURE).network.bech32).toBe('bcrt');
        expect(Bolt11Utils.decode(SIGNET_FIXTURE).network.bech32).toBe('tbs');
    });

    it('exposes payment_hash and payment_secret as top-level hex fields', () => {
        const decoded = Bolt11Utils.decode(REGTEST_FIXTURE);

        expect(decoded.payment_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(decoded.payment_secret).toMatch(/^[0-9a-f]{64}$/);
    });

    it('derives timeExpireDate from timestamp + expiry', () => {
        const decoded = Bolt11Utils.decode(REGTEST_FIXTURE);

        expect(decoded.expiry).toBe(3600);
        expect(decoded.timeExpireDate).toBe(decoded.timestamp + 3600);
    });

    it('applies the BOLT 11 default expiry of 3600 s when the invoice has no expiry field', () => {
        const decoded = Bolt11Utils.decode(NO_AMOUNT_FIXTURE);

        expect(decoded.sections.map((s) => s.name)).not.toContain('expiry');
        expect(decoded.expiry).toBe(3600);
        expect(decoded.timeExpireDate).toBe(decoded.timestamp + 3600);
    });

    it('keeps an explicit expiry field', () => {
        const decoded = Bolt11Utils.decode(BOLT11_SPEC_FIXTURE);

        expect(decoded.expiry).toBe(60);
        expect(decoded.timeExpireDate).toBe(decoded.timestamp + 60);
    });

    it('recovers destination as a 33-byte compressed pubkey via signature recovery', () => {
        const decoded = Bolt11Utils.decode(REGTEST_FIXTURE);

        // 02/03 prefix + 32 bytes = 66 hex chars (compressed secp256k1 pubkey)
        expect(decoded.destination).toMatch(/^0[23][0-9a-f]{64}$/);
        expect(decoded.payeeNodeKey).toBe(decoded.destination);
    });

    it('recovers the exact payee pubkey from the BOLT11 spec reference vector', () => {
        const decoded = Bolt11Utils.decode(BOLT11_SPEC_FIXTURE);

        expect(decoded.destination).toBe(BOLT11_SPEC_PAYEE);
        expect(decoded.payeeNodeKey).toBe(BOLT11_SPEC_PAYEE);
    });

    it('returns null amount fields for a no-amount invoice', () => {
        const decoded = Bolt11Utils.decode(NO_AMOUNT_FIXTURE);

        expect(decoded.satoshis).toBeNull();
        expect(decoded.millisatoshis).toBeNull();
        expect(decoded.num_satoshis).toBe('0');
        expect(decoded.num_msat).toBe('0');
    });

    it('still decodes payment_hash and timestamp for a no-amount invoice', () => {
        const decoded = Bolt11Utils.decode(NO_AMOUNT_FIXTURE);

        expect(decoded.payment_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(decoded.timestamp).toBeGreaterThan(0);
    });

    it('preserves the legacy sections array for back-compat', () => {
        const decoded = Bolt11Utils.decode(REGTEST_FIXTURE);

        const sectionNames = decoded.sections.map((s) => s.name);
        expect(sectionNames).toContain('lightning_network');
        expect(sectionNames).toContain('coin_network');
        expect(sectionNames).toContain('separator');
        expect(sectionNames).toContain('timestamp');
        expect(sectionNames).toContain('payment_hash');
        expect(sectionNames).toContain('expiry');
    });

    it('returns the same object on repeat decodes (LRU cache hit)', () => {
        const first = Bolt11Utils.decode(REGTEST_FIXTURE);
        const second = Bolt11Utils.decode(REGTEST_FIXTURE);

        expect(second).toBe(first);
    });

    it('treats casing as equivalent for cache lookups', () => {
        const lower = Bolt11Utils.decode(REGTEST_FIXTURE);
        const upper = Bolt11Utils.decode(REGTEST_FIXTURE.toUpperCase());

        expect(upper).toBe(lower);
    });
});

// Invalid-invoice vectors from the BOLT11 spec. All of them MUST be rejected
// by a reader.
// https://github.com/lightning/bolts/blob/master/11-payment-encoding.md#examples-of-invalid-invoices
const SPEC_INVALID = {
    badChecksum:
        'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpuyk0sg5g70me25alkluzd2x62aysf2pyy8edtjeevuv4p2d5p76r4zkmneet7uvyakky2zr4cusd45tftc9c5fh0nnqpnl2jfll544esqchsrnt',
    noSeparator:
        'pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpuyk0sg5g70me25alkluzd2x62aysf2pyy8edtjeevuv4p2d5p76r4zkmneet7uvyakky2zr4cusd45tftc9c5fh0nnqpnl2jfll544esqchsrny',
    mixedCase:
        'LNBC2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpuyk0sg5g70me25alkluzd2x62aysf2pyy8edtjeevuv4p2d5p76r4zkmneet7uvyakky2zr4cusd45tftc9c5fh0nnqpnl2jfll544esqchsrny',
    unrecoverableSignature:
        'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpusp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9qrsgqwgt7mcn5yqw3yx0w94pswkpq6j9uh6xfqqqtsk4tnarugeektd4hg5975x9am52rz4qskukxdmjemg92vvqz8nvmsye63r5ykel43pgz7zq0g2',
    tooShort:
        'lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6na6hlh',
    invalidMultiplier:
        'lnbc2500x1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpusp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9qrsgqrrzc4cvfue4zp3hggxp47ag7xnrlr8vgcmkjxk3j5jqethnumgkpqp23z9jclu3v0a7e0aruz366e9wqdykw6dxhdzcjjhldxq0w6wgqcnu43j',
    subMillisatoshi:
        'lnbc2500000001p1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpusp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9qrsgq0lzc236j96a95uv0m3umg28gclm5lqxtqqwk32uuk4k6673k6n5kfvx3d2h8s295fad45fdhmusm8sjudfhlf6dcsxmfvkeywmjdkxcp99202x',
    missingPaymentSecret:
        'lnbc20m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqhp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqs9qrsgq7ea976txfraylvgzuxs8kgcw23ezlrszfnh8r6qtfpr6cxga50aj6txm9rxrydzd06dfeawfk6swupvz4erwnyutnjq7x39ymw6j38gp49qdkj',
    highSWithPayee:
        'lnbc25m1p70xwfzpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaqnp4q0n326hr8v9zprg8gsvezcch06gfaqqhde2aj730yg0durunfhv66sp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9qrsgqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsp5cfzp9ugllvk03rltd6hvndxj26ux6gcxc5azyxk060rj9tzghct5zvjlps76gx8wpq5yuu79688k8gnm2c0al6v608s96l0xzrrlqqwnzxmu',
    unknownRequiredFeature:
        'lnbc25m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q4psqqqqqqqqqqqqqqqqsgqtqyx5vggfcsll4wu246hz02kp85x4katwsk9639we5n5yngc3yhqkm35jnjw4len8vrnqnf5ejh0mzj9n3vz2px97evektfm2l6wqccp3y7372'
};

// A 52-word `p` field holding an all-zero payment hash. decode() rejects an
// invoice without a well-formed payment hash.
const ZERO_PAYMENT_HASH_TAG = [1, 1, 20, ...new Array(52).fill(0)];

// A bech32 string with the given human-readable part, a zero timestamp, a
// zero payment hash and a zeroed signature. Enough to reach the prefix and
// amount checks.
const withPrefix = (hrp: string) =>
    bech32.encode(
        hrp,
        [
            ...new Array(7).fill(0),
            ...ZERO_PAYMENT_HASH_TAG,
            ...new Array(104).fill(0)
        ],
        Infinity
    );

describe('decode input validation', () => {
    beforeEach(() => {
        (Bolt11Utils as any).cache.clear();
    });

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['a number', 2500],
        ['an object', { paymentRequest: REGTEST_FIXTURE }]
    ])('rejects %s as not a string', (_label, input) => {
        expect(() => Bolt11Utils.decode(input as any)).toThrow(
            'Lightning Payment Request must be string'
        );
    });

    it('rejects the spec vector with no "ln" prefix or separator', () => {
        expect(() => Bolt11Utils.decode(SPEC_INVALID.noSeparator)).toThrow(
            'Not a proper lightning payment request'
        );
    });

    it('rejects a bare "ln" prefix with no network', () => {
        expect(() => Bolt11Utils.decode(withPrefix('ln'))).toThrow(
            'Not a proper lightning payment request'
        );
    });

    it.each([
        ['an unknown network', 'lnltc20m'],
        ['an unknown network without an amount', 'lnxyz'],
        ['a network with a trailing letter and no digits', 'lnbcm']
    ])('rejects %s (%s)', (_label, hrp) => {
        expect(() => Bolt11Utils.decode(withPrefix(hrp))).toThrow(
            'Unknown coin bech32 prefix'
        );
    });

    it.each([
        ['lntb20m', 'tb', '2000000'],
        ['lnsb', 'sb', '0'],
        ['lntbs10u', 'tbs', '1000']
    ])('accepts the %s prefix', (hrp, network, numSatoshis) => {
        const decoded = Bolt11Utils.decode(withPrefix(hrp));

        expect(decoded.network.bech32).toBe(network);
        expect(decoded.num_satoshis).toBe(numSatoshis);
    });

    it('rejects the spec vector with a bad bech32 checksum', () => {
        expect(() => Bolt11Utils.decode(SPEC_INVALID.badChecksum)).toThrow(
            /^Invalid checksum/
        );
    });

    it('rejects the spec vector with mixed case', () => {
        expect(() => Bolt11Utils.decode(SPEC_INVALID.mixedCase)).toThrow(
            /^Mixed-case string/
        );
    });

    // Characterising, not endorsing. The cache is keyed on the lowercased
    // input and checked before bech32 validation, so a mixed-case string
    // returns the cached result of its lowercase form instead of throwing.
    it('currently returns a cached result for a mixed-case string', () => {
        const lower = Bolt11Utils.decode(SPEC_INVALID.mixedCase.toLowerCase());

        expect(Bolt11Utils.decode(SPEC_INVALID.mixedCase)).toBe(lower);
    });

    // Characterising, not endorsing. decode() catches amount parsing errors
    // and nulls the amount, so these spec vectors decode as if they carried
    // no amount. The node still rejects them when paying.
    it.each([
        ['an invalid multiplier', SPEC_INVALID.invalidMultiplier],
        ['sub-millisatoshi precision', SPEC_INVALID.subMillisatoshi]
    ])('currently decodes %s as a no-amount invoice', (_label, invoice) => {
        const decoded = Bolt11Utils.decode(invoice);

        expect(decoded.satoshis).toBeNull();
        expect(decoded.millisatoshis).toBeNull();
        expect(decoded.num_satoshis).toBe('0');
        expect(decoded.num_msat).toBe('0');
        expect(decoded.payment_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    // Characterising, not endorsing. Recovery is lazy and swallows its own
    // errors, so an unrecoverable signature leaves the payee unset instead
    // of failing the decode.
    it('currently decodes an unrecoverable signature with no destination', () => {
        const decoded = Bolt11Utils.decode(SPEC_INVALID.unrecoverableSignature);

        expect(decoded.satoshis).toBe(250000);
        expect(decoded.destination).toBeUndefined();
        expect(decoded.payeeNodeKey).toBeUndefined();
        expect(decoded.signature).toBeUndefined();
        expect(decoded.recoveryFlag).toBeUndefined();
    });

    // decode() never checks the length, so a string too short to hold a
    // signature parses no tags. It is rejected only because no payment hash
    // is found.
    it('rejects a string too short to hold a signature', () => {
        expect(() => Bolt11Utils.decode(SPEC_INVALID.tooShort)).toThrow(
            'No valid payment hash found'
        );
    });

    // Characterising, not endorsing. decode() does not require the `s`
    // field and does not read feature bits; the node enforces both.
    it.each([
        ['a missing payment secret', SPEC_INVALID.missingPaymentSecret],
        ['an unknown required feature', SPEC_INVALID.unknownRequiredFeature]
    ])('currently decodes %s', (_label, invoice) => {
        const decoded = Bolt11Utils.decode(invoice);

        expect(decoded.payment_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(decoded.destination).toMatch(/^0[23][0-9a-f]{64}$/);
    });

    // 15010p is 1501 msat. hrpToSat rejects it, so satoshis is null and
    // num_satoshis is the msat amount rounded down.
    it('rounds a sub-satoshi amount down in num_satoshis', () => {
        const decoded = Bolt11Utils.decode(withPrefix('lnbcrt15010p'));

        expect(decoded.satoshis).toBeNull();
        expect(decoded.millisatoshis).toBe('1501');
        expect(decoded.num_satoshis).toBe('1');
        expect(decoded.num_msat).toBe('1501');
    });
});

// An invoice with a zero timestamp, the given raw tag data and a zeroed
// signature. Recovery is lazy, so decode() never checks the signature.
// Adds a valid payment hash unless the tag under test is the payment hash.
const withTag = (tagCode: number, data: number[]) =>
    bech32.encode(
        'lnbcrt',
        [
            ...new Array(7).fill(0),
            ...(tagCode === 1 ? [] : ZERO_PAYMENT_HASH_TAG),
            tagCode,
            0,
            data.length,
            ...data,
            ...new Array(104).fill(0)
        ],
        Infinity
    );

describe('decode cache', () => {
    const cache: Map<string, unknown> = (Bolt11Utils as any).cache;
    const limit: number = (Bolt11Utils as any).CACHE_LIMIT;
    // Distinct lowercase invoices that differ only by amount.
    const invoice = (i: number) => withPrefix(`lnbcrt${i + 1}u`);

    beforeEach(() => {
        cache.clear();
    });

    it('evicts the oldest entry once the cache is full', () => {
        for (let i = 0; i < limit; i++) Bolt11Utils.decode(invoice(i));
        expect(cache.size).toBe(limit);

        Bolt11Utils.decode(invoice(limit));

        expect(cache.size).toBe(limit);
        expect(cache.has(invoice(0))).toBe(false);
        expect(cache.has(invoice(1))).toBe(true);
        expect(cache.has(invoice(limit))).toBe(true);
    });

    it('moves a cache hit to the most recently used position', () => {
        for (let i = 0; i < limit; i++) Bolt11Utils.decode(invoice(i));
        Bolt11Utils.decode(invoice(0));

        Bolt11Utils.decode(invoice(limit));

        expect(cache.has(invoice(0))).toBe(true);
        expect(cache.has(invoice(1))).toBe(false);
    });
});

describe('decode tag fields', () => {
    // BOLT11 spec vector: 0.01 BTC with payment metadata 0x01fafaf0
    it('reads the metadata field', () => {
        const decoded = Bolt11Utils.decode(
            'lnbc10m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdp9wpshjmt9de6zqmt9w3skgct5vysxjmnnd9jx2mq8q8a04uqsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q2gqqqqqqsgq7hf8he7ecf7n4ffphs6awl9t6676rrclv9ckg3d3ncn7fct63p6s365duk5wrk202cfy3aj5xnnp5gs3vrdvruverwwq7yzhkf5a3xqpd05wjc'
        );

        expect(decoded.metadata).toBe('01fafaf0');
        expect(decoded.description).toBe('payment metadata inside');
    });

    // Characterising, not endorsing. The spec requires a reader to fail when
    // an invoice with an `n` field carries a high-S signature. decode() takes
    // the payee from `n` without checking the signature.
    it('currently takes the payee from the n field despite a high-S signature', () => {
        const decoded = Bolt11Utils.decode(SPEC_INVALID.highSWithPayee);
        const descriptor = Object.getOwnPropertyDescriptor(
            decoded,
            'destination'
        );

        expect(descriptor?.value).toBe(BOLT11_SPEC_PAYEE);
        expect(descriptor?.get).toBeUndefined();
        expect(decoded.payeeNodeKey).toBe(BOLT11_SPEC_PAYEE);
    });
    // A single 5-bit word cannot hold a byte (excess padding), and two words
    // leave 2 bits that must be zero (non-zero padding). bech32 rejects both.
    // A payment hash like that leaves the invoice without one, so decode()
    // throws; other fields decode as undefined.
    it.each([[[0]], [[31, 31]]])(
        'rejects an invoice whose only payment_hash has invalid padding (%#)',
        (data) => {
            expect(() => Bolt11Utils.decode(withTag(1, data))).toThrow(
                'No valid payment hash found'
            );
        }
    );

    it.each([
        ['description', 13, [0]],
        ['description', 13, [31, 31]]
    ])(
        'leaves %s undefined when its data has invalid padding (%#)',
        (field, tagCode, data) => {
            const decoded: any = Bolt11Utils.decode(
                withTag(tagCode as number, data as number[])
            );

            expect(decoded[field as string]).toBeUndefined();
            expect(decoded.sections).toContainEqual(
                expect.objectContaining({ name: field, value: undefined })
            );
        }
    );
});

describe('amount parsing', () => {
    const hrpToMillisat = (hrp: string) =>
        (Bolt11Utils as any).hrpToMillisat(hrp);
    const hrpToSat = (hrp: string) => (Bolt11Utils as any).hrpToSat(hrp);

    it.each([
        ['2500u', '250000000'],
        ['20m', '2000000000'],
        ['10p', '1'],
        ['21000000', '2100000000000000000']
    ])('converts %s to %s msat', (hrp, msat) => {
        expect(hrpToMillisat(hrp)).toBe(msat);
    });

    it.each(['2500x', '1a', '25B'])(
        'rejects %s as an invalid multiplier',
        (hrp) => {
            expect(() => hrpToMillisat(hrp)).toThrow(
                'Not a valid multiplier for the amount'
            );
        }
    );

    it.each(['m', '12a3m', '-1u', '2.5m'])(
        'rejects %s as an invalid amount',
        (hrp) => {
            expect(() => hrpToMillisat(hrp)).toThrow(
                'Not a valid human readable amount'
            );
        }
    );

    it.each([
        ['a pico amount not ending in 0', '1p'],
        ['an amount above 21M BTC', '21000001'],
        ['a milli amount above 21M BTC', '21000000001m']
    ])('rejects %s (%s) as out of range', (_label, hrp) => {
        expect(() => hrpToMillisat(hrp)).toThrow(
            'Amount is outside of valid range'
        );
    });

    it('rejects a whole-satoshi conversion of a sub-satoshi amount', () => {
        expect(hrpToMillisat('10p')).toBe('1');
        expect(() => hrpToSat('10p')).toThrow(
            'Amount is outside of valid range'
        );
    });

    it('converts a whole-satoshi amount to satoshis', () => {
        expect(hrpToSat('2500u')).toBe(250000);
        expect(hrpToSat('10000p')).toBe(1);
    });
});

describe('lazy signature recovery', () => {
    beforeEach(() => {
        // Reset the LRU cache so each test sees a fresh, un-materialized result.
        (Bolt11Utils as any).cache.clear();
    });

    it('installs a lazy getter for destination on a fresh decode', () => {
        const decoded = Bolt11Utils.decode(REGTEST_FIXTURE);
        const descriptor = Object.getOwnPropertyDescriptor(
            decoded,
            'destination'
        );

        expect(descriptor?.get).toBeDefined();
        expect(descriptor?.value).toBeUndefined();
    });

    it('replaces the getter with a plain value after first access', () => {
        const decoded = Bolt11Utils.decode(REGTEST_FIXTURE);
        void decoded.destination;
        const descriptor = Object.getOwnPropertyDescriptor(
            decoded,
            'destination'
        );

        expect(descriptor?.get).toBeUndefined();
        expect(typeof descriptor?.value).toBe('string');
    });

    it('does not run secp256k1 recovery when only non-destination fields are read', () => {
        const spy = jest.spyOn(secp, 'recoverPublicKey');
        try {
            const decoded = Bolt11Utils.decode(REGTEST_FIXTURE);
            void decoded.timestamp;
            void decoded.expiry;
            void decoded.description;
            void decoded.payment_hash;
            void decoded.payment_secret;
            void decoded.satoshis;
            void decoded.network;

            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });

    it('runs secp256k1 recovery exactly once when destination is read multiple times', () => {
        const spy = jest.spyOn(secp, 'recoverPublicKey');
        try {
            const decoded = Bolt11Utils.decode(REGTEST_FIXTURE);
            const first = decoded.destination;
            const second = decoded.destination;
            const third = decoded.payeeNodeKey;

            expect(spy).toHaveBeenCalledTimes(1);
            expect(first).toBe(second);
            expect(third).toBe(first);
        } finally {
            spy.mockRestore();
        }
    });

    it('preserves tag-populated fields and only installs getters for the missing ones', () => {
        // Simulates an invoice where the tag loop already populated destination
        // and payeeNodeKey from an explicit payee tag. The lazy installer must
        // leave those values alone and only expose signature / recoveryFlag as
        // getters so the public DecodedBolt11 contract still holds.
        const result: any = {
            destination: 'PRE_POPULATED_DESTINATION',
            payeeNodeKey: 'PRE_POPULATED_DESTINATION'
        };

        (Bolt11Utils as any).defineLazyRecoveryFields(result, 'lnbc', [], []);

        const destDescriptor = Object.getOwnPropertyDescriptor(
            result,
            'destination'
        );
        const payeeDescriptor = Object.getOwnPropertyDescriptor(
            result,
            'payeeNodeKey'
        );
        const sigDescriptor = Object.getOwnPropertyDescriptor(
            result,
            'signature'
        );
        const recoveryFlagDescriptor = Object.getOwnPropertyDescriptor(
            result,
            'recoveryFlag'
        );

        expect(destDescriptor?.value).toBe('PRE_POPULATED_DESTINATION');
        expect(destDescriptor?.get).toBeUndefined();
        expect(payeeDescriptor?.value).toBe('PRE_POPULATED_DESTINATION');
        expect(payeeDescriptor?.get).toBeUndefined();
        expect(sigDescriptor?.get).toBeDefined();
        expect(recoveryFlagDescriptor?.get).toBeDefined();
    });
});

describe('duplicate singleton tags', () => {
    // Attack shape from the `invoices` npm package bug (fixed there in
    // 6.0.0, 2026-08-07): an invoice that repeats a singleton tag makes a
    // last-wins reader track a different payment than the node.
    const HASH_A = 'aa'.repeat(32);
    const HASH_B = 'bb'.repeat(32);
    const PAYEE_A = '02' + 'ab'.repeat(32);
    const PAYEE_B = '03' + 'cd'.repeat(32);

    const hexToWords = (hex: string): number[] =>
        bech32.toWords(
            Uint8Array.from(
                hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
            )
        );

    const utf8ToWords = (text: string): number[] =>
        bech32.toWords(Uint8Array.from(text, (char) => char.charCodeAt(0)));

    const tag = (code: number, words: number[]): number[] => [
        code,
        words.length >> 5,
        words.length & 31,
        ...words
    ];

    // Timestamp of 1 (7 words) + tags + a zeroed 104-word signature block.
    // The signature cannot recover, but recovery is lazy, so tests that
    // never read destination/signature exercise only the tag loop.
    const buildInvoice = (tags: number[][]): string => {
        const words: number[] = [0, 0, 0, 0, 0, 0, 1];
        for (const tagWords of tags) words.push(...tagWords);
        words.push(...new Array(104).fill(0));
        return bech32.encode('lnbcrt', words, Number.MAX_SAFE_INTEGER);
    };

    // lightning/bolts#1357 and lnd's zpay32 (lnd#11190) reject any invoice
    // with more than one `p` field, whatever the lengths or values.
    it('throws when the payment_hash tag is duplicated', () => {
        const action = () =>
            Bolt11Utils.decode(
                buildInvoice([
                    tag(1, hexToWords(HASH_A)),
                    tag(1, hexToWords(HASH_B))
                ])
            );

        expect(action).toThrowError('Invoice contains multiple payment hashes');
    });

    it('throws when the same payment_hash appears twice', () => {
        const action = () =>
            Bolt11Utils.decode(
                buildInvoice([
                    tag(1, hexToWords(HASH_A)),
                    tag(1, hexToWords(HASH_A))
                ])
            );

        expect(action).toThrowError('Invoice contains multiple payment hashes');
    });

    it('throws on a wrong-length payment_hash followed by a valid one', () => {
        // 20 bytes = 32 words. Older lnd skipped it and settled on the
        // second; the duplicate rule counts it by presence.
        const action = () =>
            Bolt11Utils.decode(
                buildInvoice([
                    tag(1, hexToWords('cc'.repeat(20))),
                    tag(1, hexToWords(HASH_B))
                ])
            );

        expect(action).toThrowError('Invoice contains multiple payment hashes');
    });

    it('throws on a valid payment_hash followed by a wrong-length one', () => {
        const action = () =>
            Bolt11Utils.decode(
                buildInvoice([
                    tag(1, hexToWords(HASH_A)),
                    tag(1, hexToWords('cc'.repeat(20)))
                ])
            );

        expect(action).toThrowError('Invoice contains multiple payment hashes');
    });

    it('keeps the first payment_secret when the tag is duplicated', () => {
        const decoded = Bolt11Utils.decode(
            buildInvoice([
                tag(1, hexToWords(HASH_A)),
                tag(16, hexToWords(HASH_A)),
                tag(16, hexToWords(HASH_B))
            ])
        );

        expect(decoded.payment_secret).toBe(HASH_A);
    });

    it('keeps the first description_hash when the tag is duplicated', () => {
        const decoded = Bolt11Utils.decode(
            buildInvoice([
                tag(1, hexToWords(HASH_A)),
                tag(23, hexToWords(HASH_A)),
                tag(23, hexToWords(HASH_B))
            ])
        );

        expect(decoded.description_hash).toBe(HASH_A);
    });

    it('keeps the first description when the tag is duplicated', () => {
        const decoded = Bolt11Utils.decode(
            buildInvoice([
                tag(1, hexToWords(HASH_A)),
                tag(13, utf8ToWords('first memo')),
                tag(13, utf8ToWords('second memo'))
            ])
        );

        expect(decoded.description).toBe('first memo');
    });

    it('keeps the first expiry and derives timeExpireDate from it', () => {
        // 3600 encoded big-endian in 5-bit words: 3*32^2 + 16*32 + 16
        const decoded = Bolt11Utils.decode(
            buildInvoice([
                tag(1, hexToWords(HASH_A)),
                tag(6, [3, 16, 16]),
                tag(6, [1])
            ])
        );

        expect(decoded.expiry).toBe(3600);
        expect(decoded.timeExpireDate).toBe(decoded.timestamp + 3600);
    });

    it('keeps the first valid payee tag for destination', () => {
        const decoded = Bolt11Utils.decode(
            buildInvoice([
                tag(1, hexToWords(HASH_A)),
                tag(19, hexToWords(PAYEE_A)),
                tag(19, hexToWords(PAYEE_B))
            ])
        );

        expect(decoded.destination).toBe(PAYEE_A);
        expect(decoded.payeeNodeKey).toBe(PAYEE_A);
    });

    // zpay32 skips fixed-size fields with the wrong word length, so a short
    // first occurrence must not block a valid second one.
    it('skips a wrong-length payee tag and keeps the next valid one', () => {
        const decoded = Bolt11Utils.decode(
            buildInvoice([
                tag(1, hexToWords(HASH_A)),
                tag(19, hexToWords('cc'.repeat(20))),
                tag(19, hexToWords(PAYEE_B))
            ])
        );

        expect(decoded.destination).toBe(PAYEE_B);
        expect(decoded.payeeNodeKey).toBe(PAYEE_B);
    });

    it('skips a wrong-length description_hash and keeps the next valid one', () => {
        const decoded = Bolt11Utils.decode(
            buildInvoice([
                tag(1, hexToWords(HASH_A)),
                tag(23, hexToWords('cc'.repeat(20))),
                tag(23, hexToWords(HASH_B))
            ])
        );

        expect(decoded.description_hash).toBe(HASH_B);
    });

    it('skips a wrong-length payment_secret and keeps the next valid one', () => {
        const decoded = Bolt11Utils.decode(
            buildInvoice([
                tag(1, hexToWords(HASH_A)),
                tag(16, hexToWords('cc'.repeat(20))),
                tag(16, hexToWords(HASH_B))
            ])
        );

        expect(decoded.payment_secret).toBe(HASH_B);
    });

    // With no well-formed payee tag, destination comes from signature
    // recovery. The zeroed signature cannot recover, so it stays unset
    // rather than taking the short tag's value.
    it('falls back to signature recovery when the only payee tag has the wrong length', () => {
        const decoded = Bolt11Utils.decode(
            buildInvoice([
                tag(1, hexToWords(HASH_A)),
                tag(19, hexToWords('cc'.repeat(20)))
            ])
        );

        expect(decoded.destination).toBeUndefined();
        expect(decoded.payeeNodeKey).toBeUndefined();
    });

    it('throws when no payment_hash tag is present', () => {
        // lnd's zpay32 rejects such invoices outright; no node can
        // settle them.
        const action = () =>
            Bolt11Utils.decode(buildInvoice([tag(13, utf8ToWords('memo'))]));

        expect(action).toThrowError('No valid payment hash found');
    });

    it('throws when the only payment_hash tag has the wrong length', () => {
        const action = () =>
            Bolt11Utils.decode(
                buildInvoice([tag(1, hexToWords('cc'.repeat(20)))])
            );

        expect(action).toThrowError('No valid payment hash found');
    });

    it('still records every occurrence in the sections array', () => {
        const decoded = Bolt11Utils.decode(
            buildInvoice([
                tag(1, hexToWords(HASH_A)),
                tag(23, hexToWords(HASH_A)),
                tag(23, hexToWords(HASH_B))
            ])
        );

        const hashSections = decoded.sections.filter(
            (s) => s.name === 'description_hash'
        );
        expect(hashSections).toHaveLength(2);
        expect(hashSections[0].value).toBe(HASH_A);
        expect(hashSections[1].value).toBe(HASH_B);
    });
});
