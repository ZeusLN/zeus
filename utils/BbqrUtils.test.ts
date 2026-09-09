import {
    encodeData,
    HEADER_LEN,
    intToBase36,
    isValidSplit,
    isValidVersion,
    joinQRs,
    splitQRs,
    validateSplitOptions,
    versionToChars
} from '.././utils/BbqrUtils';

/**
 * BBQr is the format Zeus uses to move a PSBT (or any payload too large for one
 * QR) across an air gap, in `hooks/useQRAnimation.ts` when showing and in
 * `views/HandleAnythingQRScanner.tsx` when reading. Both sides are governed by
 * the spec rather than by our own choice, so an off-by-one in the header or the
 * base36 counter produces parts that other BBQr implementations reject — or,
 * worse, that reassemble into the wrong bytes.
 *
 * These tests assert the properties the spec fixes, and a split/join round trip,
 * rather than pinning encoded output that a legitimate change may alter.
 *
 * Reference: https://bbqr.org/
 */
describe('BbqrUtils', () => {
    describe('intToBase36', () => {
        it('renders the part counter as exactly two base36 digits', () => {
            // The header gives each counter two characters, so every value has
            // to be zero-padded to two and never wider.
            expect(intToBase36(0)).toBe('00');
            expect(intToBase36(36)).toBe('10');
            expect(intToBase36(1295)).toBe('ZZ');
        });

        it('rejects values two base36 digits cannot express', () => {
            // 1295 is ZZ, the largest two-digit base36 number. Allowing 1296
            // would silently produce a three-character field and shift the
            // payload for every reader.
            expect(() => intToBase36(1296)).toThrow('Out of range');
            expect(() => intToBase36(-1)).toThrow('Out of range');
            expect(() => intToBase36(1.5)).toThrow('Out of range');
        });
    });

    describe('validity checks', () => {
        it('bounds the split count at the two-digit base36 ceiling', () => {
            // isValidSplit and intToBase36 have to agree, or a split can be
            // accepted and then fail to render its own header.
            expect(isValidSplit(1)).toBe(true);
            expect(isValidSplit(1295)).toBe(true);
            expect(isValidSplit(0)).toBe(false);
            expect(isValidSplit(1296)).toBe(false);
        });

        it('accepts only real QR versions', () => {
            expect(isValidVersion(1)).toBe(true);
            expect(isValidVersion(40)).toBe(true);
            expect(isValidVersion(0)).toBe(false);
            expect(isValidVersion(41)).toBe(false);
        });

        it('refuses to report a capacity for a version that does not exist', () => {
            expect(() => versionToChars(41 as any)).toThrow('Invalid version');
        });
    });

    describe('validateSplitOptions', () => {
        it('fills in the documented defaults', () => {
            expect(validateSplitOptions({})).toEqual({
                minVersion: 5,
                maxVersion: 40,
                minSplit: 1,
                maxSplit: 1295,
                encoding: 'Z'
            });
        });

        it('keeps the options the caller supplied', () => {
            expect(
                validateSplitOptions({ encoding: 'H', maxSplit: 10 })
            ).toEqual(expect.objectContaining({ encoding: 'H', maxSplit: 10 }));
        });
    });

    describe('encodeData', () => {
        it('encodes hex two characters per byte', () => {
            const { encoding, encoded, splitMod } = encodeData(
                new Uint8Array([1, 2, 3, 4, 5]),
                'H'
            );

            expect(encoding).toBe('H');
            expect(encoded).toBe('0102030405');
            // A split may only fall on a byte boundary, which in hex is 2 chars.
            expect(splitMod).toBe(2);
        });

        it('splits base32 on the 8-character boundary', () => {
            // Base32 packs 5 bytes into 8 characters, so a part boundary
            // anywhere else would cut a group in half.
            expect(
                encodeData(new Uint8Array([1, 2, 3, 4, 5]), '2').splitMod
            ).toBe(8);
        });

        it('falls back to base32 when compression would enlarge the payload', () => {
            // The spec allows Zlib but does not require using it. Five bytes
            // cannot compress, so asking for 'Z' must come back as '2' — and
            // the header has to report what was actually used, or the reader
            // will try to inflate raw base32.
            const { encoding } = encodeData(
                new Uint8Array([1, 2, 3, 4, 5]),
                'Z'
            );

            expect(encoding).toBe('2');
        });
    });

    describe('splitQRs', () => {
        const payload = new Uint8Array(400).map((_, i) => i % 251);

        it('builds the fixed-length header the spec defines', () => {
            const { parts } = splitQRs(payload, 'P', { encoding: 'H' });

            // B$ + encoding + fileType + count + index = 8 characters.
            expect(parts[0].slice(0, HEADER_LEN)).toBe('B$HP0100');
            expect(HEADER_LEN).toBe(8);
        });

        it('numbers the parts sequentially and reports the same total in each', () => {
            const { parts } = splitQRs(payload, 'P', {
                encoding: 'H',
                maxVersion: 5
            });

            expect(parts.length).toBeGreaterThan(1);
            parts.forEach((part, i) => {
                expect(part.slice(2, 4)).toBe('HP');
                expect(part.slice(4, 6)).toBe(intToBase36(parts.length));
                expect(part.slice(6, 8)).toBe(intToBase36(i));
            });
        });

        it('rejects a file type outside the spec', () => {
            expect(() => splitQRs(payload, 'Q' as any)).toThrow(
                'Invalid value for fileType'
            );
        });
    });

    describe('round trip', () => {
        it.each([
            ['hex', 'H'],
            ['base32', '2'],
            ['zlib', 'Z']
        ])('returns the original bytes through %s', (_label, encoding) => {
            // This is the property that actually matters at the air gap: what
            // the scanner reassembles has to be byte-identical to what was
            // shown, whichever encoding was negotiated.
            const original = new Uint8Array(600).map((_, i) => (i * 7) % 256);

            const { parts } = splitQRs(original, 'P', {
                encoding: encoding as any,
                maxVersion: 10
            });
            const { raw, fileType } = joinQRs(parts);

            expect(fileType).toBe('P');
            expect(Array.from(raw)).toEqual(Array.from(original));
        });

        it('survives a payload that needs many parts', () => {
            const original = new Uint8Array(5000).map((_, i) => (i * 13) % 256);

            const { parts } = splitQRs(original, 'T', {
                encoding: 'H',
                maxVersion: 5
            });
            const { raw, fileType } = joinQRs(parts);

            expect(parts.length).toBeGreaterThan(5);
            expect(fileType).toBe('T');
            expect(Array.from(raw)).toEqual(Array.from(original));
        });
    });
});
