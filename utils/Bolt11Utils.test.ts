import * as secp from '@noble/secp256k1';
import { bech32 } from 'bech32';

import Bolt11Utils from './Bolt11Utils';

/**
 * Builds a structurally valid invoice carrying only an amount prefix.
 *
 * BOLT11 publishes no vector for an amount it forbids, so the rule below has
 * to be exercised against one we construct. The signature words are zeros,
 * which is harmless here because recovery is lazy -- reading the amount
 * fields never touches `destination`.
 */
const invoiceWithPrefix = (hrp: string) =>
    bech32.encode(hrp, new Array(110).fill(0), Infinity);

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

// BOLT11 spec reference vector, 20 milli-BTC with a hashed description
// https://github.com/lightning/bolts/blob/master/11-payment-encoding.md#examples
const MILLI_FIXTURE =
    'lnbc20m1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqhp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqs9qrsgq7ea976txfraylvgzuxs8kgcw23ezlrszfnh8r6qtfpr6cxga50aj6txm9rxrydzd06dfeawfk6swupvz4erwnyutnjq7x39ymw6j38gp7ynn44';

// BOLT11 spec reference vector using the pico-BTC multiplier. 9678785340p is
// 967878534 msat, which is 967878.534 sat -- deliberately NOT a whole number
// of satoshis, which is the whole point of keeping it.
// https://github.com/lightning/bolts/blob/master/11-payment-encoding.md#examples
const PICO_FIXTURE =
    'lnbc9678785340p1pwmna7lpp5gc3xfm08u9qy06djf8dfflhugl6p7lgza6dsjxq454gxhj9t7a0sd8dgfkx7cmtwd68yetpd5s9xar0wfjn5gpc8qhrsdfq24f5ggrxdaezqsnvda3kkum5wfjkzmfqf3jkgem9wgsyuctwdus9xgrcyqcjcgpzgfskx6eqf9hzqnteypzxz7fzypfhg6trddjhygrcyqezcgpzfysywmm5ypxxjemgw3hxjmn8yptk7untd9hxwg3q2d6xjcmtv4ezq7pqxgsxzmnyyqcjqmt0wfjjq6t5v4khxsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygsxqyjw5qcqp2rzjq0gxwkzc8w6323m55m4jyxcjwmy7stt9hwkwe2qxmy8zpsgg7jcuwz87fcqqeuqqqyqqqqlgqqqqn3qq9q9qrsgqrvgkpnmps664wgkp43l22qsgdw4ve24aca4nymnxddlnp8vh9v2sdxlu5ywdxefsfvm0fq3sesf08uf6q9a2ke0hc9j6z6wlxg5z5kqpu2v9wz';

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

    it('parses the amount from a micro-BTC prefix (2500u = 250000 sat)', () => {
        const decoded = Bolt11Utils.decode(BOLT11_SPEC_FIXTURE);

        expect(decoded.satoshis).toBe(250000);
        expect(decoded.millisatoshis).toBe('250000000');
        expect(decoded.num_satoshis).toBe('250000');
        expect(decoded.num_msat).toBe('250000000');
    });

    it('parses the amount from a milli-BTC prefix (20m = 2000000 sat)', () => {
        const decoded = Bolt11Utils.decode(MILLI_FIXTURE);

        expect(decoded.satoshis).toBe(2000000);
        expect(decoded.millisatoshis).toBe('2000000000');
        expect(decoded.num_satoshis).toBe('2000000');
        expect(decoded.num_msat).toBe('2000000000');
    });

    // An invoice may specify an amount that is not a whole number of
    // satoshis, and a wallet has to keep the millisatoshi figure to charge
    // the right amount. `satoshis` is deliberately null here rather than
    // rounded, so a caller cannot mistake a truncated figure for an exact
    // one; `num_satoshis` floors for display and `num_msat` stays exact.
    it('keeps msat precision for a sub-satoshi pico-BTC amount (9678785340p)', () => {
        const decoded = Bolt11Utils.decode(PICO_FIXTURE);

        expect(decoded.millisatoshis).toBe('967878534');
        expect(decoded.satoshis).toBeNull();
        expect(decoded.num_msat).toBe('967878534');
        expect(decoded.num_satoshis).toBe('967878');
    });

    // BOLT11: "if the multiplier is `p`, the least-significant digit of
    // `amount` MUST be 0", because a pico-bitcoin is a tenth of a
    // millisatoshi and anything finer cannot be paid. The pair matters: 10p
    // is accepted and yields 1 msat, so a null here is the rule firing and
    // not pico amounts being unsupported.
    it('rejects a pico amount whose last digit is not 0, but accepts 10p', () => {
        const forbidden = Bolt11Utils.decode(invoiceWithPrefix('lnbc1p'));
        expect(forbidden.millisatoshis).toBeNull();
        expect(forbidden.satoshis).toBeNull();
        expect(forbidden.num_msat).toBe('0');

        const allowed = Bolt11Utils.decode(invoiceWithPrefix('lnbc10p'));
        expect(allowed.millisatoshis).toBe('1');
        expect(allowed.satoshis).toBeNull();
        expect(allowed.num_msat).toBe('1');
    });

    // Characterising, not endorsing. decode() catches amount-parsing errors
    // and nulls the fields rather than rejecting, so an amount above the
    // 21M BTC supply cap arrives looking exactly like a no-amount invoice --
    // and downstream `Invoice.getRequestAmount` resolves it to a real 0 via
    // `Number(this.num_satoshis || 0)`. Raised on the PR; if decode is later
    // changed to distinguish the two, this test is meant to fail loudly.
    it('currently nulls, rather than rejects, an amount above the supply cap', () => {
        const decoded = Bolt11Utils.decode(invoiceWithPrefix('lnbc22000000'));

        expect(decoded.satoshis).toBeNull();
        expect(decoded.millisatoshis).toBeNull();
        expect(decoded.num_satoshis).toBe('0');
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
