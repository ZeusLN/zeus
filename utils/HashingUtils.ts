import { hash as fastSha256, hmac as fastHmacSha256 } from 'fast-sha256';
import hashjs from 'hash.js';
import { scrypt } from 'scrypt-js';

import Base64Utils from './Base64Utils';

const objectHash = require('object-hash');

// The app's SHA-256, HMAC-SHA256, SHA-1 and scrypt calls go through these
// helpers so the hashing library can be swapped in one place. Several outputs
// are persisted or derive keys (LNC storage keys, Cashu wallet db names,
// LNURL-auth linking keys, aezeed decryption), so HashingUtils.test.ts and
// the call sites' tests pin them to vectors computed with Node's crypto.

export function sha256Bytes(input: Uint8Array): Uint8Array {
    return fastSha256(input);
}

export function sha256Hex(input: Uint8Array): string {
    return Base64Utils.bytesToHex(Array.from(sha256Bytes(input)));
}

// Hashes the string's UTF-8 bytes
export function sha256StringToHex(input: string): string {
    return hashjs.sha256().update(input).digest('hex');
}

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
    return fastHmacSha256(key, message);
}

// object-hash's SHA-1 of a string: sha1("string:<length>:<value>"), where
// length counts UTF-16 code units
export function sha1ForIdenticon(stableIdentity: string): string {
    return objectHash.sha1(stableIdentity);
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
