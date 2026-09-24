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
