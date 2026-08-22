import BIP32Factory from 'bip32';
import ecc from '../zeus_modules/noble_ecc';

import { BIP39_WORD_LIST } from './Bip39Utils';

// You must wrap a tiny-secp256k1 compatible implementation
const bip32 = BIP32Factory(ecc);

const aez = require('aez');
const crc32 = require('fast-crc32c/impls/js_crc32c');
const scrypt = require('scrypt-js').scrypt;

const AEZEED_DEFAULT_PASSPHRASE = 'aezeed',
    AEZEED_VERSION = 0,
    SCRYPT_N = 32768,
    SCRYPT_R = 8,
    SCRYPT_P = 1,
    SCRYPT_KEY_LENGTH = 32,
    ENCIPHERED_LENGTH = 33,
    SALT_LENGTH = 5,
    AD_LENGTH = SALT_LENGTH + 1,
    AEZ_TAU = 4,
    CHECKSUM_LENGTH = 4,
    CHECKSUM_OFFSET = ENCIPHERED_LENGTH - CHECKSUM_LENGTH,
    SALT_OFFSET = CHECKSUM_OFFSET - SALT_LENGTH;

function lpad(str: string, padString: string, length: number) {
    while (str.length < length) {
        str = padString + str;
    }
    return str;
}

function getAD(salt: Buffer) {
    const ad = Buffer.alloc(AD_LENGTH, AEZEED_VERSION);
    salt.copy(ad, 1);
    return ad;
}

function seedBytesFromWords(seedPhrase: string[]): Buffer {
    const bits = seedPhrase
        .map((word: string) => {
            const index = BIP39_WORD_LIST.indexOf(word);
            return lpad(index.toString(2), '0', 11);
        })
        .join('');

    const seedBytes = (bits.match(/(.{1,8})/g) || []).map((bin: string) =>
        parseInt(bin, 2)
    );
    return Buffer.from(seedBytes);
}

/**
 * Validates an aezeed mnemonic's version byte and CRC32 checksum without
 * paying the scrypt cost of a full decipher. Throws when the mnemonic is
 * not a valid aezeed.
 */
export function validateAezeedChecksum(seedPhrase: string[]): void {
    const seed = seedBytesFromWords(seedPhrase);

    if (!seed || seed.length === 0 || seed[0] !== AEZEED_VERSION) {
        throw new Error('Invalid seed or version!');
    }

    const checksum = seed.slice(CHECKSUM_OFFSET);
    const newChecksum = crc32.calculate(seed.slice(0, CHECKSUM_OFFSET));
    if (newChecksum !== checksum.readUInt32BE(0)) {
        throw new Error('Invalid seed checksum!');
    }
}

/**
 * Decrypts an aezeed cipher seed mnemonic (with the default passphrase) and
 * returns the 16 bytes of wallet entropy, which lnd uses directly as the
 * BIP32 master seed. Throws when the mnemonic is not a valid aezeed or was
 * enciphered with a non-default passphrase.
 */
export async function decodeAezeedEntropy(
    seedPhrase: string[]
): Promise<Buffer> {
    validateAezeedChecksum(seedPhrase);

    const seed = seedBytesFromWords(seedPhrase);
    const salt = seed.slice(SALT_OFFSET, SALT_OFFSET + SALT_LENGTH);
    const password = Buffer.from(AEZEED_DEFAULT_PASSPHRASE, 'utf8');
    const cipherSeed = seed.slice(1, SALT_OFFSET);

    const key = await scrypt(
        password,
        salt,
        SCRYPT_N,
        SCRYPT_R,
        SCRYPT_P,
        SCRYPT_KEY_LENGTH
    );

    const plainSeedBytes = aez.decrypt(
        key,
        null,
        [getAD(salt)],
        AEZ_TAU,
        cipherSeed
    );

    if (plainSeedBytes == null) {
        throw new Error('Decryption failed. Invalid passphrase?');
    }

    // plaintext layout: internal version (1) + birthday (2) + entropy (16)
    return plainSeedBytes.slice(3);
}

/**
 * Derives the lnd node identity pubkey (hex-encoded, compressed) from wallet
 * entropy: BIP32 master -> m/1017'/coinType'/6'/0/0 (purpose 1017, key
 * family 6 = node key). Coin type is 0 on mainnet and 1 on every other
 * network: btcd's HDCoinType is 1 for testnet, signet (mutinynet), and
 * regtest alike.
 */
export function deriveNodeIdFromEntropy(
    entropy: Buffer,
    nonMainnet: boolean
): string {
    const coinType = nonMainnet ? 1 : 0;
    return bip32
        .fromSeed(entropy)
        .derivePath(`m/1017'/${coinType}'/6'/0/0`)
        .publicKey.toString('hex');
}

/**
 * Derives an embedded LND wallet's node identity pubkey straight from its
 * aezeed mnemonic. This is what NodeInfoStore reports as nodeId once the
 * node is running, but computed offline, so key material namespaced by
 * pubkey can be located after the wallet config is all that remains.
 */
export async function deriveEmbeddedNodeId(
    seedPhrase: string[],
    nonMainnet: boolean
): Promise<string> {
    const entropy = await decodeAezeedEntropy(seedPhrase);
    return deriveNodeIdFromEntropy(entropy, nonMainnet);
}
