import { encode as cborEncode, decode as cborDecode } from 'cborg';
import Base64Utils from './Base64Utils';

const CREQ_PREFIX = 'creq';
const CREQ_VERSION = 'A';

export interface CREQTransport {
    /** Transport type (e.g. 'nostr', 'post') */
    t: string;
    /** Target address/endpoint */
    a: string;
    /** Optional tags as [tag, value, ...] tuples */
    g?: string[][];
}

export interface CREQParams {
    /** Payment identifier */
    id?: string;
    /** Requested amount in smallest unit */
    amount?: number;
    /** Unit (e.g. 'sat', 'msat', 'usd') - required if amount is set */
    unit?: string;
    /** Single-use flag */
    singleUse?: boolean;
    /** Acceptable mint URLs */
    mints?: string[];
    /** Human-readable description */
    description?: string;
    /** Transport methods ordered by preference */
    transports?: CREQTransport[];
}

/**
 * Check if a string is a CREQ payment request (NUT-18).
 */
export function isCREQ(value: string): boolean {
    return value.startsWith(CREQ_PREFIX + CREQ_VERSION);
}

/**
 * Encode a Cashu payment request as a CREQ string (NUT-18).
 * Format: "creq" + "A" + base64url(CBOR(PaymentRequest))
 */
export function encodeCREQ(params: CREQParams): string {
    const map: Record<string, unknown> = {};

    if (params.id !== undefined) map.i = params.id;
    if (params.amount !== undefined) map.a = params.amount;
    if (params.unit !== undefined) map.u = params.unit;
    if (params.singleUse !== undefined) map.s = params.singleUse;
    if (params.mints !== undefined) map.m = params.mints;
    if (params.description !== undefined) map.d = params.description;
    if (params.transports !== undefined) {
        map.t = params.transports.map((tr) => {
            const tMap: Record<string, unknown> = { t: tr.t, a: tr.a };
            if (tr.g !== undefined) tMap.g = tr.g;
            return tMap;
        });
    }

    const cborBytes = cborEncode(map);
    const base64 = Base64Utils.bytesToBase64(cborBytes);
    const base64url = Base64Utils.base64ToBase64Url(base64);
    return CREQ_PREFIX + CREQ_VERSION + base64url;
}

/**
 * Decode a CREQ string into structured parameters (NUT-18).
 */
export function decodeCREQ(creq: string): CREQParams {
    if (!isCREQ(creq)) {
        throw new Error('Invalid CREQ: missing prefix');
    }

    const encoded = creq.slice(CREQ_PREFIX.length + CREQ_VERSION.length);
    const base64 = Base64Utils.base64UrlToBase64(encoded);
    const cborBytes = Base64Utils.base64ToBytes(base64);
    const map = cborDecode(cborBytes) as Record<string, unknown>;

    const params: CREQParams = {};

    if (map.i !== undefined) params.id = map.i as string;
    if (map.a !== undefined) params.amount = map.a as number;
    if (map.u !== undefined) params.unit = map.u as string;
    if (map.s !== undefined) params.singleUse = map.s as boolean;
    if (Array.isArray(map.m)) {
        params.mints = map.m.filter((m): m is string => typeof m === 'string');
    }
    if (map.d !== undefined) params.description = map.d as string;
    if (Array.isArray(map.t)) {
        params.transports = (map.t as any[]).map((tr) => ({
            t: tr.t as string,
            a: tr.a as string,
            ...(Array.isArray(tr.g) ? { g: tr.g as string[][] } : {})
        }));
    }

    return params;
}

/**
 * Find a mint from the user's wallets that can fulfill a CREQ payment.
 * Prefers mints listed in the CREQ, then the selected mint, then any with
 * sufficient balance.
 */
export function findCompatibleMint(
    creqParams: CREQParams,
    mintUrls: string[],
    mintBalances: { [key: string]: number },
    selectedMintUrl: string
): string | undefined {
    const amount = creqParams.amount || 0;

    if (creqParams.mints && creqParams.mints.length > 0) {
        for (const mint of creqParams.mints) {
            if (
                mintUrls.includes(mint) &&
                (mintBalances[mint] || 0) >= amount
            ) {
                return mint;
            }
        }
        return undefined;
    }

    if (selectedMintUrl && (mintBalances[selectedMintUrl] || 0) >= amount) {
        return selectedMintUrl;
    }

    return mintUrls.find((url) => (mintBalances[url] || 0) >= amount);
}

export default { isCREQ, encodeCREQ, decodeCREQ, findCompatibleMint };
