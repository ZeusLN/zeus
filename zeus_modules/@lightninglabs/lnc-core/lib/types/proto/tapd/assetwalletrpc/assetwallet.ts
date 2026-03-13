/* eslint-disable */
import type {
    AddressWithAmount,
    KeyDescriptor,
    ScriptKey,
    SendAssetResponse
} from '../taprootassets';
import type { OutPoint } from '../tapcommon';

export enum CoinSelectType {
    /**
     * COIN_SELECT_DEFAULT - Use the default coin selection type, which currently allows script keys and
     * key spend paths.
     */
    COIN_SELECT_DEFAULT = 'COIN_SELECT_DEFAULT',
    /**
     * COIN_SELECT_BIP86_ONLY - Explicitly only select inputs that are known to be BIP-086 compliant (have
     * a key-spend path only and no script tree).
     */
    COIN_SELECT_BIP86_ONLY = 'COIN_SELECT_BIP86_ONLY',
    /**
     * COIN_SELECT_SCRIPT_TREES_ALLOWED - Allow the selection of inputs that have a script tree spend path as well as
     * a key spend path.
     */
    COIN_SELECT_SCRIPT_TREES_ALLOWED = 'COIN_SELECT_SCRIPT_TREES_ALLOWED',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface FundVirtualPsbtRequest {
    /** Use an existing PSBT packet as the template for the funded PSBT. */
    psbt: Uint8Array | string | undefined;
    /** Use the asset outputs and optional asset inputs from this raw template. */
    raw: TxTemplate | undefined;
    /**
     * Specify the type of coins that should be selected. Defaults to allowing both
     * script trees and BIP-086 compliant inputs.
     */
    coinSelectType: CoinSelectType;
}

export interface FundVirtualPsbtResponse {
    /** The funded but not yet signed virtual PSBT packet. */
    fundedPsbt: Uint8Array | string;
    /** The index of the added change output or -1 if no change was left over. */
    changeOutputIndex: number;
    /**
     * The list of passive virtual transactions that are anchored in the same BTC
     * level anchor transaction inputs as the funded "active" asset above. These
     * assets can be ignored when using the AnchorVirtualPsbts RPC, since they are
     * retrieved, signed and committed automatically in that method. But the
     * passive assets have to be included in the CommitVirtualPsbts RPC which is
     * used when custom BTC level anchor transactions are created.
     * The main difference to the "active" asset above is that the passive assets
     * will not get their own entry in the transfer table of the database, since
     * they are just carried along and not directly affected by the direct user
     * action.
     */
    passiveAssetPsbts: Uint8Array | string[];
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
     * DEPRECATED: A map of all Taproot Asset addresses that should be sent to.
     * The keys are the Taproot Asset addresses in human-readable form, and the
     * values are IGNORED and should not be set (use the addresses_with_amounts
     * field below instead). The recipients map and addresses_with_amounts list
     * are mutually exclusive, meaning that if addresses_with_amounts is set, then
     * recipients must be empty, and vice versa.
     */
    recipients: { [key: string]: string };
    /**
     * A list of addresses and the amounts of asset units to send to them. This
     * must be used for V2 TAP addresses that don't specify an amount in the
     * address itself and allow the sender to choose the amount to send. The
     * recipients and addresses_with_amounts lists are mutually exclusive,
     * meaning that if addresses_with_amounts is set, then recipients must be
     * empty, and vice versa.
     */
    addressesWithAmounts: AddressWithAmount[];
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

export interface CommitVirtualPsbtsRequest {
    /**
     * The list of virtual transactions that should be mapped to the given BTC
     * level anchor transaction template. The virtual transactions are expected to
     * be signed (or use ASSET_VERSION_V1 with segregated witness to allow for
     * signing after committing) and ready to be committed to the anchor
     * transaction.
     */
    virtualPsbts: Uint8Array | string[];
    /**
     * The list of passive virtual transactions that are anchored in the same BTC
     * level anchor transaction inputs as the "active" assets above. These can be
     * obtained by calling FundVirtualPsbt and using the passive assets returned.
     * The virtual transactions are expected to be signed (or use ASSET_VERSION_V1
     * with segregated witness to allow for signing after committing) and ready to
     * be committed to the anchor transaction.
     * The main difference to the "active" assets above is that the passive assets
     * will not get their own entry in the transfer table of the database, since
     * they are just carried along and not directly affected by the direct user
     * action.
     */
    passiveAssetPsbts: Uint8Array | string[];
    /**
     * The template of the BTC level anchor transaction that the virtual
     * transactions should be mapped to. The template is expected to already
     * contain all asset related inputs and outputs corresponding to the virtual
     * transactions given above. This can be achieved by using
     * tapfreighter.PrepareAnchoringTemplate for example.
     */
    anchorPsbt: Uint8Array | string;
    /**
     * Use the existing output within the anchor PSBT with the specified
     * index as the change output. Any leftover change will be added to the
     * already specified amount of that output. To add a new change output to
     * the PSBT, set the "add" field below instead.
     */
    existingOutputIndex: number | undefined;
    /** Add a new P2TR change output to the PSBT if required. */
    add: boolean | undefined;
    /** The target number of blocks that the transaction should be confirmed in. */
    targetConf: number | undefined;
    /**
     * The fee rate, expressed in sat/vbyte, that should be used to fund the
     * BTC level anchor transaction.
     */
    satPerVbyte: string | undefined;
    /**
     * The custom lock ID used to identify the lock lease for UTXOs that serve as
     * inputs in the BTC-level anchor transaction. If left empty, LND's default
     * lock ID will be used.
     */
    customLockId: Uint8Array | string;
    /**
     * If set, the UTXOs used as inputs in the BTC-level anchor transaction will be
     * locked for the specified number of seconds. If unset, LND's default lock
     * expiration of 10 minutes will be applied.
     */
    lockExpirationSeconds: string;
    /**
     * If set, the psbt funding step will be skipped. This is useful if the intent
     * is to create a zero-fee transaction.
     */
    skipFunding: boolean;
}

export interface CommitVirtualPsbtsResponse {
    /**
     * The funded BTC level anchor transaction with all outputs updated to commit
     * to the virtual transactions given. The transaction is ready to be signed,
     * unless some of the asset inputs don't belong to this daemon, in which case
     * the anchor input derivation info must be added to those inputs first.
     */
    anchorPsbt: Uint8Array | string;
    /**
     * The updated virtual transactions that now contain the state transition
     * proofs for being committed to the BTC level anchor transaction above. If the
     * assets in the virtual transaction outputs are ASSET_VERSION_V1 and not yet
     * signed, then the proofs need to be updated to include the witness before
     * they become fully valid.
     */
    virtualPsbts: Uint8Array | string[];
    /**
     * The updated passive virtual transactions that were committed to the same BTC
     * level anchor transaction as the "active" virtual transactions given. If the
     * assets in the virtual transaction outputs are ASSET_VERSION_V1 and not yet
     * signed, then the proofs need to be updated to include the witness before
     * they become fully valid.
     */
    passiveAssetPsbts: Uint8Array | string[];
    /** The index of the (added) change output or -1 if no change was left over. */
    changeOutputIndex: number;
    /**
     * The list of UTXO lock leases that were acquired for the inputs in the funded
     * PSBT packet from lnd. Only inputs added to the PSBT by this RPC are locked,
     * inputs that were already present in the PSBT are not locked.
     */
    lndLockedUtxos: OutPoint[];
}

export interface PublishAndLogRequest {
    /**
     * The funded BTC level anchor transaction with all outputs updated to commit
     * to the virtual transactions given. The transaction is ready to be signed,
     * unless some of the asset inputs don't belong to this daemon, in which case
     * the anchor input derivation info must be added to those inputs first.
     */
    anchorPsbt: Uint8Array | string;
    /**
     * The updated virtual transactions that contain the state transition proofs
     * of being committed to the BTC level anchor transaction above.
     */
    virtualPsbts: Uint8Array | string[];
    /**
     * The updated passive virtual transactions that contain the state transition
     * proofs of being committed to the BTC level anchor transaction above.
     */
    passiveAssetPsbts: Uint8Array | string[];
    /** The index of the (added) change output or -1 if no change was left over. */
    changeOutputIndex: number;
    /**
     * The list of UTXO lock leases that were acquired for the inputs in the funded
     * PSBT packet from lnd. Only inputs added to the PSBT by this RPC are locked,
     * inputs that were already present in the PSBT are not locked.
     */
    lndLockedUtxos: OutPoint[];
    /**
     * If set, the anchor transaction will not be broadcast to the network. This
     * is useful when an external system handles broadcasting, such as in custom
     * transaction packaging workflows.
     */
    skipAnchorTxBroadcast: boolean;
    /**
     * An optional short label for the transfer. This label can be used to track
     * the progress of the transfer via the logs or an event subscription.
     * Multiple transfers can share the same label.
     */
    label: string;
}

export interface NextInternalKeyRequest {
    /** The key family to derive the next internal key for. */
    keyFamily: number;
}

export interface NextInternalKeyResponse {
    /** The full key descriptor of the internal key that was derived. */
    internalKey: KeyDescriptor | undefined;
}

export interface NextScriptKeyRequest {
    /** The key family to derive the next script key for. */
    keyFamily: number;
}

export interface NextScriptKeyResponse {
    /**
     * The full script key information that was derived, including the
     * internal key and the tweaked script key.
     */
    scriptKey: ScriptKey | undefined;
}

export interface QueryInternalKeyRequest {
    /**
     * The internal key to look for. This can either be the 32-byte x-only raw
     * internal key or the 33-byte raw internal key with the parity byte.
     */
    internalKey: Uint8Array | string;
}

export interface QueryInternalKeyResponse {
    /** The full key descriptor of the internal key that was queried. */
    internalKey: KeyDescriptor | undefined;
}

export interface QueryScriptKeyRequest {
    /**
     * The tweaked script key to look for. This can either be the 32-byte
     * x-only tweaked script key or the 33-byte tweaked script key with the
     * parity byte.
     */
    tweakedScriptKey: Uint8Array | string;
}

export interface QueryScriptKeyResponse {
    /**
     * The full script key information that was queried, including the
     * internal key and the tweaked script key.
     */
    scriptKey: ScriptKey | undefined;
}

export interface ProveAssetOwnershipRequest {
    /**
     * The asset ID of the asset to prove ownership of. This is the 32-byte
     * asset ID that identifies a particular asset or tranche of assets.
     */
    assetId: Uint8Array | string;
    /** The script key that is used to spend the asset. */
    scriptKey: Uint8Array | string;
    /**
     * The outpoint of the asset UTXO that is being proven to be owned by the
     * prover.
     */
    outpoint: OutPoint | undefined;
    /**
     * An optional 32-byte challenge that may be used to bind the generated
     * proof. This challenge needs to be also presented on the
     * VerifyAssetOwnership RPC in order to check the proof against it.
     */
    challenge: Uint8Array | string;
}

export interface ProveAssetOwnershipResponse {
    proofWithWitness: Uint8Array | string;
}

export interface VerifyAssetOwnershipRequest {
    /**
     * The full ownership proof that was generated, including the witness data
     * that contains the proving signature.
     */
    proofWithWitness: Uint8Array | string;
    /**
     * An optional 32-byte challenge that may be used to check the ownership
     * proof against. This challenge must match the one that the prover used
     * on the ProveAssetOwnership RPC.
     */
    challenge: Uint8Array | string;
}

export interface VerifyAssetOwnershipResponse {
    /** Whether the ownership proof is valid or not. */
    validProof: boolean;
    /** The outpoint the proof commits to. */
    outpoint: OutPoint | undefined;
    /** The outpoint in the human-readable form "hash:index". */
    outpointStr: string;
    /** The block hash the output is part of. */
    blockHash: Uint8Array | string;
    /** The block hash as hexadecimal string of the byte-reversed hash. */
    blockHashStr: string;
    /** The block height of the block the output is part of. */
    blockHeight: number;
}

export interface RemoveUTXOLeaseRequest {
    /** The outpoint of the UTXO to remove the lease for. */
    outpoint: OutPoint | undefined;
}

export interface RemoveUTXOLeaseResponse {}

export interface DeclareScriptKeyRequest {
    /** The script key the wallet should be informed about. */
    scriptKey: ScriptKey | undefined;
}

export interface DeclareScriptKeyResponse {
    /**
     * The script key that was declared, including the internal key and the
     * tweaked script key.
     */
    scriptKey: ScriptKey | undefined;
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
     * a single BTC level anchor transaction. This RPC should be used if the BTC
     * level anchor transaction of the assets to be spent are encumbered by a
     * normal key and don't require any special spending conditions. For any custom
     * spending conditions on the BTC level, the two RPCs CommitVirtualPsbts and
     * PublishAndLogTransfer should be used instead (which in combination do the
     * same as this RPC but allow for more flexibility).
     */
    anchorVirtualPsbts(
        request?: DeepPartial<AnchorVirtualPsbtsRequest>
    ): Promise<SendAssetResponse>;
    /**
     * CommitVirtualPsbts creates the output commitments and proofs for the given
     * virtual transactions by committing them to the BTC level anchor transaction.
     * In addition, the BTC level anchor transaction is funded and prepared up to
     * the point where it is ready to be signed.
     */
    commitVirtualPsbts(
        request?: DeepPartial<CommitVirtualPsbtsRequest>
    ): Promise<CommitVirtualPsbtsResponse>;
    /**
     * PublishAndLogTransfer accepts a fully committed and signed anchor
     * transaction and publishes it to the Bitcoin network. It also logs the
     * transfer of the given active and passive assets in the database and ships
     * any outgoing proofs to the counterparties.
     */
    publishAndLogTransfer(
        request?: DeepPartial<PublishAndLogRequest>
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
    /** QueryInternalKey returns the key descriptor for the given internal key. */
    queryInternalKey(
        request?: DeepPartial<QueryInternalKeyRequest>
    ): Promise<QueryInternalKeyResponse>;
    /**
     * QueryScriptKey returns the full script key descriptor for the given tweaked
     * script key.
     */
    queryScriptKey(
        request?: DeepPartial<QueryScriptKeyRequest>
    ): Promise<QueryScriptKeyResponse>;
    /**
     * tapcli: `proofs proveownership`
     * ProveAssetOwnership creates an ownership proof embedded in an asset
     * transition proof. That ownership proof is a signed virtual transaction
     * spending the asset with a valid witness to prove the prover owns the keys
     * that can spend the asset.
     */
    proveAssetOwnership(
        request?: DeepPartial<ProveAssetOwnershipRequest>
    ): Promise<ProveAssetOwnershipResponse>;
    /**
     * tapcli: `proofs verifyownership`
     * VerifyAssetOwnership verifies the asset ownership proof embedded in the
     * given transition proof of an asset and returns true if the proof is valid.
     */
    verifyAssetOwnership(
        request?: DeepPartial<VerifyAssetOwnershipRequest>
    ): Promise<VerifyAssetOwnershipResponse>;
    /**
     * `tapcli: assets removelease`
     * RemoveUTXOLease removes the lease/lock/reservation of the given managed
     * UTXO.
     */
    removeUTXOLease(
        request?: DeepPartial<RemoveUTXOLeaseRequest>
    ): Promise<RemoveUTXOLeaseResponse>;
    /**
     * DeclareScriptKey declares a new script key to the wallet. This is useful
     * when the script key contains scripts, which would mean it wouldn't be
     * recognized by the wallet automatically. Declaring a script key will make any
     * assets sent to the script key be recognized as being local assets.
     */
    declareScriptKey(
        request?: DeepPartial<DeclareScriptKeyRequest>
    ): Promise<DeclareScriptKeyResponse>;
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
