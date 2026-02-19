"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoinSelectType = void 0;
var CoinSelectType;
(function (CoinSelectType) {
    /**
     * COIN_SELECT_DEFAULT - Use the default coin selection type, which currently allows script keys and
     * key spend paths.
     */
    CoinSelectType["COIN_SELECT_DEFAULT"] = "COIN_SELECT_DEFAULT";
    /**
     * COIN_SELECT_BIP86_ONLY - Explicitly only select inputs that are known to be BIP-086 compliant (have
     * a key-spend path only and no script tree).
     */
    CoinSelectType["COIN_SELECT_BIP86_ONLY"] = "COIN_SELECT_BIP86_ONLY";
    /**
     * COIN_SELECT_SCRIPT_TREES_ALLOWED - Allow the selection of inputs that have a script tree spend path as well as
     * a key spend path.
     */
    CoinSelectType["COIN_SELECT_SCRIPT_TREES_ALLOWED"] = "COIN_SELECT_SCRIPT_TREES_ALLOWED";
    CoinSelectType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(CoinSelectType = exports.CoinSelectType || (exports.CoinSelectType = {}));
