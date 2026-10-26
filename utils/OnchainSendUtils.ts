import { randomBytes } from 'react-native-randombytes';
import { httpStatusOf, isNodeResponse } from './PaymentLookupUtils';

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

// A proxy in front of the node answers with one of these while the request
// may still be on its way to the node, or already done there
const GATEWAY_STATUSES = [502, 503, 504];

// gRPC codes the Go client reports when the connection or stream failed,
// rather than lnd answering (a broken stream can read as Internal, e.g.
// "unexpected EOF")
const LNC_TRANSPORT_CODES = [
    'Unavailable',
    'DeadlineExceeded',
    'Canceled',
    'Internal'
];

// The LNC client refuses these before anything goes out
const LNC_NOT_SENT =
    /^(RPC connection not ready|error getting client|rpc with name .* not found|param \w+ required)/;

// Native HTTP errors that only happen before the request is written: a
// refused connection, an unresolved host, no network, or a failed TLS
// handshake. Android passes OkHttp's exception message, iOS the
// NSURLSession error's localizedDescription. A connection lost after that
// ("unexpected end of stream", "The network connection was lost.") may
// still have delivered the request, and so may a timeout: Android reports
// connect and read timeouts alike as "The request timed out."
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
    /^The certificate for this server is invalid/
];

const notDelivered = (error: any): boolean => {
    const message = String(error?.message ?? error ?? '');
    return NOT_DELIVERED.some((pattern) => pattern.test(message));
};

// Whether a failed send or publish may still have reached the node, so the
// outcome is unknown and a retry could pay twice. Only an answer from the
// node itself, or a failure before the request went out, rules that out.
export const mayHaveBeenSent = (
    error: any,
    implementation?: string
): boolean => {
    if (isRequestTimeout(error)) return true;

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
            if (code) return LNC_TRANSPORT_CODES.includes(code);
            return !LNC_NOT_SENT.test(message);
        }
        // REST backends: lnd answers with a gRPC code in the body, and an
        // error response other than a gateway error came from the server.
        // No response at all means the connection failed.
        default: {
            if (isNodeResponse(error) || notDelivered(error)) return false;
            const status = httpStatusOf(error);
            return status === undefined || GATEWAY_STATUSES.includes(status);
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
