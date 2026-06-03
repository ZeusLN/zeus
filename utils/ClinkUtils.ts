import { bech32 } from '@scure/base';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import Bolt11Utils from './Bolt11Utils';
import {
    // @ts-ignore:next-line
    generatePrivateKey,
    // @ts-ignore:next-line
    getPublicKey,
    // @ts-ignore:next-line
    finishEvent,
    // @ts-ignore:next-line
    relayInit,
    // @ts-ignore:next-line
    verifySignature
} from 'nostr-tools';
import * as nip44 from '@nostr/tools/nip44';

// CLINK Offers — successor to LNURL-pay using Nostr as transport.
// Spec: https://github.com/shocknet/clink (specs/clink-offers.md)
// Bech32-encoded `noffer1...` string carrying a TLV payload that points
// at a Nostr pubkey + relay + offer id, optionally with pricing hints.

const NOFFER_PREFIX = 'noffer';
const BECH32_MAX_SIZE = 5000;

export const CLINK_KIND = 21001;
export const CLINK_VERSION = '1';
const DEFAULT_TIMEOUT_MS = 30_000;

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

export enum NofferErrorCode {
    InvalidOffer = 1,
    TemporaryFailure = 2,
    ExpiredOrMoved = 3,
    UnsupportedFeature = 4,
    InvalidAmount = 5
}

export interface NofferRequestParams {
    amountSats?: number;
    description?: string;
    payerData?: Record<string, any>;
    zap?: string;
    expiresInSeconds?: number;
}

export interface NofferSuccess {
    bolt11: string;
}

export interface NofferError {
    error: string;
    code?: NofferErrorCode;
    range?: { min: number; max: number };
    latest?: string;
}

export type NofferResponse = NofferSuccess | NofferError;

export const isNofferSuccess = (r: NofferResponse): r is NofferSuccess =>
    typeof (r as NofferSuccess).bolt11 === 'string';

// Structured error thrown from requestInvoiceFromNoffer so the view layer
// can map `code` to a localized string instead of surfacing English to
// users. `detail` carries additional context (e.g. relay rejection reason).
export type ClinkRequestErrorCode =
    | 'NO_RELAYS'
    | 'ONION_NOT_SUPPORTED'
    | 'RELAY_CONNECT_FAILED'
    | 'RELAY_REJECTED_PUBLISH'
    | 'TIMEOUT';

export class ClinkRequestError extends Error {
    code: ClinkRequestErrorCode;
    detail?: string;
    constructor(code: ClinkRequestErrorCode, detail?: string) {
        super(detail ? `${code}: ${detail}` : code);
        this.name = 'ClinkRequestError';
        this.code = code;
        this.detail = detail;
    }
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

    // Normalize an omitted TLV 3 (pricing type) to the spec-defined default
    // so downstream consumers see a single canonical type:
    //   - currency present -> Variable (spec: "If [currency] is present,
    //     pricing type 1 (Variable) MUST be used.")
    //   - neither price nor type present -> Spontaneous (spec: "If neither
    //     price (TLV 4) nor pricing type (TLV 3) is present, the offer SHOULD
    //     be treated as type 2 (Spontaneous payment).")
    //   - price present, type absent -> Fixed (not explicitly stated in spec;
    //     the only consistent reading since Variable requires currency and
    //     Spontaneous implies no price)
    if (result.priceType === undefined) {
        if (result.currency !== undefined) {
            result.priceType = NofferPriceType.Variable;
        } else if (result.price !== undefined) {
            result.priceType = NofferPriceType.Fixed;
        } else {
            result.priceType = NofferPriceType.Spontaneous;
        }
    }

    return result;
};

// Build the plaintext payload sent inside the NIP-44-encrypted content of
// the kind-21001 request event. Validates that the amount is present where
// the offer's pricing type requires one.
export const buildClinkRequestPayload = (
    noffer: NofferData,
    params: NofferRequestParams
): Record<string, any> => {
    if (
        (noffer.priceType === NofferPriceType.Spontaneous ||
            noffer.priceType === NofferPriceType.Variable) &&
        (!params.amountSats || params.amountSats <= 0)
    ) {
        throw new Error(
            `amount_sats required for noffer price type ${noffer.priceType}`
        );
    }

    const payload: Record<string, any> = { offer: noffer.offer };
    if (params.amountSats !== undefined) {
        payload.amount_sats = params.amountSats;
    }
    if (params.description !== undefined) {
        payload.description = params.description;
    }
    if (params.payerData !== undefined) {
        payload.payer_data = params.payerData;
    }
    if (params.zap !== undefined) {
        payload.zap = params.zap;
    }
    if (params.expiresInSeconds !== undefined) {
        payload.expires_in_seconds = params.expiresInSeconds;
    }
    return payload;
};

// Sanity-check that a service-returned invoice matches what the user
// asked for. Defends against a malicious or buggy CLINK service silently
// returning an invoice for the wrong amount. Returns null on success or a
// human-readable reason string on mismatch.
export const verifyBolt11MatchesOffer = (
    invoice: string,
    noffer: NofferData,
    requestedAmountSats?: number
): string | null => {
    let invoiceSats: number | null;
    try {
        const decoded = Bolt11Utils.decode(invoice);
        invoiceSats =
            typeof decoded?.satoshis === 'number' ? decoded.satoshis : null;
    } catch {
        return 'could not decode service invoice';
    }
    if (invoiceSats === null || invoiceSats === undefined) {
        // Invoice has no encoded amount — service expects the wallet to
        // choose one. Acceptable only for spontaneous offers; otherwise
        // it's a protocol violation.
        if (noffer.priceType === NofferPriceType.Spontaneous) return null;
        return 'service returned an amountless invoice';
    }
    if (noffer.priceType === NofferPriceType.Fixed && noffer.price) {
        if (invoiceSats !== noffer.price) {
            return `expected ${noffer.price} sats, invoice is for ${invoiceSats} sats`;
        }
        return null;
    }
    // For variable and spontaneous offers, compare against what the user
    // requested. (For variable offers with a currency the user requested
    // sats post-conversion, so a direct comparison is still appropriate.)
    if (requestedAmountSats !== undefined && requestedAmountSats > 0) {
        if (invoiceSats !== requestedAmountSats) {
            return `expected ${requestedAmountSats} sats, invoice is for ${invoiceSats} sats`;
        }
    }
    return null;
};

// Returns true only if the event is a structurally-valid CLINK response
// addressed to this request: correct kind, author = expected recipient,
// references our request id via `e` tag, and (if present) carries a
// compatible `clink_version` tag. Does NOT verify signature or decrypt
// content — those are separate steps in the request flow.
//
// Spec says services MUST include `clink_version` and clients SHOULD
// reject events lacking it. In practice the reference implementation
// (and others) omit it; we treat "missing" as "compatible" for interop
// (Postel's law), but reject events that present an explicit wrong
// version since that's a real incompatibility.
export const isValidClinkResponseEvent = (
    event: any,
    requestId: string,
    expectedRecipientPubkey: string
): boolean => {
    if (!event || event.kind !== CLINK_KIND) return false;
    if (event.pubkey !== expectedRecipientPubkey) return false;
    const tags: any[] = Array.isArray(event.tags) ? event.tags : [];
    const refsRequest = tags.some(
        (t) => Array.isArray(t) && t[0] === 'e' && t[1] === requestId
    );
    if (!refsRequest) return false;
    const versionTag = tags.find(
        (t) => Array.isArray(t) && t[0] === 'clink_version'
    );
    if (versionTag && versionTag[1] !== CLINK_VERSION) return false;
    return true;
};

const sendAndAwaitResponse = (opts: {
    relayUrl: string;
    event: any;
    payerPkHex: string;
    recipientPkHex: string;
    conversationKey: Uint8Array;
    timeoutMs: number;
}): Promise<NofferResponse> => {
    const {
        relayUrl,
        event,
        payerPkHex,
        recipientPkHex,
        conversationKey,
        timeoutMs
    } = opts;
    const log = (msg: string, extra?: any) =>
        extra !== undefined
            ? console.log(`[CLINK ${relayUrl}] ${msg}`, extra)
            : console.log(`[CLINK ${relayUrl}] ${msg}`);

    return new Promise((resolve, reject) => {
        const relay = relayInit(relayUrl);
        let resolved = false;
        let sub: any;
        let eventsSeen = 0;
        let eventsRejected = 0;
        const cleanup = () => {
            try {
                sub?.unsub();
            } catch {}
            try {
                relay.close();
            } catch {}
        };
        const timeout = setTimeout(() => {
            if (resolved) return;
            resolved = true;
            log(
                `request timed out after ${timeoutMs}ms (saw ${eventsSeen} events, rejected ${eventsRejected})`
            );
            cleanup();
            reject(new ClinkRequestError('TIMEOUT'));
        }, timeoutMs);

        relay.on('notice', (msg: string) => log('relay NOTICE:', msg));
        relay.on('error', () => log('relay error event fired'));
        relay.on('disconnect', () => log('relay disconnected'));

        log(`request id=${event.id} payer=${payerPkHex.slice(0, 8)}…`);

        relay
            .connect()
            .then(() => {
                log('connected');
                // Drop `#e` from the wire filter — some relays don't
                // pre-index it. Client-side check still enforces it
                // (isValidClinkResponseEvent). `since` is widened to 60s
                // to absorb clock skew between phone and relay.
                sub = relay.sub([
                    {
                        kinds: [CLINK_KIND],
                        '#p': [payerPkHex],
                        authors: [recipientPkHex],
                        since: Math.floor(Date.now() / 1000) - 60
                    }
                ]);
                log('subscribed', {
                    kind: CLINK_KIND,
                    p: payerPkHex,
                    author: recipientPkHex
                });

                sub.on('eose', () => log('relay sent EOSE'));

                sub.on('event', (ev: any) => {
                    if (resolved) return;
                    eventsSeen++;
                    if (
                        !isValidClinkResponseEvent(ev, event.id, recipientPkHex)
                    ) {
                        eventsRejected++;
                        log('event rejected (structural mismatch)', {
                            id: ev.id,
                            kind: ev.kind,
                            author: ev.pubkey,
                            tags: ev.tags
                        });
                        return;
                    }
                    const hasVersionTag = (
                        Array.isArray(ev.tags) ? ev.tags : []
                    ).some(
                        (t: any) => Array.isArray(t) && t[0] === 'clink_version'
                    );
                    if (!hasVersionTag) {
                        log(
                            'WARN: service response missing clink_version tag (spec violation, accepting for interop)'
                        );
                    }
                    let valid = false;
                    try {
                        valid = verifySignature(ev);
                    } catch (e) {
                        log('verifySignature threw:', e);
                    }
                    if (!valid) {
                        eventsRejected++;
                        log('event rejected (bad signature)', { id: ev.id });
                        return;
                    }
                    let plaintext: string;
                    try {
                        plaintext = nip44.decrypt(ev.content, conversationKey);
                    } catch (e) {
                        eventsRejected++;
                        log('event rejected (nip44 decrypt failed):', e);
                        return;
                    }
                    let parsed: NofferResponse;
                    try {
                        parsed = JSON.parse(plaintext);
                    } catch (e) {
                        eventsRejected++;
                        log('event rejected (plaintext not JSON):', e);
                        return;
                    }
                    log('response accepted', parsed);
                    resolved = true;
                    clearTimeout(timeout);
                    cleanup();
                    resolve(parsed);
                });

                // Publish AFTER subscribing so we don't miss a fast reply.
                // Await the publish so a relay-level rejection (OK false:
                // rate-limited / blocked / auth-required / etc.) surfaces
                // instead of silently timing out.
                relay.publish(event).then(
                    () => log('publish OK'),
                    (err: any) => {
                        log(
                            `publish REJECTED by relay: ${err?.message ?? err}`
                        );
                        if (resolved) return;
                        resolved = true;
                        clearTimeout(timeout);
                        cleanup();
                        reject(
                            new ClinkRequestError(
                                'RELAY_REJECTED_PUBLISH',
                                err?.message ?? String(err)
                            )
                        );
                    }
                );
            })
            .catch((e: any) => {
                log('connect failed:', e);
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                cleanup();
                reject(
                    new ClinkRequestError(
                        'RELAY_CONNECT_FAILED',
                        e?.message ?? (e ? String(e) : undefined)
                    )
                );
            });
    });
};

// Resolves to a CLINK response: either a success containing a bolt11
// invoice, or an error containing a code and human-readable message.
// Throws only on transport failure (no relay reachable / timeout).
export const requestInvoiceFromNoffer = async (
    noffer: NofferData,
    params: NofferRequestParams = {},
    options: {
        extraRelays?: string[];
        timeoutMs?: number;
    } = {}
): Promise<NofferResponse> => {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const relays = [noffer.relay, ...(options.extraRelays ?? [])].filter(
        (r, i, arr) => !!r && arr.indexOf(r) === i
    );
    if (relays.length === 0) {
        throw new ClinkRequestError('NO_RELAYS');
    }
    // WebSocket-over-Tor is not currently supported by the relay layer.
    // Refuse onion relays explicitly rather than silently leaking traffic.
    const onion = relays.find((r) => /\.onion(:\d+)?(\/|$)/i.test(r));
    if (onion) {
        throw new ClinkRequestError('ONION_NOT_SUPPORTED', onion);
    }

    const payload = buildClinkRequestPayload(noffer, params);

    // Ephemeral payer key per request (privacy: don't link to user identity)
    const payerSkHex = generatePrivateKey();
    const payerPkHex = getPublicKey(payerSkHex);
    const conversationKey = nip44.getConversationKey(
        hexToBytes(payerSkHex),
        noffer.pubkey
    );
    const encryptedContent = nip44.encrypt(
        JSON.stringify(payload),
        conversationKey
    );

    const event = finishEvent(
        {
            kind: CLINK_KIND,
            content: encryptedContent,
            tags: [
                ['p', noffer.pubkey],
                ['clink_version', CLINK_VERSION]
            ],
            created_at: Math.floor(Date.now() / 1000)
        },
        payerSkHex
    );

    let lastErr: unknown;
    for (const relayUrl of relays) {
        try {
            return await sendAndAwaitResponse({
                relayUrl,
                event,
                payerPkHex,
                recipientPkHex: noffer.pubkey,
                conversationKey,
                timeoutMs
            });
        } catch (e) {
            lastErr = e;
            console.warn(`CLINK request via ${relayUrl} failed:`, e);
        }
    }
    throw lastErr ?? new Error('CLINK request failed on all relays');
};

const ClinkUtils = {
    decodeNoffer,
    buildClinkRequestPayload,
    isValidClinkResponseEvent,
    requestInvoiceFromNoffer,
    isNofferSuccess,
    verifyBolt11MatchesOffer,
    ClinkRequestError,
    NofferPriceType,
    NofferErrorCode,
    CLINK_KIND,
    CLINK_VERSION
};

export default ClinkUtils;
