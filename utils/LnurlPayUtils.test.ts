// LnurlPayUtils.test.ts
import BigNumber from 'bignumber.js';
import { sha256 } from '@noble/hashes/sha256';

import Base64Utils from './Base64Utils';
import Bolt11Utils from './Bolt11Utils';
import { verifyLnurlPayInvoice, isLnurlCallbackAllowed } from './LnurlPayUtils';

const METADATA = '[["text/plain","Payment to Alice"]]';
const MATCHING_HASH = Base64Utils.bytesToHex(
    Array.from(sha256(Base64Utils.utf8ToBytes(METADATA)))
);

describe('LnurlPayUtils', () => {
    describe('verifyLnurlPayInvoice', () => {
        afterEach(() => jest.restoreAllMocks());

        it('accepts an invoice bound to the shown metadata and requested amount', () => {
            jest.spyOn(Bolt11Utils, 'decode').mockReturnValue({
                num_msat: '21000',
                description_hash: MATCHING_HASH
            } as any);
            expect(
                verifyLnurlPayInvoice('lnbc...', METADATA, new BigNumber(21000))
                    .ok
            ).toBe(true);
        });

        it('rejects an invoice whose description_hash does not commit to the metadata', () => {
            jest.spyOn(Bolt11Utils, 'decode').mockReturnValue({
                num_msat: '21000',
                description_hash: 'deadbeef'
            } as any);
            const result = verifyLnurlPayInvoice(
                'lnbc...',
                METADATA,
                new BigNumber(21000)
            );
            expect(result.ok).toBe(false);
            expect(result.reason).toContain('description hash');
        });

        it('rejects an invoice for a different amount than requested', () => {
            jest.spyOn(Bolt11Utils, 'decode').mockReturnValue({
                num_msat: '100000',
                description_hash: MATCHING_HASH
            } as any);
            const result = verifyLnurlPayInvoice(
                'lnbc...',
                METADATA,
                new BigNumber(21000)
            );
            expect(result.ok).toBe(false);
            expect(result.reason).toContain('amount mismatch');
        });

        it('accepts an invoice without a description_hash (ecash-backed and other non-committing services)', () => {
            jest.spyOn(Bolt11Utils, 'decode').mockReturnValue({
                num_msat: '21000',
                description: 'ZEUS Pay'
            } as any);
            expect(
                verifyLnurlPayInvoice('lnbc...', METADATA, new BigNumber(21000))
                    .ok
            ).toBe(true);
        });

        it('still enforces the amount on an invoice without a description_hash', () => {
            jest.spyOn(Bolt11Utils, 'decode').mockReturnValue({
                num_msat: '100000',
                description: 'ZEUS Pay'
            } as any);
            const result = verifyLnurlPayInvoice(
                'lnbc...',
                METADATA,
                new BigNumber(21000)
            );
            expect(result.ok).toBe(false);
            expect(result.reason).toContain('amount mismatch');
        });

        it('rejects a committing invoice when no metadata is available to bind against', () => {
            jest.spyOn(Bolt11Utils, 'decode').mockReturnValue({
                num_msat: '21000',
                description_hash: MATCHING_HASH
            } as any);
            expect(
                verifyLnurlPayInvoice(
                    'lnbc...',
                    undefined,
                    new BigNumber(21000)
                ).ok
            ).toBe(false);
        });

        it('rejects an undecodable invoice', () => {
            jest.spyOn(Bolt11Utils, 'decode').mockImplementation(() => {
                throw new Error('bad');
            });
            expect(
                verifyLnurlPayInvoice('nope', METADATA, new BigNumber(21000)).ok
            ).toBe(false);
        });
    });

    describe('isLnurlCallbackAllowed', () => {
        it('allows an https callback', () => {
            expect(
                isLnurlCallbackAllowed('https://pay.example.com/cb').ok
            ).toBe(true);
        });

        it('allows a cross-domain https callback', () => {
            expect(isLnurlCallbackAllowed('https://cdn.other.net/cb').ok).toBe(
                true
            );
        });

        it('allows http only for .onion hosts', () => {
            expect(isLnurlCallbackAllowed('http://abcdefg.onion/cb').ok).toBe(
                true
            );
        });

        it('rejects http on a clearnet host (cleartext leak / MITM)', () => {
            expect(isLnurlCallbackAllowed('http://pay.example.com/cb').ok).toBe(
                false
            );
        });

        it('rejects the cloud-metadata / link-local address', () => {
            expect(
                isLnurlCallbackAllowed('http://169.254.169.254/latest').ok
            ).toBe(false);
        });

        it('rejects loopback even over https', () => {
            expect(isLnurlCallbackAllowed('https://127.0.0.1/x').ok).toBe(
                false
            );
        });

        it('rejects an RFC1918 address', () => {
            expect(isLnurlCallbackAllowed('https://10.1.2.3/x').ok).toBe(false);
            expect(isLnurlCallbackAllowed('https://192.168.0.1/x').ok).toBe(
                false
            );
            expect(isLnurlCallbackAllowed('https://172.16.5.5/x').ok).toBe(
                false
            );
        });

        it('rejects localhost', () => {
            expect(isLnurlCallbackAllowed('https://localhost/x').ok).toBe(
                false
            );
        });

        it('rejects IPv6 loopback', () => {
            expect(isLnurlCallbackAllowed('http://[::1]/x').ok).toBe(false);
        });

        it('rejects non-canonical IPv4 loopback spellings (inet_aton forms)', () => {
            // platform resolvers dial all of these as 127.0.0.1
            expect(isLnurlCallbackAllowed('https://2130706433/x').ok).toBe(
                false
            ); // decimal integer
            expect(isLnurlCallbackAllowed('https://0177.0.0.1/x').ok).toBe(
                false
            ); // octal
            expect(isLnurlCallbackAllowed('https://0x7f.0.0.1/x').ok).toBe(
                false
            ); // hex
            expect(isLnurlCallbackAllowed('https://0x7f000001/x').ok).toBe(
                false
            ); // hex integer
            expect(isLnurlCallbackAllowed('https://127.1/x').ok).toBe(false); // short form
            expect(isLnurlCallbackAllowed('https://127.0.0.1./x').ok).toBe(
                false
            ); // trailing dot
        });

        it('rejects non-canonical spellings of other private ranges', () => {
            expect(
                isLnurlCallbackAllowed('https://0xa9.0xfe.0xa9.0xfe/x').ok
            ).toBe(false); // 169.254.169.254 in hex
            expect(isLnurlCallbackAllowed('https://012.1.2.3/x').ok).toBe(
                false
            ); // 10.1.2.3 in octal
            expect(isLnurlCallbackAllowed('https://192.168.1/x').ok).toBe(
                false
            ); // 192.168.0.1 short form
        });

        it('rejects non-canonical IPv6 loopback spellings', () => {
            expect(
                isLnurlCallbackAllowed('https://[0:0:0:0:0:0:0:1]/x').ok
            ).toBe(false); // long form
            expect(isLnurlCallbackAllowed('https://[::ffff:7f00:1]/x').ok).toBe(
                false
            ); // hex-mapped IPv4 loopback
            expect(
                isLnurlCallbackAllowed('https://[::ffff:127.0.0.1]/x').ok
            ).toBe(false); // dotted-mapped IPv4 loopback
            expect(
                isLnurlCallbackAllowed('https://[0:0:0:0:0:ffff:c0a8:1]/x').ok
            ).toBe(false); // mapped 192.168.0.1, long form
        });

        it('still allows public IP literals in any spelling', () => {
            expect(isLnurlCallbackAllowed('https://8.8.8.8/x').ok).toBe(true);
            expect(isLnurlCallbackAllowed('https://0x8.0x8.0x8.0x8/x').ok).toBe(
                true
            );
            expect(isLnurlCallbackAllowed('https://[2001:db8::1]/x').ok).toBe(
                true
            );
            expect(isLnurlCallbackAllowed('https://example.com./x').ok).toBe(
                true
            ); // root-anchored public hostname
        });

        it('rejects an empty or missing callback', () => {
            expect(isLnurlCallbackAllowed('').ok).toBe(false);
            expect(isLnurlCallbackAllowed(undefined as any).ok).toBe(false);
        });
    });
});
