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
});
