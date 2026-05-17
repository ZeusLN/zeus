import { bech32 } from '@scure/base';
import { bytesToHex } from '@noble/hashes/utils';

// CLINK Offers — successor to LNURL-pay using Nostr as transport.
// Spec: https://github.com/shocknet/clink (specs/clink-offers.md)
// Bech32-encoded `noffer1...` string carrying a TLV payload that points
// at a Nostr pubkey + relay + offer id, optionally with pricing hints.

const NOFFER_PREFIX = 'noffer';
const BECH32_MAX_SIZE = 5000;
const NOFFER_REGEX =
    /^(?:noffer1[02-9ac-hj-np-z]{6,}|NOFFER1[02-9AC-HJ-NP-Z]{6,})$/;

export enum NofferPriceType {
    Fixed = 0,
    Variable = 1,
    Spontaneous = 2
}

export interface NofferData {
    pubkey: string;
    relay: string;
    offer: string;
    priceType?: NofferPriceType;
    price?: number;
    currency?: string;
}

const utf8Decoder = new global.TextDecoder('utf-8');

const parseTLV = (data: Uint8Array): Record<number, Uint8Array[]> => {
    const result: Record<number, Uint8Array[]> = {};
    let rest = data;
    while (rest.length > 0) {
        const t = rest[0];
        const l = rest[1];
        if (l === undefined) throw new Error(`malformed TLV ${t}`);
        const v = rest.slice(2, 2 + l);
        rest = rest.slice(2 + l);
        if (v.length < l) {
            throw new Error(`not enough data to read on TLV ${t}`);
        }
        result[t] = result[t] || [];
        result[t].push(v);
    }
    return result;
};

const bytesToBigEndianInt = (bytes: Uint8Array): number => {
    let n = 0;
    for (let i = 0; i < bytes.length; i++) {
        n = n * 256 + bytes[i];
    }
    return n;
};

export const isValidNoffer = (input: string): boolean => {
    if (!input || !NOFFER_REGEX.test(input)) return false;
    try {
        decodeNoffer(input);
        return true;
    } catch {
        return false;
    }
};

export const decodeNoffer = (input: string): NofferData => {
    const lower = input.toLowerCase();
    const { prefix, words } = bech32.decode(
        lower as `${string}1${string}`,
        BECH32_MAX_SIZE
    );
    if (prefix !== NOFFER_PREFIX) {
        throw new Error(`expected noffer prefix, got ${prefix}`);
    }
    const data = new Uint8Array(bech32.fromWords(words));
    const tlv = parseTLV(data);

    if (!tlv[0]?.[0]) throw new Error('missing TLV 0 (pubkey) for noffer');
    if (tlv[0][0].length !== 32) {
        throw new Error('TLV 0 (pubkey) should be 32 bytes');
    }
    if (!tlv[1]?.[0]) throw new Error('missing TLV 1 (relay) for noffer');
    if (!tlv[2]?.[0]) throw new Error('missing TLV 2 (offer id) for noffer');

    const result: NofferData = {
        pubkey: bytesToHex(tlv[0][0]),
        relay: utf8Decoder.decode(tlv[1][0]),
        offer: utf8Decoder.decode(tlv[2][0])
    };

    if (tlv[3]?.[0] && tlv[3][0].length > 0) {
        const raw = bytesToBigEndianInt(tlv[3][0]);
        if (
            raw !== NofferPriceType.Fixed &&
            raw !== NofferPriceType.Variable &&
            raw !== NofferPriceType.Spontaneous
        ) {
            throw new Error(`unknown noffer price type ${raw}`);
        }
        result.priceType = raw as NofferPriceType;
    }

    if (tlv[4]?.[0] && tlv[4][0].length > 0) {
        result.price = bytesToBigEndianInt(tlv[4][0]);
    }

    if (tlv[5]?.[0] && tlv[5][0].length > 0) {
        result.currency = utf8Decoder.decode(tlv[5][0]);
    }

    return result;
};

const ClinkUtils = {
    isValidNoffer,
    decodeNoffer,
    NofferPriceType
};

export default ClinkUtils;
