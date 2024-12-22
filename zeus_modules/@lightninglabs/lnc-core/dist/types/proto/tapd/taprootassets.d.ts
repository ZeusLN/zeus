export declare enum AssetType {
    /**
     * NORMAL - Indicates that an asset is capable of being split/merged, with each of the
     * units being fungible, even across a key asset ID boundary (assuming the
     * key group is the same).
     */
    NORMAL = "NORMAL",
    /**
     * COLLECTIBLE - Indicates that an asset is a collectible, meaning that each of the other
     * items under the same key group are not fully fungible with each other.
     * Collectibles also cannot be split or merged.
     */
    COLLECTIBLE = "COLLECTIBLE",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum AssetMetaType {
    /**
     * META_TYPE_OPAQUE - Opaque is used for asset meta blobs that have no true structure and instead
     * should be interpreted as opaque blobs.
     */
    META_TYPE_OPAQUE = "META_TYPE_OPAQUE",
    /**
     * META_TYPE_JSON - JSON is used for asset meta blobs that are to be interpreted as valid JSON
     * strings.
     */
    META_TYPE_JSON = "META_TYPE_JSON",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum AssetVersion {
    /**
     * ASSET_VERSION_V0 - ASSET_VERSION_V0 is the default asset version. This version will include
     * the witness vector in the leaf for a tap commitment.
     */
    ASSET_VERSION_V0 = "ASSET_VERSION_V0",
    /**
     * ASSET_VERSION_V1 - ASSET_VERSION_V1 is the asset version that leaves out the witness vector
     * from the MS-SMT leaf encoding.
     */
    ASSET_VERSION_V1 = "ASSET_VERSION_V1",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum OutputType {
    /**
     * OUTPUT_TYPE_SIMPLE - OUTPUT_TYPE_SIMPLE is a plain full-value or split output that is not a
     * split root and does not carry passive assets. In case of a split, the
     * asset of this output has a split commitment.
     */
    OUTPUT_TYPE_SIMPLE = "OUTPUT_TYPE_SIMPLE",
    /**
     * OUTPUT_TYPE_SPLIT_ROOT - OUTPUT_TYPE_SPLIT_ROOT is a split root output that carries the change
     * from a split or a tombstone from a non-interactive full value send
     * output. In either case, the asset of this output has a tx witness.
     */
    OUTPUT_TYPE_SPLIT_ROOT = "OUTPUT_TYPE_SPLIT_ROOT",
    UNRECOGNIZED = "UNRECOGNIZED"
}
/**
 * ProofDeliveryStatus is an enum that describes the status of the delivery of
 * a proof associated with an asset transfer output.
 */
export declare enum ProofDeliveryStatus {
    /** PROOF_DELIVERY_STATUS_NOT_APPLICABLE - Delivery is not applicable; the proof will not be delivered. */
    PROOF_DELIVERY_STATUS_NOT_APPLICABLE = "PROOF_DELIVERY_STATUS_NOT_APPLICABLE",
    /** PROOF_DELIVERY_STATUS_COMPLETE - The proof has been successfully delivered. */
    PROOF_DELIVERY_STATUS_COMPLETE = "PROOF_DELIVERY_STATUS_COMPLETE",
    /**
     * PROOF_DELIVERY_STATUS_PENDING - The proof is pending delivery. This status indicates that the proof has
     * not yet been delivered successfully. One or more attempts at proof
     * delivery may have been made.
     */
    PROOF_DELIVERY_STATUS_PENDING = "PROOF_DELIVERY_STATUS_PENDING",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum AddrVersion {
    /**
     * ADDR_VERSION_UNSPECIFIED - ADDR_VERSION_UNSPECIFIED is the default value for an address version in
     * an RPC message. It is unmarshalled to the latest address version.
     */
    ADDR_VERSION_UNSPECIFIED = "ADDR_VERSION_UNSPECIFIED",
    /** ADDR_VERSION_V0 - ADDR_VERSION_V0 is the initial address version. */
    ADDR_VERSION_V0 = "ADDR_VERSION_V0",
    /**
     * ADDR_VERSION_V1 - ADDR_VERSION_V1 is the address version that uses V2 Taproot Asset
     * commitments.
     */
    ADDR_VERSION_V1 = "ADDR_VERSION_V1",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum AddrEventStatus {
    ADDR_EVENT_STATUS_UNKNOWN = "ADDR_EVENT_STATUS_UNKNOWN",
    ADDR_EVENT_STATUS_TRANSACTION_DETECTED = "ADDR_EVENT_STATUS_TRANSACTION_DETECTED",
    ADDR_EVENT_STATUS_TRANSACTION_CONFIRMED = "ADDR_EVENT_STATUS_TRANSACTION_CONFIRMED",
    ADDR_EVENT_STATUS_PROOF_RECEIVED = "ADDR_EVENT_STATUS_PROOF_RECEIVED",
    ADDR_EVENT_STATUS_COMPLETED = "ADDR_EVENT_STATUS_COMPLETED",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum SendState {
    /**
     * SEND_STATE_VIRTUAL_INPUT_SELECT - Input coin selection to pick out which asset inputs should be spent is
     * executed during this state.
     */
    SEND_STATE_VIRTUAL_INPUT_SELECT = "SEND_STATE_VIRTUAL_INPUT_SELECT",
    /** SEND_STATE_VIRTUAL_SIGN - The virtual transaction is signed during this state. */
    SEND_STATE_VIRTUAL_SIGN = "SEND_STATE_VIRTUAL_SIGN",
    /** SEND_STATE_ANCHOR_SIGN - The Bitcoin anchor transaction is signed during this state. */
    SEND_STATE_ANCHOR_SIGN = "SEND_STATE_ANCHOR_SIGN",
    /**
     * SEND_STATE_LOG_COMMITMENT - The outbound packet is written to the database during this state,
     * including the partial proof suffixes. Only parcels that complete this
     * state can be resumed on restart.
     */
    SEND_STATE_LOG_COMMITMENT = "SEND_STATE_LOG_COMMITMENT",
    /**
     * SEND_STATE_BROADCAST - The Bitcoin anchor transaction is broadcast to the network during this
     * state.
     */
    SEND_STATE_BROADCAST = "SEND_STATE_BROADCAST",
    /**
     * SEND_STATE_WAIT_CONFIRMATION - The on-chain anchor transaction needs to reach at least 1 confirmation.
     * This state waits for the confirmation.
     */
    SEND_STATE_WAIT_CONFIRMATION = "SEND_STATE_WAIT_CONFIRMATION",
    /**
     * SEND_STATE_STORE_PROOFS - The anchor transaction was confirmed in a block and the full proofs can
     * now be constructed during this stage.
     */
    SEND_STATE_STORE_PROOFS = "SEND_STATE_STORE_PROOFS",
    /**
     * SEND_STATE_TRANSFER_PROOFS - The full proofs are sent to the recipient(s) with the proof courier
     * service during this state.
     */
    SEND_STATE_TRANSFER_PROOFS = "SEND_STATE_TRANSFER_PROOFS",
    /** SEND_STATE_COMPLETED - The send state machine has completed the send process. */
    SEND_STATE_COMPLETED = "SEND_STATE_COMPLETED",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum ParcelType {
    /** PARCEL_TYPE_ADDRESS - The parcel is an address parcel. */
    PARCEL_TYPE_ADDRESS = "PARCEL_TYPE_ADDRESS",
    /**
     * PARCEL_TYPE_PRE_SIGNED - The parcel type is a pre-signed parcel where the virtual transactions are
     * signed outside of the send state machine. Parcels of this type will only
     * get send states starting from SEND_STATE_ANCHOR_SIGN.
     */
    PARCEL_TYPE_PRE_SIGNED = "PARCEL_TYPE_PRE_SIGNED",
    /**
     * PARCEL_TYPE_PENDING - The parcel is pending and was resumed on the latest restart of the
     * daemon. The original parcel type (address or pre-signed) is not known
     * anymore, as it's not relevant for the remaining steps. Parcels of this
     * type will only get send states starting from SEND_STATE_BROADCAST.
     */
    PARCEL_TYPE_PENDING = "PARCEL_TYPE_PENDING",
    /**
     * PARCEL_TYPE_PRE_ANCHORED - The parcel type is a pre-anchored parcel where the full anchor
     * transaction and all proofs are already available. Parcels of this type
     * will only get send states starting from SEND_STATE_LOG_COMMITMENT.
     */
    PARCEL_TYPE_PRE_ANCHORED = "PARCEL_TYPE_PRE_ANCHORED",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export interface AssetMeta {
    /**
     * The raw data of the asset meta data. Based on the type below, this may be
     * structured data such as a text file or PDF. The size of the data is limited
     * to 1MiB.
     */
    data: Uint8Array | string;
    /** The type of the asset meta data. */
    type: AssetMetaType;
    /**
     * The hash of the meta. This is the hash of the TLV serialization of the meta
     * itself.
     */
    metaHash: Uint8Array | string;
}
export interface ListAssetRequest {
    withWitness: boolean;
    includeSpent: boolean;
    includeLeased: boolean;
    /**
     * List assets that aren't confirmed yet. Only freshly minted assets will
     * show in the asset list with a block height of 0. All other forms of
     * unconfirmed assets will not appear in the list until the transaction is
     * confirmed (check either transfers or receives for unconfirmed outbound or
     * inbound assets).
     */
    includeUnconfirmedMints: boolean;
}
export interface AnchorInfo {
    /**
     * The transaction that anchors the Taproot Asset commitment where the asset
     *  resides.
     */
    anchorTx: Uint8Array | string;
    /** The block hash the contains the anchor transaction above. */
    anchorBlockHash: string;
    /** The outpoint (txid:vout) that stores the Taproot Asset commitment. */
    anchorOutpoint: string;
    /** The raw internal key that was used to create the anchor Taproot output key. */
    internalKey: Uint8Array | string;
    /**
     * The Taproot merkle root hash of the anchor output the asset was committed
     * to. If there is no Tapscript sibling, this is equal to the Taproot Asset
     * root commitment hash.
     */
    merkleRoot: Uint8Array | string;
    /**
     * The serialized preimage of a Tapscript sibling, if there was one. If this
     * is empty, then the merkle_root hash is equal to the Taproot root hash of the
     * anchor output.
     */
    tapscriptSibling: Uint8Array | string;
    /** The height of the block which contains the anchor transaction. */
    blockHeight: number;
}
export interface GenesisInfo {
    /** The first outpoint of the transaction that created the asset (txid:vout). */
    genesisPoint: string;
    /** The name of the asset. */
    name: string;
    /** The hash of the meta data for this genesis asset. */
    metaHash: Uint8Array | string;
    /** The asset ID that uniquely identifies the asset. */
    assetId: Uint8Array | string;
    /** The type of the asset. */
    assetType: AssetType;
    /**
     * The index of the output that carries the unique Taproot Asset commitment in
     * the genesis transaction.
     */
    outputIndex: number;
}
export interface GroupKeyRequest {
    /** The internal key for the asset group before any tweaks have been applied. */
    rawKey: KeyDescriptor | undefined;
    /**
     * The genesis of the group anchor asset, which is used to derive the single
     * tweak for the group key. For a new group key, this will be the genesis of
     * new_asset.
     */
    anchorGenesis: GenesisInfo | undefined;
    /**
     * The optional root of a tapscript tree that will be used when constructing a
     * new asset group key. This enables future issuance authorized with a script
     * witness.
     */
    tapscriptRoot: Uint8Array | string;
    /**
     * The serialized asset which we are requesting group membership for. A
     * successful request will produce a witness that authorizes this asset to be a
     * member of this asset group.
     */
    newAsset: Uint8Array | string;
}
export interface TxOut {
    /** The value of the output being spent. */
    value: string;
    /** The script of the output being spent. */
    pkScript: Uint8Array | string;
}
export interface GroupVirtualTx {
    /**
     * The virtual transaction that represents the genesis state transition of a
     * grouped asset.
     */
    transaction: Uint8Array | string;
    /**
     * The transaction output that represents a grouped asset. The tweaked
     * group key is set as the PkScript of this output. This is used in combination
     * with Tx to produce an asset group witness.
     */
    prevOut: TxOut | undefined;
    /**
     * The asset ID of the grouped asset in a GroupKeyRequest. This ID is
     * needed to construct a sign descriptor, as it is the single tweak for the
     * group internal key.
     */
    genesisId: Uint8Array | string;
    /**
     * The tweaked group key for a specific GroupKeyRequest. This is used to
     * construct a complete group key after producing an asset group witness.
     */
    tweakedKey: Uint8Array | string;
}
export interface GroupWitness {
    /**
     * The asset ID of the pending asset that should be assigned this asset
     * group witness.
     */
    genesisId: Uint8Array | string;
    /** The serialized witness stack for the asset group. */
    witness: Uint8Array | string[];
}
export interface AssetGroup {
    /** The raw group key which is a normal public key. */
    rawGroupKey: Uint8Array | string;
    /**
     * The tweaked group key, which is derived based on the genesis point and also
     * asset type.
     */
    tweakedGroupKey: Uint8Array | string;
    /**
     * A witness that authorizes a specific asset to be part of the asset group
     * specified by the above key.
     */
    assetWitness: Uint8Array | string;
    /**
     * The root hash of a tapscript tree, which enables future issuance authorized
     * with a script witness.
     */
    tapscriptRoot: Uint8Array | string;
}
export interface GroupKeyReveal {
    /** The raw group key which is a normal public key. */
    rawGroupKey: Uint8Array | string;
    /** The tapscript root included in the tweaked group key, which may be empty. */
    tapscriptRoot: Uint8Array | string;
}
export interface GenesisReveal {
    /** The base genesis information in the genesis reveal. */
    genesisBaseReveal: GenesisInfo | undefined;
}
export interface DecimalDisplay {
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
export interface Asset {
    /** The version of the Taproot Asset. */
    version: AssetVersion;
    /** The base genesis information of an asset. This information never changes. */
    assetGenesis: GenesisInfo | undefined;
    /** The total amount of the asset stored in this Taproot Asset UTXO. */
    amount: string;
    /** An optional locktime, as with Bitcoin transactions. */
    lockTime: number;
    /** An optional relative lock time, same as Bitcoin transactions. */
    relativeLockTime: number;
    /** The version of the script, only version 0 is defined at present. */
    scriptVersion: number;
    /** The script key of the asset, which can be spent under Taproot semantics. */
    scriptKey: Uint8Array | string;
    /**
     * Indicates whether the script key is known to the wallet of the lnd node
     * connected to the Taproot Asset daemon.
     */
    scriptKeyIsLocal: boolean;
    /** The information related to the key group of an asset (if it exists). */
    assetGroup: AssetGroup | undefined;
    /** Describes where in the chain the asset is currently anchored. */
    chainAnchor: AnchorInfo | undefined;
    prevWitnesses: PrevWitness[];
    /** Indicates whether the asset has been spent. */
    isSpent: boolean;
    /**
     * If the asset has been leased, this is the owner (application ID) of the
     * lease.
     */
    leaseOwner: Uint8Array | string;
    /**
     * If the asset has been leased, this is the expiry of the lease as a Unix
     * timestamp in seconds.
     */
    leaseExpiry: string;
    /**
     * Indicates whether this transfer was an asset burn. If true, the number of
     * assets in this output are destroyed and can no longer be spent.
     */
    isBurn: boolean;
    /**
     * Indicates whether this script key has either been derived by the local
     * wallet or was explicitly declared to be known by using the
     * DeclareScriptKey RPC. Knowing the key conceptually means the key belongs
     * to the local wallet or is at least known by a software that operates on
     * the local wallet. The flag is never serialized in proofs, so this is
     * never explicitly set for keys foreign to the local wallet. Therefore, if
     * this method returns true for a script key, it means the asset with the
     * script key will be shown in the wallet balance.
     */
    scriptKeyDeclaredKnown: boolean;
    /**
     * Indicates whether the script key is known to have a Tapscript spend path,
     * meaning that the Taproot merkle root tweak is not empty. This will only
     * ever be true if either script_key_is_local or script_key_internals_known
     * is true as well, since the presence of a Tapscript spend path cannot be
     * determined for script keys that aren't known to the wallet of the local
     * tapd node.
     */
    scriptKeyHasScriptPath: boolean;
    /**
     * This field defines a decimal display value that may be present. If this
     * field is null, it means the presence of a decimal display field is
     * unknown in the current context.
     */
    decimalDisplay: DecimalDisplay | undefined;
}
export interface PrevWitness {
    prevId: PrevInputAsset | undefined;
    txWitness: Uint8Array | string[];
    splitCommitment: SplitCommitment | undefined;
}
export interface SplitCommitment {
    rootAsset: Asset | undefined;
}
export interface ListAssetResponse {
    assets: Asset[];
    /**
     * This is a count of unconfirmed outgoing transfers. Unconfirmed transfers
     * do not appear as assets in this endpoint response.
     */
    unconfirmedTransfers: string;
    /**
     * This is a count of freshly minted assets that haven't been confirmed on
     * chain yet. These assets will appear in the asset list with a block height
     * of 0 if include_unconfirmed_mints is set to true in the request.
     */
    unconfirmedMints: string;
}
export interface ListUtxosRequest {
    includeLeased: boolean;
}
export interface ManagedUtxo {
    /** The outpoint of the UTXO. */
    outPoint: string;
    /** The UTXO amount in satoshis. */
    amtSat: string;
    /** The internal key used for the on-chain output. */
    internalKey: Uint8Array | string;
    /** The Taproot Asset root commitment hash. */
    taprootAssetRoot: Uint8Array | string;
    /**
     * The Taproot merkle root hash committed to by the outpoint of this UTXO.
     * If there is no Tapscript sibling, this is equal to the Taproot Asset root
     * commitment hash.
     */
    merkleRoot: Uint8Array | string;
    /** The assets held at this UTXO. */
    assets: Asset[];
    /** The lease owner for this UTXO. If blank the UTXO isn't leased. */
    leaseOwner: Uint8Array | string;
    /**
     * The expiry time as a unix time stamp for this lease. If blank the utxo
     * isn't leased.
     */
    leaseExpiryUnix: string;
}
export interface ListUtxosResponse {
    /** The set of UTXOs managed by the daemon. */
    managedUtxos: {
        [key: string]: ManagedUtxo;
    };
}
export interface ListUtxosResponse_ManagedUtxosEntry {
    key: string;
    value: ManagedUtxo | undefined;
}
export interface ListGroupsRequest {
}
export interface AssetHumanReadable {
    /** The ID of the asset. */
    id: Uint8Array | string;
    /** The amount of the asset. */
    amount: string;
    /** An optional locktime, as with Bitcoin transactions. */
    lockTime: number;
    /** An optional relative locktime, as with Bitcoin transactions. */
    relativeLockTime: number;
    /** The name of the asset. */
    tag: string;
    /** The metadata hash of the asset. */
    metaHash: Uint8Array | string;
    /** The type of the asset. */
    type: AssetType;
    /** The version of the asset. */
    version: AssetVersion;
}
export interface GroupedAssets {
    /** A list of assets with the same group key. */
    assets: AssetHumanReadable[];
}
export interface ListGroupsResponse {
    /** The set of assets with a group key. */
    groups: {
        [key: string]: GroupedAssets;
    };
}
export interface ListGroupsResponse_GroupsEntry {
    key: string;
    value: GroupedAssets | undefined;
}
export interface ListBalancesRequest {
    /** Group results by asset IDs. */
    assetId: boolean | undefined;
    /** Group results by group keys. */
    groupKey: boolean | undefined;
    /**
     * If the query results should grouped by asset ids, then an optional asset
     * filter may be provided to query balance of a specific asset.
     */
    assetFilter: Uint8Array | string;
    /**
     * If the query results should be grouped by group keys, then an optional
     * group key filter may be provided to query the balance of a specific
     * asset group.
     */
    groupKeyFilter: Uint8Array | string;
    /** An option to include previous leased assets in the balances. */
    includeLeased: boolean;
}
export interface AssetBalance {
    /** The base genesis information of an asset. This information never changes. */
    assetGenesis: GenesisInfo | undefined;
    /** The balance of the asset owned by the target daemon. */
    balance: string;
}
export interface AssetGroupBalance {
    /** The group key or nil aggregating assets that don't have a group. */
    groupKey: Uint8Array | string;
    /** The total balance of the assets in the group. */
    balance: string;
}
export interface ListBalancesResponse {
    assetBalances: {
        [key: string]: AssetBalance;
    };
    assetGroupBalances: {
        [key: string]: AssetGroupBalance;
    };
}
export interface ListBalancesResponse_AssetBalancesEntry {
    key: string;
    value: AssetBalance | undefined;
}
export interface ListBalancesResponse_AssetGroupBalancesEntry {
    key: string;
    value: AssetGroupBalance | undefined;
}
export interface ListTransfersRequest {
    /**
     * anchor_txid specifies the hexadecimal encoded txid string of the anchor
     * transaction for which to retrieve transfers. An empty value indicates
     * that this parameter should be disregarded in transfer selection.
     */
    anchorTxid: string;
}
export interface ListTransfersResponse {
    /** The unordered list of outgoing asset transfers. */
    transfers: AssetTransfer[];
}
/**
 * ChainHash represents a hash value, typically a double SHA-256 of some data.
 * Common examples include block hashes and transaction hashes.
 *
 * This versatile message type is used in various Bitcoin-related messages and
 * structures, providing two different formats of the same hash to accommodate
 * both developer and user needs.
 */
export interface ChainHash {
    /**
     * The raw hash value in byte format.
     *
     * This format is optimized for programmatic use, particularly for Go
     * developers, enabling easy integration with other RPC calls or binary
     * operations.
     */
    hash: Uint8Array | string;
    /**
     * The byte-reversed hash value as a hexadecimal string.
     *
     * This format is intended for human interaction, making it easy to copy,
     * paste, and use in contexts like command-line arguments or configuration
     * files.
     */
    hashStr: string;
}
export interface AssetTransfer {
    transferTimestamp: string;
    /**
     * The new transaction that commits to the set of Taproot Assets found
     * at the above new anchor point.
     */
    anchorTxHash: Uint8Array | string;
    anchorTxHeightHint: number;
    anchorTxChainFees: string;
    /** Describes the set of spent assets. */
    inputs: TransferInput[];
    /** Describes the set of newly created asset outputs. */
    outputs: TransferOutput[];
    /**
     * The block hash of the blockchain block that contains the anchor
     * transaction. If this value is unset, the anchor transaction is
     * unconfirmed.
     */
    anchorTxBlockHash: ChainHash | undefined;
}
export interface TransferInput {
    /**
     * The old/current location of the Taproot Asset commitment that was spent
     * as an input.
     */
    anchorPoint: string;
    /** The ID of the asset that was spent. */
    assetId: Uint8Array | string;
    /** The script key of the asset that was spent. */
    scriptKey: Uint8Array | string;
    /** The amount of the asset that was spent. */
    amount: string;
}
export interface TransferOutputAnchor {
    /**
     * The new location of the Taproot Asset commitment that was created on
     * chain.
     */
    outpoint: string;
    value: string;
    internalKey: Uint8Array | string;
    taprootAssetRoot: Uint8Array | string;
    merkleRoot: Uint8Array | string;
    tapscriptSibling: Uint8Array | string;
    numPassiveAssets: number;
}
export interface TransferOutput {
    anchor: TransferOutputAnchor | undefined;
    scriptKey: Uint8Array | string;
    scriptKeyIsLocal: boolean;
    amount: string;
    /**
     * The new individual transition proof (not a full proof file) that proves
     * the inclusion of the new asset within the new AnchorTx.
     */
    newProofBlob: Uint8Array | string;
    splitCommitRootHash: Uint8Array | string;
    outputType: OutputType;
    assetVersion: AssetVersion;
    lockTime: string;
    relativeLockTime: string;
    /** The delivery status of the proof associated with this output. */
    proofDeliveryStatus: ProofDeliveryStatus;
}
export interface StopRequest {
}
export interface StopResponse {
}
export interface DebugLevelRequest {
    /** If true, all the valid debug sub-systems will be returned. */
    show: boolean;
    levelSpec: string;
}
export interface DebugLevelResponse {
    subSystems: string;
}
export interface Addr {
    /** The bech32 encoded Taproot Asset address. */
    encoded: string;
    /** The asset ID that uniquely identifies the asset. */
    assetId: Uint8Array | string;
    /** The type of the asset. */
    assetType: AssetType;
    /** The total amount of the asset stored in this Taproot Asset UTXO. */
    amount: string;
    /** The group key of the asset (if it exists) */
    groupKey: Uint8Array | string;
    /**
     * The specific script key the asset must commit to in order to transfer
     * ownership to the creator of the address.
     */
    scriptKey: Uint8Array | string;
    /** The internal key used for the on-chain output. */
    internalKey: Uint8Array | string;
    /**
     * The optional serialized tapscript sibling preimage to use for the receiving
     * asset. This is usually empty as it is only needed when there should be an
     * additional script path in the Taproot tree alongside the Taproot Asset
     * commitment of the asset.
     */
    tapscriptSibling: Uint8Array | string;
    /**
     * The tweaked internal key that commits to the asset and represents the
     * on-chain output key the Bitcoin transaction must send to in order to
     * transfer assets described in this address.
     */
    taprootOutputKey: Uint8Array | string;
    /** The address of the proof courier service used in proof transfer. */
    proofCourierAddr: string;
    /** The asset version of the address. */
    assetVersion: AssetVersion;
    /** The version of the address. */
    addressVersion: AddrVersion;
}
export interface QueryAddrRequest {
    /**
     * If set, then only addresses created after this Unix timestamp will be
     * returned.
     */
    createdAfter: string;
    /**
     * If set, then only addresses created before this Unix timestamp will be
     * returned.
     */
    createdBefore: string;
    /** The max number of addresses that should be returned. */
    limit: number;
    /** The offset from the addresses that should be returned. */
    offset: number;
}
export interface QueryAddrResponse {
    addrs: Addr[];
}
export interface NewAddrRequest {
    assetId: Uint8Array | string;
    amt: string;
    /**
     * The optional script key that the receiving asset should be locked to. If no
     * script key is provided, a normal BIP-86 key will be derived from the
     * underlying wallet.
     *
     * NOTE: The script_key and internal_key fields should either both be set or
     * both be empty.
     */
    scriptKey: ScriptKey | undefined;
    /**
     * The optional internal key of the receiving BTC level transaction output on
     * which the receiving asset transfers will be committed to. If no internal key
     * is provided, a key will be derived from the underlying wallet.
     *
     * NOTE: The script_key and internal_key fields should either both be set or
     * both be empty.
     */
    internalKey: KeyDescriptor | undefined;
    /**
     * The optional serialized tapscript sibling preimage to use for the receiving
     * asset. This is usually empty as it is only needed when there should be an
     * additional script path in the Taproot tree alongside the Taproot Asset
     * commitment of the asset.
     */
    tapscriptSibling: Uint8Array | string;
    /**
     * An optional proof courier address for use in proof transfer. If unspecified,
     * the daemon configured default address will be used.
     */
    proofCourierAddr: string;
    /** The asset version to use when sending/receiving to/from this address. */
    assetVersion: AssetVersion;
    /** The version of this address. */
    addressVersion: AddrVersion;
}
export interface ScriptKey {
    /**
     * The full Taproot output key the asset is locked to. This is either a BIP-86
     * key if the tap_tweak below is empty, or a key with the tap tweak applied to
     * it.
     */
    pubKey: Uint8Array | string;
    /** The key descriptor describing the internal key of the above Taproot key. */
    keyDesc: KeyDescriptor | undefined;
    /**
     * The optional Taproot tweak to apply to the above internal key. If this is
     * empty then a BIP-86 style tweak is applied to the internal key.
     */
    tapTweak: Uint8Array | string;
}
export interface KeyLocator {
    /** The family of key being identified. */
    keyFamily: number;
    /** The precise index of the key being identified. */
    keyIndex: number;
}
export interface KeyDescriptor {
    /** The raw bytes of the key being identified. */
    rawKeyBytes: Uint8Array | string;
    /** The key locator that identifies which key to use for signing. */
    keyLoc: KeyLocator | undefined;
}
export interface TapscriptFullTree {
    /** The complete, ordered list of all tap leaves of the tree. */
    allLeaves: TapLeaf[];
}
export interface TapLeaf {
    /** The script of the tap leaf. */
    script: Uint8Array | string;
}
export interface TapBranch {
    /** The TapHash of the left child of the root hash of a Tapscript tree. */
    leftTaphash: Uint8Array | string;
    /** The TapHash of the right child of the root hash of a Tapscript tree. */
    rightTaphash: Uint8Array | string;
}
export interface DecodeAddrRequest {
    addr: string;
}
export interface ProofFile {
    /**
     * The raw proof file encoded as bytes. Must be a file and not just an
     * individual mint/transfer proof.
     */
    rawProofFile: Uint8Array | string;
    genesisPoint: string;
}
export interface DecodedProof {
    /** The index depth of the decoded proof, with 0 being the latest proof. */
    proofAtDepth: number;
    /**
     * The total number of proofs contained in the decoded proof file (this will
     * always be 1 if a single mint/transition proof was given as the raw_proof
     * instead of a file).
     */
    numberOfProofs: number;
    /** The asset referenced in the proof. */
    asset: Asset | undefined;
    /** The reveal meta data associated with the proof, if available. */
    metaReveal: AssetMeta | undefined;
    /**
     * The merkle proof for AnchorTx used to prove its
     * inclusion within BlockHeader.
     */
    txMerkleProof: Uint8Array | string;
    /**
     * The TaprootProof proving the new inclusion of the
     * resulting asset within AnchorTx.
     */
    inclusionProof: Uint8Array | string;
    /**
     * The set of TaprootProofs proving the exclusion of
     * the resulting asset from all other Taproot outputs within AnchorTx.
     */
    exclusionProofs: Uint8Array | string[];
    /**
     * An optional TaprootProof needed if this asset is
     * the result of a split. SplitRootProof proves inclusion of the root
     * asset of the split.
     */
    splitRootProof: Uint8Array | string;
    /**
     * The number of additional nested full proofs for any inputs found within
     * the resulting asset.
     */
    numAdditionalInputs: number;
    /**
     * ChallengeWitness is an optional virtual transaction witness that serves
     * as an ownership proof for the asset. If this is non-nil, then it is a
     * valid transfer witness for a 1-input, 1-output virtual transaction that
     * spends the asset in this proof and sends it to the NUMS key, to prove
     * that the creator of the proof is able to produce a valid signature to
     * spend the asset.
     */
    challengeWitness: Uint8Array | string[];
    /**
     * Indicates whether the state transition this proof represents is a burn,
     * meaning that the assets were provably destroyed and can no longer be
     * spent.
     */
    isBurn: boolean;
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
export interface VerifyProofResponse {
    valid: boolean;
    /** The decoded last proof in the file if the proof file was valid. */
    decodedProof: DecodedProof | undefined;
}
export interface DecodeProofRequest {
    /**
     * The raw proof bytes to decode. This can be a full proof file or a single
     * mint/transition proof. If it is a full proof file, the proof_at_depth
     * field will be used to determine which individual proof within the file to
     * decode.
     */
    rawProof: Uint8Array | string;
    /**
     * The index depth of the decoded proof, with 0 being the latest proof. This
     * is ignored if the raw_proof is a single mint/transition proof and not a
     * proof file.
     */
    proofAtDepth: number;
    /** An option to include previous witnesses in decoding. */
    withPrevWitnesses: boolean;
    /** An option to attempt to retrieve the meta data associated with the proof. */
    withMetaReveal: boolean;
}
export interface DecodeProofResponse {
    decodedProof: DecodedProof | undefined;
}
export interface ExportProofRequest {
    assetId: Uint8Array | string;
    scriptKey: Uint8Array | string;
    outpoint: OutPoint | undefined;
}
export interface AddrEvent {
    /** The time the event was created in unix timestamp seconds. */
    creationTimeUnixSeconds: string;
    /** The address the event was created for. */
    addr: Addr | undefined;
    /** The current status of the event. */
    status: AddrEventStatus;
    /** The outpoint that contains the inbound asset transfer. */
    outpoint: string;
    /**
     * The amount in satoshis that were transferred on chain along with the asset.
     * This amount is independent of the requested asset amount, which can be
     * looked up on the address.
     */
    utxoAmtSat: string;
    /** The taproot sibling hash that was used to send to the Taproot output. */
    taprootSibling: Uint8Array | string;
    /**
     * The height at which the on-chain output was confirmed. If this is zero, it
     * means the output is unconfirmed.
     */
    confirmationHeight: number;
    /**
     * Indicates whether a proof file can be found for the address' asset ID and
     * script key.
     */
    hasProof: boolean;
}
export interface AddrReceivesRequest {
    /** Filter receives by a specific address. Leave empty to get all receives. */
    filterAddr: string;
    /** Filter receives by a specific status. Leave empty to get all receives. */
    filterStatus: AddrEventStatus;
}
export interface AddrReceivesResponse {
    /** The events that match the filter criteria. */
    events: AddrEvent[];
}
export interface SendAssetRequest {
    tapAddrs: string[];
    /** The optional fee rate to use for the minting transaction, in sat/kw. */
    feeRate: number;
}
export interface PrevInputAsset {
    anchorPoint: string;
    assetId: Uint8Array | string;
    scriptKey: Uint8Array | string;
    amount: string;
}
export interface SendAssetResponse {
    transfer: AssetTransfer | undefined;
}
export interface GetInfoRequest {
}
export interface GetInfoResponse {
    version: string;
    lndVersion: string;
    network: string;
    lndIdentityPubkey: string;
    nodeAlias: string;
    blockHeight: number;
    blockHash: string;
    syncToChain: boolean;
}
export interface FetchAssetMetaRequest {
    /** The asset ID of the asset to fetch the meta for. */
    assetId: Uint8Array | string | undefined;
    /** The 32-byte meta hash of the asset meta. */
    metaHash: Uint8Array | string | undefined;
    /** The hex encoded asset ID of the asset to fetch the meta for. */
    assetIdStr: string | undefined;
    /** The hex encoded meta hash of the asset meta. */
    metaHashStr: string | undefined;
}
export interface BurnAssetRequest {
    /** The asset ID of the asset to burn units of. */
    assetId: Uint8Array | string | undefined;
    /** The hex encoded asset ID of the asset to burn units of. */
    assetIdStr: string | undefined;
    amountToBurn: string;
    /**
     * A safety check to ensure the user is aware of the destructive nature of
     * the burn. This needs to be set to the value "assets will be destroyed"
     * for the burn to succeed.
     */
    confirmationText: string;
    /** A note that may contain user defined metadata related to this burn. */
    note: string;
}
export interface BurnAssetResponse {
    /** The asset transfer that contains the asset burn as an output. */
    burnTransfer: AssetTransfer | undefined;
    /** The burn transition proof for the asset burn output. */
    burnProof: DecodedProof | undefined;
}
export interface ListBurnsRequest {
    /** The asset id of the burnt asset. */
    assetId: Uint8Array | string;
    /** The tweaked group key of the group this asset belongs to. */
    tweakedGroupKey: Uint8Array | string;
    /** The txid of the transaction that the burn was anchored to. */
    anchorTxid: Uint8Array | string;
}
export interface AssetBurn {
    /** A note that may contain user defined metadata related to this burn. */
    note: string;
    /** The asset id of the burnt asset. */
    assetId: Uint8Array | string;
    /** The tweaked group key of the group this asset belongs to. */
    tweakedGroupKey: Uint8Array | string;
    /** The amount of burnt assets. */
    amount: string;
    /** The txid of the transaction that the burn was anchored to. */
    anchorTxid: Uint8Array | string;
}
export interface ListBurnsResponse {
    burns: AssetBurn[];
}
export interface OutPoint {
    /** Raw bytes representing the transaction id. */
    txid: Uint8Array | string;
    /** The index of the output on the transaction. */
    outputIndex: number;
}
export interface SubscribeReceiveEventsRequest {
    /**
     * Filter receives by a specific address. Leave empty to get all receive
     * events for all addresses.
     */
    filterAddr: string;
    /**
     * The start time as a Unix timestamp in microseconds. If not set (default
     * value 0), the daemon will start streaming events from the current time.
     */
    startTimestamp: string;
}
export interface ReceiveEvent {
    /** Event creation timestamp (Unix timestamp in microseconds). */
    timestamp: string;
    /** The address that received the asset. */
    address: Addr | undefined;
    /** The outpoint of the transaction that was used to receive the asset. */
    outpoint: string;
    /**
     * The status of the event. If error below is set, then the status is the
     * state that lead to the error during its execution.
     */
    status: AddrEventStatus;
    /**
     * The height of the block the asset receive transaction was mined in. This
     * is only set if the status is ADDR_EVENT_STATUS_TRANSACTION_CONFIRMED or
     * later.
     */
    confirmationHeight: number;
    /** An optional error, indicating that executing the status above failed. */
    error: string;
}
export interface SubscribeSendEventsRequest {
    /**
     * Filter send events by a specific recipient script key. Leave empty to get
     * all receive events for all parcels.
     */
    filterScriptKey: Uint8Array | string;
}
export interface SendEvent {
    /** Execute timestamp (Unix timestamp in microseconds). */
    timestamp: string;
    /**
     * The send state that was executed successfully. If error below is set,
     * then the send_state is the state that lead to the error during its
     * execution.
     */
    sendState: string;
    /** The type of the outbound send parcel. */
    parcelType: ParcelType;
    /**
     * The list of addresses the parcel sends to (recipient addresses only, not
     * including change going back to own wallet). This is only set for parcels
     * of type PARCEL_TYPE_ADDRESS.
     */
    addresses: Addr[];
    /** The virtual packets that are part of the parcel. */
    virtualPackets: Uint8Array | string[];
    /**
     * The passive virtual packets that are carried along with the parcel. This
     * is empty if there were no other assets in the input commitment that is
     * being spent with the "active" virtual packets above.
     */
    passiveVirtualPackets: Uint8Array | string[];
    /**
     * The Bitcoin on-chain anchor transaction that commits the sent assets
     * on-chain. This is only set after the send state SEND_STATE_ANCHOR_SIGN.
     */
    anchorTransaction: AnchorTransaction | undefined;
    /**
     * The final transfer as it will be stored in the database. This is only set
     * after the send state SEND_STATE_LOG_COMMITMENT.
     */
    transfer: AssetTransfer | undefined;
    /** An optional error, indicating that executing the send_state failed. */
    error: string;
}
export interface AnchorTransaction {
    anchorPsbt: Uint8Array | string;
    /** The index of the (added) change output or -1 if no change was left over. */
    changeOutputIndex: number;
    /**
     * The total number of satoshis in on-chain fees paid by the anchor
     * transaction.
     */
    chainFeesSats: string;
    /** The fee rate in sat/kWU that was targeted by the anchor transaction. */
    targetFeeRateSatKw: number;
    /**
     * The list of UTXO lock leases that were acquired for the inputs in the funded
     * PSBT packet from lnd. Only inputs added to the PSBT by this RPC are locked,
     * inputs that were already present in the PSBT are not locked.
     */
    lndLockedUtxos: OutPoint[];
    /** The final, signed anchor transaction that was broadcast to the network. */
    finalTx: Uint8Array | string;
}
export interface TaprootAssets {
    /**
     * tapcli: `assets list`
     * ListAssets lists the set of assets owned by the target daemon.
     */
    listAssets(request?: DeepPartial<ListAssetRequest>): Promise<ListAssetResponse>;
    /**
     * tapcli: `assets utxos`
     * ListUtxos lists the UTXOs managed by the target daemon, and the assets they
     * hold.
     */
    listUtxos(request?: DeepPartial<ListUtxosRequest>): Promise<ListUtxosResponse>;
    /**
     * tapcli: `assets groups`
     * ListGroups lists the asset groups known to the target daemon, and the assets
     * held in each group.
     */
    listGroups(request?: DeepPartial<ListGroupsRequest>): Promise<ListGroupsResponse>;
    /**
     * tapcli: `assets balance`
     * ListBalances lists asset balances
     */
    listBalances(request?: DeepPartial<ListBalancesRequest>): Promise<ListBalancesResponse>;
    /**
     * tapcli: `assets transfers`
     * ListTransfers lists outbound asset transfers tracked by the target daemon.
     */
    listTransfers(request?: DeepPartial<ListTransfersRequest>): Promise<ListTransfersResponse>;
    /**
     * tapcli: `stop`
     * StopDaemon will send a shutdown request to the interrupt handler, triggering
     * a graceful shutdown of the daemon.
     */
    stopDaemon(request?: DeepPartial<StopRequest>): Promise<StopResponse>;
    /**
     * tapcli: `debuglevel`
     * DebugLevel allows a caller to programmatically set the logging verbosity of
     * tapd. The logging can be targeted according to a coarse daemon-wide logging
     * level, or in a granular fashion to specify the logging for a target
     * sub-system.
     */
    debugLevel(request?: DeepPartial<DebugLevelRequest>): Promise<DebugLevelResponse>;
    /**
     * tapcli: `addrs query`
     * QueryAddrs queries the set of Taproot Asset addresses stored in the
     * database.
     */
    queryAddrs(request?: DeepPartial<QueryAddrRequest>): Promise<QueryAddrResponse>;
    /**
     * tapcli: `addrs new`
     * NewAddr makes a new address from the set of request params.
     */
    newAddr(request?: DeepPartial<NewAddrRequest>): Promise<Addr>;
    /**
     * tapcli: `addrs decode`
     * DecodeAddr decode a Taproot Asset address into a partial asset message that
     * represents the asset it wants to receive.
     */
    decodeAddr(request?: DeepPartial<DecodeAddrRequest>): Promise<Addr>;
    /**
     * tapcli: `addrs receives`
     * List all receives for incoming asset transfers for addresses that were
     * created previously.
     */
    addrReceives(request?: DeepPartial<AddrReceivesRequest>): Promise<AddrReceivesResponse>;
    /**
     * tapcli: `proofs verify`
     * VerifyProof attempts to verify a given proof file that claims to be anchored
     * at the specified genesis point.
     */
    verifyProof(request?: DeepPartial<ProofFile>): Promise<VerifyProofResponse>;
    /**
     * tapcli: `proofs decode`
     * DecodeProof attempts to decode a given proof file into human readable
     * format.
     */
    decodeProof(request?: DeepPartial<DecodeProofRequest>): Promise<DecodeProofResponse>;
    /**
     * tapcli: `proofs export`
     * ExportProof exports the latest raw proof file anchored at the specified
     * script_key.
     */
    exportProof(request?: DeepPartial<ExportProofRequest>): Promise<ProofFile>;
    /**
     * tapcli: `assets send`
     * SendAsset uses one or multiple passed Taproot Asset address(es) to attempt
     * to complete an asset send. The method returns information w.r.t the on chain
     * send, as well as the proof file information the receiver needs to fully
     * receive the asset.
     */
    sendAsset(request?: DeepPartial<SendAssetRequest>): Promise<SendAssetResponse>;
    /**
     * tapcli: `assets burn`
     * BurnAsset burns the given number of units of a given asset by sending them
     * to a provably un-spendable script key. Burning means irrevocably destroying
     * a certain number of assets, reducing the total supply of the asset. Because
     * burning is such a destructive and non-reversible operation, some specific
     * values need to be set in the request to avoid accidental burns.
     */
    burnAsset(request?: DeepPartial<BurnAssetRequest>): Promise<BurnAssetResponse>;
    /**
     * tapcli: `assets listburns`
     * ListBurns lists the asset burns that this wallet has performed. These assets
     * are not recoverable in any way. Filters may be applied to return more
     * specific results.
     */
    listBurns(request?: DeepPartial<ListBurnsRequest>): Promise<ListBurnsResponse>;
    /**
     * tapcli: `getinfo`
     * GetInfo returns the information for the node.
     */
    getInfo(request?: DeepPartial<GetInfoRequest>): Promise<GetInfoResponse>;
    /**
     * tapcli: `assets meta`
     * FetchAssetMeta allows a caller to fetch the reveal meta data for an asset
     * either by the asset ID for that asset, or a meta hash.
     */
    fetchAssetMeta(request?: DeepPartial<FetchAssetMetaRequest>): Promise<AssetMeta>;
    /**
     * tapcli: `events receive`
     * SubscribeReceiveEvents allows a caller to subscribe to receive events for
     * incoming asset transfers.
     */
    subscribeReceiveEvents(request?: DeepPartial<SubscribeReceiveEventsRequest>, onMessage?: (msg: ReceiveEvent) => void, onError?: (err: Error) => void): void;
    /**
     * tapcli: `events send`
     * SubscribeSendEvents allows a caller to subscribe to send events for outgoing
     * asset transfers.
     */
    subscribeSendEvents(request?: DeepPartial<SubscribeSendEventsRequest>, onMessage?: (msg: SendEvent) => void, onError?: (err: Error) => void): void;
}
declare type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
declare type DeepPartial<T> = T extends Builtin ? T : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
export {};
//# sourceMappingURL=taprootassets.d.ts.map