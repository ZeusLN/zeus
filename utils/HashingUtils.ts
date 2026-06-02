import { sha256 } from '@noble/hashes/sha256';
import { sha1 } from '@noble/hashes/legacy';
import { hmac } from '@noble/hashes/hmac';
import { scryptAsync as nobleScryptAsync } from '@noble/hashes/scrypt';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

export function sha256Bytes(input: Uint8Array): Uint8Array {
    return sha256(input);
}

export function sha256Hex(input: Uint8Array): string {
    return bytesToHex(sha256(input));
}

export function sha256StringToHex(input: string): string {
    return bytesToHex(sha256(utf8ToBytes(input)));
}

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
    return hmac(sha256, key, message);
}

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
    return nobleScryptAsync(password, salt, opts);
}
