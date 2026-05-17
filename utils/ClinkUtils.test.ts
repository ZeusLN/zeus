import { bech32 } from '@scure/base';
import { hexToBytes } from '@noble/hashes/utils';

import ClinkUtils, {
    decodeNoffer,
    isValidNoffer,
    NofferPriceType,
    buildClinkRequestPayload,
    isValidClinkResponseEvent,
    isNofferSuccess,
    verifyBolt11MatchesOffer,
    CLINK_KIND,
    CLINK_VERSION
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

    describe('buildClinkRequestPayload', () => {
        const baseNoffer = {
            pubkey,
            relay,
            offer: offerId
        };

        it('produces a minimal payload with just the offer id', () => {
            const payload = buildClinkRequestPayload(baseNoffer, {});
            expect(payload).toEqual({ offer: offerId });
        });

        it('includes all optional fields when provided', () => {
            const payload = buildClinkRequestPayload(baseNoffer, {
                amountSats: 1000,
                description: 'coffee',
                payerData: { name: 'satoshi' },
                zap: '{"kind":9734}',
                expiresInSeconds: 600
            });
            expect(payload).toEqual({
                offer: offerId,
                amount_sats: 1000,
                description: 'coffee',
                payer_data: { name: 'satoshi' },
                zap: '{"kind":9734}',
                expires_in_seconds: 600
            });
        });

        it('requires amount_sats for spontaneous offers', () => {
            expect(() =>
                buildClinkRequestPayload(
                    {
                        ...baseNoffer,
                        priceType: NofferPriceType.Spontaneous
                    },
                    {}
                )
            ).toThrow(/amount_sats required/);
        });

        it('requires amount_sats for variable offers', () => {
            expect(() =>
                buildClinkRequestPayload(
                    {
                        ...baseNoffer,
                        priceType: NofferPriceType.Variable
                    },
                    { amountSats: 0 }
                )
            ).toThrow(/amount_sats required/);
        });

        it('does not require amount_sats for fixed offers', () => {
            const payload = buildClinkRequestPayload(
                {
                    ...baseNoffer,
                    priceType: NofferPriceType.Fixed,
                    price: 5000
                },
                {}
            );
            expect(payload).toEqual({ offer: offerId });
        });
    });

    describe('isValidClinkResponseEvent', () => {
        const recipient = pubkey;
        const requestId =
            'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
        const baseEvent = {
            kind: CLINK_KIND,
            pubkey: recipient,
            tags: [
                ['p', 'payer-pubkey'],
                ['e', requestId],
                ['clink_version', CLINK_VERSION]
            ],
            content: 'encrypted'
        };

        it('accepts a structurally-valid response', () => {
            expect(
                isValidClinkResponseEvent(baseEvent, requestId, recipient)
            ).toBe(true);
        });

        it('rejects events of the wrong kind', () => {
            expect(
                isValidClinkResponseEvent(
                    { ...baseEvent, kind: 1 },
                    requestId,
                    recipient
                )
            ).toBe(false);
        });

        it('rejects events from a different author', () => {
            expect(
                isValidClinkResponseEvent(
                    { ...baseEvent, pubkey: 'someone-else' },
                    requestId,
                    recipient
                )
            ).toBe(false);
        });

        it('rejects events with no matching e tag', () => {
            expect(
                isValidClinkResponseEvent(
                    {
                        ...baseEvent,
                        tags: [
                            ['p', 'payer-pubkey'],
                            ['e', 'different-request-id'],
                            ['clink_version', CLINK_VERSION]
                        ]
                    },
                    requestId,
                    recipient
                )
            ).toBe(false);
        });

        it('rejects events missing the clink_version tag', () => {
            expect(
                isValidClinkResponseEvent(
                    {
                        ...baseEvent,
                        tags: [
                            ['p', 'payer-pubkey'],
                            ['e', requestId]
                        ]
                    },
                    requestId,
                    recipient
                )
            ).toBe(false);
        });

        it('rejects events with a mismatched clink_version value', () => {
            expect(
                isValidClinkResponseEvent(
                    {
                        ...baseEvent,
                        tags: [
                            ['p', 'payer-pubkey'],
                            ['e', requestId],
                            ['clink_version', '2']
                        ]
                    },
                    requestId,
                    recipient
                )
            ).toBe(false);
        });

        it('rejects malformed inputs', () => {
            expect(isValidClinkResponseEvent(null, requestId, recipient)).toBe(
                false
            );
            expect(
                isValidClinkResponseEvent(
                    { kind: CLINK_KIND, pubkey: recipient },
                    requestId,
                    recipient
                )
            ).toBe(false);
        });
    });

    describe('isNofferSuccess', () => {
        it('returns true for responses with a bolt11 string', () => {
            expect(isNofferSuccess({ bolt11: 'lnbc1...' })).toBe(true);
        });
        it('returns false for error responses', () => {
            expect(isNofferSuccess({ error: 'nope', code: 1 } as any)).toBe(
                false
            );
        });
    });

    describe('verifyBolt11MatchesOffer', () => {
        // Signed BOLT 11 test invoices (deterministic, generated via
        // bolt11.encode + bolt11.sign with a fixed key — see test setup).
        const invoice1000sat =
            'lnbc10u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq8w3jhxaqxqrrsscqpfy9rcdxqs6sg3stye42sr3wr046005zrpeccrk2yvjexau2fw6vfh3fplnwyvswc8474g8t9rprevl42a50mf6sxqx796hmztzfyq2tqqaggcpw';
        const invoiceAmountless =
            'lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq8w3jhxaqxqrrsscqpf8mshkzdw6gscgeqgwf8q54x27hyf6hrqtmqur5eud2umrsavmzmsk6skc3adk6y6wj3tngd6f0qzh4py0fg0n63kfjdr3ekgy62p9ecprf5yqg';

        const baseNoffer = {
            pubkey,
            relay,
            offer: offerId
        };

        it('accepts a matching invoice for a fixed-price offer', () => {
            const offer = {
                ...baseNoffer,
                priceType: NofferPriceType.Fixed,
                price: 1000
            };
            expect(verifyBolt11MatchesOffer(invoice1000sat, offer)).toBeNull();
        });

        it('rejects a mismatched invoice for a fixed-price offer', () => {
            const offer = {
                ...baseNoffer,
                priceType: NofferPriceType.Fixed,
                price: 5000
            };
            const reason = verifyBolt11MatchesOffer(invoice1000sat, offer);
            expect(reason).toMatch(/5000/);
            expect(reason).toMatch(/1000/);
        });

        it('accepts a matching invoice for a spontaneous offer', () => {
            const offer = {
                ...baseNoffer,
                priceType: NofferPriceType.Spontaneous
            };
            expect(
                verifyBolt11MatchesOffer(invoice1000sat, offer, 1000)
            ).toBeNull();
        });

        it('rejects a mismatched invoice for a spontaneous offer', () => {
            const offer = {
                ...baseNoffer,
                priceType: NofferPriceType.Spontaneous
            };
            const reason = verifyBolt11MatchesOffer(invoice1000sat, offer, 500);
            expect(reason).toMatch(/500/);
            expect(reason).toMatch(/1000/);
        });

        it('accepts a matching invoice for a variable offer', () => {
            const offer = {
                ...baseNoffer,
                priceType: NofferPriceType.Variable,
                price: 100,
                currency: 'USD'
            };
            expect(
                verifyBolt11MatchesOffer(invoice1000sat, offer, 1000)
            ).toBeNull();
        });

        it('accepts an amountless invoice for spontaneous offers', () => {
            const offer = {
                ...baseNoffer,
                priceType: NofferPriceType.Spontaneous
            };
            // Edge case: service returned a 0-amount invoice expecting wallet
            // to set it. Spec-compatible for spontaneous.
            expect(
                verifyBolt11MatchesOffer(invoiceAmountless, offer)
            ).toBeNull();
        });

        it('rejects an amountless invoice for non-spontaneous offers', () => {
            const offer = {
                ...baseNoffer,
                priceType: NofferPriceType.Fixed,
                price: 1000
            };
            expect(verifyBolt11MatchesOffer(invoiceAmountless, offer)).toMatch(
                /amountless/
            );
        });

        it('returns a friendly error on undecodable input', () => {
            const offer = {
                ...baseNoffer,
                priceType: NofferPriceType.Fixed,
                price: 1000
            };
            expect(verifyBolt11MatchesOffer('not-a-bolt11', offer)).toMatch(
                /decode/
            );
        });
    });

    describe('default export', () => {
        it('exposes the public API', () => {
            expect(typeof ClinkUtils.isValidNoffer).toBe('function');
            expect(typeof ClinkUtils.decodeNoffer).toBe('function');
            expect(typeof ClinkUtils.requestInvoiceFromNoffer).toBe('function');
            expect(typeof ClinkUtils.buildClinkRequestPayload).toBe('function');
            expect(typeof ClinkUtils.isValidClinkResponseEvent).toBe(
                'function'
            );
            expect(typeof ClinkUtils.isNofferSuccess).toBe('function');
            expect(typeof ClinkUtils.verifyBolt11MatchesOffer).toBe('function');
            expect(ClinkUtils.CLINK_KIND).toBe(21001);
            expect(ClinkUtils.CLINK_VERSION).toBe('1');
            expect(ClinkUtils.NofferPriceType).toBe(NofferPriceType);
        });
    });
});
