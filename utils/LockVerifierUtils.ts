import { scrypt } from 'scrypt-js';

// App-lock credentials (PIN / passphrase and their duress variants) must never
// be stored in plaintext: the settings blob they live in also holds every
// wallet secret and, on iOS, historically migrated through encrypted backups.
// Instead we store a salted scrypt digest and compare in constant time. All
// four verifiers use the identical record shape so a duress verifier is
// indistinguishable from a normal one to anyone who reads the blob.

export interface VerifierRecord {
    v: 1;
    kdf: 'scrypt';
    n: number;
    r: number;
    p: number;
    salt: string; // hex
    hash: string; // hex
}

// scrypt work factors. N=32768 keeps a single derivation in the ~1s range on
// device, which is a deliberate cost: it rate-limits online guessing and makes
// an offline brute force of a short PIN expensive rather than trivial.
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;

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
    const derived = await scrypt(
        toBytes(secret),
        saltBuf,
        SCRYPT_N,
        SCRYPT_R,
        SCRYPT_P,
        KEY_LEN
    );
    return {
        v: 1,
        kdf: 'scrypt',
        n: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        salt: Buffer.from(saltBuf).toString('hex'),
        hash: Buffer.from(derived).toString('hex')
    };
};

/** True when `record` is a well-formed verifier (used for UI/gate presence). */
export const hasVerifier = (record?: VerifierRecord | null): boolean =>
    !!record &&
    record.kdf === 'scrypt' &&
    typeof record.salt === 'string' &&
    record.salt.length > 0 &&
    typeof record.hash === 'string' &&
    record.hash.length > 0;

const constantTimeEqualHex = (a: string, b: string): boolean => {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length === 0 || bufA.length !== bufB.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < bufA.length; i++) {
        diff |= bufA[i] ^ bufB[i];
    }
    return diff === 0;
};

/**
 * Verify a candidate secret against a stored verifier. Returns false (fail
 * closed) for an empty secret or a missing/malformed record, and never throws.
 */
export const verifySecret = async (
    secret: string,
    record?: VerifierRecord | null
): Promise<boolean> => {
    if (!secret || !hasVerifier(record)) {
        return false;
    }
    const rec = record as VerifierRecord;
    try {
        const saltBuf = Buffer.from(rec.salt, 'hex');
        const dkLen = Buffer.from(rec.hash, 'hex').length || KEY_LEN;
        const derived = await scrypt(
            toBytes(secret),
            saltBuf,
            rec.n || SCRYPT_N,
            rec.r || SCRYPT_R,
            rec.p || SCRYPT_P,
            dkLen
        );
        return constantTimeEqualHex(
            Buffer.from(derived).toString('hex'),
            rec.hash
        );
    } catch (e) {
        return false;
    }
};
