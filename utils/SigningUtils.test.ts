import { getCompressedPublicKeyHex, ecdsaSignDERHex } from './SigningUtils';

const h = (hex: string): Uint8Array => Buffer.from(hex, 'hex');

const VECTORS = [
    {
        privKey:
            'f8f8a2f43c8376ccb0871305060d7b27b0554d2cc72bccf41b2705608452f315',
        hash: 'b94f5374fce5edbc8e2a8697c15331677e6ebf0b000000000000000000000000',
        pubKey: '026e145ccef1033dea239875dd00dfb4fee6e3348b84985c92f103444683bae07b',
        derSig: '3045022100ecbcfa894bcfb39a95a9a421328ae2682a09ee7e6f630c62aeb5d83f63fd4a3a02201999312a89fff33817ee5c0399744476c85583d1ca8bd579e10ea47fe7a5ccb2'
    },
    {
        // privKey = 1 → pubKey is the secp256k1 generator point G
        // hash = SHA256("")
        privKey:
            '0000000000000000000000000000000000000000000000000000000000000001',
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        pubKey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
        derSig: '3044022077c8d336572f6f466055b5f70f433851f8f535f6c4fc71133a6cfd71079d03b702200ed9f5eb8aa5b266abac35d416c3207e7a538bf5f37649727d7a9823b1069577'
    }
];

const INVALID_KEYS = [
    { name: 'zero', key: new Uint8Array(32) },
    {
        name: 'curve order n',
        key: h(
            'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
        )
    }
];

describe('SigningUtils', () => {
    describe('getCompressedPublicKeyHex', () => {
        it.each(VECTORS)(
            'derives the correct compressed public key',
            ({ privKey, pubKey }) => {
                expect(getCompressedPublicKeyHex(h(privKey))).toBe(pubKey);
            }
        );

        it.each(INVALID_KEYS)(
            'throws on invalid private key ($name)',
            ({ key }) => {
                expect(() => getCompressedPublicKeyHex(key)).toThrow();
            }
        );
    });

    describe('ecdsaSignDERHex', () => {
        it.each(VECTORS)(
            'produces a correct DER-encoded signature',
            ({ privKey, hash, derSig }) => {
                expect(ecdsaSignDERHex(h(hash), h(privKey))).toBe(derSig);
            }
        );
    });
});
