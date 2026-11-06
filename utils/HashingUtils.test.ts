import {
    hashScryptAsync,
    hmacSha256,
    sha1ForIdenticon,
    sha256Bytes,
    sha256Hex,
    sha256StringToHex
} from './HashingUtils';

// Expected values come from published test vectors or Node's crypto, so they
// do not depend on the library behind HashingUtils.

const bytes = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'));
const ascii = (s: string) => Uint8Array.from(Buffer.from(s, 'utf8'));
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

describe('HashingUtils', () => {
    describe('sha256Bytes / sha256Hex', () => {
        // FIPS 180-2 examples
        it.each([
            [
                'the empty message',
                '',
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
            ],
            [
                '"abc"',
                'abc',
                'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
            ],
            [
                'the 448-bit message',
                'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
                '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
            ]
        ])('hashes %s', (_name, message, expected) => {
            expect(sha256Hex(ascii(message))).toBe(expected);
            expect(hex(sha256Bytes(ascii(message)))).toBe(expected);
        });

        it('returns 32 bytes', () => {
            const digest = sha256Bytes(new Uint8Array(0));
            expect(digest).toBeInstanceOf(Uint8Array);
            expect(digest.length).toBe(32);
        });

        it('hashes a Buffer the same as a Uint8Array', () => {
            expect(sha256Hex(Buffer.from('abc'))).toBe(sha256Hex(ascii('abc')));
        });
    });

    describe('sha256StringToHex', () => {
        it('hashes the UTF-8 bytes of the string', () => {
            expect(sha256StringToHex('abc')).toBe(
                'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
            );
            expect(sha256StringToHex('₿ ⚡ ü')).toBe(
                'c7f500ea086f9afb89b15af1b7a3fdc0d6bcbfc09d4622ed4ce670ef96f442fa'
            );
        });
    });

    describe('hmacSha256', () => {
        // RFC 4231 test cases 1 and 2
        it('matches RFC 4231 test case 1', () => {
            expect(
                hex(
                    hmacSha256(new Uint8Array(20).fill(0x0b), ascii('Hi There'))
                )
            ).toBe(
                'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'
            );
        });

        it('matches RFC 4231 test case 2', () => {
            expect(
                hex(
                    hmacSha256(
                        ascii('Jefe'),
                        ascii('what do ya want for nothing?')
                    )
                )
            ).toBe(
                '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'
            );
        });

        it('takes a 32-byte key (the LNURL-auth hashing key)', () => {
            expect(
                hex(hmacSha256(new Uint8Array(32).fill(1), ascii('a.com')))
            ).toHaveLength(64);
        });
    });

    describe('sha1ForIdenticon', () => {
        // object-hash frames a string as "string:<length>:<value>"
        it.each([
            [
                'lndhub-https://example.com-user123',
                '1edceff59c0025570a31c48c407c770878dd0035'
            ],
            [
                'lnd-ñodo.example.com-8080',
                '6895d1d8b4eff7ea7a0d00f05c038c8f6fe4c0d7'
            ]
        ])('hashes %s', (identity, expected) => {
            expect(sha1ForIdenticon(identity)).toBe(expected);
        });
    });

    describe('hashScryptAsync', () => {
        // RFC 7914 section 12, second vector
        it('matches the RFC 7914 vector', async () => {
            const key = await hashScryptAsync(
                ascii('password'),
                ascii('NaCl'),
                {
                    N: 1024,
                    r: 8,
                    p: 16,
                    dkLen: 64
                }
            );
            expect(hex(key)).toBe(
                'fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640'
            );
        });

        it('returns dkLen bytes', async () => {
            const key = await hashScryptAsync(bytes('00'), bytes('01'), {
                N: 16,
                r: 1,
                p: 1,
                dkLen: 32
            });
            expect(key.length).toBe(32);
        });
    });
});
