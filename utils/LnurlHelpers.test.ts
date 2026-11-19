import { getParams } from 'js-lnurl';
import {
    decipherAES,
    decodelnurl,
    findlnurl,
    getDomain
} from 'js-lnurl/lib/helpers';

// js-lnurl 0.6.0 stopped re-exporting the helpers from the package root, so
// `import { findlnurl } from 'js-lnurl'` resolves fine but hands back
// undefined at runtime. handleAnything and LnurlPay/Success both depend on
// these helpers, so pin the import surface we actually rely on.
describe('js-lnurl import surface', () => {
    it('exposes getParams from the package root', () => {
        expect(typeof getParams).toBe('function');
    });

    it('exposes the helpers from js-lnurl/lib/helpers', () => {
        expect(typeof findlnurl).toBe('function');
        expect(typeof decodelnurl).toBe('function');
        expect(typeof decipherAES).toBe('function');
        expect(typeof getDomain).toBe('function');
    });

    it('does not expose the helpers from the package root', () => {
        // guards against a future version silently re-adding them, which would
        // make the subpath imports above look optional again
        const root = require('js-lnurl');
        expect(root.findlnurl).toBeUndefined();
        expect(root.decodelnurl).toBeUndefined();
        expect(root.decipherAES).toBeUndefined();
    });
});

describe('js-lnurl helpers', () => {
    // LUD-01 test vector
    const BECH32_LNURL =
        'LNURL1DP68GURN8GHJ7UM9WFMXJCM99E3K7MF0V9CXJ0M385EKVCENXC6R2C35XVUKXEFCV5MKVV34X5EKZD3EV56NYD3HXQURZEPEXEJXXEPNXSCRVWFNV9NXZCN9XQ6XYEFHVGCXXCMYXYMNSERXFQ5FNS';
    const DECODED_URL =
        'https://service.com/api?q=3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df';

    describe('decodelnurl', () => {
        it('decodes a bech32 lnurl', () => {
            expect(decodelnurl(BECH32_LNURL)).toBe(DECODED_URL);
        });

        it('upgrades lnurlp:// to https://', () => {
            expect(decodelnurl('lnurlp://service.com/api?q=1')).toBe(
                'https://service.com/api?q=1'
            );
        });

        it('keeps .onion hosts on http://', () => {
            expect(decodelnurl('lnurlw://abcdef.onion/api')).toBe(
                'http://abcdef.onion/api'
            );
        });

        it('throws on input that is not an lnurl', () => {
            expect(() => decodelnurl('not an lnurl')).toThrow();
        });
    });

    describe('findlnurl', () => {
        it('pulls a lowercased lnurl out of surrounding text', () => {
            expect(findlnurl(`pay me here: ${BECH32_LNURL} thanks`)).toBe(
                BECH32_LNURL.toLowerCase()
            );
        });

        it('returns null when there is no lnurl', () => {
            expect(findlnurl('bitcoin:bc1qexample')).toBeNull();
        });
    });

    describe('getDomain', () => {
        it('strips scheme, port, path and query', () => {
            expect(getDomain('https://service.com:8080/api?q=1')).toBe(
                'service.com'
            );
        });
    });

    describe('decipherAES', () => {
        // AES-256-CBC, key = preimage bytes, generated with node crypto
        const preimage =
            '3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df';

        it('decrypts an aes successAction with the payment preimage', () => {
            const plaintext = decipherAES(
                {
                    tag: 'aes',
                    iv: 'AAECAwQFBgcICQoLDA0ODw==',
                    ciphertext:
                        'JTJgrpQpKVbTh2x7Jy059dX4t3+QS50Fcl9q1QDHD6VXFX6VLPD8G/A1sZDzy36F'
                } as any,
                preimage
            );
            expect(plaintext).toBe('here is your voucher code: ZEUS-1234');
        });

        it('returns an empty string for non-aes successActions', () => {
            expect(decipherAES({ tag: 'message' } as any, preimage)).toBe('');
        });
    });
});

// getParams parses login and withdrawRequest queries locally (no fetch), via
// query-string and decode-uri-component. decode-uri-component 0.2.2 hangs or
// throws on malformed escapes (GHSA-vcc3-ghjq-m6fr, GHSA-qr28-fpjm-wq7f), so
// package.json pins js-lnurl's query-string to 9.x, which uses 0.5.1.
describe('js-lnurl getParams query parsing', () => {
    const CALLBACK = 'https://service.com/withdraw?id=1';
    const withdrawLnurl = (extra = '') =>
        `lnurlw://service.com/api?tag=withdrawRequest&k1=abc&callback=${encodeURIComponent(
            CALLBACK
        )}&maxWithdrawable=100000&minWithdrawable=1000&defaultDescription=Hello+World${extra}`;

    it('parses a login lnurl without fetching', async () => {
        const k1 =
            '3fc3645b439ce8e7f2553a69e5267081d96dcd340693afabe04be7b0ccd178df';
        await expect(
            getParams(`keyauth://service.com/login?tag=login&k1=${k1}`)
        ).resolves.toEqual({
            tag: 'login',
            k1,
            callback: `https://service.com/login?tag=login&k1=${k1}`,
            domain: 'service.com'
        });
    });

    it('parses a withdrawRequest lnurl without fetching', async () => {
        await expect(getParams(withdrawLnurl())).resolves.toEqual({
            tag: 'withdrawRequest',
            k1: 'abc',
            callback: CALLBACK,
            maxWithdrawable: '100000',
            minWithdrawable: '1000',
            defaultDescription: 'Hello World',
            domain: 'service.com'
        });
    });

    it('decodes UTF-8 escapes', async () => {
        const params: any = await getParams(withdrawLnurl('&memo=caf%C3%A9'));
        expect(params.memo).toBe('café');
    });

    it('survives `$` replacement patterns in malformed escapes', async () => {
        // 0.2.2 fed `$\`` and `$'` to String#replace as patterns, so the
        // string grew until it threw RangeError: Invalid string length
        const params: any = await getParams(
            withdrawLnurl('&x=' + '%24%60x%24%27y'.repeat(150) + '%')
        );
        expect(params.k1).toBe('abc');
        expect(params.x.length).toBeLessThan(2000);
    });

    it('parses malformed escapes quickly', async () => {
        const runs = Array.from(
            { length: 500 },
            (_, i) =>
                `%${(i >> 8).toString(16).padStart(2, '0')}%${(i & 0xff)
                    .toString(16)
                    .padStart(2, '0')}x`
        ).join('');
        for (const extra of [
            // 0.2.2 is cubic here: 800 escapes took 65 s under jest
            '&x=' + '%C0'.repeat(300),
            // many distinct runs plus a malformed one
            '&x=' + runs + '%zz'
        ]) {
            const start = Date.now();
            const params: any = await getParams(withdrawLnurl(extra));
            expect(params.k1).toBe('abc');
            expect(Date.now() - start).toBeLessThan(1000);
        }
    });
});
