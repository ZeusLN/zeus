import { randomBytes } from 'react-native-randombytes';

// An on-chain send whose request timed out may still have been broadcast:
// lnd keeps executing SendCoins after the client stops waiting (LNC's 60s
// request timer, the 30s REST timeout). Each LND send therefore carries a
// unique label, so after a timeout the wallet's transactions can show
// whether it went out before anyone is offered a retry.

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

// Transport errors for a connection that dropped after the request may
// have reached the node: RN fetch, iOS URL sessions, OkHttp via
// ReactNativeBlobUtil (including a response body cut off mid-read), grpc-go
// under LNC, and hyper/reqwest under Tor. Failures to connect at all
// (refused, unresolved host) are left out, as nothing was sent.
const DROPPED_CONNECTION =
    /network request failed|network connection was lost|connection reset|econnreset|broken pipe|epipe|connection abort|socket closed|unexpected end of stream|stream was reset|failed to encode response data|transport is closing|error reading from server|client connection is closing|connection closed before message completed|error sending request|failed to read response body/i;

// Whether a failed send may still have gone out, so it must not be offered
// for a retry: a timeout or a dropped connection, as opposed to the node
// rejecting the send
export const isOutcomeUnknownError = (error: any): boolean => {
    if (isRequestTimeout(error)) return true;
    const message = String(error?.message ?? error ?? '');
    return DROPPED_CONNECTION.test(message);
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
