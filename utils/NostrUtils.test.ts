import NostrUtils from './NostrUtils';

describe('NostrUtils', () => {
    // Valid npub (ZEUS official)
    const validNpub =
        'npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5';
    const validHex =
        '34d2f5274f1958fcd2cb2463dabeaddf8a21f84ace4241da888023bf05cc8095';

    describe('isValidNpub', () => {
        it('should return true for valid npub', () => {
            expect(NostrUtils.isValidNpub(validNpub)).toBe(true);
        });

        it('should return true for valid npub with whitespace', () => {
            expect(NostrUtils.isValidNpub(`  ${validNpub}  `)).toBe(true);
        });

        it('should return true for uppercase npub (case insensitive)', () => {
            expect(NostrUtils.isValidNpub(validNpub.toUpperCase())).toBe(true);
        });

        it('should return false for empty string', () => {
            expect(NostrUtils.isValidNpub('')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(NostrUtils.isValidNpub(null as any)).toBe(false);
            expect(NostrUtils.isValidNpub(undefined as any)).toBe(false);
        });

        it('should return false for wrong prefix', () => {
            expect(
                NostrUtils.isValidNpub(
                    'nsec1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5'
                )
            ).toBe(false);
        });

        it('should return false for too short npub', () => {
            expect(NostrUtils.isValidNpub('npub1abc123')).toBe(false);
        });

        it('should return false for too long npub', () => {
            expect(NostrUtils.isValidNpub(validNpub + 'extra')).toBe(false);
        });

        it('should return false for invalid characters', () => {
            expect(
                NostrUtils.isValidNpub(
                    'npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpro'
                )
            ).toBe(false); // 'o' is not valid in bech32
        });

        it('should return false for invalid bech32 checksum', () => {
            // Change last character to break checksum
            const invalidChecksum = validNpub.slice(0, -1) + 'a';
            expect(NostrUtils.isValidNpub(invalidChecksum)).toBe(false);
        });

        it('should return false for hex pubkey', () => {
            expect(NostrUtils.isValidNpub(validHex)).toBe(false);
        });

        it('should return false for random string', () => {
            expect(NostrUtils.isValidNpub('hello world')).toBe(false);
        });
    });

    describe('npubToHex', () => {
        it('should decode valid npub to hex', () => {
            expect(NostrUtils.npubToHex(validNpub)).toBe(validHex);
        });

        it('should handle whitespace', () => {
            expect(NostrUtils.npubToHex(`  ${validNpub}  `)).toBe(validHex);
        });

        it('should return null for empty string', () => {
            expect(NostrUtils.npubToHex('')).toBe(null);
        });

        it('should return null for null/undefined', () => {
            expect(NostrUtils.npubToHex(null as any)).toBe(null);
            expect(NostrUtils.npubToHex(undefined as any)).toBe(null);
        });

        it('should return null for invalid npub', () => {
            expect(NostrUtils.npubToHex('npub1invalid')).toBe(null);
        });

        it('should return null for nsec (wrong type)', () => {
            // This is a valid nsec, not npub
            expect(
                NostrUtils.npubToHex(
                    'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5'
                )
            ).toBe(null);
        });
    });

    describe('hexToNpub', () => {
        it('should encode valid hex to npub', () => {
            expect(NostrUtils.hexToNpub(validHex)).toBe(validNpub);
        });

        it('should handle whitespace', () => {
            expect(NostrUtils.hexToNpub(`  ${validHex}  `)).toBe(validNpub);
        });

        it('should handle uppercase hex', () => {
            expect(NostrUtils.hexToNpub(validHex.toUpperCase())).toBe(
                validNpub
            );
        });

        it('should return null for empty string', () => {
            expect(NostrUtils.hexToNpub('')).toBe(null);
        });

        it('should return null for null/undefined', () => {
            expect(NostrUtils.hexToNpub(null as any)).toBe(null);
            expect(NostrUtils.hexToNpub(undefined as any)).toBe(null);
        });

        it('should return null for too short hex', () => {
            expect(NostrUtils.hexToNpub('abcd1234')).toBe(null);
        });

        it('should return null for too long hex', () => {
            expect(NostrUtils.hexToNpub(validHex + 'ff')).toBe(null);
        });

        it('should return null for invalid hex characters', () => {
            expect(
                NostrUtils.hexToNpub(
                    'ghij02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5'
                )
            ).toBe(null);
        });
    });

    describe('roundtrip', () => {
        it('should roundtrip npub -> hex -> npub', () => {
            const hex = NostrUtils.npubToHex(validNpub);
            expect(hex).not.toBe(null);
            const npub = NostrUtils.hexToNpub(hex!);
            expect(npub).toBe(validNpub);
        });

        it('should roundtrip hex -> npub -> hex', () => {
            const npub = NostrUtils.hexToNpub(validHex);
            expect(npub).not.toBe(null);
            const hex = NostrUtils.npubToHex(npub!);
            expect(hex).toBe(validHex);
        });
    });

    // Valid nsec for testing (randomly generated, not a real secret)
    const validNsec =
        'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
    const validNsecHex =
        '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa';

    describe('isValidNsec', () => {
        it('should return true for valid nsec', () => {
            expect(NostrUtils.isValidNsec(validNsec)).toBe(true);
        });

        it('should return true for valid nsec with whitespace', () => {
            expect(NostrUtils.isValidNsec(`  ${validNsec}  `)).toBe(true);
        });

        it('should return true for uppercase nsec (case insensitive)', () => {
            expect(NostrUtils.isValidNsec(validNsec.toUpperCase())).toBe(true);
        });

        it('should return false for empty string', () => {
            expect(NostrUtils.isValidNsec('')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(NostrUtils.isValidNsec(null as any)).toBe(false);
            expect(NostrUtils.isValidNsec(undefined as any)).toBe(false);
        });

        it('should return false for npub (wrong type)', () => {
            expect(NostrUtils.isValidNsec(validNpub)).toBe(false);
        });

        it('should return false for too short nsec', () => {
            expect(NostrUtils.isValidNsec('nsec1abc123')).toBe(false);
        });

        it('should return false for too long nsec', () => {
            expect(NostrUtils.isValidNsec(validNsec + 'extra')).toBe(false);
        });

        it('should return false for invalid bech32 checksum', () => {
            const invalidChecksum = validNsec.slice(0, -1) + 'a';
            expect(NostrUtils.isValidNsec(invalidChecksum)).toBe(false);
        });

        it('should return false for hex key', () => {
            expect(NostrUtils.isValidNsec(validNsecHex)).toBe(false);
        });
    });

    describe('nsecToHex', () => {
        it('should decode valid nsec to hex', () => {
            expect(NostrUtils.nsecToHex(validNsec)).toBe(validNsecHex);
        });

        it('should handle whitespace', () => {
            expect(NostrUtils.nsecToHex(`  ${validNsec}  `)).toBe(validNsecHex);
        });

        it('should return null for empty string', () => {
            expect(NostrUtils.nsecToHex('')).toBe(null);
        });

        it('should return null for null/undefined', () => {
            expect(NostrUtils.nsecToHex(null as any)).toBe(null);
            expect(NostrUtils.nsecToHex(undefined as any)).toBe(null);
        });

        it('should return null for invalid nsec', () => {
            expect(NostrUtils.nsecToHex('nsec1invalid')).toBe(null);
        });

        it('should return null for npub (wrong type)', () => {
            expect(NostrUtils.nsecToHex(validNpub)).toBe(null);
        });
    });

    describe('hexToNsec', () => {
        it('should encode valid hex to nsec', () => {
            expect(NostrUtils.hexToNsec(validNsecHex)).toBe(validNsec);
        });

        it('should handle whitespace', () => {
            expect(NostrUtils.hexToNsec(`  ${validNsecHex}  `)).toBe(validNsec);
        });

        it('should handle uppercase hex', () => {
            expect(NostrUtils.hexToNsec(validNsecHex.toUpperCase())).toBe(
                validNsec
            );
        });

        it('should return null for empty string', () => {
            expect(NostrUtils.hexToNsec('')).toBe(null);
        });

        it('should return null for null/undefined', () => {
            expect(NostrUtils.hexToNsec(null as any)).toBe(null);
            expect(NostrUtils.hexToNsec(undefined as any)).toBe(null);
        });

        it('should return null for too short hex', () => {
            expect(NostrUtils.hexToNsec('abcd1234')).toBe(null);
        });

        it('should return null for too long hex', () => {
            expect(NostrUtils.hexToNsec(validNsecHex + 'ff')).toBe(null);
        });

        it('should return null for invalid hex characters', () => {
            expect(
                NostrUtils.hexToNsec(
                    'ghij029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laq'
                )
            ).toBe(null);
        });
    });

    describe('nsec roundtrip', () => {
        it('should roundtrip nsec -> hex -> nsec', () => {
            const hex = NostrUtils.nsecToHex(validNsec);
            expect(hex).not.toBe(null);
            const nsec = NostrUtils.hexToNsec(hex!);
            expect(nsec).toBe(validNsec);
        });

        it('should roundtrip hex -> nsec -> hex', () => {
            const nsec = NostrUtils.hexToNsec(validNsecHex);
            expect(nsec).not.toBe(null);
            const hex = NostrUtils.nsecToHex(nsec!);
            expect(hex).toBe(validNsecHex);
        });
    });
});
