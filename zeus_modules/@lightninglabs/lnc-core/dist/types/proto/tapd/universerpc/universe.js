"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetTypeFilter = exports.SortDirection = exports.AssetQuerySort = exports.UniverseSyncMode = exports.ProofType = void 0;
var ProofType;
(function (ProofType) {
    ProofType["PROOF_TYPE_UNSPECIFIED"] = "PROOF_TYPE_UNSPECIFIED";
    ProofType["PROOF_TYPE_ISSUANCE"] = "PROOF_TYPE_ISSUANCE";
    ProofType["PROOF_TYPE_TRANSFER"] = "PROOF_TYPE_TRANSFER";
    ProofType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ProofType = exports.ProofType || (exports.ProofType = {}));
var UniverseSyncMode;
(function (UniverseSyncMode) {
    /**
     * SYNC_ISSUANCE_ONLY - A sync node that indicates that only new asset creation (minting) proofs
     * should be synced.
     */
    UniverseSyncMode["SYNC_ISSUANCE_ONLY"] = "SYNC_ISSUANCE_ONLY";
    /**
     * SYNC_FULL - A syncing mode that indicates that all asset proofs should be synced.
     * This includes normal transfers as well.
     */
    UniverseSyncMode["SYNC_FULL"] = "SYNC_FULL";
    UniverseSyncMode["UNRECOGNIZED"] = "UNRECOGNIZED";
})(UniverseSyncMode = exports.UniverseSyncMode || (exports.UniverseSyncMode = {}));
var AssetQuerySort;
(function (AssetQuerySort) {
    AssetQuerySort["SORT_BY_NONE"] = "SORT_BY_NONE";
    AssetQuerySort["SORT_BY_ASSET_NAME"] = "SORT_BY_ASSET_NAME";
    AssetQuerySort["SORT_BY_ASSET_ID"] = "SORT_BY_ASSET_ID";
    AssetQuerySort["SORT_BY_ASSET_TYPE"] = "SORT_BY_ASSET_TYPE";
    AssetQuerySort["SORT_BY_TOTAL_SYNCS"] = "SORT_BY_TOTAL_SYNCS";
    AssetQuerySort["SORT_BY_TOTAL_PROOFS"] = "SORT_BY_TOTAL_PROOFS";
    AssetQuerySort["SORT_BY_GENESIS_HEIGHT"] = "SORT_BY_GENESIS_HEIGHT";
    AssetQuerySort["SORT_BY_TOTAL_SUPPLY"] = "SORT_BY_TOTAL_SUPPLY";
    AssetQuerySort["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AssetQuerySort = exports.AssetQuerySort || (exports.AssetQuerySort = {}));
var SortDirection;
(function (SortDirection) {
    SortDirection["SORT_DIRECTION_ASC"] = "SORT_DIRECTION_ASC";
    SortDirection["SORT_DIRECTION_DESC"] = "SORT_DIRECTION_DESC";
    SortDirection["UNRECOGNIZED"] = "UNRECOGNIZED";
})(SortDirection = exports.SortDirection || (exports.SortDirection = {}));
var AssetTypeFilter;
(function (AssetTypeFilter) {
    AssetTypeFilter["FILTER_ASSET_NONE"] = "FILTER_ASSET_NONE";
    AssetTypeFilter["FILTER_ASSET_NORMAL"] = "FILTER_ASSET_NORMAL";
    AssetTypeFilter["FILTER_ASSET_COLLECTIBLE"] = "FILTER_ASSET_COLLECTIBLE";
    AssetTypeFilter["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AssetTypeFilter = exports.AssetTypeFilter || (exports.AssetTypeFilter = {}));
