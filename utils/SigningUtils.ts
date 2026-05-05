const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

export function getCompressedPublicKeyHex(privKey: Uint8Array): string {
    return ec.keyFromPrivate(privKey).getPublic().encodeCompressed('hex');
}

export function ecdsaSignDERHex(hash: Uint8Array, privKey: Uint8Array): string {
    const sig = ec.sign(hash, privKey, { canonical: true });
    return Buffer.from(sig.toDER()).toString('hex');
}
