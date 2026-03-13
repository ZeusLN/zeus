"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProofTransferType = void 0;
/**
 * ProofTransferType is the type of proof transfer attempt. The transfer is
 * either a proof delivery to the transfer counterparty or receiving a proof
 * from the transfer counterparty. Note that the transfer counterparty is
 * usually the proof courier service.
 */
var ProofTransferType;
(function (ProofTransferType) {
    /**
     * PROOF_TRANSFER_TYPE_SEND - This value indicates that the proof transfer attempt is a delivery to the
     * transfer counterparty.
     */
    ProofTransferType["PROOF_TRANSFER_TYPE_SEND"] = "PROOF_TRANSFER_TYPE_SEND";
    /**
     * PROOF_TRANSFER_TYPE_RECEIVE - This value indicates that the proof transfer attempt is a receive from
     * the transfer counterparty.
     */
    ProofTransferType["PROOF_TRANSFER_TYPE_RECEIVE"] = "PROOF_TRANSFER_TYPE_RECEIVE";
    ProofTransferType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ProofTransferType = exports.ProofTransferType || (exports.ProofTransferType = {}));
