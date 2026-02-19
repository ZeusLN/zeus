"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LookupModifier = void 0;
var LookupModifier;
(function (LookupModifier) {
    /** DEFAULT - The default look up modifier, no look up behavior is changed. */
    LookupModifier["DEFAULT"] = "DEFAULT";
    /**
     * HTLC_SET_ONLY - Indicates that when a look up is done based on a set_id, then only that set
     * of HTLCs related to that set ID should be returned.
     */
    LookupModifier["HTLC_SET_ONLY"] = "HTLC_SET_ONLY";
    /**
     * HTLC_SET_BLANK - Indicates that when a look up is done using a payment_addr, then no HTLCs
     * related to the payment_addr should be returned. This is useful when one
     * wants to be able to obtain the set of associated setIDs with a given
     * invoice, then look up the sub-invoices "projected" by that set ID.
     */
    LookupModifier["HTLC_SET_BLANK"] = "HTLC_SET_BLANK";
    LookupModifier["UNRECOGNIZED"] = "UNRECOGNIZED";
})(LookupModifier = exports.LookupModifier || (exports.LookupModifier = {}));
