/* eslint-disable */
import type {
    AssetVersion,
    AssetType,
    AssetMeta,
    KeyDescriptor,
    ScriptKey,
    GroupKeyRequest,
    GroupVirtualTx,
    TapscriptFullTree,
    TapBranch,
    GroupWitness
} from '../taprootassets';

export enum BatchState {
    BATCH_STATE_UNKNOWN = 'BATCH_STATE_UNKNOWN',
    BATCH_STATE_PENDING = 'BATCH_STATE_PENDING',
    BATCH_STATE_FROZEN = 'BATCH_STATE_FROZEN',
    BATCH_STATE_COMMITTED = 'BATCH_STATE_COMMITTED',
    BATCH_STATE_BROADCAST = 'BATCH_STATE_BROADCAST',
    BATCH_STATE_CONFIRMED = 'BATCH_STATE_CONFIRMED',
    BATCH_STATE_FINALIZED = 'BATCH_STATE_FINALIZED',
    BATCH_STATE_SEEDLING_CANCELLED = 'BATCH_STATE_SEEDLING_CANCELLED',
    BATCH_STATE_SPROUT_CANCELLED = 'BATCH_STATE_SPROUT_CANCELLED',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface PendingAsset {
    /** The version of asset to mint. */
    assetVersion: AssetVersion;
    /** The type of the asset to be created. */
    assetType: AssetType;
    /** The name, or "tag" of the asset. This will affect the final asset ID. */
    name: string;
    /**
     * A blob that resents metadata related to the asset. This will affect the
     * final asset ID.
     */
    assetMeta: AssetMeta | undefined;
    /**
     * The total amount of units of the new asset that should be created. If the
     * AssetType is Collectible, then this field cannot be set.
     */
    amount: string;
    /**
     * If true, then the asset will be created with a new group key, which allows
     * for future asset issuance.
     */
    newGroupedAsset: boolean;
    /** The specific existing group key this asset should be minted with. */
    groupKey: Uint8Array | string;
    /**
     * The name of the asset in the batch that will anchor a new asset group.
     * This asset will be minted with the same group key as the anchor asset.
     */
    groupAnchor: string;
    /**
     * The optional key that will be used as the internal key for an asset group
     * created with this asset.
     */
    groupInternalKey: KeyDescriptor | undefined;
    /**
     * The optional root of a tapscript tree that will be used when constructing a
     * new asset group key. This enables future issuance authorized with a script
     * witness.
     */
    groupTapscriptRoot: Uint8Array | string;
    /**
     * The optional script key to use for the new asset. If no script key is given,
     * a BIP-86 key will be derived from the underlying wallet.
     */
    scriptKey: ScriptKey | undefined;
}

export interface UnsealedAsset {
    /** The pending asset with an unsealed asset group. */
    asset: PendingAsset | undefined;
    /** The group key request for the asset. */
    groupKeyRequest: GroupKeyRequest | undefined;
    /** The group virtual transaction for the asset. */
    groupVirtualTx: GroupVirtualTx | undefined;
}

export interface MintAsset {
    /** The version of asset to mint. */
    assetVersion: AssetVersion;
    /** The type of the asset to be created. */
    assetType: AssetType;
    /** The name, or "tag" of the asset. This will affect the final asset ID. */
    name: string;
    /**
     * A blob that resents metadata related to the asset. This will affect the
     * final asset ID.
     */
    assetMeta: AssetMeta | undefined;
    /**
     * The total amount of units of the new asset that should be created. If the
     * AssetType is Collectible, then this field cannot be set.
     */
    amount: string;
    /**
     * If true, then the asset will be created with a group key, which allows for
     * future asset issuance.
     */
    newGroupedAsset: boolean;
    /**
     * If true, then a group key or group anchor can be set to mint this asset into
     * an existing asset group.
     */
    groupedAsset: boolean;
    /** The specific existing group key this asset should be minted with. */
    groupKey: Uint8Array | string;
    /**
     * The name of the asset in the batch that will anchor a new asset group.
     * This asset will be minted with the same group key as the anchor asset.
     */
    groupAnchor: string;
    /**
     * The optional key that will be used as the internal key for an asset group
     * created with this asset.
     */
    groupInternalKey: KeyDescriptor | undefined;
    /**
     * The optional root of a tapscript tree that will be used when constructing a
     * new asset group key. This enables future issuance authorized with a script
     * witness.
     */
    groupTapscriptRoot: Uint8Array | string;
    /**
     * The optional script key to use for the new asset. If no script key is given,
     * a BIP-86 key will be derived from the underlying wallet.
     */
    scriptKey: ScriptKey | undefined;
    /**
     * Decimal display dictates the number of decimal places to shift the amount to
     * the left converting from Taproot Asset integer representation to a
     * UX-recognizable fractional quantity.
     *
     * For example, if the decimal_display value is 2 and there's 100 of those
     * assets, then a wallet would display the amount as "1.00". This field is
     * intended as information for wallets that display balances and has no impact
     * on the behavior of the daemon or any other part of the protocol. This value
     * is encoded in the MetaData field as a JSON field, therefore it is only
     * compatible with assets that have a JSON MetaData field.
     */
    decimalDisplay: number;
}

export interface MintAssetRequest {
    /** The asset to be minted. */
    asset: MintAsset | undefined;
    /**
     * If true, then the assets currently in the batch won't be returned in the
     * response. This is mainly to avoid a lot of data being transmitted and
     * possibly printed on the command line in the case of a very large batch.
     */
    shortResponse: boolean;
}

export interface MintAssetResponse {
    /** The pending batch the asset was added to. */
    pendingBatch: MintingBatch | undefined;
}

export interface MintingBatch {
    /**
     * A public key serialized in compressed format that can be used to uniquely
     * identify a pending minting batch. Responses that share the same key will be
     * batched into the same minting transaction.
     */
    batchKey: Uint8Array | string;
    /**
     * The transaction ID of the batch. Only populated if the batch has been
     * committed.
     */
    batchTxid: string;
    /** The state of the batch. */
    state: BatchState;
    /** The assets that are part of the batch. */
    assets: PendingAsset[];
    /** The time the batch was created as a Unix timestamp (in seconds). */
    createdAt: string;
    /** The current height of the block chain at the time of the batch creation. */
    heightHint: number;
    /**
     * The genesis transaction as a PSBT packet. Only populated if the batch has
     * been committed.
     */
    batchPsbt: Uint8Array | string;
}

export interface VerboseBatch {
    /** The minting batch, without any assets. */
    batch: MintingBatch | undefined;
    /** The assets that are part of the batch. */
    unsealedAssets: UnsealedAsset[];
}

export interface FundBatchRequest {
    /**
     * If true, then the assets currently in the batch won't be returned in the
     * response. This is mainly to avoid a lot of data being transmitted and
     * possibly printed on the command line in the case of a very large batch.
     */
    shortResponse: boolean;
    /** The optional fee rate to use for the minting transaction, in sat/kw. */
    feeRate: number;
    /**
     * An ordered list of TapLeafs, which will be used to construct a
     * Tapscript tree.
     */
    fullTree: TapscriptFullTree | undefined;
    /** A TapBranch that represents a Tapscript tree managed externally. */
    branch: TapBranch | undefined;
}

export interface FundBatchResponse {
    /** The funded batch. */
    batch: MintingBatch | undefined;
}

export interface SealBatchRequest {
    /**
     * If true, then the assets currently in the batch won't be returned in the
     * response. This is mainly to avoid a lot of data being transmitted and
     * possibly printed on the command line in the case of a very large batch.
     */
    shortResponse: boolean;
    /** The assetID, witness pairs that authorize asset membership in a group. */
    groupWitnesses: GroupWitness[];
}

export interface SealBatchResponse {
    /** The sealed batch. */
    batch: MintingBatch | undefined;
}

export interface FinalizeBatchRequest {
    /**
     * If true, then the assets currently in the batch won't be returned in the
     * response. This is mainly to avoid a lot of data being transmitted and
     * possibly printed on the command line in the case of a very large batch.
     */
    shortResponse: boolean;
    /** The optional fee rate to use for the minting transaction, in sat/kw. */
    feeRate: number;
    /**
     * An ordered list of TapLeafs, which will be used to construct a
     * Tapscript tree.
     */
    fullTree: TapscriptFullTree | undefined;
    /** A TapBranch that represents a Tapscript tree managed externally. */
    branch: TapBranch | undefined;
}

export interface FinalizeBatchResponse {
    /** The finalized batch. */
    batch: MintingBatch | undefined;
}

export interface CancelBatchRequest {}

export interface CancelBatchResponse {
    /** The internal public key of the batch. */
    batchKey: Uint8Array | string;
}

export interface ListBatchRequest {
    /**
     * The optional batch key of the batch to list, specified as raw bytes
     * (gRPC only).
     */
    batchKey: Uint8Array | string | undefined;
    /**
     * The optional batch key of the batch to list, specified as a hex
     * encoded string (use this for REST).
     */
    batchKeyStr: string | undefined;
    /**
     * If true, pending asset group information will be shown for the pending
     * batch.
     */
    verbose: boolean;
}

export interface ListBatchResponse {
    batches: VerboseBatch[];
}

export interface SubscribeMintEventsRequest {
    /**
     * If true, then the assets currently in the batch won't be returned in the
     * event's batch. This is mainly to avoid a lot of data being transmitted and
     * possibly printed on the command line in the case of a very large batch.
     */
    shortResponse: boolean;
}

export interface MintEvent {
    /** Execute timestamp (Unix timestamp in microseconds). */
    timestamp: string;
    /**
     * The last state of the batch that was successfully executed. If error
     * below is set, then the batch_state is the state that lead to the error
     * during its execution.
     */
    batchState: BatchState;
    /** The batch that the event is for. */
    batch: MintingBatch | undefined;
    /** An optional error, indicating that executing the batch_state failed. */
    error: string;
}

export interface Mint {
    /**
     * tapcli: `assets mint`
     * MintAsset will attempt to mint the set of assets (async by default to
     * ensure proper batching) specified in the request. The pending batch is
     * returned that shows the other pending assets that are part of the next
     * batch. This call will block until the operation succeeds (asset is staged
     * in the batch) or fails.
     */
    mintAsset(
        request?: DeepPartial<MintAssetRequest>
    ): Promise<MintAssetResponse>;
    /**
     * tapcli `assets mint fund`
     * FundBatch will attempt to fund the current pending batch with a genesis
     * input, or create a new funded batch if no batch exists yet. This RPC is only
     * needed if a custom witness is needed to finalize the batch. Otherwise,
     * FinalizeBatch can be called directly.
     */
    fundBatch(
        request?: DeepPartial<FundBatchRequest>
    ): Promise<FundBatchResponse>;
    /**
     * tapcli `assets mint seal`
     * SealBatch will attempt to seal the current pending batch by creating and
     * validating asset group witness for all assets in the batch. If a witness
     * is not provided, a signature will be derived to serve as the witness. This
     * RPC is only needed if any assets in the batch have a custom asset group key
     * that require an external signer. Otherwise, FinalizeBatch can be called
     * directly.
     */
    sealBatch(
        request?: DeepPartial<SealBatchRequest>
    ): Promise<SealBatchResponse>;
    /**
     * tapcli: `assets mint finalize`
     * FinalizeBatch will attempt to finalize the current pending batch.
     */
    finalizeBatch(
        request?: DeepPartial<FinalizeBatchRequest>
    ): Promise<FinalizeBatchResponse>;
    /**
     * tapcli: `assets mint cancel`
     * CancelBatch will attempt to cancel the current pending batch.
     */
    cancelBatch(
        request?: DeepPartial<CancelBatchRequest>
    ): Promise<CancelBatchResponse>;
    /**
     * tapcli: `assets mint batches`
     * ListBatches lists the set of batches submitted to the daemon, including
     * pending and cancelled batches.
     */
    listBatches(
        request?: DeepPartial<ListBatchRequest>
    ): Promise<ListBatchResponse>;
    /**
     * tapcli: `events mint`
     * SubscribeMintEvents allows a caller to subscribe to mint events for asset
     * creation batches.
     */
    subscribeMintEvents(
        request?: DeepPartial<SubscribeMintEventsRequest>,
        onMessage?: (msg: MintEvent) => void,
        onError?: (err: Error) => void
    ): void;
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
