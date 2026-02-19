"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var schema_1 = require("../types/proto/schema");
/**
 * An API wrapper to communicate with the LiT node via GRPC
 */
var LitApi = /** @class */ (function () {
    function LitApi(createRpc, lnc) {
        this.autopilot = createRpc(schema_1.serviceNames.litrpc.Autopilot, lnc);
        this.firewall = createRpc(schema_1.serviceNames.litrpc.Firewall, lnc);
        this.sessions = createRpc(schema_1.serviceNames.litrpc.Sessions, lnc);
        this.status = createRpc(schema_1.serviceNames.litrpc.Status, lnc);
    }
    return LitApi;
}());
exports.default = LitApi;
