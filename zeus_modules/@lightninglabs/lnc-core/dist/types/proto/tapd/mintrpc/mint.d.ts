import type { AssetType, AssetMeta } from '../taprootassets';
export declare enum BatchState {
    BATCH_STATE_UNKNOWN = "BATCH_STATE_UNKNOWN",
    BATCH_STATE_PEDNING = "BATCH_STATE_PEDNING",
    BATCH_STATE_FROZEN = "BATCH_STATE_FROZEN",
    BATCH_STATE_COMMITTED = "BATCH_STATE_COMMITTED",
    BATCH_STATE_BROADCAST = "BATCH_STATE_BROADCAST",
    BATCH_STATE_CONFIRMED = "BATCH_STATE_CONFIRMED",
    BATCH_STATE_FINALIZED = "BATCH_STATE_FINALIZED",
    BATCH_STATE_SEEDLING_CANCELLED = "BATCH_STATE_SEEDLING_CANCELLED",
    BATCH_STATE_SPROUT_CANCELLED = "BATCH_STATE_SPROUT_CANCELLED",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export interface MintAsset {
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
    /** The specific group key this asset should be minted with. */
    groupKey: Uint8Array | string;
    /**
     * The name of the asset in the batch that will anchor a new asset group.
     * This asset will be minted with the same group key as the anchor asset.
     */
    groupAnchor: string;
}
export interface MintAssetRequest {
    /** The asset to be minted. */
    asset: MintAsset | undefined;
    /**
     * If true, then the asset will be created with a group key, which allows for
     * future asset issuance.
     */
    enableEmission: boolean;
}
export interface MintAssetResponse {
    /**
     * A public key serialized in compressed format that can be used to uniquely
     * identify a pending minting batch. Responses that share the same key will be
     * batched into the same minting transaction.
     */
    batchKey: Uint8Array | string;
}
export interface MintingBatch {
    /** The internal public key of the batch. */
    batchKey: Uint8Array | string;
    /** The assets that are part of the batch. */
    assets: MintAsset[];
    /** The state of the batch. */
    state: BatchState;
}
export interface FinalizeBatchRequest {
}
export interface FinalizeBatchResponse {
    /** The internal public key of the batch. */
    batchKey: Uint8Array | string;
}
export interface CancelBatchRequest {
}
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
}
export interface ListBatchResponse {
    batches: MintingBatch[];
}
export interface Mint {
    /**
     * tapcli: `assets mint`
     * MintAsset will attempt to mint the set of assets (async by default to
     * ensure proper batching) specified in the request.
     */
    mintAsset(request?: DeepPartial<MintAssetRequest>): Promise<MintAssetResponse>;
    /**
     * tapcli: `assets mint finalize`
     * FinalizeBatch will attempt to finalize the current pending batch.
     */
    finalizeBatch(request?: DeepPartial<FinalizeBatchRequest>): Promise<FinalizeBatchResponse>;
    /**
     * tapcli: `assets mint cancel`
     * CancelBatch will attempt to cancel the current pending batch.
     */
    cancelBatch(request?: DeepPartial<CancelBatchRequest>): Promise<CancelBatchResponse>;
    /**
     * tapcli: `assets mint batches`
     * ListBatches lists the set of batches submitted to the daemon, including
     * pending and cancelled batches.
     */
    listBatches(request?: DeepPartial<ListBatchRequest>): Promise<ListBatchResponse>;
}
declare type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
declare type DeepPartial<T> = T extends Builtin ? T : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
export {};
//# sourceMappingURL=mint.d.ts.map