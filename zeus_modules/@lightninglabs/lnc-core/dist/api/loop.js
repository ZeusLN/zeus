"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var schema_1 = require("../types/proto/schema");
/**
 * An API wrapper to communicate with the Loop node via GRPC
 */
var LoopApi = /** @class */ (function () {
    function LoopApi(createRpc, lnc) {
        this.swapClient = createRpc(schema_1.serviceNames.looprpc.SwapClient, lnc);
        this.debug = createRpc(schema_1.serviceNames.looprpc.Debug, lnc);
    }
    return LoopApi;
}());
exports.default = LoopApi;
