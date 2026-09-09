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
} from './BbqrUtils';

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

        it('rejects a version range that is inverted or out of bounds', () => {
            // An inverted range is expressible in the type system.
            expect(() =>
                validateSplitOptions({ minVersion: 20, maxVersion: 10 })
            ).toThrow('min/max version out of range');

            // 0 and 41 are not: Version is a union of the real QR versions, so
            // isValidVersion only fires for callers that arrive without types,
            // which is what the cast stands in for here.
            expect(() =>
                validateSplitOptions({ minVersion: 0 as any })
            ).toThrow('min/max version out of range');
            expect(() =>
                validateSplitOptions({ maxVersion: 41 as any })
            ).toThrow('min/max version out of range');
        });

        it('rejects a split range that is inverted or out of bounds', () => {
            expect(() =>
                validateSplitOptions({ minSplit: 10, maxSplit: 2 })
            ).toThrow('min/max split out of range');
            expect(() => validateSplitOptions({ minSplit: 0 })).toThrow(
                'min/max split out of range'
            );
            expect(() => validateSplitOptions({ maxSplit: 1296 })).toThrow(
                'min/max split out of range'
            );
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

        it('refuses a payload that cannot be made to fit', () => {
            // One part at version 1 cannot hold 4 KB, so no (version, count)
            // pair satisfies the constraints and there is nothing to choose.
            const tooBig = new Uint8Array(4096).map((_, i) => i % 256);

            expect(() =>
                splitQRs(tooBig, 'T', {
                    encoding: 'H',
                    minVersion: 1,
                    maxVersion: 1,
                    maxSplit: 1
                })
            ).toThrow('Cannot make it fit');
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

            const { parts, encoding: used } = splitQRs(original, 'P', {
                encoding: encoding as any,
                maxVersion: 10
            });

            // A payload that stopped compressing would silently fall back from
            // 'Z' to '2', the round trip would still pass, and pako.inflate
            // would no longer be exercised by anything.
            expect(used).toBe(encoding);

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

    describe('joinQRs rejects a malformed scan', () => {
        // joinQRs is the only function here fed by whatever the camera reads,
        // so its rejections are the ones that matter. Each case starts from a
        // real split and corrupts it, rather than hand-writing a header, so
        // these stay honest if the header layout ever changes.
        //
        // Header is B$<encoding><fileType><numParts><index>, two base36
        // characters each for the last two: 'B$HT0500' is hex, filetype T,
        // five parts, index zero.
        const payload = new Uint8Array(300).map((_, i) => (i * 11) % 256);
        const freshParts = () =>
            splitQRs(payload, 'T', { encoding: 'H', maxVersion: 5 }).parts;

        it('rejects parts whose headers disagree', () => {
            const parts = freshParts();
            // Same data, but this part claims a different file type.
            parts[1] = 'B$HU' + parts[1].slice(4);

            expect(() => joinQRs(parts)).toThrow(
                'conflicting/variable filetype/encodings/sizes'
            );
        });

        it('rejects a header that does not start with B$', () => {
            const parts = freshParts().map((p) => 'XX' + p.slice(2));

            expect(() => joinQRs(parts)).toThrow(
                'fixed header not found, expected B$'
            );
        });

        it('rejects an unknown encoding byte', () => {
            const parts = freshParts().map(
                (p) => p.slice(0, 2) + 'Q' + p.slice(3)
            );

            expect(() => joinQRs(parts)).toThrow('bad encoding: Q');
        });

        it('rejects an unknown file type byte', () => {
            const parts = freshParts().map(
                (p) => p.slice(0, 3) + 'Q' + p.slice(4)
            );

            expect(() => joinQRs(parts)).toThrow('bad file type: Q');
        });

        it('rejects a declared part count of zero', () => {
            const parts = freshParts().map(
                (p) => p.slice(0, 4) + '00' + p.slice(6)
            );

            expect(() => joinQRs(parts)).toThrow('zero parts?');
        });

        it('rejects a part index beyond the declared count', () => {
            const parts = freshParts();
            // Index 9 in a five-part set.
            parts[2] = parts[2].slice(0, 6) + '09' + parts[2].slice(8);

            expect(() => joinQRs(parts)).toThrow(
                'got part 9 but only expecting 5'
            );
        });

        it('rejects a duplicate index carrying different content', () => {
            const parts = freshParts();
            // Re-label part 3 as part 2, so index 2 arrives twice with
            // different payloads. An identical duplicate is allowed by design
            // -- the same QR scanned twice is not an error -- so the content
            // has to differ for this to be a conflict.
            parts[3] = parts[2].slice(0, 8) + parts[3].slice(8);

            expect(() => joinQRs(parts)).toThrow(
                'Duplicate part 0x2 has wrong content'
            );
        });

        it('accepts the same part scanned twice', () => {
            const parts = freshParts();
            const { raw } = joinQRs([...parts, parts[0], parts[2]]);

            expect(Array.from(raw)).toEqual(Array.from(payload));
        });

        it('rejects a set with a part missing', () => {
            const parts = freshParts();
            parts.splice(2, 1);

            expect(() => joinQRs(parts)).toThrow('Part 2 is missing');
        });
    });
});
