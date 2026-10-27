import { randomBytes } from 'react-native-randombytes';
import {
    hasJsonRpcCode,
    httpStatusOf,
    isNodeResponse,
    isRequestNotSent
} from './PaymentLookupUtils';

// An on-chain send whose request failed may still have been broadcast:
// lnd keeps executing SendCoins after the client stops waiting (LNC's 60s
// request timer, the 30s REST timeout) or loses the connection. Each LND
// send therefore carries a unique label, so after such a failure the
// wallet's transactions can show whether it went out before anyone is
// offered a retry.

export const SEND_LABEL_PREFIX = 'ZEUS send ';

export const makeSendLabel = (): string =>
    `${SEND_LABEL_PREFIX}${randomBytes(8).toString('hex')}`;

// lnc-rn's request timer rejects with "<method> timed out after <ms>ms",
// the REST backend with 'Request timeout', and the native HTTP clients
// report their own timeouts as "timed out" / "timeout"
export const isRequestTimeout = (error: any): boolean => {
    const message = String(error?.message ?? error ?? '');
    return /timed out|timeout/i.test(message);
};

// gRPC codes for a failed connection or stream rather than lnd's answer,
// by name (the LNC Go client's text) and by number (LND's REST gateway
// puts them in its own error bodies when it can't reach lnd: 503 with 14,
// 504 with 4). A broken stream can read as Internal, e.g. "unexpected
// EOF". lnd refuses a send with Unknown (2) or a validation code.
const TRANSPORT_GRPC_CODES: Array<string | number> = [
    'Canceled',
    'DeadlineExceeded',
    'Internal',
    'Unavailable',
    1,
    4,
    13,
    14
];

// The LNC client refuses these before anything goes out
const LNC_NOT_SENT =
    /^(RPC connection not ready|error getting client|rpc with name .* not found|param \w+ required)/;

// Native HTTP errors that only happen before the request is written: a
// refused connection, an unresolved host, no network, or a failed TLS
// handshake. Android passes OkHttp's exception message, iOS the
// NSURLSession error's localizedDescription, and the Tor path the
// nitro-tor error (reqwest and hyper underneath). A connection lost after
// that ("unexpected end of stream", "The network connection was lost.",
// "connection closed before message completed") may still have delivered
// the request, and so may a timeout: Android reports connect and read
// timeouts alike as "The request timed out."
const NOT_DELIVERED = [
    // Android
    /^Failed to connect to /,
    /^Unable to resolve host /,
    /Trust anchor for certification path not found/,
    /^Hostname .+ not verified/,
    /^Handshake failed/,
    /^Chain validation failed/,
    // iOS
    /^Could not connect to the server\./,
    /^A server with the specified hostname could not be found\./,
    /^The Internet connection appears to be offline\./,
    /^A TLS error caused the secure connection to fail\./,
    // older iOS
    /^An SSL error has occurred/,
    /^The certificate for this server is invalid/,
    // Tor: nitro-tor refuses before sending, and hyper reports a failed
    // connect (through the SOCKS proxy, or its TLS) as "error trying to
    // connect", e.g. "Request failed: error sending request for url (...):
    // error trying to connect: socks connect error: Host unreachable"
    /^Tor service not running/,
    /^Tor library not initialized/,
    /error trying to connect/
];

const notDelivered = (error: any): boolean => {
    if (isRequestNotSent(error)) return true;
    const message = String(error?.message ?? error ?? '');
    return NOT_DELIVERED.some((pattern) => pattern.test(message));
};

// Whether a failed send or publish may still have reached the node, so the
// outcome is unknown and a retry could pay twice. Only an answer from the
// node itself, a refusal, or a failure before the request went out rules
// that out.
export const mayHaveBeenSent = (
    error: any,
    implementation?: string
): boolean => {
    if (isRequestTimeout(error)) return true;
    if (notDelivered(error)) return false;

    switch (implementation) {
        // in-process: every rejection is the node's answer
        case 'embedded-lnd':
        case 'ldk-node':
            return false;
        // the Go client passes lnd's errors and its own as
        // "rpc error: code = <Code> desc = ..."
        case 'lightning-node-connect': {
            const message = String(error?.message ?? error ?? '');
            const code = /^rpc error: code = (\w+)/.exec(message)?.[1];
            if (code) return TRANSPORT_GRPC_CODES.includes(code);
            return !LNC_NOT_SENT.test(message);
        }
        // REST backends. lnd's own errors always carry a gRPC code, and
        // clnrest answers its own with a 500 and a JSON-RPC code. A 3xx or
        // 4xx is a refusal, from the node or a proxy. Any other 5xx (a
        // proxy's 502/503/504, Cloudflare's 520) or no response at all may
        // have come after the node acted.
        default: {
            if (isNodeResponse(error)) {
                return TRANSPORT_GRPC_CODES.includes((error as any).grpcCode);
            }
            const status = httpStatusOf(error);
            if (status === undefined) return true;
            if (status < 500) return false;
            return !(
                implementation === 'cln-rest' &&
                status === 500 &&
                hasJsonRpcCode(error)
            );
        }
    }
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Looks for a sent transaction in the wallet's transactions. Each lookup
// can fail on the same connection that timed out the send, so it retries a
// few times. Resolves the txid, or undefined if the send was not found.
export const findSentTransaction = async (
    getTransactions: () => Promise<any>,
    isSent: (tx: any) => boolean,
    {
        attempts = 3,
        delayMs = 5000
    }: { attempts?: number; delayMs?: number } = {}
): Promise<string | undefined> => {
    for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt > 0) await wait(delayMs);
        try {
            const result = await getTransactions();
            const match = (result?.transactions || []).find(
                (tx: any) => tx && isSent(tx)
            );
            if (match?.tx_hash) return match.tx_hash;
        } catch (error) {
            console.log('Error looking up a timed out send', error);
        }
    }
    return undefined;
};
