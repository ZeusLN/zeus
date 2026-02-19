"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyType = void 0;
/* eslint-disable */
var PolicyType;
(function (PolicyType) {
    /** LEGACY - Selects the policy from the legacy tower client. */
    PolicyType["LEGACY"] = "LEGACY";
    /** ANCHOR - Selects the policy from the anchor tower client. */
    PolicyType["ANCHOR"] = "ANCHOR";
    /** TAPROOT - Selects the policy from the taproot tower client. */
    PolicyType["TAPROOT"] = "TAPROOT";
    PolicyType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(PolicyType = exports.PolicyType || (exports.PolicyType = {}));
