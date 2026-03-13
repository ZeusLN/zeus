"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var schema_1 = require("../types/proto/schema");
/**
 * An API wrapper to communicate with the Faraday node via GRPC
 */
var FaradayApi = /** @class */ (function () {
    function FaradayApi(createRpc, lnc) {
        this.faradayServer = createRpc(schema_1.serviceNames.frdrpc.FaradayServer, lnc);
    }
    return FaradayApi;
}());
exports.default = FaradayApi;
