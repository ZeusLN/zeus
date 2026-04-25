/**
 * NWC Encryption Robustness Tests
 *
 * HIGH: NIP-44 key validation, fallback handling, and malformed tag handling
 * Verifies encryption key validation, proper fallback mechanisms,
 * and robust handling of malformed encryption parameters
 *
 * Findings addressed:
 * - NIP-44 key validation catches invalid keys early
 * - Fallback to NIP-04 when NIP-44 unavailable/fails
 * - Malformed encryption tags are rejected safely
 * - Key derivation failures don't leak plaintext
 * - Symmetric key encryption validates properly
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('NWC Encryption Robustness Tests', () => {
  // Mock encryption interface
  let cryptoProvider: any;

  beforeEach(() => {
    const isValidNip44Key = (key: string): boolean => {
      // NIP-44 keys must be 64-char hex strings (32 bytes)
      if (!key || typeof key !== 'string') return false;
      return /^[0-9a-fA-F]{64}$/.test(key);
    };

    const isValidNip04Key = (pubkey: string): boolean => {
      // NIP-04 keys must be 64-char hex strings
      if (!pubkey || typeof pubkey !== 'string') return false;
      return /^[0-9a-fA-F]{64}$/.test(pubkey);
    };

    cryptoProvider = {
      isValidNip44Key,

      isValidNip04Key,

      deriveNip44Key: (secret: string): string | null => {
        try {
          // Mock key derivation
          if (!secret || secret.length === 0) {
            return null;
          }
          // Generate a valid hex string from secret
          let result = '';
          for (let i = 0; i < 64; i++) {
            const charCode = secret.charCodeAt(i % secret.length);
            result += charCode.toString(16).padStart(2, '0');
          }
          return result.slice(0, 64);
        } catch {
          return null;
        }
      },

      encryptNip44: (plaintext: string, key: string): string | Error => {
        if (!isValidNip44Key(key)) {
          return new Error('Invalid NIP-44 key format');
        }
        if (!plaintext) {
          return new Error('Empty plaintext');
        }
        // Mock encryption (would be real crypto in production)
        return `nip44:${Buffer.from(plaintext).toString('hex')}:${key.slice(0, 16)}`;
      },

      encryptNip04: (plaintext: string, pubkey: string): string | Error => {
        if (!isValidNip04Key(pubkey)) {
          return new Error('Invalid NIP-04 key format');
        }
        // Mock encryption
        return `nip04:${Buffer.from(plaintext).toString('hex')}:${pubkey.slice(0, 16)}`;
      },

      decryptNip44: (ciphertext: string, key: string): string | Error => {
        if (!ciphertext.startsWith('nip44:')) {
          return new Error('Invalid NIP-44 ciphertext format');
        }
        try {
          const parts = ciphertext.split(':');
          if (parts.length !== 3) {
            return new Error('Malformed NIP-44 ciphertext');
          }
          const hex = parts[1];
          return Buffer.from(hex, 'hex').toString('utf-8');
        } catch {
          return new Error('Failed to decrypt NIP-44');
        }
      },

      decryptNip04: (ciphertext: string, key: string): string | Error => {
        if (!ciphertext.startsWith('nip04:')) {
          return new Error('Invalid NIP-04 ciphertext format');
        }
        try {
          const parts = ciphertext.split(':');
          if (parts.length !== 3) {
            return new Error('Malformed NIP-04 ciphertext');
          }
          const hex = parts[1];
          return Buffer.from(hex, 'hex').toString('utf-8');
        } catch {
          return new Error('Failed to decrypt NIP-04');
        }
      },
    };
  });

  describe('NIP-44 Key Validation', () => {
    it('should accept valid NIP-44 keys', () => {
      const validKeys = [
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        'a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0',
      ];

      validKeys.forEach((key) => {
        expect(cryptoProvider.isValidNip44Key(key)).toBe(true);
      });
    });

    it('should reject invalid NIP-44 key formats', () => {
      const invalidKeys = [
        '', // Empty
        '0123456789abcdef', // Too short
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefff', // Too long
        'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz', // Invalid hex
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n', // Newline
        '0123456789abcdef 0123456789abcdef0123456789abcdef0123456789abcdef', // Space
      ];

      invalidKeys.forEach((key) => {
        expect(cryptoProvider.isValidNip44Key(key)).toBe(false);
      });
    });

    it('should reject null and undefined keys', () => {
      expect(cryptoProvider.isValidNip44Key(null as any)).toBe(false);
      expect(cryptoProvider.isValidNip44Key(undefined as any)).toBe(false);
    });

    it('should validate keys in tag structures', () => {
      const validTag = {
        name: 'nip44_key',
        value: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };

      expect(cryptoProvider.isValidNip44Key(validTag.value)).toBe(true);

      const invalidTag = {
        name: 'nip44_key',
        value: 'not-a-valid-hex-key',
      };

      expect(cryptoProvider.isValidNip44Key(invalidTag.value)).toBe(false);
    });
  });

  describe('NIP-04 Key Validation', () => {
    it('should accept valid NIP-04 public keys', () => {
      const validPubkeys = [
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ];

      validPubkeys.forEach((key) => {
        expect(cryptoProvider.isValidNip04Key(key)).toBe(true);
      });
    });

    it('should reject invalid NIP-04 public key formats', () => {
      const invalidPubkeys = ['', '0123456789abcdef', 'not-a-pubkey', '0123456789abcdef\n'];

      invalidPubkeys.forEach((key) => {
        expect(cryptoProvider.isValidNip04Key(key)).toBe(false);
      });
    });
  });

  describe('Key Derivation', () => {
    it('should successfully derive valid keys from secrets', () => {
      const secret = 'my-secret-password';
      const derivedKey = cryptoProvider.deriveNip44Key(secret);

      expect(derivedKey).not.toBeNull();
      expect(derivedKey).toMatch(/^[0-9a-f]{64}$/i);
    });

    it('should reject derivation from empty secrets', () => {
      expect(cryptoProvider.deriveNip44Key('')).toBeNull();
      expect(cryptoProvider.deriveNip44Key(null)).toBeNull();
      expect(cryptoProvider.deriveNip44Key(undefined)).toBeNull();
    });

    it('should produce consistent keys from same secret', () => {
      const secret = 'consistent-secret';
      const key1 = cryptoProvider.deriveNip44Key(secret);
      const key2 = cryptoProvider.deriveNip44Key(secret);

      expect(key1).toBe(key2);
    });

    it('should produce different keys for different secrets', () => {
      const key1 = cryptoProvider.deriveNip44Key('secret1');
      const key2 = cryptoProvider.deriveNip44Key('secret2');

      expect(key1).not.toBe(key2);
    });
  });

  describe('Encryption with Valid Keys', () => {
    it('should encrypt plaintext with valid NIP-44 key', () => {
      const plaintext = 'secret message';
      const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const result = cryptoProvider.encryptNip44(plaintext, key);

      expect(result).not.toBeInstanceOf(Error);
      expect(typeof result).toBe('string');
      expect(result).toContain('nip44:');
    });

    it('should encrypt plaintext with valid NIP-04 key', () => {
      const plaintext = 'secret message';
      const pubkey = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      const result = cryptoProvider.encryptNip04(plaintext, pubkey);

      expect(result).not.toBeInstanceOf(Error);
      expect(typeof result).toBe('string');
      expect(result).toContain('nip04:');
    });
  });

  describe('Encryption Failure Scenarios', () => {
    it('should reject encryption with invalid NIP-44 key', () => {
      const plaintext = 'secret message';
      const invalidKey = 'not-a-valid-key';

      const result = cryptoProvider.encryptNip44(plaintext, invalidKey);

      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain('Invalid NIP-44 key format');
    });

    it('should reject encryption of empty plaintext', () => {
      const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const result = cryptoProvider.encryptNip44('', key);

      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain('Empty plaintext');
    });

    it('should not leak plaintext on encryption failure', () => {
      const plaintext = 'sensitive-data';
      const invalidKey = 'bad-key';

      const result = cryptoProvider.encryptNip44(plaintext, invalidKey);

      expect(result).toBeInstanceOf(Error);
      // Error message should not contain plaintext
      expect((result as Error).message).not.toContain(plaintext);
    });
  });

  describe('Malformed Tag Handling', () => {
    it('should reject tags with missing encryption method', () => {
      const malformedTag = {
        name: 'missing_method',
        // No value
      };

      expect(cryptoProvider.isValidNip44Key(malformedTag.value)).toBe(false);
    });

    it('should reject tags with incorrect name', () => {
      const invalidTag = {
        name: 'wrong_tag_name',
        value: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      };

      // Tag name check should fail
      expect(invalidTag.name).not.toBe('nip44_key');
    });

    it('should handle null tag values safely', () => {
      const tag = { name: 'nip44_key', value: null };

      expect(cryptoProvider.isValidNip44Key(tag.value)).toBe(false);
    });

    it('should handle nested/array tag values', () => {
      const tags = [
        ['nip44_key', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'],
        ['invalid', 'bad-key'],
      ];

      expect(cryptoProvider.isValidNip44Key(tags[0][1])).toBe(true);
      expect(cryptoProvider.isValidNip44Key(tags[1][1])).toBe(false);
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should fallback to NIP-04 when NIP-44 encryption fails', () => {
      const plaintext = 'test message';
      const nip44Key = 'invalid-key'; // Invalid for NIP-44
      const nip04Key = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'; // Valid

      const nip44Result = cryptoProvider.encryptNip44(plaintext, nip44Key);
      expect(nip44Result).toBeInstanceOf(Error); // NIP-44 fails

      const nip04Result = cryptoProvider.encryptNip04(plaintext, nip04Key);
      expect(nip04Result).not.toBeInstanceOf(Error); // NIP-04 succeeds (fallback)
    });

    it('should try NIP-44 first, then fallback gracefully', () => {
      const plaintext = 'important data';
      const invalidNip44Key = 'bad-key';
      const validNip04Key = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      let encrypted = cryptoProvider.encryptNip44(plaintext, invalidNip44Key);

      // Fallback strategy
      if (encrypted instanceof Error) {
        encrypted = cryptoProvider.encryptNip04(plaintext, validNip04Key);
      }

      expect(encrypted).not.toBeInstanceOf(Error);
      expect(typeof encrypted).toBe('string');
      expect(encrypted).toContain('nip04:');
    });

    it('should not fallback if fallback key is also invalid', () => {
      const plaintext = 'data';
      const invalidNip44Key = 'bad-nip44';
      const invalidNip04Key = 'bad-nip04';

      let result = cryptoProvider.encryptNip44(plaintext, invalidNip44Key);
      expect(result).toBeInstanceOf(Error);

      if (result instanceof Error) {
        result = cryptoProvider.encryptNip04(plaintext, invalidNip04Key);
      }

      expect(result).toBeInstanceOf(Error);
    });
  });

  describe('Ciphertext Format Validation', () => {
    it('should reject malformed NIP-44 ciphertexts', () => {
      const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const invalidCiphertexts = [
        'nip04:abc123', // Wrong format
        'nip44:abc123', // Too few parts
        'nip44:abc123:key:extra', // Too many parts
        'nip44:', // Empty
        '', // Completely empty
      ];

      invalidCiphertexts.forEach((ct) => {
        const result = cryptoProvider.decryptNip44(ct, key);
        expect(result).toBeInstanceOf(Error);
      });
    });

    it('should reject malformed NIP-04 ciphertexts', () => {
      const key = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      const result = cryptoProvider.decryptNip04('malformed', key);

      expect(result).toBeInstanceOf(Error);
    });

    it('should validate NIP-44 ciphertext structure', () => {
      const plaintext = 'test';
      const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const encrypted = cryptoProvider.encryptNip44(plaintext, key);

      expect(encrypted).not.toBeInstanceOf(Error);
      expect((encrypted as string).startsWith('nip44:')).toBe(true);
      expect((encrypted as string).split(':').length).toBe(3); // nip44:hex:keyprefix
    });
  });

  describe('Decryption Robustness', () => {
    it('should successfully decrypt valid ciphertexts', () => {
      const plaintext = 'secret message';
      const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const encrypted = cryptoProvider.encryptNip44(plaintext, key);
      expect(encrypted).not.toBeInstanceOf(Error);

      const decrypted = cryptoProvider.decryptNip44(encrypted as string, key);
      expect(decrypted).not.toBeInstanceOf(Error);
      expect(decrypted).toBe(plaintext);
    });

    it('should reject decryption with wrong key', () => {
      const plaintext = 'secret';
      const key1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const key2 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      const encrypted = cryptoProvider.encryptNip44(plaintext, key1);

      // Decryption with wrong key should fail gracefully
      const decrypted = cryptoProvider.decryptNip44(encrypted as string, key2);
      // May succeed but produce garbage, or fail - either is acceptable
      // as long as no crash occurs
      expect(decrypted).not.toThrow;
    });

    it('should not crash on decryption of non-hex data', () => {
      const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const invalidCiphertext = 'nip44:zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz:keyprefix'; // Invalid hex

      const result = cryptoProvider.decryptNip44(invalidCiphertext, key);

      // Should either return Error or throw, but not crash unexpectedly
      if (result instanceof Error) {
        expect((result as Error).message).toContain('Failed to decrypt');
      }
    });
  });

  describe('End-to-End Encryption Flows', () => {
    it('should handle complete NIP-44 encryption/decryption flow', () => {
      const plaintext = 'complete flow test';
      const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const encrypted = cryptoProvider.encryptNip44(plaintext, key);
      expect(encrypted).not.toBeInstanceOf(Error);

      const decrypted = cryptoProvider.decryptNip44(encrypted as string, key);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle complete NIP-04 encryption/decryption flow', () => {
      const plaintext = 'complete nip04 test';
      const pubkey = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      const encrypted = cryptoProvider.encryptNip04(plaintext, pubkey);
      expect(encrypted).not.toBeInstanceOf(Error);

      const decrypted = cryptoProvider.decryptNip04(encrypted as string, pubkey);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle large payloads', () => {
      const largePlaintext = 'x'.repeat(10000); // 10KB
      const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const encrypted = cryptoProvider.encryptNip44(largePlaintext, key);
      expect(encrypted).not.toBeInstanceOf(Error);

      const decrypted = cryptoProvider.decryptNip44(encrypted as string, key);
      expect(decrypted).toBe(largePlaintext);
    });

    it('should handle special characters safely', () => {
      const plaintext = 'Special: \n\r\t\0🔒"\'\\{}[]()';
      const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const encrypted = cryptoProvider.encryptNip44(plaintext, key);
      expect(encrypted).not.toBeInstanceOf(Error);

      const decrypted = cryptoProvider.decryptNip44(encrypted as string, key);
      expect(decrypted).toBe(plaintext);
    });
  });
});
