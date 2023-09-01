/* eslint-disable */
import type {
    KeyDescriptor,
    ScriptKey,
    SendAssetResponse
} from '../taprootassets';

export interface FundVirtualPsbtRequest {
    /**
     * Use an existing PSBT packet as the template for the funded PSBT.
     *
     * TODO(guggero): Actually implement this. We can't use the "reserved"
     * keyword here because we're in a oneof, so we add the field but implement
     * it later.
     */
    psbt: Uint8Array | string | undefined;
    /** Use the asset outputs and optional asset inputs from this raw template. */
    raw: TxTemplate | undefined;
}

export interface FundVirtualPsbtResponse {
    /** The funded but not yet signed PSBT packet. */
    fundedPsbt: Uint8Array | string;
    /** The index of the added change output or -1 if no change was left over. */
    changeOutputIndex: number;
}

export interface TxTemplate {
    /**
     * An optional list of inputs to use. Every input must be an asset UTXO known
     * to the wallet. The sum of all inputs must be greater than or equal to the
     * sum of all outputs.
     *
     * If no inputs are specified, asset coin selection will be performed instead
     * and inputs of sufficient value will be added to the resulting PSBT.
     */
    inputs: PrevId[];
    /**
     * A map of all Taproot Asset addresses mapped to the anchor transaction's
     * output index that should be sent to.
     */
    recipients: { [key: string]: string };
}

export interface TxTemplate_RecipientsEntry {
    key: string;
    value: string;
}

export interface PrevId {
    /** The bitcoin anchor output on chain that contains the input asset. */
    outpoint: OutPoint | undefined;
    /** The asset ID of the previous asset tree. */
    id: Uint8Array | string;
    /**
     * The tweaked Taproot output key committing to the possible spending
     * conditions of the asset.
     */
    scriptKey: Uint8Array | string;
}

export interface OutPoint {
    /** Raw bytes representing the transaction id. */
    txid: Uint8Array | string;
    /** The index of the output on the transaction. */
    outputIndex: number;
}

export interface SignVirtualPsbtRequest {
    /**
     * The PSBT of the virtual transaction that should be signed. The PSBT must
     * contain all required inputs, outputs, UTXO data and custom fields required
     * to identify the signing key.
     */
    fundedPsbt: Uint8Array | string;
}

export interface SignVirtualPsbtResponse {
    /** The signed virtual transaction in PSBT format. */
    signedPsbt: Uint8Array | string;
    /** The indices of signed inputs. */
    signedInputs: number[];
}

export interface AnchorVirtualPsbtsRequest {
    /**
     * The list of virtual transactions that should be merged and committed to in
     * the BTC level anchor transaction.
     */
    virtualPsbts: Uint8Array | string[];
}

export interface NextInternalKeyRequest {
    keyFamily: number;
}

export interface NextInternalKeyResponse {
    internalKey: KeyDescriptor | undefined;
}

export interface NextScriptKeyRequest {
    keyFamily: number;
}

export interface NextScriptKeyResponse {
    scriptKey: ScriptKey | undefined;
}

export interface ProveAssetOwnershipRequest {
    assetId: Uint8Array | string;
    scriptKey: Uint8Array | string;
}

export interface ProveAssetOwnershipResponse {
    proofWithWitness: Uint8Array | string;
}

export interface VerifyAssetOwnershipRequest {
    proofWithWitness: Uint8Array | string;
}

export interface VerifyAssetOwnershipResponse {
    validProof: boolean;
}

export interface AssetWallet {
    /**
     * FundVirtualPsbt selects inputs from the available asset commitments to fund
     * a virtual transaction matching the template.
     */
    fundVirtualPsbt(
        request?: DeepPartial<FundVirtualPsbtRequest>
    ): Promise<FundVirtualPsbtResponse>;
    /**
     * SignVirtualPsbt signs the inputs of a virtual transaction and prepares the
     * commitments of the inputs and outputs.
     */
    signVirtualPsbt(
        request?: DeepPartial<SignVirtualPsbtRequest>
    ): Promise<SignVirtualPsbtResponse>;
    /**
     * AnchorVirtualPsbts merges and then commits multiple virtual transactions in
     * a single BTC level anchor transaction.
     *
     * TODO(guggero): Actually implement accepting and merging multiple
     * transactions.
     */
    anchorVirtualPsbts(
        request?: DeepPartial<AnchorVirtualPsbtsRequest>
    ): Promise<SendAssetResponse>;
    /**
     * NextInternalKey derives the next internal key for the given key family and
     * stores it as an internal key in the database to make sure it is identified
     * as a local key later on when importing proofs. While an internal key can
     * also be used as the internal key of a script key, it is recommended to use
     * the NextScriptKey RPC instead, to make sure the tweaked Taproot output key
     * is also recognized as a local key.
     */
    nextInternalKey(
        request?: DeepPartial<NextInternalKeyRequest>
    ): Promise<NextInternalKeyResponse>;
    /**
     * NextScriptKey derives the next script key (and its corresponding internal
     * key) and stores them both in the database to make sure they are identified
     * as local keys later on when importing proofs.
     */
    nextScriptKey(
        request?: DeepPartial<NextScriptKeyRequest>
    ): Promise<NextScriptKeyResponse>;
    /**
     * ProveAssetOwnership creates an ownership proof embedded in an asset
     * transition proof. That ownership proof is a signed virtual transaction
     * spending the asset with a valid witness to prove the prover owns the keys
     * that can spend the asset.
     */
    proveAssetOwnership(
        request?: DeepPartial<ProveAssetOwnershipRequest>
    ): Promise<ProveAssetOwnershipResponse>;
    /**
     * VerifyAssetOwnership verifies the asset ownership proof embedded in the
     * given transition proof of an asset and returns true if the proof is valid.
     */
    verifyAssetOwnership(
        request?: DeepPartial<VerifyAssetOwnershipRequest>
    ): Promise<VerifyAssetOwnershipResponse>;
}

type Builtin =
    | Date
    | Function
    | Uint8Array
    | string
    | number
    | boolean
    | undefined;

type DeepPartial<T> = T extends Builtin
    ? T
    : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : T extends {}
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : Partial<T>;
