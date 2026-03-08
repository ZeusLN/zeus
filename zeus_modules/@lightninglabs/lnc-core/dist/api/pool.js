"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var schema_1 = require("../types/proto/schema");
/**
 * An API wrapper to communicate with the Pool node via GRPC
 */
var PoolApi = /** @class */ (function () {
    function PoolApi(createRpc, lnc) {
        this.trader = createRpc(schema_1.serviceNames.poolrpc.Trader, lnc);
        this.channelAuctioneer = createRpc(schema_1.serviceNames.poolrpc.ChannelAuctioneer, lnc);
        this.hashmail = createRpc(schema_1.serviceNames.poolrpc.HashMail, lnc);
    }
    return PoolApi;
}());
exports.default = PoolApi;
