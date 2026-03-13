"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var schema_1 = require("../types/proto/schema");
/**
 * An API wrapper to communicate with the Taproot Assets node via GRPC
 */
var TaprootAssetsApi = /** @class */ (function () {
    function TaprootAssetsApi(createRpc, lnc) {
        this.taprootAssets = createRpc(schema_1.serviceNames.taprpc.TaprootAssets, lnc);
        this.mint = createRpc(schema_1.serviceNames.mintrpc.Mint, lnc);
        this.assetWallet = createRpc(schema_1.serviceNames.assetwalletrpc.AssetWallet, lnc);
        this.universe = createRpc(schema_1.serviceNames.universerpc.Universe, lnc);
    }
    return TaprootAssetsApi;
}());
exports.default = TaprootAssetsApi;
