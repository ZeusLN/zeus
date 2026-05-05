import { getPublicKey, signSync } from '@noble/secp256k1';
import '../zeus_modules/noble_ecc'; // ensures hmacSha256Sync is configured for signSync

export function getCompressedPublicKeyHex(privKey: Uint8Array): string {
    return Buffer.from(getPublicKey(privKey, true)).toString('hex');
}

export function ecdsaSignDERHex(hash: Uint8Array, privKey: Uint8Array): string {
    return Buffer.from(signSync(hash, privKey, { canonical: true })).toString(
        'hex'
    );
}
