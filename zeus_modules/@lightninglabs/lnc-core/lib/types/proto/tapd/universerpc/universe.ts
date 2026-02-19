/* eslint-disable */
import type {
    AssetType,
    Asset,
    AssetMeta,
    GenesisReveal,
    GroupKeyReveal
} from '../taprootassets';
import type { AssetOutPoint, OutPoint } from '../tapcommon';

export enum ProofType {
    PROOF_TYPE_UNSPECIFIED = 'PROOF_TYPE_UNSPECIFIED',
    PROOF_TYPE_ISSUANCE = 'PROOF_TYPE_ISSUANCE',
    PROOF_TYPE_TRANSFER = 'PROOF_TYPE_TRANSFER',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum UniverseSyncMode {
    /**
     * SYNC_ISSUANCE_ONLY - A sync node that indicates that only new asset creation (minting) proofs
     * should be synced.
     */
    SYNC_ISSUANCE_ONLY = 'SYNC_ISSUANCE_ONLY',
    /**
     * SYNC_FULL - A syncing mode that indicates that all asset proofs should be synced.
     * This includes normal transfers as well.
     */
    SYNC_FULL = 'SYNC_FULL',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum AssetQuerySort {
    SORT_BY_NONE = 'SORT_BY_NONE',
    SORT_BY_ASSET_NAME = 'SORT_BY_ASSET_NAME',
    SORT_BY_ASSET_ID = 'SORT_BY_ASSET_ID',
    SORT_BY_ASSET_TYPE = 'SORT_BY_ASSET_TYPE',
    SORT_BY_TOTAL_SYNCS = 'SORT_BY_TOTAL_SYNCS',
    SORT_BY_TOTAL_PROOFS = 'SORT_BY_TOTAL_PROOFS',
    SORT_BY_GENESIS_HEIGHT = 'SORT_BY_GENESIS_HEIGHT',
    SORT_BY_TOTAL_SUPPLY = 'SORT_BY_TOTAL_SUPPLY',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum SortDirection {
    SORT_DIRECTION_ASC = 'SORT_DIRECTION_ASC',
    SORT_DIRECTION_DESC = 'SORT_DIRECTION_DESC',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum AssetTypeFilter {
    FILTER_ASSET_NONE = 'FILTER_ASSET_NONE',
    FILTER_ASSET_NORMAL = 'FILTER_ASSET_NORMAL',
    FILTER_ASSET_COLLECTIBLE = 'FILTER_ASSET_COLLECTIBLE',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface MultiverseRootRequest {
    /** The proof type to calculate the multiverse root for. */
    proofType: ProofType;
    /**
     * An optional list of universe IDs to include in the multiverse root. If
     * none are specified, then all known universes of the given proof type are
     * included. NOTE: The proof type within the IDs must either be unspecified
     * or match the proof type above.
     */
    specificIds: ID[];
}

export interface MultiverseRootResponse {
    /** The root of the multiverse tree. */
    multiverseRoot: MerkleSumNode | undefined;
}

export interface AssetRootRequest {
    /**
     * If true, then the response will include the amounts for each asset ID
     * of grouped assets.
     */
    withAmountsById: boolean;
    /** The offset for the page. */
    offset: number;
    /** The length limit for the page. */
    limit: number;
    /** The direction of the page. */
    direction: SortDirection;
}

export interface MerkleSumNode {
    /** The MS-SMT root hash for the branch node. */
    rootHash: Uint8Array | string;
    /**
     * The root sum of the branch node. This is hashed to create the root_hash
     * along with the left and right siblings. This value represents the total
     * known supply of the asset.
     */
    rootSum: string;
}

export interface ID {
    /** The 32-byte asset ID specified as raw bytes (gRPC only). */
    assetId: Uint8Array | string | undefined;
    /** The 32-byte asset ID encoded as a hex string (use this for REST). */
    assetIdStr: string | undefined;
    /** The 32-byte asset group key specified as raw bytes (gRPC only). */
    groupKey: Uint8Array | string | undefined;
    /**
     * The 32-byte asset group key encoded as hex string (use this for
     * REST).
     */
    groupKeyStr: string | undefined;
    proofType: ProofType;
}

export interface UniverseRoot {
    /** The ID of the asset universe root. */
    id: ID | undefined;
    /**
     * The merkle sum sparse merkle tree root associated with the above
     * universe ID.
     */
    mssmtRoot: MerkleSumNode | undefined;
    /** The name of the asset. */
    assetName: string;
    /**
     * A map of hex encoded asset IDs to the number of units minted for that
     * asset. This only contains more than one entry for grouped assets and in
     * that case represents the whole list of assets currently known to exist
     * within the group. For single (non-grouped) assets, this is equal to the
     * asset ID above and the sum in the mssmt_root. A hex encoded string is
     * used as the map key because gRPC does not support using raw bytes for a
     * map key.
     */
    amountsByAssetId: { [key: string]: string };
}

export interface UniverseRoot_AmountsByAssetIdEntry {
    key: string;
    value: string;
}

export interface AssetRootResponse {
    /**
     * A map of the set of known universe roots for each asset. The key in the
     * map is the 32-byte asset_id or group key hash.
     */
    universeRoots: { [key: string]: UniverseRoot };
}

export interface AssetRootResponse_UniverseRootsEntry {
    key: string;
    value: UniverseRoot | undefined;
}

export interface AssetRootQuery {
    /** An ID value to uniquely identify a Universe root. */
    id: ID | undefined;
}

export interface QueryRootResponse {
    /** The issuance universe root for the given asset ID or group key. */
    issuanceRoot: UniverseRoot | undefined;
    /** The transfer universe root for the given asset ID or group key. */
    transferRoot: UniverseRoot | undefined;
}

export interface DeleteRootQuery {
    /** An ID value to uniquely identify a Universe root. */
    id: ID | undefined;
}

export interface DeleteRootResponse {}

export interface Outpoint {
    /** The output as a hex encoded (and reversed!) string. */
    hashStr: string;
    /** The index of the output. */
    index: number;
}

export interface AssetKey {
    opStr: string | undefined;
    op: Outpoint | undefined;
    scriptKeyBytes: Uint8Array | string | undefined;
    scriptKeyStr: string | undefined;
}

export interface AssetLeafKeysRequest {
    /** The ID of the asset to query for. */
    id: ID | undefined;
    /** The offset for the page. */
    offset: number;
    /** The length limit for the page. */
    limit: number;
    /** The direction of the page. */
    direction: SortDirection;
}

export interface AssetLeafKeyResponse {
    /** The set of asset leaf keys for the given asset ID or group key. */
    assetKeys: AssetKey[];
}

export interface AssetLeaf {
    /** The asset included in the leaf. */
    asset: Asset | undefined;
    /**
     * The asset issuance or transfer proof, which proves that the asset
     * specified above was issued or transferred properly. This is always just
     * an individual mint/transfer proof and never a proof file.
     */
    proof: Uint8Array | string;
}

export interface AssetLeafResponse {
    /** The set of asset leaves for the given asset ID or group key. */
    leaves: AssetLeaf[];
}

export interface UniverseKey {
    /** The ID of the asset to query for. */
    id: ID | undefined;
    /** The asset key to query for. */
    leafKey: AssetKey | undefined;
}

export interface AssetProofResponse {
    /** The original request for the issuance proof. */
    req: UniverseKey | undefined;
    /** The Universe root that includes this asset leaf. */
    universeRoot: UniverseRoot | undefined;
    /**
     * An inclusion proof for the asset leaf included below. The value is that
     * issuance proof itself, with a sum value of the amount of the asset.
     */
    universeInclusionProof: Uint8Array | string;
    /** The asset leaf itself, which includes the asset and the issuance proof. */
    assetLeaf: AssetLeaf | undefined;
    /**
     * MultiverseRoot is the root of the multiverse tree that includes this
     * asset leaf.
     */
    multiverseRoot: MerkleSumNode | undefined;
    /**
     * MultiverseInclusionProof is the inclusion proof for the asset leaf in the
     * multiverse.
     */
    multiverseInclusionProof: Uint8Array | string;
    /**
     * The issuance related data for an issuance asset leaf. This is empty for
     * any other type of asset leaf.
     */
    issuanceData: IssuanceData | undefined;
}

export interface IssuanceData {
    /** The reveal meta data associated with the proof, if available. */
    metaReveal: AssetMeta | undefined;
    /**
     * GenesisReveal is an optional field that is the Genesis information for
     * the asset. This is required for minting proofs.
     */
    genesisReveal: GenesisReveal | undefined;
    /**
     * GroupKeyReveal is an optional field that includes the information needed
     * to derive the tweaked group key.
     */
    groupKeyReveal: GroupKeyReveal | undefined;
}

export interface AssetProof {
    /** The ID of the asset to insert the proof for. */
    key: UniverseKey | undefined;
    /** The asset leaf to insert into the Universe tree. */
    assetLeaf: AssetLeaf | undefined;
}

export interface PushProofRequest {
    /** The ID of the asset to push the proof for. */
    key: UniverseKey | undefined;
    /** The universe server to push the proof to. */
    server: UniverseFederationServer | undefined;
}

export interface PushProofResponse {
    /** The ID of the asset a push was requested for. */
    key: UniverseKey | undefined;
}

export interface InfoRequest {}

export interface InfoResponse {
    /**
     * A pseudo-random runtime ID for the current instance of the Universe
     * server, changes with each restart. Mainly used to identify identical
     * servers when they are exposed under different hostnames/ports.
     */
    runtimeId: string;
}

export interface SyncTarget {
    /** The ID of the asset to sync. */
    id: ID | undefined;
}

export interface SyncRequest {
    /**
     * TODO(roasbeef): accept connection type? so can pass along self-signed
     * cert, also brontide based RPC handshake
     */
    universeHost: string;
    /** The sync mode. This determines what type of proofs are synced. */
    syncMode: UniverseSyncMode;
    /**
     * The set of assets to sync. If none are specified, then all assets are
     * synced.
     */
    syncTargets: SyncTarget[];
}

export interface SyncedUniverse {
    /** The old Universe root for the synced asset. */
    oldAssetRoot: UniverseRoot | undefined;
    /** The new Universe root for the synced asset. */
    newAssetRoot: UniverseRoot | undefined;
    /** The set of new asset leaves that were synced. */
    newAssetLeaves: AssetLeaf[];
}

export interface StatsRequest {}

export interface SyncResponse {
    /** The set of synced asset Universes. */
    syncedUniverses: SyncedUniverse[];
}

export interface UniverseFederationServer {
    /**
     * The host of the federation server, which is used to connect to the
     * server to push proofs and sync new proofs.
     */
    host: string;
    /**
     * The numeric ID of the federation server. This is used to identify
     * existing servers when adding or deleting them from the federation.
     */
    id: number;
}

export interface ListFederationServersRequest {}

export interface ListFederationServersResponse {
    /**
     * The list of federation servers that make up the local Universe
     * federation.
     */
    servers: UniverseFederationServer[];
}

export interface AddFederationServerRequest {
    /** The federation server to add to the local Universe federation. */
    servers: UniverseFederationServer[];
}

export interface AddFederationServerResponse {}

export interface DeleteFederationServerRequest {
    /** The federation server to delete from the local Universe federation. */
    servers: UniverseFederationServer[];
}

export interface DeleteFederationServerResponse {}

export interface StatsResponse {
    numTotalAssets: string;
    numTotalGroups: string;
    numTotalSyncs: string;
    numTotalProofs: string;
}

export interface AssetStatsQuery {
    /** The asset name filter. If this is empty, then all assets are returned. */
    assetNameFilter: string;
    /** The asset ID filter. If this is empty, then all assets are returned. */
    assetIdFilter: Uint8Array | string;
    /**
     * The asset type filter. If this is set to FILTER_ASSET_NONE, then all
     * assets are returned. If set to FILTER_ASSET_NORMAL, then only normal
     * assets are returned. If set to FILTER_ASSET_COLLECTIBLE, then only
     * collectible assets are returned.
     */
    assetTypeFilter: AssetTypeFilter;
    /**
     * The sort order for the query. If this is set to SORT_BY_NONE, then the
     * results are not sorted.
     */
    sortBy: AssetQuerySort;
    /** The offset for the page. This is used for pagination. */
    offset: number;
    /** The length limit for the page. This is used for pagination. */
    limit: number;
    /**
     * The direction of the sort. If this is set to SORT_DIRECTION_ASC, then
     * the results are sorted in ascending order. If set to
     * SORT_DIRECTION_DESC, then the results are sorted in descending order.
     */
    direction: SortDirection;
}

export interface AssetStatsSnapshot {
    /**
     * The group key of the asset group. If this is empty, then the asset is
     * not part of a group.
     */
    groupKey: Uint8Array | string;
    /**
     * The total supply of the asset group. If the asset is not part of an asset
     * group then this is always zero.
     */
    groupSupply: string;
    /**
     * The group anchor that was used to group assets together into an asset
     * group. This is only set if the asset is part of an asset group.
     */
    groupAnchor: AssetStatsAsset | undefined;
    /**
     * If the asset is not part of an asset group, then this is the asset the
     * stats below refer to.
     */
    asset: AssetStatsAsset | undefined;
    /**
     * The total number of syncs either for the asset group or the single asset
     * if it is not part of a group.
     */
    totalSyncs: string;
    /**
     * The total number of proofs either for the asset group or the single asset
     * if it is not part of a group.
     */
    totalProofs: string;
}

export interface AssetStatsAsset {
    /** The ID of the asset. */
    assetId: Uint8Array | string;
    /**
     * The asset's genesis point, which is the outpoint of the genesis
     * transaction that created the asset. This is a hex encoded string.
     */
    genesisPoint: string;
    /**
     * The total supply of the asset. This is the total number of units of the
     * asset that have been issued.
     */
    totalSupply: string;
    /** The human-readable name of the asset. */
    assetName: string;
    /**
     * The type of the asset. This can be either a normal asset or a collectible
     * asset.
     */
    assetType: AssetType;
    /** The height of the block at which the asset was created. */
    genesisHeight: number;
    /**
     * The timestamp of the block at which the asset was created, in Unix epoch
     * time (seconds).
     */
    genesisTimestamp: string;
    /**
     * The anchor point of the asset, which is a human-readable string that
     * represents the asset's anchor point in the blockchain.
     */
    anchorPoint: string;
    /**
     * The decimal display value for the asset. This is the number of decimal
     * places that the asset can be divided into.
     */
    decimalDisplay: number;
}

export interface UniverseAssetStats {
    /** The asset statistics snapshot for the queried assets. */
    assetStats: AssetStatsSnapshot[];
}

export interface QueryEventsRequest {
    /** The start timestamp for the query, in Unix epoch time (seconds). */
    startTimestamp: string;
    /** The end timestamp for the query, in Unix epoch time (seconds). */
    endTimestamp: string;
}

export interface QueryEventsResponse {
    /**
     * The list of grouped universe events that occurred within the specified
     * time range. Each entry in the list represents a day, with the number of
     * sync and new proof events that occurred on that day.
     */
    events: GroupedUniverseEvents[];
}

export interface GroupedUniverseEvents {
    /** The date the events occurred on, formatted as YYYY-MM-DD. */
    date: string;
    /** The number of sync events that occurred on this date. */
    syncEvents: string;
    /** The number of new proof events that occurred on this date. */
    newProofEvents: string;
}

export interface SetFederationSyncConfigRequest {
    /** The global federation sync configs for the given proof types. */
    globalSyncConfigs: GlobalFederationSyncConfig[];
    /** The asset federation sync configs for the given universe IDs. */
    assetSyncConfigs: AssetFederationSyncConfig[];
}

export interface SetFederationSyncConfigResponse {}

/**
 * GlobalFederationSyncConfig is a global proof type specific configuration
 * for universe federation syncing.
 */
export interface GlobalFederationSyncConfig {
    /** proof_type is the universe proof type which this config applies to. */
    proofType: ProofType;
    /**
     * allow_sync_insert is a boolean that indicates whether leaves from
     * universes of the given proof type have may be inserted via federation
     * sync.
     */
    allowSyncInsert: boolean;
    /**
     * allow_sync_export is a boolean that indicates whether leaves from
     * universes of the given proof type have may be exported via federation
     * sync.
     */
    allowSyncExport: boolean;
}

/**
 * AssetFederationSyncConfig is an asset universe specific configuration for
 * federation syncing.
 */
export interface AssetFederationSyncConfig {
    /** id is the ID of the universe to configure. */
    id: ID | undefined;
    /**
     * allow_sync_insert is a boolean that indicates whether leaves from
     * universes of the given proof type have may be inserted via federation
     * sync.
     */
    allowSyncInsert: boolean;
    /**
     * allow_sync_export is a boolean that indicates whether leaves from
     * universes of the given proof type have may be exported via federation
     * sync.
     */
    allowSyncExport: boolean;
}

export interface QueryFederationSyncConfigRequest {
    /** Target universe ID(s). */
    id: ID[];
}

export interface QueryFederationSyncConfigResponse {
    /** The global federation sync configs for the given proof types. */
    globalSyncConfigs: GlobalFederationSyncConfig[];
    /** The asset federation sync configs for the given universe IDs. */
    assetSyncConfigs: AssetFederationSyncConfig[];
}

export interface IgnoreAssetOutPointRequest {
    /** The outpoint of the asset to ignore. */
    assetOutPoint: AssetOutPoint | undefined;
    /** The amount of asset units at the associated asset outpoint. */
    amount: string;
}

export interface IgnoreAssetOutPointResponse {
    /**
     * The key identifying the signed ignore outpoint leaf in the ignore supply
     * commitment subtree.
     */
    leafKey: Uint8Array | string;
    /** The signed ignore outpoint leaf in the ignore supply commitment tree. */
    leaf: MerkleSumNode | undefined;
}

export interface UpdateSupplyCommitRequest {
    /** The 32-byte asset group key specified as raw bytes (gRPC only). */
    groupKeyBytes: Uint8Array | string | undefined;
    /**
     * The 32-byte asset group key encoded as hex string (use this for
     * REST).
     */
    groupKeyStr: string | undefined;
}

export interface UpdateSupplyCommitResponse {}

export interface FetchSupplyCommitRequest {
    /** The 32-byte asset group key specified as raw bytes (gRPC only). */
    groupKeyBytes: Uint8Array | string | undefined;
    /**
     * The 32-byte asset group key encoded as hex string (use this for
     * REST).
     */
    groupKeyStr: string | undefined;
    /**
     * Fetch the the supply commitment that created this new commitment
     * output on chain.
     */
    commitOutpoint: OutPoint | undefined;
    /**
     * Fetch the supply commitment that spent the specified commitment
     * output on chain to create a new supply commitment. This can be used
     * to traverse the chain of supply commitments by watching the spend of
     * the commitment output.
     */
    spentCommitOutpoint: OutPoint | undefined;
    /**
     * Fetch the very first supply commitment for the asset group. This
     * returns the initial supply commitment that spent the pre-commitment
     * output of the very first asset mint of a grouped asset (also known
     * as the group anchor). This is useful as the starting point to fetch
     * all supply commitments for a grouped asset one by one.
     */
    veryFirst: boolean | undefined;
    /**
     * Fetch the latest supply commitment for the asset group. This returns
     * the most recent supply commitment that is anchored on chain for the
     * asset group. This is useful to always get the current supply state
     * of the asset group.
     */
    latest: boolean | undefined;
}

export interface SupplyCommitSubtreeRoot {
    /** The type of the supply commit subtree. */
    type: string;
    /** The root node of the supply commit subtree. */
    rootNode: MerkleSumNode | undefined;
    /**
     * The leaf key which locates the subtree leaf node in the supply commit
     * tree.
     */
    supplyTreeLeafKey: Uint8Array | string;
    /** The inclusion proof for the supply commit subtree root node. */
    supplyTreeInclusionProof: Uint8Array | string;
}

export interface FetchSupplyCommitResponse {
    /**
     * The supply commitment chain data that contains both the commitment and
     * chain proof information.
     */
    chainData: SupplyCommitChainData | undefined;
    /**
     * The total number of satoshis in on-chain fees paid by the supply
     * commitment transaction.
     */
    txChainFeesSats: string;
    /** The root of the issuance tree for the specified asset. */
    issuanceSubtreeRoot: SupplyCommitSubtreeRoot | undefined;
    /** The root of the burn tree for the specified asset. */
    burnSubtreeRoot: SupplyCommitSubtreeRoot | undefined;
    /** The root of the ignore tree for the specified asset. */
    ignoreSubtreeRoot: SupplyCommitSubtreeRoot | undefined;
    /**
     * The issuance leaves that were added by this supply commitment. Does not
     * include leaves that were already present in the issuance subtree before
     * the block height at which this supply commitment was anchored.
     */
    issuanceLeaves: SupplyLeafEntry[];
    /**
     * The burn leaves that were added by this supply commitment. Does not
     * include leaves that were already present in the burn subtree before
     * the block height at which this supply commitment was anchored.
     */
    burnLeaves: SupplyLeafEntry[];
    /**
     * The ignore leaves that were added by this supply commitment. Does not
     * include leaves that were already present in the ignore subtree before
     * the block height at which this supply commitment was anchored.
     */
    ignoreLeaves: SupplyLeafEntry[];
    /**
     * The total outstanding supply of the asset after applying all the supply
     * changes (issuance, burn, ignore) included in this supply commitment.
     */
    totalOutstandingSupply: string;
    /**
     * The outpoint of the previous commitment that this new commitment is
     * spending. This must be set unless this is the very first supply
     * commitment of a grouped asset.
     */
    spentCommitmentOutpoint: OutPoint | undefined;
    /**
     * A map of block height to supply leaf block header for all block heights
     * referenced in supply leaves.
     */
    blockHeaders: { [key: number]: SupplyLeafBlockHeader };
}

export interface FetchSupplyCommitResponse_BlockHeadersEntry {
    key: number;
    value: SupplyLeafBlockHeader | undefined;
}

export interface FetchSupplyLeavesRequest {
    /** The 32-byte asset group key specified as raw bytes (gRPC only). */
    groupKeyBytes: Uint8Array | string | undefined;
    /**
     * The 32-byte asset group key encoded as hex string (use this for
     * REST).
     */
    groupKeyStr: string | undefined;
    /** The start block height for the range of supply leaves to fetch. */
    blockHeightStart: number;
    /** The end block height for the range of supply leaves to fetch. */
    blockHeightEnd: number;
    /**
     * Optional: A list of issuance leaf keys. For each key in this list,
     * the endpoint will generate and return an inclusion proof.
     */
    issuanceLeafKeys: Uint8Array | string[];
    /**
     * Optional: A list of burn leaf keys. For each key in this list,
     * the endpoint will generate and return an inclusion proof.
     */
    burnLeafKeys: Uint8Array | string[];
    /**
     * Optional: A list of ignore leaf keys. For each key in this list, the
     * endpoint will generate and return an inclusion proof.
     */
    ignoreLeafKeys: Uint8Array | string[];
}

/**
 * SupplyLeafKey identifies a supply leaf entry. It contains the components
 * used to derive the key, which is computed as a hash of these fields.
 */
export interface SupplyLeafKey {
    /** The outpoint associated with the supply leaf. */
    outpoint: Outpoint | undefined;
    /**
     * The script key of the supply leaf. This is the script key of the asset
     * point.
     */
    scriptKey: Uint8Array | string;
    /**
     * The asset ID associated with the supply leaf. This is only set for
     * ignore type supply leaves.
     */
    assetId: Uint8Array | string;
}

export interface SupplyLeafEntry {
    /** The key that identifies the supply leaf in the supply commitment subtree. */
    leafKey: SupplyLeafKey | undefined;
    /**
     * The merkle sum node representing the supply leaf in the supply commitment
     * subtree.
     */
    leafNode: MerkleSumNode | undefined;
    /** The block height at which the supply leaf was created. */
    blockHeight: number;
    /** The raw serialized bytes of the supply leaf. */
    rawLeaf: Uint8Array | string;
}

export interface SupplyLeafBlockHeader {
    /** Block header timestamp in seconds since unix epoch. */
    timestamp: string;
    /** 32-byte block header hash. */
    hash: Uint8Array | string;
}

export interface FetchSupplyLeavesResponse {
    issuanceLeaves: SupplyLeafEntry[];
    burnLeaves: SupplyLeafEntry[];
    ignoreLeaves: SupplyLeafEntry[];
    /**
     * Inclusion proofs for each issuance leaf key provided in the request.
     * Each entry corresponds to the key at the same index in
     * `issuance_leaf_keys`.
     */
    issuanceLeafInclusionProofs: Uint8Array | string[];
    /**
     * Inclusion proofs for each burn leaf key provided in the request.
     * Each entry corresponds to the key at the same index in `burn_leaf_keys`.
     */
    burnLeafInclusionProofs: Uint8Array | string[];
    /**
     * Inclusion proofs for each ignored leaf key provided in the request.
     * Each entry corresponds to the key at the same index in
     * `ignore_leaf_keys`.
     */
    ignoreLeafInclusionProofs: Uint8Array | string[];
    /**
     * A map of block height to supply leaf block header for all block heights
     * referenced in supply leaves.
     */
    blockHeaders: { [key: number]: SupplyLeafBlockHeader };
}

export interface FetchSupplyLeavesResponse_BlockHeadersEntry {
    key: number;
    value: SupplyLeafBlockHeader | undefined;
}

/**
 * SupplyCommitChainData represents the on-chain artifacts for a supply
 * commitment update.
 */
export interface SupplyCommitChainData {
    /** The raw transaction that created the root commitment. */
    txn: Uint8Array | string;
    /** The index of the output in the transaction where the commitment resides. */
    txOutIdx: number;
    /** The internal key used to create the commitment output. */
    internalKey: Uint8Array | string;
    /** The taproot output key used to create the commitment output. */
    outputKey: Uint8Array | string;
    /**
     * The root hash of the supply tree that contains the set of
     * sub-commitments. The sum value of this tree is the outstanding supply
     * value.
     */
    supplyRootHash: Uint8Array | string;
    /**
     * The sum value of the supply root tree, representing the outstanding
     * supply amount.
     */
    supplyRootSum: string;
    /**
     * The block header of the block that contains the supply commitment
     * transaction.
     */
    blockHeader: Uint8Array | string;
    /** The hash of the block that contains the commitment. */
    blockHash: Uint8Array | string;
    /**
     * The block height of the block that contains the supply commitment
     * transaction.
     */
    blockHeight: number;
    /**
     * The merkle proof that proves that the supply commitment transaction is
     * included in the block.
     */
    txBlockMerkleProof: Uint8Array | string;
    /** The index of the supply commitment transaction in the block. */
    txIndex: number;
    /** The outpoint in the transaction where the commitment resides. */
    commitOutpoint: string;
}

export interface InsertSupplyCommitRequest {
    /** The 32-byte asset group key specified as raw bytes (gRPC only). */
    groupKeyBytes: Uint8Array | string | undefined;
    /**
     * The 32-byte asset group key encoded as hex string (use this for
     * REST).
     */
    groupKeyStr: string | undefined;
    /**
     * The supply commitment chain data that contains both the commitment and
     * chain proof information.
     */
    chainData: SupplyCommitChainData | undefined;
    /**
     * The outpoint of the previous commitment that this new commitment is
     * spending. This must be set unless this is the very first supply
     * commitment of a grouped asset.
     */
    spentCommitmentOutpoint: OutPoint | undefined;
    /** The supply leaves that represent the supply changes for the asset group. */
    issuanceLeaves: SupplyLeafEntry[];
    burnLeaves: SupplyLeafEntry[];
    ignoreLeaves: SupplyLeafEntry[];
}

export interface InsertSupplyCommitResponse {}

export interface Universe {
    /**
     * tapcli: `universe multiverse`
     * MultiverseRoot returns the root of the multiverse tree. This is useful to
     * determine the equality of two multiverse trees, since the root can directly
     * be compared to another multiverse root to find out if a sync is required.
     */
    multiverseRoot(
        request?: DeepPartial<MultiverseRootRequest>
    ): Promise<MultiverseRootResponse>;
    /**
     * tapcli: `universe roots`
     * AssetRoots queries for the known Universe roots associated with each known
     * asset. These roots represent the supply/audit state for each known asset.
     */
    assetRoots(
        request?: DeepPartial<AssetRootRequest>
    ): Promise<AssetRootResponse>;
    /**
     * tapcli: `universe roots`
     * QueryAssetRoots attempts to locate the current Universe root for a specific
     * asset. This asset can be identified by its asset ID or group key.
     */
    queryAssetRoots(
        request?: DeepPartial<AssetRootQuery>
    ): Promise<QueryRootResponse>;
    /**
     * tapcli: `universe delete`
     * DeleteAssetRoot deletes the Universe root for a specific asset, including
     * all asoociated universe keys, leaves, and events.
     */
    deleteAssetRoot(
        request?: DeepPartial<DeleteRootQuery>
    ): Promise<DeleteRootResponse>;
    /**
     * tapcli: `universe keys`
     * AssetLeafKeys queries for the set of Universe keys associated with a given
     * asset_id or group_key. Each key takes the form: (outpoint, script_key),
     * where outpoint is an outpoint in the Bitcoin blockchain that anchors a
     * valid Taproot Asset commitment, and script_key is the script_key of
     * the asset within the Taproot Asset commitment for the given asset_id or
     * group_key.
     */
    assetLeafKeys(
        request?: DeepPartial<AssetLeafKeysRequest>
    ): Promise<AssetLeafKeyResponse>;
    /**
     * tapcli: `universe leaves`
     * AssetLeaves queries for the set of asset leaves (the values in the Universe
     * MS-SMT tree) for a given asset_id or group_key. These represents either
     * asset issuance events (they have a genesis witness) or asset transfers that
     * took place on chain. The leaves contain a normal Taproot Asset proof, as
     * well as details for the asset.
     */
    assetLeaves(request?: DeepPartial<ID>): Promise<AssetLeafResponse>;
    /**
     * tapcli: `universe proofs query`
     * QueryProof attempts to query for an issuance or transfer proof for a given
     * asset based on its UniverseKey. A UniverseKey is composed of the Universe
     * ID (asset_id/group_key) and also a leaf key (outpoint || script_key). If
     * found, then the issuance proof is returned that includes an inclusion proof
     * to the known Universe root, as well as a Taproot Asset state transition or
     * issuance proof for the said asset.
     */
    queryProof(request?: DeepPartial<UniverseKey>): Promise<AssetProofResponse>;
    /**
     * tapcli: `universe proofs insert`
     * InsertProof attempts to insert a new issuance or transfer proof into the
     * Universe tree specified by the UniverseKey. If valid, then the proof is
     * inserted into the database, with a new Universe root returned for the
     * updated asset_id/group_key.
     */
    insertProof(request?: DeepPartial<AssetProof>): Promise<AssetProofResponse>;
    /**
     * tapcli: `universe proofs push`
     * PushProof attempts to query the local universe for a proof specified by a
     * UniverseKey. If found, a connection is made to a remote Universe server to
     * attempt to upload the asset leaf.
     */
    pushProof(
        request?: DeepPartial<PushProofRequest>
    ): Promise<PushProofResponse>;
    /**
     * tapcli: `universe info`
     * Info returns a set of information about the current state of the Universe
     * and allows a caller to check that a universe server is reachable and
     * configured correctly to allow proof courier access without macaroons.
     */
    info(request?: DeepPartial<InfoRequest>): Promise<InfoResponse>;
    /**
     * tapcli: `universe sync`
     * SyncUniverse takes host information for a remote Universe server, then
     * attempts to synchronize either only the set of specified asset_ids, or all
     * assets if none are specified. The sync process will attempt to query for
     * the latest known root for each asset, performing tree based reconciliation
     * to arrive at a new shared root.
     */
    syncUniverse(request?: DeepPartial<SyncRequest>): Promise<SyncResponse>;
    /**
     * tapcli: `universe federation list`
     * ListFederationServers lists the set of servers that make up the federation
     * of the local Universe server. This servers are used to push out new proofs,
     * and also periodically call sync new proofs from the remote server.
     */
    listFederationServers(
        request?: DeepPartial<ListFederationServersRequest>
    ): Promise<ListFederationServersResponse>;
    /**
     * tapcli: `universe federation add`
     * AddFederationServer adds a new server to the federation of the local
     * Universe server. Once a server is added, this call can also optionally be
     * used to trigger a sync of the remote server.
     */
    addFederationServer(
        request?: DeepPartial<AddFederationServerRequest>
    ): Promise<AddFederationServerResponse>;
    /**
     * tapcli: `universe federation del`
     * DeleteFederationServer removes a server from the federation of the local
     * Universe server.
     */
    deleteFederationServer(
        request?: DeepPartial<DeleteFederationServerRequest>
    ): Promise<DeleteFederationServerResponse>;
    /**
     * tapcli: `universe stats`
     * UniverseStats returns a set of aggregate statistics for the current state
     * of the Universe. Stats returned include: total number of syncs, total
     * number of proofs, and total number of known assets.
     */
    universeStats(request?: DeepPartial<StatsRequest>): Promise<StatsResponse>;
    /**
     * tapcli `universe stats assets`
     * QueryAssetStats returns a set of statistics for a given set of assets.
     * Stats can be queried for all assets, or based on the: asset ID, name, or
     * asset type. Pagination is supported via the offset and limit params.
     * Results can also be sorted based on any of the main query params.
     */
    queryAssetStats(
        request?: DeepPartial<AssetStatsQuery>
    ): Promise<UniverseAssetStats>;
    /**
     * tapcli `universe stats events`
     * QueryEvents returns the number of sync and proof events for a given time
     * period, grouped by day.
     */
    queryEvents(
        request?: DeepPartial<QueryEventsRequest>
    ): Promise<QueryEventsResponse>;
    /**
     * SetFederationSyncConfig sets the configuration of the universe federation
     * sync.
     */
    setFederationSyncConfig(
        request?: DeepPartial<SetFederationSyncConfigRequest>
    ): Promise<SetFederationSyncConfigResponse>;
    /**
     * tapcli: `universe federation config info`
     * QueryFederationSyncConfig queries the universe federation sync configuration
     * settings.
     */
    queryFederationSyncConfig(
        request?: DeepPartial<QueryFederationSyncConfigRequest>
    ): Promise<QueryFederationSyncConfigResponse>;
    /**
     * tapcli: `universe ignoreoutpoint`
     * IgnoreAssetOutPoint allows an asset issuer to mark a specific asset outpoint
     * as ignored. An ignored outpoint will be included in the next universe supply
     * commitment transaction that is published.
     */
    ignoreAssetOutPoint(
        request?: DeepPartial<IgnoreAssetOutPointRequest>
    ): Promise<IgnoreAssetOutPointResponse>;
    /**
     * tapcli: `universe updatesupplycommit`
     * UpdateSupplyCommit updates the on-chain supply commitment for a specific
     * asset group.
     */
    updateSupplyCommit(
        request?: DeepPartial<UpdateSupplyCommitRequest>
    ): Promise<UpdateSupplyCommitResponse>;
    /**
     * tapcli: `universe fetchsupplycommit`
     * FetchSupplyCommit fetches the on-chain supply commitment for a specific
     * asset group.
     */
    fetchSupplyCommit(
        request?: DeepPartial<FetchSupplyCommitRequest>
    ): Promise<FetchSupplyCommitResponse>;
    /**
     * tapcli: `universe supplyleaves`
     * FetchSupplyLeaves fetches the supply leaves for a specific asset group
     * within a specified block height range. The leaves include issuance, burn,
     * and ignore leaves, which represent the supply changes for the asset group.
     */
    fetchSupplyLeaves(
        request?: DeepPartial<FetchSupplyLeavesRequest>
    ): Promise<FetchSupplyLeavesResponse>;
    /**
     * tapcli: `universe supplycommit insert`
     * InsertSupplyCommit inserts a supply commitment for a specific asset
     * group. This includes the commitment details, supply leaves (issuance, burn,
     * and ignore), and chain proof that proves the commitment has been mined.
     */
    insertSupplyCommit(
        request?: DeepPartial<InsertSupplyCommitRequest>
    ): Promise<InsertSupplyCommitResponse>;
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
