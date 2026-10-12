import ecc from '../zeus_modules/noble_ecc';

describe('noble_ecc', () => {
    describe('signSchnorr', () => {
        const hash = Buffer.alloc(32, 0x01);
        const privateKey = Buffer.alloc(32, 0x02);
        const xOnlyPubkey = Buffer.from(
            ecc.pointFromScalar(privateKey, true)!.slice(1)
        );

        it('uses fresh BIP340 aux randomness by default', () => {
            const sig1 = ecc.signSchnorr!(hash, privateKey);
            const sig2 = ecc.signSchnorr!(hash, privateKey);
            expect(Buffer.from(sig1).equals(Buffer.from(sig2))).toBe(false);
        });

        it('produces valid signatures under the default aux randomness', () => {
            const sig = ecc.signSchnorr!(hash, privateKey);
            expect(ecc.verifySchnorr!(hash, xOnlyPubkey, sig)).toBe(true);
        });

        it('is deterministic when explicit aux data is supplied', () => {
            const aux = Buffer.alloc(32, 0x03);
            const sig1 = ecc.signSchnorr!(hash, privateKey, aux);
            const sig2 = ecc.signSchnorr!(hash, privateKey, aux);
            expect(Buffer.from(sig1).equals(Buffer.from(sig2))).toBe(true);
            expect(ecc.verifySchnorr!(hash, xOnlyPubkey, sig1)).toBe(true);
        });
    });

    describe('sign', () => {
        it('produces deterministic RFC6979 signatures without extraEntropy', () => {
            const hash = Buffer.alloc(32, 0x01);
            const privateKey = Buffer.alloc(32, 0x02);
            const sig1 = ecc.sign(hash, privateKey);
            const sig2 = ecc.sign(hash, privateKey);
            expect(Buffer.from(sig1).equals(Buffer.from(sig2))).toBe(true);
        });
    });

    describe('privateAdd', () => {
        const one = Buffer.alloc(32);
        one[31] = 1;
        const zero = Buffer.alloc(32);
        // n - 1, the largest valid private key
        const nMinusOne = Buffer.from(
            'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
            'hex'
        );

        it('returns the key unchanged for a zero tweak', () => {
            const result = ecc.privateAdd(one, zero);
            expect(result).not.toBeNull();
            expect(Buffer.from(result!).equals(one)).toBe(true);
        });

        it('returns null when the sum is zero', () => {
            expect(ecc.privateAdd(nMinusOne, one)).toBeNull();
        });

        it('returns null for an invalid private key with a zero tweak', () => {
            expect(ecc.privateAdd(zero, zero)).toBeNull();
        });

        it('adds a non-zero tweak', () => {
            const two = Buffer.alloc(32);
            two[31] = 2;
            expect(Buffer.from(ecc.privateAdd(one, one)!).equals(two)).toBe(
                true
            );
        });
    });

    it('passes the ecpair self-test', () => {
        const { ECPairFactory } = require('ecpair');
        expect(() => ECPairFactory(ecc)).not.toThrow();
    });
});
