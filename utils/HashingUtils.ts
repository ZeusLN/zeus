import { hmac } from '@noble/hashes/hmac.js';
import { sha1 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { scrypt } from 'scrypt-js';

// The app's SHA-256, HMAC-SHA256, SHA-1 and scrypt calls go through these
// helpers so the hashing library can be swapped in one place. Several outputs
// are persisted or derive keys (LNC storage keys, Cashu wallet db names,
// LNURL-auth linking keys, aezeed decryption), so HashingUtils.test.ts and
// the call sites' tests pin them to vectors computed with Node's crypto.

export function sha256Bytes(input: Uint8Array): Uint8Array {
    return sha256(input);
}

export function sha256Hex(input: Uint8Array): string {
    return bytesToHex(sha256Bytes(input));
}

// Hashes the string's UTF-8 bytes
export function sha256StringToHex(input: string): string {
    return bytesToHex(sha256(utf8ToBytes(input)));
}

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
    return hmac(sha256, key, message);
}

// object-hash's SHA-1 of a string: sha1("string:<length>:<value>"), where
// length counts UTF-16 code units
export function sha1ForIdenticon(stableIdentity: string): string {
    return bytesToHex(
        sha1(utf8ToBytes(`string:${stableIdentity.length}:${stableIdentity}`))
    );
}

export interface ScryptOpts {
    N: number;
    r: number;
    p: number;
    dkLen: number;
}

export async function hashScryptAsync(
    password: Uint8Array,
    salt: Uint8Array,
    opts: ScryptOpts
): Promise<Uint8Array> {
    return scrypt(password, salt, opts.N, opts.r, opts.p, opts.dkLen);
}
