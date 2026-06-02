import {
    sha256Bytes,
    sha256Hex,
    sha256StringToHex,
    hmacSha256,
    sha1ForIdenticon,
    hashScryptAsync
} from './HashingUtils';

describe('HashingUtils', () => {
    describe('sha256Bytes', () => {
        it('returns correct sha256 hash as Uint8Array', () => {
            const input = new Uint8Array([116, 101, 115, 116]); // 'test'
            const result = sha256Bytes(input);
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(32);
            expect(Buffer.from(result).toString('hex')).toBe(
                '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
            );
        });
    });

    describe('sha256Hex', () => {
        it('returns correct sha256 hash as hex string', () => {
            const input = new Uint8Array([116, 101, 115, 116]); // 'test'
            expect(sha256Hex(input)).toBe(
                '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
            );
        });

        it('handles empty input', () => {
            const input = new Uint8Array([]);
            expect(sha256Hex(input)).toBe(
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
            );
        });
    });

    describe('sha256StringToHex', () => {
        it('hashes utf8 string to hex', () => {
            expect(sha256StringToHex('test')).toBe(
                '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
            );
        });

        it('handles unicode strings', () => {
            expect(sha256StringToHex('hello world')).toBe(
                'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
            );
        });
    });

    describe('hmacSha256', () => {
        it('returns correct HMAC-SHA256', () => {
            const key = new Uint8Array([
                0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b,
                0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b
            ]);
            const message = new Uint8Array([
                0x48, 0x69, 0x20, 0x54, 0x68, 0x65, 0x72, 0x65
            ]); // "Hi There"
            const result = hmacSha256(key, message);
            expect(Buffer.from(result).toString('hex')).toBe(
                'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'
            );
        });
    });

    describe('sha1ForIdenticon', () => {
        it('hashes with object-hash compatible format', () => {
            const identity = 'test';
            const result = sha1ForIdenticon(identity);
            expect(result).toBe('8d56ea07e4ac6175807ed5f66279715d394d8885');
        });

        it('handles lndhub identity string', () => {
            const identity = 'lndhub-https://example.com-user123';
            const result = sha1ForIdenticon(identity);
            expect(result.length).toBe(40);
            expect(result).toMatch(/^[0-9a-f]+$/);
        });
    });

    describe('hashScryptAsync', () => {
        it('derives key with aezeed params', async () => {
            const password = Buffer.from('aezeed', 'utf8');
            const salt = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
            const opts = {
                N: 32768,
                r: 8,
                p: 1,
                dkLen: 32
            };

            const result = await hashScryptAsync(password, salt, opts);
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(32);
            expect(Buffer.from(result).toString('hex')).toBe(
                '4437efffedb7ecf2c450b395707a9aa180112467c8fd2b2f8fa1f3e7607e4f57'
            );
        });
    });
});
