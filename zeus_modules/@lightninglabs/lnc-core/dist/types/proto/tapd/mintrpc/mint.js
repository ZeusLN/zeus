"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchState = void 0;
var BatchState;
(function (BatchState) {
    BatchState["BATCH_STATE_UNKNOWN"] = "BATCH_STATE_UNKNOWN";
    BatchState["BATCH_STATE_PENDING"] = "BATCH_STATE_PENDING";
    BatchState["BATCH_STATE_FROZEN"] = "BATCH_STATE_FROZEN";
    BatchState["BATCH_STATE_COMMITTED"] = "BATCH_STATE_COMMITTED";
    BatchState["BATCH_STATE_BROADCAST"] = "BATCH_STATE_BROADCAST";
    BatchState["BATCH_STATE_CONFIRMED"] = "BATCH_STATE_CONFIRMED";
    BatchState["BATCH_STATE_FINALIZED"] = "BATCH_STATE_FINALIZED";
    BatchState["BATCH_STATE_SEEDLING_CANCELLED"] = "BATCH_STATE_SEEDLING_CANCELLED";
    BatchState["BATCH_STATE_SPROUT_CANCELLED"] = "BATCH_STATE_SPROUT_CANCELLED";
    BatchState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(BatchState = exports.BatchState || (exports.BatchState = {}));
