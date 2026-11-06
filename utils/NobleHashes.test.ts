import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

// Known-answer tests for the @noble/hashes functions the app imports, through
// the same subpaths. They pin the behavior the app relies on so a major bump
// (1.x -> 2.x) is verified by the suite rather than assumed.

describe('@noble/hashes sha256', () => {
    // FIPS 180-2 / NIST CSRC example vectors
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
        expect(bytesToHex(sha256(utf8ToBytes(message)))).toBe(expected);
    });

    it('hashes a million "a" bytes', () => {
        expect(bytesToHex(sha256(new Uint8Array(1_000_000).fill(0x61)))).toBe(
            'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'
        );
    });

    it('hashes 32 zero bytes (a payment preimage)', () => {
        expect(bytesToHex(sha256(new Uint8Array(32)))).toBe(
            '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925'
        );
    });

    it('hashes a Buffer the same as a Uint8Array', () => {
        expect(bytesToHex(sha256(Buffer.from('abc')))).toBe(
            bytesToHex(sha256(Uint8Array.from([0x61, 0x62, 0x63])))
        );
    });

    it('returns 32 bytes', () => {
        const digest = sha256(new Uint8Array(0));
        expect(digest).toBeInstanceOf(Uint8Array);
        expect(digest.length).toBe(32);
    });
});

describe('@noble/hashes utils', () => {
    it('encodes UTF-8 including multi-byte characters', () => {
        expect(bytesToHex(utf8ToBytes('₿ ⚡ ü 😀'))).toBe(
            'e282bf20e29aa120c3bc20f09f9880'
        );
    });

    it('round-trips hex', () => {
        const hex = '00ff10a5' + '0123456789abcdef'.repeat(4);
        expect(bytesToHex(hexToBytes(hex))).toBe(hex);
    });

    it('accepts upper-case hex and returns lower-case hex', () => {
        expect(Array.from(hexToBytes('ABCDEF'))).toEqual([0xab, 0xcd, 0xef]);
        expect(bytesToHex(Uint8Array.from([0xab, 0xcd, 0xef]))).toBe('abcdef');
    });

    it('encodes a Buffer', () => {
        expect(bytesToHex(Buffer.from([0, 1, 254, 255]))).toBe('0001feff');
    });

    it('decodes empty hex to no bytes', () => {
        expect(hexToBytes('').length).toBe(0);
        expect(bytesToHex(new Uint8Array(0))).toBe('');
    });

    it.each([
        ['odd-length hex', 'abc'],
        ['a 0x prefix', '0xab'],
        ['non-hex characters', 'zz']
    ])('rejects %s', (_name, input) => {
        expect(() => hexToBytes(input)).toThrow();
    });
});
