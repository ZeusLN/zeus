import { randomBytes } from 'react-native-randombytes';
import { httpStatusOf, isNodeResponse } from './PaymentLookupUtils';
import {
    isRequestTimeout,
    LookupOptions,
    lookUpWithRetries
} from './RequestTimeoutUtils';

// An on-chain send whose request failed may still have been broadcast:
// lnd keeps executing SendCoins after the client stops waiting (LNC's 60s
// request timer, the 30s REST timeout) or loses the connection. Each LND
// send therefore carries a unique label, so after such a failure the
// wallet's transactions can show whether it went out before anyone is
// offered a retry.

export const SEND_LABEL_PREFIX = 'ZEUS send ';

export const makeSendLabel = (): string =>
    `${SEND_LABEL_PREFIX}${randomBytes(8).toString('hex')}`;

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
            if (isNodeResponse(error)) return false;
            const status = httpStatusOf(error);
            return status === undefined || GATEWAY_STATUSES.includes(status);
        }
    }
};

// Looks for a sent transaction in the wallet's transactions. Resolves the
// txid, or undefined if the send was not found.
export const findSentTransaction = (
    getTransactions: () => Promise<any>,
    isSent: (tx: any) => boolean,
    options?: LookupOptions
): Promise<string | undefined> =>
    lookUpWithRetries(async () => {
        const result = await getTransactions();
        const match = (result?.transactions || []).find(
            (tx: any) => tx && isSent(tx)
        );
        return match?.tx_hash || undefined;
    }, options);
