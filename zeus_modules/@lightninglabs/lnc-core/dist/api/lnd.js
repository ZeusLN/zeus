"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var schema_1 = require("../types/proto/schema");
/**
 * An API wrapper to communicate with the LND node via GRPC
 */
var LndApi = /** @class */ (function () {
    function LndApi(createRpc, lnc) {
        this.autopilot = createRpc(schema_1.serviceNames.autopilotrpc.Autopilot, lnc);
        this.chainNotifier = createRpc(schema_1.serviceNames.chainrpc.ChainNotifier, lnc);
        this.invoices = createRpc(schema_1.serviceNames.invoicesrpc.Invoices, lnc);
        this.lightning = createRpc(schema_1.serviceNames.lnrpc.Lightning, lnc);
        this.router = createRpc(schema_1.serviceNames.routerrpc.Router, lnc);
        this.signer = createRpc(schema_1.serviceNames.signrpc.Signer, lnc);
        this.walletKit = createRpc(schema_1.serviceNames.walletrpc.WalletKit, lnc);
        this.walletUnlocker = createRpc(schema_1.serviceNames.lnrpc.WalletUnlocker, lnc);
        this.watchtower = createRpc(schema_1.serviceNames.watchtowerrpc.Watchtower, lnc);
        this.watchtowerClient = createRpc(schema_1.serviceNames.wtclientrpc.WatchtowerClient, lnc);
    }
    return LndApi;
}());
exports.default = LndApi;
