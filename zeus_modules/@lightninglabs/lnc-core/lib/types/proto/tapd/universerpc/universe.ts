/* eslint-disable */
import type { AssetType, Asset } from '../taprootassets';

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
    host: string;
    id: number;
}

export interface ListFederationServersRequest {}

export interface ListFederationServersResponse {
    servers: UniverseFederationServer[];
}

export interface AddFederationServerRequest {
    servers: UniverseFederationServer[];
}

export interface AddFederationServerResponse {}

export interface DeleteFederationServerRequest {
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
    assetNameFilter: string;
    assetIdFilter: Uint8Array | string;
    assetTypeFilter: AssetTypeFilter;
    sortBy: AssetQuerySort;
    offset: number;
    limit: number;
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
    assetId: Uint8Array | string;
    genesisPoint: string;
    totalSupply: string;
    assetName: string;
    assetType: AssetType;
    genesisHeight: number;
    genesisTimestamp: string;
    anchorPoint: string;
}

export interface UniverseAssetStats {
    assetStats: AssetStatsSnapshot[];
}

export interface QueryEventsRequest {
    startTimestamp: string;
    endTimestamp: string;
}

export interface QueryEventsResponse {
    events: GroupedUniverseEvents[];
}

export interface GroupedUniverseEvents {
    /** The date the events occurred on, formatted as YYYY-MM-DD. */
    date: string;
    syncEvents: string;
    newProofEvents: string;
}

export interface SetFederationSyncConfigRequest {
    globalSyncConfigs: GlobalFederationSyncConfig[];
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
    globalSyncConfigs: GlobalFederationSyncConfig[];
    assetSyncConfigs: AssetFederationSyncConfig[];
}

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
     * Info returns a set of information about the current state of the Universe.
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
