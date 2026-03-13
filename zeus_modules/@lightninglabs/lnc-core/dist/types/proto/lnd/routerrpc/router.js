"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtlcEvent_EventType = exports.MissionControlConfig_ProbabilityModel = exports.ChanStatusAction = exports.ResolveHoldForwardAction = exports.PaymentState = exports.FailureDetail = void 0;
var FailureDetail;
(function (FailureDetail) {
    FailureDetail["UNKNOWN"] = "UNKNOWN";
    FailureDetail["NO_DETAIL"] = "NO_DETAIL";
    FailureDetail["ONION_DECODE"] = "ONION_DECODE";
    FailureDetail["LINK_NOT_ELIGIBLE"] = "LINK_NOT_ELIGIBLE";
    FailureDetail["ON_CHAIN_TIMEOUT"] = "ON_CHAIN_TIMEOUT";
    FailureDetail["HTLC_EXCEEDS_MAX"] = "HTLC_EXCEEDS_MAX";
    FailureDetail["INSUFFICIENT_BALANCE"] = "INSUFFICIENT_BALANCE";
    FailureDetail["INCOMPLETE_FORWARD"] = "INCOMPLETE_FORWARD";
    FailureDetail["HTLC_ADD_FAILED"] = "HTLC_ADD_FAILED";
    FailureDetail["FORWARDS_DISABLED"] = "FORWARDS_DISABLED";
    FailureDetail["INVOICE_CANCELED"] = "INVOICE_CANCELED";
    FailureDetail["INVOICE_UNDERPAID"] = "INVOICE_UNDERPAID";
    FailureDetail["INVOICE_EXPIRY_TOO_SOON"] = "INVOICE_EXPIRY_TOO_SOON";
    FailureDetail["INVOICE_NOT_OPEN"] = "INVOICE_NOT_OPEN";
    FailureDetail["MPP_INVOICE_TIMEOUT"] = "MPP_INVOICE_TIMEOUT";
    FailureDetail["ADDRESS_MISMATCH"] = "ADDRESS_MISMATCH";
    FailureDetail["SET_TOTAL_MISMATCH"] = "SET_TOTAL_MISMATCH";
    FailureDetail["SET_TOTAL_TOO_LOW"] = "SET_TOTAL_TOO_LOW";
    FailureDetail["SET_OVERPAID"] = "SET_OVERPAID";
    FailureDetail["UNKNOWN_INVOICE"] = "UNKNOWN_INVOICE";
    FailureDetail["INVALID_KEYSEND"] = "INVALID_KEYSEND";
    FailureDetail["MPP_IN_PROGRESS"] = "MPP_IN_PROGRESS";
    FailureDetail["CIRCULAR_ROUTE"] = "CIRCULAR_ROUTE";
    FailureDetail["UNRECOGNIZED"] = "UNRECOGNIZED";
})(FailureDetail = exports.FailureDetail || (exports.FailureDetail = {}));
var PaymentState;
(function (PaymentState) {
    /** IN_FLIGHT - Payment is still in flight. */
    PaymentState["IN_FLIGHT"] = "IN_FLIGHT";
    /** SUCCEEDED - Payment completed successfully. */
    PaymentState["SUCCEEDED"] = "SUCCEEDED";
    /** FAILED_TIMEOUT - There are more routes to try, but the payment timeout was exceeded. */
    PaymentState["FAILED_TIMEOUT"] = "FAILED_TIMEOUT";
    /**
     * FAILED_NO_ROUTE - All possible routes were tried and failed permanently. Or were no
     * routes to the destination at all.
     */
    PaymentState["FAILED_NO_ROUTE"] = "FAILED_NO_ROUTE";
    /** FAILED_ERROR - A non-recoverable error has occurred. */
    PaymentState["FAILED_ERROR"] = "FAILED_ERROR";
    /**
     * FAILED_INCORRECT_PAYMENT_DETAILS - Payment details incorrect (unknown hash, invalid amt or
     * invalid final cltv delta)
     */
    PaymentState["FAILED_INCORRECT_PAYMENT_DETAILS"] = "FAILED_INCORRECT_PAYMENT_DETAILS";
    /** FAILED_INSUFFICIENT_BALANCE - Insufficient local balance. */
    PaymentState["FAILED_INSUFFICIENT_BALANCE"] = "FAILED_INSUFFICIENT_BALANCE";
    PaymentState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(PaymentState = exports.PaymentState || (exports.PaymentState = {}));
var ResolveHoldForwardAction;
(function (ResolveHoldForwardAction) {
    /**
     * SETTLE - SETTLE is an action that is used to settle an HTLC instead of forwarding
     * it.
     */
    ResolveHoldForwardAction["SETTLE"] = "SETTLE";
    /** FAIL - FAIL is an action that is used to fail an HTLC backwards. */
    ResolveHoldForwardAction["FAIL"] = "FAIL";
    /** RESUME - RESUME is an action that is used to resume a forward HTLC. */
    ResolveHoldForwardAction["RESUME"] = "RESUME";
    /**
     * RESUME_MODIFIED - RESUME_MODIFIED is an action that is used to resume a hold forward HTLC
     * with modifications specified during interception.
     */
    ResolveHoldForwardAction["RESUME_MODIFIED"] = "RESUME_MODIFIED";
    ResolveHoldForwardAction["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ResolveHoldForwardAction = exports.ResolveHoldForwardAction || (exports.ResolveHoldForwardAction = {}));
var ChanStatusAction;
(function (ChanStatusAction) {
    ChanStatusAction["ENABLE"] = "ENABLE";
    ChanStatusAction["DISABLE"] = "DISABLE";
    ChanStatusAction["AUTO"] = "AUTO";
    ChanStatusAction["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ChanStatusAction = exports.ChanStatusAction || (exports.ChanStatusAction = {}));
var MissionControlConfig_ProbabilityModel;
(function (MissionControlConfig_ProbabilityModel) {
    MissionControlConfig_ProbabilityModel["APRIORI"] = "APRIORI";
    MissionControlConfig_ProbabilityModel["BIMODAL"] = "BIMODAL";
    MissionControlConfig_ProbabilityModel["UNRECOGNIZED"] = "UNRECOGNIZED";
})(MissionControlConfig_ProbabilityModel = exports.MissionControlConfig_ProbabilityModel || (exports.MissionControlConfig_ProbabilityModel = {}));
var HtlcEvent_EventType;
(function (HtlcEvent_EventType) {
    HtlcEvent_EventType["UNKNOWN"] = "UNKNOWN";
    HtlcEvent_EventType["SEND"] = "SEND";
    HtlcEvent_EventType["RECEIVE"] = "RECEIVE";
    HtlcEvent_EventType["FORWARD"] = "FORWARD";
    HtlcEvent_EventType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(HtlcEvent_EventType = exports.HtlcEvent_EventType || (exports.HtlcEvent_EventType = {}));
