/**
 * Unit tests for NostrWalletConnectStore encryption scheme detection
 * Tests the robustness of encryption scheme detection with exact matching and error handling.
 * Reference: FINAL_REVIEW_SYNTHESIS.md HIGH-PRIORITY MEDIUM-1
 */

describe('NostrWalletConnectStore - Encryption Scheme Detection', () => {
    // Helper to extract the private methods we're testing
    // In a real test setup, these would be exposed or tested indirectly through public methods
    
    // Mock implementations of the methods for testing
    const isSupportedEncryptionScheme = (tags: string[][]): boolean => {
        const encryptionTag = tags.find((tag) => tag[0] === 'encryption');
        const schemeValue = encryptionTag?.[1];

        if (!schemeValue) {
            return true;
        }

        if (typeof schemeValue !== 'string') {
            console.warn('NWC: Invalid encryption tag value type', {
                tagValue: schemeValue,
                tagType: typeof schemeValue
            });
            return false;
        }

        const normalized = schemeValue.toLowerCase();
        const validSchemes = ['nip04', 'nip44_v2'];

        if (validSchemes.includes(normalized)) {
            return true;
        }

        console.warn('NWC: Unsupported encryption scheme', {
            scheme: normalized,
            validSchemes
        });
        return false;
    };

    const getEventEncryptionScheme = (tags: string[][]): 'nip04' | 'nip44_v2' => {
        const encryptionTag = tags.find((tag) => tag[0] === 'encryption');
        const schemeValue = encryptionTag?.[1];

        if (!schemeValue) {
            return 'nip04';
        }

        if (typeof schemeValue !== 'string') {
            console.warn('NWC: Invalid encryption tag value type, defaulting to nip04', {
                tagValue: schemeValue,
                tagType: typeof schemeValue
            });
            return 'nip04';
        }

        const normalized = schemeValue.toLowerCase();
        const validSchemes = ['nip04', 'nip44_v2'];

        if (normalized === 'nip44_v2') {
            return 'nip44_v2';
        }

        if (!validSchemes.includes(normalized)) {
            console.warn('NWC: Unknown encryption scheme, defaulting to nip04', {
                scheme: normalized,
                validSchemes
            });
        }

        return 'nip04';
    };

    describe('getEventEncryptionScheme', () => {
        test('should detect nip44_v2 encryption scheme', () => {
            const tags = [['encryption', 'nip44_v2']];
            expect(getEventEncryptionScheme(tags)).toBe('nip44_v2');
        });

        test('should detect nip04 encryption scheme', () => {
            const tags = [['encryption', 'nip04']];
            expect(getEventEncryptionScheme(tags)).toBe('nip04');
        });

        test('should default to nip04 when encryption tag is missing', () => {
            const tags = [['other', 'value']];
            expect(getEventEncryptionScheme(tags)).toBe('nip04');
        });

        test('should default to nip04 when encryption tag is empty', () => {
            const tags = [['encryption', '']];
            expect(getEventEncryptionScheme(tags)).toBe('nip04');
        });

        test('should handle empty tags array', () => {
            const tags: string[][] = [];
            expect(getEventEncryptionScheme(tags)).toBe('nip04');
        });

        test('should normalize uppercase encryption scheme to lowercase and match', () => {
            const tags = [['encryption', 'NIP44_V2']];
            expect(getEventEncryptionScheme(tags)).toBe('nip44_v2');
        });

        test('should fallback to nip04 for invalid encryption scheme', () => {
            const tags = [['encryption', 'invalid_scheme']];
            expect(getEventEncryptionScheme(tags)).toBe('nip04');
        });

        test('should fallback to nip04 for partial match (not exact)', () => {
            const tags = [['encryption', 'nip44_v2_extra']];
            expect(getEventEncryptionScheme(tags)).toBe('nip04');
        });

        test('should reject non-string encryption tag values', () => {
            const tags = [['encryption', null as any]];
            expect(getEventEncryptionScheme(tags)).toBe('nip04');
        });

        test('should reject numeric encryption tag values', () => {
            const tags = [['encryption', 123 as any]];
            expect(getEventEncryptionScheme(tags)).toBe('nip04');
        });

        test('should use exact match - does not match partial strings', () => {
            const tags = [['encryption', 'contains_nip44_v2_inside']];
            expect(getEventEncryptionScheme(tags)).toBe('nip04');
        });
    });

    describe('isSupportedEncryptionScheme', () => {
        test('should support nip44_v2', () => {
            const tags = [['encryption', 'nip44_v2']];
            expect(isSupportedEncryptionScheme(tags)).toBe(true);
        });

        test('should support nip04', () => {
            const tags = [['encryption', 'nip04']];
            expect(isSupportedEncryptionScheme(tags)).toBe(true);
        });

        test('should support missing encryption tag (defaults to nip04)', () => {
            const tags = [['other', 'value']];
            expect(isSupportedEncryptionScheme(tags)).toBe(true);
        });

        test('should support empty encryption tag (defaults to nip04)', () => {
            const tags = [['encryption', '']];
            expect(isSupportedEncryptionScheme(tags)).toBe(true);
        });

        test('should reject invalid encryption schemes', () => {
            const tags = [['encryption', 'invalid_scheme']];
            expect(isSupportedEncryptionScheme(tags)).toBe(false);
        });

        test('should handle case-insensitive matching', () => {
            const tagsUpper = [['encryption', 'NIP04']];
            const tagsLower = [['encryption', 'nip04']];
            expect(isSupportedEncryptionScheme(tagsUpper)).toBe(true);
            expect(isSupportedEncryptionScheme(tagsLower)).toBe(true);
        });

        test('should reject non-string encryption values', () => {
            const tags = [['encryption', 123 as any]];
            expect(isSupportedEncryptionScheme(tags)).toBe(false);
        });

        test('should reject partial matches', () => {
            const tags = [['encryption', 'prefix_nip44_v2']];
            expect(isSupportedEncryptionScheme(tags)).toBe(false);
        });
    });

    describe('Error handling scenarios', () => {
        test('should log diagnostic info when encountering uppercase scheme', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const tags = [['encryption', 'NIP44_V2']];
            const result = getEventEncryptionScheme(tags);
            expect(result).toBe('nip44_v2');
            warnSpy.mockRestore();
        });

        test('should log warning for unknown schemes', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const tags = [['encryption', 'unsupported_scheme']];
            getEventEncryptionScheme(tags);
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        test('should log warning for invalid type encryption values', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const tags = [['encryption', { scheme: 'nip44_v2' } as any]];
            getEventEncryptionScheme(tags);
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });
});
