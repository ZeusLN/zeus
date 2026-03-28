import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { getPublicKey, nip19 } from 'nostr-tools';
import * as bip39 from '@scure/bip39';

import { deriveMintBackupKeypair } from './NostrMintBackup';
import Base64Utils from './Base64Utils';

describe('NostrMintBackup', () => {
    // A fixed test mnemonic (DO NOT use in production)
    const testMnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const testSeed = bip39.mnemonicToSeedSync(testMnemonic);

    describe('deriveMintBackupKeypair', () => {
        it('should return privateKey, privateKeyHex, and publicKeyHex', () => {
            const result = deriveMintBackupKeypair(testSeed);

            expect(result.privateKey).toBeInstanceOf(Uint8Array);
            expect(result.privateKey.length).toBe(32);
            expect(result.privateKeyHex).toMatch(/^[0-9a-f]{64}$/);
            expect(result.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should be deterministic — same seed always produces same keys', () => {
            const result1 = deriveMintBackupKeypair(testSeed);
            const result2 = deriveMintBackupKeypair(testSeed);

            expect(result1.privateKeyHex).toBe(result2.privateKeyHex);
            expect(result1.publicKeyHex).toBe(result2.publicKeyHex);
        });

        it('should produce different keys for different seeds', () => {
            const otherMnemonic =
                'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
            const otherSeed = bip39.mnemonicToSeedSync(otherMnemonic);

            const result1 = deriveMintBackupKeypair(testSeed);
            const result2 = deriveMintBackupKeypair(otherSeed);

            expect(result1.privateKeyHex).not.toBe(result2.privateKeyHex);
            expect(result1.publicKeyHex).not.toBe(result2.publicKeyHex);
        });

        it('should produce a valid secp256k1 keypair', () => {
            const { privateKeyHex, publicKeyHex } =
                deriveMintBackupKeypair(testSeed);

            // Verify the public key matches what nostr-tools derives
            const expectedPubkey = getPublicKey(privateKeyHex);
            expect(publicKeyHex).toBe(expectedPubkey);
        });

        it('should produce valid npub/nsec encodings', () => {
            const { privateKeyHex, publicKeyHex } =
                deriveMintBackupKeypair(testSeed);

            const npub = nip19.npubEncode(publicKeyHex);
            const nsec = nip19.nsecEncode(privateKeyHex);

            expect(npub).toMatch(/^npub1/);
            expect(nsec).toMatch(/^nsec1/);

            // Roundtrip
            const decodedNpub = nip19.decode(npub);
            expect(decodedNpub.data).toBe(publicKeyHex);

            const decodedNsec = nip19.decode(nsec);
            expect(decodedNsec.data).toBe(privateKeyHex);
        });
    });

    describe('cross-compatibility with cashu.me', () => {
        it('should use the same derivation as cashu.me: SHA-256(seed || "cashu-mint-backup")', () => {
            const { privateKeyHex } = deriveMintBackupKeypair(testSeed);

            // Manually replicate cashu.me's derivation
            const domainSeparator =
                Base64Utils.utf8ToBytes('cashu-mint-backup');
            const combined = new Uint8Array(
                testSeed.length + domainSeparator.length
            );
            combined.set(testSeed);
            combined.set(domainSeparator, testSeed.length);
            const expectedPrivateKey = bytesToHex(sha256(combined));

            expect(privateKeyHex).toBe(expectedPrivateKey);
        });

        it('should produce a stable keypair for the well-known test vector', () => {
            const { privateKeyHex, publicKeyHex } =
                deriveMintBackupKeypair(testSeed);

            // Derived from "abandon abandon ... about" mnemonic.
            // Must match cashu.me's output for the same seed.
            expect(privateKeyHex).toBe(
                'a2b87a529208651bbf974186ee4a0c13c1f31e07030de6ebd09ee33559ff97a7'
            );
            expect(publicKeyHex).toBe(
                'e1c971f6a291628471291a266ab85c6ffd7116c7aab6299a6801ae502f56d69b'
            );
        });
    });
});
