import { bech32 } from '@scure/base';
import { hexToBytes } from '@noble/hashes/utils';

import ClinkUtils, {
    decodeNoffer,
    isValidNoffer,
    NofferPriceType
} from './ClinkUtils';

const utf8Encoder = new global.TextEncoder();

const encodeTLV = (tlv: Record<number, Uint8Array[]>): Uint8Array => {
    const parts: number[] = [];
    for (const [type, values] of Object.entries(tlv)) {
        const t = Number(type);
        for (const v of values) {
            parts.push(t, v.length, ...v);
        }
    }
    return new Uint8Array(parts);
};

const buildNoffer = (params: {
    pubkey: string;
    relay: string;
    offer: string;
    priceType?: number;
    price?: number;
    currency?: string;
}): string => {
    const tlv: Record<number, Uint8Array[]> = {
        0: [hexToBytes(params.pubkey)],
        1: [utf8Encoder.encode(params.relay)],
        2: [utf8Encoder.encode(params.offer)]
    };
    if (params.priceType !== undefined) {
        tlv[3] = [new Uint8Array([params.priceType])];
    }
    if (params.price !== undefined) {
        const bytes: number[] = [];
        let n = params.price;
        if (n === 0) {
            bytes.push(0);
        } else {
            while (n > 0) {
                bytes.unshift(n & 0xff);
                n = Math.floor(n / 256);
            }
        }
        tlv[4] = [new Uint8Array(bytes)];
    }
    if (params.currency !== undefined) {
        tlv[5] = [utf8Encoder.encode(params.currency)];
    }
    const data = encodeTLV(tlv);
    const words = bech32.toWords(data);
    return bech32.encode('noffer', words, 5000);
};

describe('ClinkUtils', () => {
    const pubkey =
        '79f00d3f5a19ec806189fcab03c1be4ff81d18ee4f653c88fac41fe03570f432';
    const relay = 'wss://relay.shockwallet.app';
    const offerId = 'coffee';

    describe('isValidNoffer', () => {
        it('accepts a well-formed noffer string', () => {
            const noffer = buildNoffer({ pubkey, relay, offer: offerId });
            expect(isValidNoffer(noffer)).toBe(true);
        });

        it('accepts uppercase noffer strings', () => {
            const noffer = buildNoffer({
                pubkey,
                relay,
                offer: offerId
            }).toUpperCase();
            expect(isValidNoffer(noffer)).toBe(true);
        });

        it('rejects empty input', () => {
            expect(isValidNoffer('')).toBe(false);
        });

        it('rejects strings with wrong prefix', () => {
            expect(isValidNoffer('noffe1abcdefghij')).toBe(false);
            expect(
                isValidNoffer(
                    'lno1pgx7mn5wfshymjpvf68xemtv4eqgcrsdac8q6tdvf5hgwf38yuq'
                )
            ).toBe(false);
            expect(
                isValidNoffer(
                    'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg'
                )
            ).toBe(false);
        });

        it('rejects strings with invalid bech32 charset', () => {
            expect(isValidNoffer('noffer1!!!!!!!')).toBe(false);
        });

        it('rejects strings with invalid bech32 checksum', () => {
            const good = buildNoffer({ pubkey, relay, offer: offerId });
            const tampered =
                good.slice(0, -1) + (good.endsWith('q') ? 'p' : 'q');
            expect(isValidNoffer(tampered)).toBe(false);
        });

        it('rejects noffer missing required TLVs', () => {
            const data = new Uint8Array([0, 32, ...hexToBytes(pubkey)]);
            const incomplete = bech32.encode(
                'noffer',
                bech32.toWords(data),
                5000
            );
            expect(isValidNoffer(incomplete)).toBe(false);
        });
    });

    describe('decodeNoffer', () => {
        it('decodes pubkey, relay, and offer id (required TLVs)', () => {
            const noffer = buildNoffer({ pubkey, relay, offer: offerId });
            const decoded = decodeNoffer(noffer);
            expect(decoded.pubkey).toBe(pubkey);
            expect(decoded.relay).toBe(relay);
            expect(decoded.offer).toBe(offerId);
            expect(decoded.priceType).toBeUndefined();
            expect(decoded.price).toBeUndefined();
            expect(decoded.currency).toBeUndefined();
        });

        it('decodes fixed-amount offers', () => {
            const noffer = buildNoffer({
                pubkey,
                relay,
                offer: offerId,
                priceType: NofferPriceType.Fixed,
                price: 5000
            });
            const decoded = decodeNoffer(noffer);
            expect(decoded.priceType).toBe(NofferPriceType.Fixed);
            expect(decoded.price).toBe(5000);
        });

        it('decodes variable-currency offers', () => {
            const noffer = buildNoffer({
                pubkey,
                relay,
                offer: offerId,
                priceType: NofferPriceType.Variable,
                price: 250,
                currency: 'USD'
            });
            const decoded = decodeNoffer(noffer);
            expect(decoded.priceType).toBe(NofferPriceType.Variable);
            expect(decoded.price).toBe(250);
            expect(decoded.currency).toBe('USD');
        });

        it('decodes spontaneous offers', () => {
            const noffer = buildNoffer({
                pubkey,
                relay,
                offer: offerId,
                priceType: NofferPriceType.Spontaneous
            });
            const decoded = decodeNoffer(noffer);
            expect(decoded.priceType).toBe(NofferPriceType.Spontaneous);
        });

        it('decodes large prices spanning multiple bytes', () => {
            const noffer = buildNoffer({
                pubkey,
                relay,
                offer: offerId,
                priceType: NofferPriceType.Fixed,
                price: 21_000_000
            });
            const decoded = decodeNoffer(noffer);
            expect(decoded.price).toBe(21_000_000);
        });

        it('accepts uppercase input', () => {
            const noffer = buildNoffer({ pubkey, relay, offer: offerId });
            const decoded = decodeNoffer(noffer.toUpperCase());
            expect(decoded.pubkey).toBe(pubkey);
        });

        it('throws if pubkey TLV is missing', () => {
            const data = encodeTLV({
                1: [utf8Encoder.encode(relay)],
                2: [utf8Encoder.encode(offerId)]
            });
            const noffer = bech32.encode('noffer', bech32.toWords(data), 5000);
            expect(() => decodeNoffer(noffer)).toThrow(/TLV 0/);
        });

        it('throws on unknown price type', () => {
            const noffer = buildNoffer({
                pubkey,
                relay,
                offer: offerId,
                priceType: 99
            });
            expect(() => decodeNoffer(noffer)).toThrow(/price type/);
        });

        it('throws on non-noffer bech32 prefix', () => {
            const data = new Uint8Array([0, 32, ...hexToBytes(pubkey)]);
            const encoded = bech32.encode(
                'npub',
                bech32.toWords(hexToBytes(pubkey)),
                5000
            );
            expect(() => decodeNoffer(encoded)).toThrow(/prefix/);
            expect(data).toBeDefined();
        });
    });

    describe('default export', () => {
        it('exposes isValidNoffer and decodeNoffer', () => {
            expect(typeof ClinkUtils.isValidNoffer).toBe('function');
            expect(typeof ClinkUtils.decodeNoffer).toBe('function');
            expect(ClinkUtils.NofferPriceType).toBe(NofferPriceType);
        });
    });
});
