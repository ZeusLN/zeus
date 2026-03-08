"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MuSig2Version = exports.SignMethod = void 0;
/* eslint-disable */
var SignMethod;
(function (SignMethod) {
    /**
     * SIGN_METHOD_WITNESS_V0 - Specifies that a SegWit v0 (p2wkh, np2wkh, p2wsh) input script should be
     * signed.
     */
    SignMethod["SIGN_METHOD_WITNESS_V0"] = "SIGN_METHOD_WITNESS_V0";
    /**
     * SIGN_METHOD_TAPROOT_KEY_SPEND_BIP0086 - Specifies that a SegWit v1 (p2tr) input should be signed by using the
     * BIP0086 method (commit to internal key only).
     */
    SignMethod["SIGN_METHOD_TAPROOT_KEY_SPEND_BIP0086"] = "SIGN_METHOD_TAPROOT_KEY_SPEND_BIP0086";
    /**
     * SIGN_METHOD_TAPROOT_KEY_SPEND - Specifies that a SegWit v1 (p2tr) input should be signed by using a given
     * taproot hash to commit to in addition to the internal key.
     */
    SignMethod["SIGN_METHOD_TAPROOT_KEY_SPEND"] = "SIGN_METHOD_TAPROOT_KEY_SPEND";
    /**
     * SIGN_METHOD_TAPROOT_SCRIPT_SPEND - Specifies that a SegWit v1 (p2tr) input should be spent using the script
     * path and that a specific leaf script should be signed for.
     */
    SignMethod["SIGN_METHOD_TAPROOT_SCRIPT_SPEND"] = "SIGN_METHOD_TAPROOT_SCRIPT_SPEND";
    SignMethod["UNRECOGNIZED"] = "UNRECOGNIZED";
})(SignMethod = exports.SignMethod || (exports.SignMethod = {}));
var MuSig2Version;
(function (MuSig2Version) {
    /**
     * MUSIG2_VERSION_UNDEFINED - The default value on the RPC is zero for enums so we need to represent an
     * invalid/undefined version by default to make sure clients upgrade their
     * software to set the version explicitly.
     */
    MuSig2Version["MUSIG2_VERSION_UNDEFINED"] = "MUSIG2_VERSION_UNDEFINED";
    /**
     * MUSIG2_VERSION_V040 - The version of MuSig2 that lnd 0.15.x shipped with, which corresponds to the
     * version v0.4.0 of the MuSig2 BIP draft.
     */
    MuSig2Version["MUSIG2_VERSION_V040"] = "MUSIG2_VERSION_V040";
    /**
     * MUSIG2_VERSION_V100RC2 - The current version of MuSig2 which corresponds to the version v1.0.0rc2 of
     * the MuSig2 BIP draft.
     */
    MuSig2Version["MUSIG2_VERSION_V100RC2"] = "MUSIG2_VERSION_V100RC2";
    MuSig2Version["UNRECOGNIZED"] = "UNRECOGNIZED";
})(MuSig2Version = exports.MuSig2Version || (exports.MuSig2Version = {}));
