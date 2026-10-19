// page size for lookupPayment's ListPayments scans
export const PAYMENT_LOOKUP_PAGE_SIZE = 50;

const INCONCLUSIVE_ERROR_NAME = 'PaymentLookupInconclusive';

// A scan that could have missed the payment (a full page with no match)
// can't answer "the node has no record". lookupPayment rejects with this
// instead of resolving null, so callers treat it as unobserved rather than
// as proof the payment never reached the node. Tagged by name rather than
// by subclass because instanceof on Error subclasses is unreliable under
// Babel's class transform.
export const paymentLookupInconclusiveError = () => {
    const error = new Error(
        'Payment lookup inconclusive: the scanned payment pages were full'
    );
    error.name = INCONCLUSIVE_ERROR_NAME;
    return error;
};

export const isPaymentLookupInconclusive = (error: unknown): boolean =>
    (error as Error)?.name === INCONCLUSIVE_ERROR_NAME;

// A send request rejected by the node itself (a gRPC error from LND's REST
// gateway, or an in-process call on embedded LND) was processed, not left in transit. LND
// records a payment before dispatching any HTLC, so after such a rejection
// one lookup finding no record shows the payment was never sent; a
// transport failure (timeout, dropped connection) needs repeated answers
// because the request may still reach the node. String rejections are
// wrapped so they can carry the tag. `grpcCode` is the gRPC status code of
// the rejection when known (numeric over REST, the code name on embedded
// LND).
export const markNodeResponded = (
    error: unknown,
    grpcCode?: unknown
): unknown => {
    const tagged = typeof error === 'string' ? new Error(error) : error;
    if (tagged && typeof tagged === 'object') {
        (tagged as any).nodeResponded = true;
        if (grpcCode !== undefined && grpcCode !== null) {
            (tagged as any).grpcCode = grpcCode;
        }
    }
    return tagged;
};

export const isNodeResponse = (error: unknown): boolean =>
    (error as any)?.nodeResponded === true;

// The gRPC status code in an LND REST error body: grpc-gateway puts it at
// `code` for unary calls and at `error.code` in a stream's error chunk
export const grpcErrorCode = (body: unknown): unknown => {
    if (!body || typeof body !== 'object') return undefined;
    const { code, error } = body as any;
    if (error && typeof error === 'object' && error.code !== undefined) {
        return error.code;
    }
    return code;
};

// Tags an LND REST error status as the node's answer only when the body
// carries a gRPC status code. LND's REST gateway puts one in every error it
// returns. A reverse proxy in front of LND (nginx, envoy, Cloudflare)
// answers 502/503/504 with its own body and no code, while the request may
// still be on its way to LND, so that error stays a transport failure.
export const markRestErrorResponse = (
    error: Error,
    grpcCode: unknown
): unknown =>
    grpcCode === undefined || grpcCode === null
        ? error
        : markNodeResponded(error, grpcCode);

// LND refuses a send with AlreadyExists when it already has a payment for
// the hash (already paid, still in flight, or being created), before any
// HTLC for this request goes out. Only a FAILED payment can be retried. So
// such a rejection proves this request sent nothing, and the existing
// record belongs to an earlier attempt.
export const isPaymentRefusedAsDuplicate = (error: unknown): boolean => {
    if (!isNodeResponse(error)) return false;
    const code = (error as any).grpcCode;
    return code === 6 || code === '6' || code === 'AlreadyExists';
};

type PaymentsPageRequest = {
    maxPayments: number;
    reversed: boolean;
    creationDateStart?: number;
};

// Finds a payment by hash via ListPayments pages, for backends without a
// non-streaming per-payment lookup. Resolves the payment, or null only when
// the node's answer rules the payment out; rejects with
// paymentLookupInconclusiveError when a miss may be a truncated page.
//
// With a creation_date_start bound, the first pass scans ascending from the
// bound, so newer payments from other clients can't evict the target. A
// second pass over the newest page covers a device clock running more than
// the bound's slack ahead of the node's, which puts the payment before the
// bound. Null requires both passes to miss and the bounded pass to have
// returned less than a full page.
export const findPaymentByHash = async (
    fetchPage: (request: PaymentsPageRequest) => Promise<any>,
    payment_hash: string,
    creation_date_start?: number
): Promise<any | null> => {
    const target = payment_hash.toLowerCase();
    const scan = async (request: PaymentsPageRequest) => {
        const response = await fetchPage(request);
        const payments: any[] = response?.payments ?? [];
        return {
            match: payments.find(
                (payment: any) =>
                    payment?.payment_hash?.toLowerCase() === target
            ),
            full: payments.length >= request.maxPayments
        };
    };

    let truncated = false;
    if (creation_date_start) {
        const bounded = await scan({
            maxPayments: PAYMENT_LOOKUP_PAGE_SIZE,
            reversed: false,
            creationDateStart: creation_date_start
        });
        if (bounded.match) return bounded.match;
        truncated = bounded.full;
    }

    const newest = await scan({
        maxPayments: PAYMENT_LOOKUP_PAGE_SIZE,
        reversed: true
    });
    if (newest.match) return newest.match;
    // without a bound, the newest page is the only view; if it's full the
    // payment may sit on an older page
    if (!creation_date_start) truncated = newest.full;

    if (truncated) throw paymentLookupInconclusiveError();
    return null;
};

// When the node created a payment record, in ms on the node's clock, or null
// if the record carries no usable creation time. LND REST and LNC return
// int64 fields as strings, embedded LND as Long, so both go through String.
export const paymentCreationTimeMs = (payment: any): number | null => {
    const ns = Number(String(payment?.creation_time_ns ?? ''));
    if (Number.isFinite(ns) && ns > 0) return Math.floor(ns / 1e6);
    const seconds = Number(String(payment?.creation_date ?? ''));
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    return null;
};
