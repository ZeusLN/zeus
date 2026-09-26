jest.mock('./LocaleUtils', () => ({
    localeString: (key: string, substitutions: any = {}) =>
        Object.keys(substitutions).reduce(
            (text: string, name: string) =>
                text.replace(`{{${name}}}`, substitutions[name]),
            require('../locales/en.json')[key]
        )
}));

// decoded min_final_cltv_expiry by payment request
jest.mock('./Bolt11Utils', () => ({
    __esModule: true,
    default: {
        decode: (paymentRequest: string) => {
            if (paymentRequest === 'lnbc-c40') return { cltv_expiry: 40 };
            if (paymentRequest === 'lnbc-no-c') return {};
            throw new Error('Not a proper lightning payment request');
        }
    }
}));

import {
    formatHeldDuration,
    getRecipientRejection,
    MIN_REPORTED_HOLD_SECONDS
} from './RecipientRejectionUtils';

const ATTEMPT_NS = '1790000000000000000';
const nsAfter = (seconds: number) =>
    (BigInt(ATTEMPT_NS) + BigInt(seconds * 1e9)).toString();

const twoHopRoute = { hops: [{}, {}] };

// lnd REST / LNC shape: enum names, int64 as strings
const restHtlc = (overrides: any = {}) => ({
    status: 'FAILED',
    route: twoHopRoute,
    attempt_time_ns: ATTEMPT_NS,
    resolve_time_ns: nsAfter(134),
    failure: {
        code: 'INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS',
        failure_source_index: 2
    },
    ...overrides
});

describe('getRecipientRejection', () => {
    it('reports how long the recipient held a rejected HTLC', () => {
        expect(getRecipientRejection({ htlcs: [restHtlc()] })).toEqual({
            heldSeconds: 134,
            senderBehindChain: false
        });
    });

    it('reads the embedded LND protobuf shape (enum numbers, Long timestamps)', () => {
        const long = (n: number) => ({ toNumber: () => n });
        const result = getRecipientRejection({
            htlcs: [
                {
                    status: 2, // HTLCStatus.FAILED
                    route: twoHopRoute,
                    attempt_time_ns: long(1e18),
                    resolve_time_ns: long(1e18 + 30e9),
                    failure: {
                        code: 1, // INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS
                        failure_source_index: 2
                    }
                }
            ]
        });
        expect(result?.heldSeconds).toBeCloseTo(30);
    });

    it('treats a prompt rejection as a rejection without a hold', () => {
        expect(
            getRecipientRejection({
                htlcs: [
                    restHtlc({
                        resolve_time_ns: nsAfter(MIN_REPORTED_HOLD_SECONDS - 1)
                    })
                ]
            })
        ).toEqual({ heldSeconds: null, senderBehindChain: false });
        expect(
            getRecipientRejection({
                htlcs: [
                    restHtlc({
                        resolve_time_ns: nsAfter(MIN_REPORTED_HOLD_SECONDS)
                    })
                ]
            })
        ).toEqual({
            heldSeconds: MIN_REPORTED_HOLD_SECONDS,
            senderBehindChain: false
        });
    });

    it('treats missing timestamps as a rejection without a hold', () => {
        expect(
            getRecipientRejection({
                htlcs: [
                    restHtlc({
                        attempt_time_ns: undefined,
                        resolve_time_ns: undefined
                    })
                ]
            })
        ).toEqual({ heldSeconds: null, senderBehindChain: false });
    });

    it('uses the longest hold across MPP shards', () => {
        expect(
            getRecipientRejection({
                htlcs: [
                    restHtlc({ resolve_time_ns: nsAfter(20) }),
                    restHtlc({ resolve_time_ns: nsAfter(90) })
                ]
            })
        ).toEqual({ heldSeconds: 90, senderBehindChain: false });
    });

    it('ignores failures from intermediate hops', () => {
        expect(
            getRecipientRejection({
                htlcs: [
                    restHtlc({
                        failure: {
                            code: 'INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS',
                            failure_source_index: 1
                        }
                    })
                ]
            })
        ).toBeNull();
    });

    it('ignores other failure codes at the final hop', () => {
        expect(
            getRecipientRejection({
                htlcs: [
                    restHtlc({
                        failure: {
                            code: 'MPP_TIMEOUT',
                            failure_source_index: 2
                        }
                    })
                ]
            })
        ).toBeNull();
    });

    it('ignores attempts that did not fail', () => {
        expect(
            getRecipientRejection({
                htlcs: [restHtlc({ status: 'SUCCEEDED' })]
            })
        ).toBeNull();
    });

    it('returns null for payments without HTLC data', () => {
        expect(getRecipientRejection({})).toBeNull();
        expect(getRecipientRejection(undefined)).toBeNull();
        expect(getRecipientRejection({ htlcs: [{}] })).toBeNull();
    });
});

describe('getRecipientRejection senderBehindChain', () => {
    // two-hop route whose final hop expires at the given height; lnd sets it
    // to its own height + min_final_cltv_expiry + 3 blocks of padding
    const promptHtlc = (finalHopExpiry: number, recipientHeight: number) =>
        restHtlc({
            route: {
                hops: [
                    { expiry: finalHopExpiry + 40 },
                    { expiry: finalHopExpiry }
                ]
            },
            resolve_time_ns: nsAfter(1),
            failure: {
                code: 'INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS',
                failure_source_index: 2,
                height: recipientHeight
            }
        });

    it('is set when the final hop expiry was too soon for the recipient', () => {
        // sender 10 blocks behind: 990 + 40 + 3 < 1000 + 40
        expect(
            getRecipientRejection({
                payment_request: 'lnbc-c40',
                htlcs: [promptHtlc(1033, 1000)]
            })
        ).toEqual({ heldSeconds: null, senderBehindChain: true });
    });

    it('is not set when the sender was at the recipient height', () => {
        expect(
            getRecipientRejection({
                payment_request: 'lnbc-c40',
                htlcs: [promptHtlc(1043, 1000)]
            })
        ).toEqual({ heldSeconds: null, senderBehindChain: false });
    });

    it('uses the BOLT 11 default of 18 when the invoice has no c field', () => {
        expect(
            getRecipientRejection({
                payment_request: 'lnbc-no-c',
                htlcs: [promptHtlc(1017, 1000)]
            })?.senderBehindChain
        ).toBe(true);
        expect(
            getRecipientRejection({
                payment_request: 'lnbc-no-c',
                htlcs: [promptHtlc(1018, 1000)]
            })?.senderBehindChain
        ).toBe(false);
    });

    it('is not set without a decodable payment request', () => {
        expect(
            getRecipientRejection({ htlcs: [promptHtlc(1033, 1000)] })
                ?.senderBehindChain
        ).toBe(false);
        expect(
            getRecipientRejection({
                payment_request: 'garbage',
                htlcs: [promptHtlc(1033, 1000)]
            })?.senderBehindChain
        ).toBe(false);
    });

    it('is not set for a held HTLC, whose recipient height kept advancing', () => {
        expect(
            getRecipientRejection({
                payment_request: 'lnbc-c40',
                htlcs: [
                    {
                        ...promptHtlc(1043, 1050),
                        resolve_time_ns: nsAfter(3 * 3600)
                    }
                ]
            })
        ).toEqual({ heldSeconds: 3 * 3600, senderBehindChain: false });
    });

    it('is not set when the failure carries no height', () => {
        expect(
            getRecipientRejection({
                payment_request: 'lnbc-c40',
                htlcs: [promptHtlc(1033, 0)]
            })?.senderBehindChain
        ).toBe(false);
    });
});

describe('formatHeldDuration', () => {
    it('rounds down to the largest whole unit', () => {
        expect(formatHeldDuration(30.7)).toEqual('30 seconds');
        expect(formatHeldDuration(134)).toEqual('2 minutes');
        expect(formatHeldDuration(3 * 3600 + 59)).toEqual('3 hours');
        expect(formatHeldDuration(3 * 86400)).toEqual('3 days');
    });

    it('switches units at the two-minute, two-hour and two-day marks', () => {
        expect(formatHeldDuration(119)).toEqual('119 seconds');
        expect(formatHeldDuration(2 * 86400 - 1)).toEqual('47 hours');
        expect(formatHeldDuration(2 * 86400)).toEqual('2 days');
    });
});
