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
});
