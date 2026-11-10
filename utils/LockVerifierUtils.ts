import { scrypt } from 'scrypt-js';

import { pbkdf2Sha256 } from './LockKdf';

// App-lock credentials (PIN / passphrase and their duress variants) must never
// be stored in plaintext: the settings blob they live in also holds every
// wallet secret and, on iOS, historically migrated through encrypted backups.
// Instead we store a salted PBKDF2 digest and compare in constant time. All
// four verifiers use the identical record shape so a duress verifier is
// indistinguishable from a normal one to anyone who reads the blob.

export interface Pbkdf2VerifierRecord {
    v: 1;
    kdf: 'pbkdf2-sha256';
    iterations: number;
    salt: string; // hex
    hash: string; // hex
}

// Records written by earlier builds of this change, which derived with
// scrypt-js. Still verified so those locks keep working; new records always
// use PBKDF2.
export interface ScryptVerifierRecord {
    v: 1;
    kdf: 'scrypt';
    n: number;
    r: number;
    p: number;
    salt: string; // hex
    hash: string; // hex
}

export type VerifierRecord = Pbkdf2VerifierRecord | ScryptVerifierRecord;

// PBKDF2-HMAC-SHA256 iterations, run natively (utils/LockKdf). 100,000 is
// the count ZipUtils and CryptoHelper already use for encrypted channel
// backups. In a debug build on an API 36 arm64 emulator one derivation took
// about 250 ms and an unlock attempt (primary and duress checks in parallel)
// about 340 ms, where scrypt-js took 27.6 s for the same attempt. OWASP's
// 600,000 would be about six times slower and put a slower phone back near
// two seconds per attempt. The count is stored in each record, so it can be
// raised later.
export const PBKDF2_ITERATIONS = 100000;
const KEY_LEN = 32;
const SALT_LEN = 16;

// scrypt defaults, used only to verify ScryptVerifierRecord.
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

const toBytes = (secret: string): Buffer => Buffer.from(secret, 'utf8');

// react-native-randombytes runs a native init() at import time that throws
// under jest, so it is loaded lazily here rather than at module scope. Keeping
// this module side-effect free lets any store/view import it without dragging
// the native dependency into unrelated test suites; test paths pass an explicit
// salt and never reach this.
const generateSalt = (length: number): Buffer => {
    const { randomBytes } = require('react-native-randombytes');
    return randomBytes(length);
};

/**
 * Derive a verifier record for a secret. A fresh random salt is used per call,
 * so the same PIN set twice yields different records. `salt` is injectable for
 * deterministic tests only.
 */
export const deriveVerifier = async (
    secret: string,
    salt?: Buffer
): Promise<VerifierRecord> => {
    const saltBuf = salt ?? generateSalt(SALT_LEN);
    const derived = await pbkdf2Sha256(
        toBytes(secret),
        Buffer.from(saltBuf),
        PBKDF2_ITERATIONS,
        KEY_LEN
    );
    return {
        v: 1,
        kdf: 'pbkdf2-sha256',
        iterations: PBKDF2_ITERATIONS,
        salt: Buffer.from(saltBuf).toString('hex'),
        hash: derived.toString('hex')
    };
};

/**
 * Fixed, well-formed verifier, used as the dummy when there is no primary
 * verifier to copy. Verifying against it runs the full derivation but can
 * never match: the stored hash is a constant, not the digest of any secret
 * under this salt.
 */
export const DUMMY_VERIFIER: VerifierRecord = {
    v: 1,
    kdf: 'pbkdf2-sha256',
    iterations: PBKDF2_ITERATIONS,
    salt: '00'.repeat(SALT_LEN),
    hash: '00'.repeat(KEY_LEN)
};

/**
 * The dummy to verify against in place of a missing duress verifier, so
 * unlock latency does not reveal whether a duress credential exists. It is
 * the primary verifier with its salt and hash zeroed, so the KDF, its cost
 * parameters and the key length match the primary's, including for scrypt
 * records and for records written before PBKDF2_ITERATIONS changes.
 */
export const getDummyVerifier = (
    primary?: VerifierRecord | null
): VerifierRecord =>
    primary && hasVerifier(primary)
        ? {
              ...primary,
              salt: '0'.repeat(primary.salt.length),
              hash: '0'.repeat(primary.hash.length)
          }
        : DUMMY_VERIFIER;

/** True when `record` is a well-formed verifier (used for UI/gate presence). */
export const hasVerifier = (record?: VerifierRecord | null): boolean =>
    !!record &&
    (record.kdf === 'pbkdf2-sha256' || record.kdf === 'scrypt') &&
    typeof record.salt === 'string' &&
    record.salt.length > 0 &&
    typeof record.hash === 'string' &&
    record.hash.length > 0;

const constantTimeEqual = (a: Buffer, b: Buffer): boolean => {
    if (a.length === 0 || a.length !== b.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
};

const derive = async (
    secret: Buffer,
    salt: Buffer,
    record: VerifierRecord,
    keyLen: number
): Promise<Buffer> => {
    if (record.kdf === 'scrypt') {
        const derived = await scrypt(
            secret,
            salt,
            record.n || SCRYPT_N,
            record.r || SCRYPT_R,
            record.p || SCRYPT_P,
            keyLen
        );
        return Buffer.from(derived);
    }
    return pbkdf2Sha256(
        secret,
        salt,
        record.iterations || PBKDF2_ITERATIONS,
        keyLen
    );
};

/**
 * Verify a candidate secret against a stored verifier. Returns false (fail
 * closed) for an empty secret or a missing/malformed record. Rejects when
 * the derivation itself fails (e.g. the native module is unavailable), so a
 * caller cannot count a KDF failure as a wrong entry.
 */
export const verifySecret = async (
    secret: string,
    record?: VerifierRecord | null
): Promise<boolean> => {
    if (!secret || !hasVerifier(record)) {
        return false;
    }
    const rec = record as VerifierRecord;
    const expected = Buffer.from(rec.hash, 'hex');
    const derived = await derive(
        toBytes(secret),
        Buffer.from(rec.salt, 'hex'),
        rec,
        expected.length || KEY_LEN
    );
    return constantTimeEqual(derived, expected);
};
