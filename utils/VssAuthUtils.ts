/**
 * VSS (Versioned Storage Service) Authentication Utilities
 *
 * Generates signature-based auth headers for the default LDK VSS server
 * (lightningdevkit/vss-server with SignatureValidatingAuthorizer).
 *
 * Protocol:
 *   Authorization = hex(pubkey_33B) + hex(ecdsa_sig_compact_64B) + timestamp
 *   Signed message = SHA256(SIGNING_CONSTANT || pubkey_bytes || timestamp_ascii)
 */

import * as necc from '@noble/secp256k1';
import { HDKey } from '@scure/bip32';
import createHash from 'create-hash';

// Import noble_ecc to ensure hmacSha256Sync / sha256Sync are configured
// (required by necc.signSync)
import '../zeus_modules/noble_ecc';

const bip39 = require('bip39');

// 64-byte salt from vss-server SignatureValidatingAuthorizer
const SIGNING_CONSTANT = Buffer.from(
    'VSS Signature Authorizer Signing Salt Constant..................',
    'ascii'
);

// BIP32 derivation path for VSS signing key (non-standard purpose to avoid collision)
const VSS_DERIVATION_PATH = "m/130'/0'";

/**
 * Derive a secp256k1 keypair from a BIP39 mnemonic for VSS authentication.
 */
export function deriveVssSigningKey(
    mnemonic: string,
    passphrase?: string
): { privateKey: Uint8Array; publicKey: Uint8Array } {
    const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase || '');
    const master = HDKey.fromMasterSeed(seed);
    const child = master.derive(VSS_DERIVATION_PATH);

    if (!child.privateKey || !child.publicKey) {
        throw new Error('Failed to derive VSS signing key');
    }

    return {
        privateKey: child.privateKey,
        publicKey: child.publicKey // 33-byte compressed
    };
}

/**
 * Generate the VSS Authorization header value.
 *
 * Format: hex(pubkey_33B) + hex(ecdsa_compact_sig_64B) + timestamp_decimal
 *
 * The header is valid for 24 hours (server-side tolerance window).
 */
export function generateVssAuthHeaders(
    mnemonic: string,
    passphrase?: string,
    precomputedKey?: { privateKey: Uint8Array; publicKey: Uint8Array }
): { authorization: string } {
    const { privateKey, publicKey } =
        precomputedKey ?? deriveVssSigningKey(mnemonic, passphrase);

    // Current UNIX timestamp as decimal string
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const timestampBytes = Buffer.from(timestamp, 'ascii');

    // Message: SHA256(SIGNING_CONSTANT || pubkey_bytes || timestamp_ascii)
    const hash = createHash('sha256');
    hash.update(SIGNING_CONSTANT);
    hash.update(Buffer.from(publicKey));
    hash.update(timestampBytes);
    const msgHash = new Uint8Array(hash.digest());

    // ECDSA sign (compact 64-byte r||s format)
    const sig = necc.signSync(msgHash, privateKey, { der: false });

    // Assemble: hex(pubkey) + hex(sig) + timestamp
    const pubKeyHex = Buffer.from(publicKey).toString('hex');
    const sigHex = Buffer.from(sig).toString('hex');

    return { authorization: pubKeyHex + sigHex + timestamp };
}
