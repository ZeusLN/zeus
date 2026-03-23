"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionState = void 0;
/* eslint-disable */
var ActionState;
(function (ActionState) {
    /** STATE_UNKNOWN - No state was assigned to the action. This should never be the case. */
    ActionState["STATE_UNKNOWN"] = "STATE_UNKNOWN";
    /**
     * STATE_PENDING - Pending means that the request resulting in the action being created
     * came through but that no response came back from the appropriate backend.
     * This means that the Action is either still being processed or that it
     * did not successfully complete.
     */
    ActionState["STATE_PENDING"] = "STATE_PENDING";
    /** STATE_DONE - Done means that the action successfully completed. */
    ActionState["STATE_DONE"] = "STATE_DONE";
    /** STATE_ERROR - Error means that the Action did not successfully complete. */
    ActionState["STATE_ERROR"] = "STATE_ERROR";
    ActionState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ActionState = exports.ActionState || (exports.ActionState = {}));
