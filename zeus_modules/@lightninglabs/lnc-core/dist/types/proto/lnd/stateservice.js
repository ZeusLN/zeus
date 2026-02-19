"use strict";
/* eslint-disable */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletState = void 0;
var WalletState;
(function (WalletState) {
    /** NON_EXISTING - NON_EXISTING means that the wallet has not yet been initialized. */
    WalletState["NON_EXISTING"] = "NON_EXISTING";
    /** LOCKED - LOCKED means that the wallet is locked and requires a password to unlock. */
    WalletState["LOCKED"] = "LOCKED";
    /**
     * UNLOCKED - UNLOCKED means that the wallet was unlocked successfully, but RPC server
     * isn't ready.
     */
    WalletState["UNLOCKED"] = "UNLOCKED";
    /**
     * RPC_ACTIVE - RPC_ACTIVE means that the lnd server is active but not fully ready for
     * calls.
     */
    WalletState["RPC_ACTIVE"] = "RPC_ACTIVE";
    /** SERVER_ACTIVE - SERVER_ACTIVE means that the lnd server is ready to accept calls. */
    WalletState["SERVER_ACTIVE"] = "SERVER_ACTIVE";
    /**
     * WAITING_TO_START - WAITING_TO_START means that node is waiting to become the leader in a
     * cluster and is not started yet.
     */
    WalletState["WAITING_TO_START"] = "WAITING_TO_START";
    WalletState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(WalletState = exports.WalletState || (exports.WalletState = {}));
