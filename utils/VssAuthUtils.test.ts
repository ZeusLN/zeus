// Test-env shim: jest's moduleNameMapper forces @scure/bip32 to resolve
// @noble/hashes/_assert to the top-level package (1.7.x, exports `abytes`),
// while Metro/production resolves to the nested package (1.3.x, exports `bytes`).
// Alias `bytes` -> `abytes` so HDKey.fromMasterSeed works under jest.
const assertMod = require('@noble/hashes/_assert');
if (!assertMod.bytes && assertMod.abytes) {
    assertMod.bytes = assertMod.abytes;
}

import {
    deriveVssSigningKey,
    deriveVssSigningKeyFromSeed
} from './VssAuthUtils';

const h = (hex: string): Buffer => Buffer.from(hex, 'hex');
const toHex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

// Vectors captured against bip39@3.1.0. These hex values pin the cryptographic
// contract of deriveVssSigningKey at BIP-32 path m/130'/0' — they MUST remain
// stable across any BIP-39 library swap, or existing VSS auth keys will break.
const MNEMONIC_VECTORS = [
    {
        label: '12-word, no passphrase',
        mnemonic:
            'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        passphrase: undefined,
        privateKey:
            '9801f798e40abfb99ed5a060783cbb7909d9fe24471cd2892ac567165c848abd',
        publicKey:
            '036cfad5b223bae7981eed0548ef85908f8ad38817cc055d8b7ee8967902273842'
    },
    {
        label: '12-word, with passphrase',
        mnemonic:
            'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        passphrase: 'zeus',
        privateKey:
            'ab4790704a670ac84f2cfed7292e97ba1fc4fe969a9c46a2c5e645c91ab576a2',
        publicKey:
            '02886c66ac8d238f829b713840875221a1b7ca8b350bdfb010bfbca61a2995f0f4'
    },
    {
        label: '24-word, no passphrase',
        mnemonic:
            'legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title',
        passphrase: undefined,
        privateKey:
            '6b7235c5d2a78e75840e34361849c4ebba33ec9ed58a870733266dff1ec195b7',
        publicKey:
            '029a9d539683ae9836658377f61babc3d5ba99870df7ecca3c5e3a77e388b9d7bc'
    }
];

// BIP-39 published seed for "abandon abandon ... about" with empty passphrase.
// https://github.com/trezor/python-mnemonic/blob/master/vectors.json
const ABANDON_SEED_HEX =
    '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4';

describe('VssAuthUtils', () => {
    describe('deriveVssSigningKey', () => {
        it.each(MNEMONIC_VECTORS)(
            'derives the expected keypair ($label)',
            ({ mnemonic, passphrase, privateKey, publicKey }) => {
                const result = deriveVssSigningKey(mnemonic, passphrase);
                expect(toHex(result.privateKey)).toBe(privateKey);
                expect(toHex(result.publicKey)).toBe(publicKey);
                expect(result.publicKey).toHaveLength(33);
            }
        );

        it('treats undefined and empty-string passphrase as equivalent', () => {
            const { mnemonic } = MNEMONIC_VECTORS[0];
            const a = deriveVssSigningKey(mnemonic);
            const b = deriveVssSigningKey(mnemonic, '');
            expect(toHex(a.privateKey)).toBe(toHex(b.privateKey));
            expect(toHex(a.publicKey)).toBe(toHex(b.publicKey));
        });
    });

    describe('deriveVssSigningKeyFromSeed', () => {
        it('derives the same keypair as deriveVssSigningKey for the abandon vector', () => {
            // Seed-only path used by LdkNodeUtils with native PBKDF2.
            const seedPath = deriveVssSigningKeyFromSeed(h(ABANDON_SEED_HEX));
            const expected = MNEMONIC_VECTORS[0];
            expect(toHex(seedPath.privateKey)).toBe(expected.privateKey);
            expect(toHex(seedPath.publicKey)).toBe(expected.publicKey);
        });
    });
});
