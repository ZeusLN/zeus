/* eslint-disable */
import type { AssetType, Asset } from '../taprootassets';

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
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum AssetTypeFilter {
    FILTER_ASSET_NONE = 'FILTER_ASSET_NONE',
    FILTER_ASSET_NORMAL = 'FILTER_ASSET_NORMAL',
    FILTER_ASSET_COLLECTIBLE = 'FILTER_ASSET_COLLECTIBLE',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

/** TODO(roasbeef): filter by asset ID, etc? */
export interface AssetRootRequest {}

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
    /** The asset root for the given asset ID or group key. */
    assetRoot: UniverseRoot | undefined;
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

export interface AssetLeafKeyResponse {
    /** The set of asset leaf keys for the given asset ID or group key. */
    assetKeys: AssetKey[];
}

export interface AssetLeaf {
    /** The asset included in the leaf. */
    asset: Asset | undefined;
    /**
     * The asset issuance proof, which proves that the asset specified above
     * was issued properly.
     */
    issuanceProof: Uint8Array | string;
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
    /** The request original request for the issuance proof. */
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
}

export interface AssetProof {
    /** The ID of the asset to insert the proof for. */
    key: UniverseKey | undefined;
    /** The asset leaf to insert into the Universe tree. */
    assetLeaf: AssetLeaf | undefined;
}

export interface InfoRequest {}

export interface InfoResponse {
    /**
     * A pseudo-random runtime ID for the current instance of the Universe
     * server, changes with each restart. Mainly used to identify identical
     * servers when they are exposed under different hostnames/ports.
     */
    runtimeId: string;
    /** The number of assets known to this Universe server. */
    numAssets: string;
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
}

export interface AssetStatsSnapshot {
    assetId: Uint8Array | string;
    groupKey: Uint8Array | string;
    genesisPoint: string;
    totalSupply: string;
    assetName: string;
    assetType: AssetType;
    genesisHeight: number;
    genesisTimestamp: string;
    totalSyncs: string;
    totalProofs: string;
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

export interface Universe {
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
     * where outpoint is an outpoint in the Bitcoin blockcahin that anchors a
     * valid Taproot Asset commitment, and script_key is the script_key of
     * the asset within the Taproot Asset commitment for the given asset_id or
     * group_key.
     */
    assetLeafKeys(request?: DeepPartial<ID>): Promise<AssetLeafKeyResponse>;
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
