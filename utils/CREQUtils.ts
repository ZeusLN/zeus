import { encode as cborEncode } from 'cborg';
import CashuDevKit from '../cashu-cdk';
import Base64Utils from './Base64Utils';

const CREQ_A_PREFIX = 'creqA';
// NUT-26 bech32m human-readable part plus separator
const CREQ_B_PREFIX = 'creqb1';

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
 * Check if a string is a Cashu payment request: NUT-18 (creqA, base64url
 * so case-sensitive) or NUT-26 (creqb, bech32m so any case).
 */
export function isCREQ(value: string): boolean {
    return (
        value.startsWith(CREQ_A_PREFIX) ||
        value.toLowerCase().startsWith(CREQ_B_PREFIX)
    );
}

/**
 * Encode a Cashu payment request as a CREQ string (NUT-18).
 * Format: "creqA" + base64url(CBOR(PaymentRequest))
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
    return CREQ_A_PREFIX + base64url;
}

/**
 * Decode a creqA or creqb payment request with CDK.
 */
export async function decodeCREQ(creq: string): Promise<CREQParams> {
    if (!isCREQ(creq)) {
        throw new Error('Invalid CREQ: missing prefix');
    }

    const request = await CashuDevKit.decodePaymentRequest(creq);

    const params: CREQParams = {};
    if (request.payment_id !== undefined) params.id = request.payment_id;
    if (request.amount !== undefined) params.amount = request.amount;
    if (request.unit !== undefined) params.unit = request.unit;
    if (request.single_use !== undefined) params.singleUse = request.single_use;
    if (request.description !== undefined)
        params.description = request.description;
    if (request.mints?.length) params.mints = request.mints;
    if (request.transports?.length) {
        params.transports = request.transports.map((tr) => ({
            t: tr.type,
            a: tr.target,
            ...(tr.tags?.length ? { g: tr.tags } : {})
        }));
    }

    return params;
}

/**
 * Locale key of the reason ZEUS can't pay this request, if any. Only
 * whole-sat amounts in 'sat' are paid: the amount is in the request's unit,
 * so paying an msat or fiat request as sats would send the wrong amount.
 */
export function creqPaymentError(creqParams: CREQParams): string | undefined {
    const { amount, unit } = creqParams;
    if (!amount || !Number.isInteger(amount) || amount <= 0) {
        return 'views.Cashu.CREQPayment.noAmount';
    }
    if (unit?.toLowerCase() !== 'sat') {
        return 'views.Cashu.CREQPayment.unsupportedUnit';
    }
    return undefined;
}

/**
 * Comparison key for mint URLs: no trailing slash, scheme and host lowercased
 * (CDK canonicalizes those), path left case-sensitive.
 */
export function mintUrlKey(url: string): string {
    return url
        .trim()
        .replace(/\/+$/, '')
        .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, (schemeAndHost) =>
            schemeAndHost.toLowerCase()
        );
}

/**
 * Find a mint from the user's wallets that can fulfill a CREQ payment.
 * If the CREQ lists mints, only those are used, in the CREQ's order.
 * Otherwise prefers the selected mint, then any with sufficient balance.
 * Returns the URL as the wallet spells it.
 */
export function findCompatibleMint(
    creqParams: CREQParams,
    mintUrls: string[],
    mintBalances: { [key: string]: number },
    selectedMintUrl: string
): string | undefined {
    const amount = creqParams.amount || 0;
    const balance = (url: string) =>
        mintBalances[url] ?? mintBalances[url.replace(/\/+$/, '')] ?? 0;
    const walletMint = (url: string) =>
        mintUrls.find((walletUrl) => mintUrlKey(walletUrl) === mintUrlKey(url));

    if (creqParams.mints && creqParams.mints.length > 0) {
        for (const mint of creqParams.mints) {
            const url = walletMint(mint);
            if (url && balance(url) >= amount) return url;
        }
        return undefined;
    }

    if (selectedMintUrl && balance(selectedMintUrl) >= amount) {
        return selectedMintUrl;
    }

    return mintUrls.find((url) => balance(url) >= amount);
}

/**
 * Whether two decoded payment requests ask for the same payment: the same
 * id if either has one, otherwise the same mints. The amount and unit must
 * match either way. Compares decoded fields, since one request can be
 * encoded as creqA or creqb.
 */
export function sameRequest(a: CREQParams, b: CREQParams): boolean {
    if (a.amount !== b.amount) return false;
    if ((a.unit || '').toLowerCase() !== (b.unit || '').toLowerCase()) {
        return false;
    }
    if (a.id || b.id) return a.id === b.id;
    const mints = (p: CREQParams) =>
        [...new Set((p.mints || []).map(mintUrlKey))].sort().join(' ');
    return mints(a) === mints(b);
}

/**
 * Locale key of the reason a token written back by a payer doesn't settle
 * the request ZEUS broadcast, if any.
 */
export function tokenRequestMismatch(
    token: { value: number; mint_url: string; unit?: string },
    request: { amount: number; mintUrl?: string }
): string | undefined {
    if ((token.unit || 'sat').toLowerCase() !== 'sat') {
        return 'views.Cashu.CREQPayment.unsupportedUnit';
    }
    if (
        request.mintUrl &&
        mintUrlKey(token.mint_url) !== mintUrlKey(request.mintUrl)
    ) {
        return 'views.Cashu.ReceiveEcash.creqWrongMint';
    }
    if (token.value < request.amount) {
        return 'views.Cashu.ReceiveEcash.creqUnderpaid';
    }
    return undefined;
}

export default {
    isCREQ,
    encodeCREQ,
    decodeCREQ,
    creqPaymentError,
    mintUrlKey,
    findCompatibleMint,
    sameRequest,
    tokenRequestMismatch
};
